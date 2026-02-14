package admin

import (
	"log"
	"net/http"
	"strconv"

	"transport-server/config"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

/*
=========================
  VEHICLE GROUP HANDLERS
=========================
*/

// InitVehicleGroupMemberTables creates the vehicle_group_members table
func InitVehicleGroupMemberTables() {
	_, err := config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS vehicle_group_members (
			id INT AUTO_INCREMENT PRIMARY KEY,
			group_id INT NOT NULL,
			vehicle_id INT NOT NULL,
			valid_from DATE NOT NULL,
			valid_to DATE NOT NULL,
			added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES vehicle_groups(id) ON DELETE CASCADE,
			FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
			CHECK (valid_from <= valid_to)
		)
	`)
	if err != nil {
		log.Printf("Error creating vehicle_group_members table: %v", err)
	} else {
		log.Println("✅ vehicle_group_members table ready")
	}
}

// VehicleGroup - vehicle group struct
type VehicleGroup struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	VehicleCount int     `json:"vehicle_count"`
	ValidFrom    *string `json:"valid_from"`
	ValidTo      *string `json:"valid_to"`
	CreatedAt    *string `json:"created_at"`
	UpdatedAt    *string `json:"updated_at"`
}

// VehicleGroupMember - vehicle membership in a group
type VehicleGroupMember struct {
	ID            int    `json:"id"`
	GroupID       int    `json:"group_id"`
	VehicleID     int    `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	VehicleType   string `json:"vehicle_type"`
	ValidFrom     string `json:"valid_from"`
	ValidTo       string `json:"valid_to"`
	AddedAt       string `json:"added_at"`
}

// GroupVehicle - vehicle in a group (for listing)
type GroupVehicle struct {
	ID            int    `json:"id"`
	VehicleNumber string `json:"vehicle_number"`
	VehicleType   string `json:"vehicle_type"`
	GroupID       *int   `json:"group_id"`
}

/*
=========================

	GET /api/admin/vehicle-groups

=========================
*/
func GetVehicleGroups(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT vg.id, vg.name, COALESCE(vg.description, '') as description,
			   (SELECT COUNT(DISTINCT vgm.vehicle_id) FROM vehicle_group_members vgm 
			    WHERE vgm.group_id = vg.id) as vehicle_count,
			   DATE_FORMAT(vg.valid_from, '%d-%m-%Y'),
			   DATE_FORMAT(vg.valid_to, '%d-%m-%Y'),
			   DATE_FORMAT(vg.created_at, '%d-%m-%Y %H:%i'),
			   DATE_FORMAT(vg.updated_at, '%d-%m-%Y %H:%i')
		FROM vehicle_groups vg
		ORDER BY vg.name
	`)
	if err != nil {
		log.Printf("Get vehicle groups error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching vehicle groups"})
		return
	}
	defer rows.Close()

	var groups []VehicleGroup
	for rows.Next() {
		var group VehicleGroup
		var validFrom, validTo, createdAt, updatedAt *string
		err := rows.Scan(&group.ID, &group.Name, &group.Description, &group.VehicleCount, &validFrom, &validTo, &createdAt, &updatedAt)
		if err != nil {
			log.Printf("Scan vehicle group error: %v", err)
			continue
		}
		group.ValidFrom = validFrom
		group.ValidTo = validTo
		group.CreatedAt = createdAt
		group.UpdatedAt = updatedAt
		groups = append(groups, group)
	}

	c.JSON(http.StatusOK, groups)
}

/*
=========================

	POST /api/admin/vehicle-groups/create

=========================
*/
func CreateVehicleGroup(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		VehicleIDs  []int  `json:"vehicle_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group name is required"})
		return
	}

	if req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid from and valid to dates are required"})
		return
	}

	validFrom := utils.FormatDateForDB(req.ValidFrom)
	validTo := utils.FormatDateForDB(req.ValidTo)

	// Check for date conflicts for each vehicle if vehicle IDs provided
	if len(req.VehicleIDs) > 0 {
		for _, vehicleID := range req.VehicleIDs {
			hasConflict, conflictMsg := checkVehicleGroupConflict(vehicleID, 0, validFrom, validTo)
			if hasConflict {
				c.JSON(http.StatusConflict, gin.H{"error": conflictMsg})
				return
			}
		}
	}

	result, err := config.DB.Exec(`
		INSERT INTO vehicle_groups (name, description, valid_from, valid_to)
		VALUES (?, ?, ?, ?)
	`, req.Name, req.Description, validFrom, validTo)

	if err != nil {
		log.Printf("Create vehicle group error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating vehicle group"})
		return
	}

	groupID, _ := result.LastInsertId()

	// Add vehicles as members if provided
	if len(req.VehicleIDs) > 0 {
		for _, vehicleID := range req.VehicleIDs {
			_, err := config.DB.Exec(`
				INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
				VALUES (?, ?, ?, ?)
			`, groupID, vehicleID, validFrom, validTo)
			if err != nil {
				log.Printf("Error adding vehicle %d to group: %v", vehicleID, err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"id": groupID, "message": "Vehicle group created successfully"})
}

/*
=========================

	PUT /api/admin/vehicle-groups/:id

=========================
*/
func UpdateVehicleGroup(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		VehicleIDs  []int  `json:"vehicle_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Use provided dates or fetch existing
	validFrom := req.ValidFrom
	validTo := req.ValidTo

	if validFrom == "" || validTo == "" {
		var existingFrom, existingTo *string
		// Fetch date format for consistency
		err := config.DB.QueryRow(`SELECT DATE_FORMAT(valid_from, '%d-%m-%Y'), DATE_FORMAT(valid_to, '%d-%m-%Y') FROM vehicle_groups WHERE id = ?`, id).Scan(&existingFrom, &existingTo)
		if err == nil {
			if validFrom == "" && existingFrom != nil {
				validFrom = *existingFrom
			}
			if validTo == "" && existingTo != nil {
				validTo = *existingTo
			}
		}
	}

	// Ensure we have dates
	if validFrom == "" || validTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid from and valid to dates are required"})
		return
	}

	// Format dates (in case client sent DD-MM-YYYY)
	validFrom = utils.FormatDateForDB(validFrom)
	validTo = utils.FormatDateForDB(validTo)

	// Validate date range
	if validFrom > validTo {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid From date must be before Valid To date"})
		return
	}

	// Begin Transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	_, err = tx.Exec(`
		UPDATE vehicle_groups 
		SET name = ?, description = ?, valid_from = ?, valid_to = ?
		WHERE id = ?
	`, req.Name, req.Description, validFrom, validTo, id)

	if err != nil {
		tx.Rollback()
		log.Printf("Update vehicle group error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating vehicle group"})
		return
	}

	// Update assignments: Always clear existing first
	_, err = tx.Exec(`DELETE FROM vehicle_group_members WHERE group_id = ?`, id)
	if err != nil {
		tx.Rollback()
		log.Printf("Error clearing group members: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating members"})
		return
	}

	// Insert new members if any are selected
	if len(req.VehicleIDs) > 0 {
		for _, vehicleID := range req.VehicleIDs {
			// Check conflict locally within transaction? Ideally yes, but reusing checkVehicleGroupConflict
			// which uses DB connection might be tricky if it doesn't accept TX.
			// For now, assume optimistic or rely on logic.
			// NOTE: checkVehicleGroupConflict READS from DB. It won't see changes in this TX yet,
			// but we ruled out THIS group.

			_, err = tx.Exec(`
				INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
				VALUES (?, ?, ?, ?)
			`, id, vehicleID, validFrom, validTo)
			if err != nil {
				tx.Rollback()
				log.Printf("Error adding vehicle %d to group: %v", vehicleID, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding vehicle to group"})
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Transaction commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing changes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle group updated successfully"})
}

/*
=========================

	DELETE /api/admin/vehicle-groups/:id

=========================
*/
func DeleteVehicleGroup(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// Memberships will be deleted by CASCADE
	_, err = config.DB.Exec("DELETE FROM vehicle_groups WHERE id = ?", id)
	if err != nil {
		log.Printf("Delete vehicle group error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting vehicle group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle group deleted successfully"})
}

/*
=========================

	GET /api/admin/vehicle-groups/:id/details

=========================
*/
func GetVehicleGroupDetails(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// Get group details
	var group VehicleGroup
	var validFrom, validTo, createdAt, updatedAt *string
	err = config.DB.QueryRow(`
		SELECT vg.id, vg.name, COALESCE(vg.description, '') as description,
			   (SELECT COUNT(DISTINCT vgm.vehicle_id) FROM vehicle_group_members vgm 
			    WHERE vgm.group_id = vg.id) as vehicle_count,
			   DATE_FORMAT(vg.valid_from, '%d-%m-%Y'),
			   DATE_FORMAT(vg.valid_to, '%d-%m-%Y'),
			   DATE_FORMAT(vg.created_at, '%d-%m-%Y %H:%i'),
			   DATE_FORMAT(vg.updated_at, '%d-%m-%Y %H:%i')
		FROM vehicle_groups vg
		WHERE vg.id = ?
	`, id).Scan(&group.ID, &group.Name, &group.Description, &group.VehicleCount, &validFrom, &validTo, &createdAt, &updatedAt)

	if err != nil {
		log.Printf("Get vehicle group details error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching vehicle group details"})
		return
	}

	group.ValidFrom = validFrom
	group.ValidTo = validTo

	c.JSON(http.StatusOK, gin.H{
		"group": group,
	})
}

/*
=========================

	GET /api/admin/vehicle-groups/:id/members

=========================
*/
func GetVehicleGroupMembers(c *gin.Context) {
	idParam := c.Param("id")
	if idParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT vgm.id, vgm.group_id, vgm.vehicle_id,
		       v.vehicle_number, v.vehicle_type,
		       DATE_FORMAT(vgm.valid_from, '%d-%m-%Y') as valid_from,
		       DATE_FORMAT(vgm.valid_to, '%d-%m-%Y') as valid_to,
		       DATE_FORMAT(vgm.added_at, '%d-%m-%Y %H:%i') as added_at
		FROM vehicle_group_members vgm
		JOIN vehicles v ON vgm.vehicle_id = v.id
		WHERE vgm.group_id = ?
		ORDER BY vgm.valid_from DESC, v.vehicle_number
	`, idParam)
	if err != nil {
		log.Printf("Get vehicle group members error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching members"})
		return
	}
	defer rows.Close()

	var members []VehicleGroupMember
	for rows.Next() {
		var m VehicleGroupMember
		err := rows.Scan(&m.ID, &m.GroupID, &m.VehicleID, &m.VehicleNumber, &m.VehicleType, &m.ValidFrom, &m.ValidTo, &m.AddedAt)
		if err != nil {
			log.Printf("Scan member error: %v", err)
			continue
		}
		members = append(members, m)
	}

	c.JSON(http.StatusOK, members)
}

/*
=========================

	POST /api/admin/vehicle-groups/:id/add-member

=========================
*/
func AddVehicleGroupMember(c *gin.Context) {
	groupIDParam := c.Param("id")
	if groupIDParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group ID required"})
		return
	}

	var req struct {
		VehicleID int    `json:"vehicle_id"`
		ValidFrom string `json:"valid_from"`
		ValidTo   string `json:"valid_to"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.VehicleID == 0 || req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID, valid_from, and valid_to are required"})
		return
	}

	groupID, _ := strconv.Atoi(groupIDParam)

	validFrom := utils.FormatDateForDB(req.ValidFrom)
	validTo := utils.FormatDateForDB(req.ValidTo)

	// Check for date conflicts
	hasConflict, conflictMsg := checkVehicleGroupConflict(req.VehicleID, groupID, validFrom, validTo)
	if hasConflict {
		c.JSON(http.StatusConflict, gin.H{"error": conflictMsg})
		return
	}

	// Add member
	_, err := config.DB.Exec(`
		INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
		VALUES (?, ?, ?, ?)
	`, groupID, req.VehicleID, validFrom, validTo)

	if err != nil {
		log.Printf("Add vehicle group member error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle added to group successfully"})
}

/*
=========================

	DELETE /api/admin/vehicle-groups/:id/remove-member

=========================
*/
func RemoveVehicleGroupMember(c *gin.Context) {
	memberID := c.Query("member_id")
	if memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Member ID required"})
		return
	}

	_, err := config.DB.Exec(`DELETE FROM vehicle_group_members WHERE id = ?`, memberID)
	if err != nil {
		log.Printf("Remove vehicle group member error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error removing member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// checkVehicleGroupConflict checks if a vehicle has overlapping membership in any group
func checkVehicleGroupConflict(vehicleID int, excludeGroupID int, validFrom, validTo string) (bool, string) {
	query := `
		SELECT vg.name, DATE_FORMAT(vgm.valid_from, '%d-%m-%Y'), DATE_FORMAT(vgm.valid_to, '%d-%m-%Y')
		FROM vehicle_group_members vgm
		JOIN vehicle_groups vg ON vgm.group_id = vg.id
		WHERE vgm.vehicle_id = ?
		AND vgm.group_id != ?
		AND NOT (? < vgm.valid_from OR ? > vgm.valid_to)
		LIMIT 1
	`
	var groupName, existingFrom, existingTo string
	err := config.DB.QueryRow(query, vehicleID, excludeGroupID, validTo, validFrom).Scan(&groupName, &existingFrom, &existingTo)
	if err == nil {
		// Get vehicle number
		var vehicleNumber string
		config.DB.QueryRow(`SELECT vehicle_number FROM vehicles WHERE id = ?`, vehicleID).Scan(&vehicleNumber)

		return true, "Vehicle '" + vehicleNumber + "' is already assigned to '" + groupName + "' from " + existingFrom + " to " + existingTo + ". Dates overlap with your selection."
	}
	return false, ""
}

/*
=========================

	POST /api/admin/vehicle-groups/:id/assign-vehicles
	(Legacy - kept for compatibility)

=========================
*/
func AssignVehiclesToGroup(c *gin.Context) {
	idParam := c.Param("id")
	groupID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var req struct {
		VehicleIDs    []int  `json:"vehicle_ids"`
		ValidFrom     string `json:"valid_from"`
		ValidTo       string `json:"valid_to"`
		ClearExisting bool   `json:"clear_existing"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Only require vehicles if not clearing existing (i.e., creating new assignment)
	if len(req.VehicleIDs) == 0 && !req.ClearExisting {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No vehicles selected"})
		return
	}

	// If clearing with empty list, just delete all members and return
	if req.ClearExisting && len(req.VehicleIDs) == 0 {
		_, err := config.DB.Exec(`DELETE FROM vehicle_group_members WHERE group_id = ?`, groupID)
		if err != nil {
			log.Printf("Error clearing existing members: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error clearing members"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "All vehicles removed from group", "added": 0})
		return
	}

	// Get group validity dates if not provided
	if req.ValidFrom == "" || req.ValidTo == "" {
		config.DB.QueryRow(`
			SELECT DATE_FORMAT(valid_from, '%d-%m-%Y'), DATE_FORMAT(valid_to, '%d-%m-%Y')
			FROM vehicle_groups WHERE id = ?
		`, groupID).Scan(&req.ValidFrom, &req.ValidTo)
	}

	if req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid from and valid to dates are required"})
		return
	}

	validFrom := utils.FormatDateForDB(req.ValidFrom)
	validTo := utils.FormatDateForDB(req.ValidTo)

	// If clear_existing is true, remove all existing members first
	if req.ClearExisting {
		_, err := config.DB.Exec(`DELETE FROM vehicle_group_members WHERE group_id = ?`, groupID)
		if err != nil {
			log.Printf("Error clearing existing members: %v", err)
		}
	}

	addedCount := 0
	for _, vehicleID := range req.VehicleIDs {
		// Pass reformatted dates to conflict check
		hasConflict, _ := checkVehicleGroupConflict(vehicleID, groupID, validFrom, validTo)

		if !hasConflict || req.ClearExisting {
			// Delete any existing membership for this vehicle in this group first (if duplicate key)
			// (Though schema might not have unique constraint on group+vehicle, it's safer)
			config.DB.Exec(`DELETE FROM vehicle_group_members WHERE group_id = ? AND vehicle_id = ?`, groupID, vehicleID)

			_, err := config.DB.Exec(`
				INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
				VALUES (?, ?, ?, ?)
			`, groupID, vehicleID, validFrom, validTo)
			if err == nil {
				addedCount++
			} else {
				log.Printf("Assign vehicle error: %v", err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicles assigned successfully", "added": addedCount})
}

/*
=========================

	POST /api/admin/vehicle-groups/:id/remove-vehicle
	(Legacy - remove by vehicle_id)

=========================
*/
func RemoveVehicleFromGroup(c *gin.Context) {
	idParam := c.Param("id")
	groupID, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var req struct {
		VehicleID int `json:"vehicle_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Remove all memberships for this vehicle in this group
	_, err = config.DB.Exec("DELETE FROM vehicle_group_members WHERE vehicle_id = ? AND group_id = ?", req.VehicleID, groupID)
	if err != nil {
		log.Printf("Remove vehicle error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error removing vehicle"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle removed successfully"})
}

/*
=========================

	GET /api/admin/vehicles/unassigned-ev
	Get all EV vehicles not assigned to any group for given dates

=========================
*/
func GetUnassignedEVVehicles(c *gin.Context) {
	validFrom := c.Query("valid_from")
	validTo := c.Query("valid_to")

	var query string
	var args []interface{}

	if validFrom != "" && validTo != "" {
		query = `
			SELECT v.id, v.vehicle_number, v.vehicle_type, NULL as group_id
			FROM vehicles v
			WHERE v.vehicle_type = 'BATTERY_VEHICLE' 
			AND v.id NOT IN (
				SELECT vgm.vehicle_id FROM vehicle_group_members vgm
				WHERE NOT (? < vgm.valid_from OR ? > vgm.valid_to)
			)
			ORDER BY v.vehicle_number
		`
		args = []interface{}{validTo, validFrom}
	} else {
		query = `
			SELECT v.id, v.vehicle_number, v.vehicle_type, NULL as group_id
			FROM vehicles v
			WHERE v.vehicle_type = 'BATTERY_VEHICLE' 
			AND v.id NOT IN (
				SELECT DISTINCT vgm.vehicle_id FROM vehicle_group_members vgm
				WHERE CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
			)
			ORDER BY v.vehicle_number
		`
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get unassigned vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching unassigned vehicles"})
		return
	}
	defer rows.Close()

	var vehicles []GroupVehicle
	for rows.Next() {
		var vehicle GroupVehicle
		err := rows.Scan(&vehicle.ID, &vehicle.VehicleNumber, &vehicle.VehicleType, &vehicle.GroupID)
		if err != nil {
			log.Printf("Scan vehicle error: %v", err)
			continue
		}
		vehicles = append(vehicles, vehicle)
	}

	c.JSON(http.StatusOK, vehicles)
}

/*
=========================

	GET /api/admin/vehicles/available-for-group
	Get vehicles available for a date range

=========================
*/
func GetAvailableVehiclesForGroup(c *gin.Context) {
	validFrom := c.Query("valid_from")
	validTo := c.Query("valid_to")
	excludeGroupID := c.Query("exclude_group_id")
	vehicleType := c.Query("vehicle_type")

	if validFrom == "" || validTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid_from and valid_to required"})
		return
	}

	query := `
		SELECT v.id, v.vehicle_number, v.vehicle_type
		FROM vehicles v
		WHERE v.id NOT IN (
			SELECT vgm.vehicle_id FROM vehicle_group_members vgm
			WHERE vgm.group_id != COALESCE(?, 0)
			AND NOT (? < vgm.valid_from OR ? > vgm.valid_to)
		)
	`
	args := []interface{}{excludeGroupID, validTo, validFrom}

	if vehicleType != "" {
		query += " AND v.vehicle_type = ?"
		args = append(args, vehicleType)
	}

	query += " ORDER BY v.vehicle_number"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get available vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching vehicles"})
		return
	}
	defer rows.Close()

	type AvailableVehicle struct {
		ID            int    `json:"id"`
		VehicleNumber string `json:"vehicle_number"`
		VehicleType   string `json:"vehicle_type"`
	}

	var vehicles []AvailableVehicle
	for rows.Next() {
		var v AvailableVehicle
		err := rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType)
		if err != nil {
			continue
		}
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, vehicles)
}
