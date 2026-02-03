package admin

import (
	"log"
	"net/http"
	"strconv"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
=========================
  VEHICLE GROUP HANDLERS
=========================
*/

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

// GroupVehicle - vehicle in a group
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
			   (SELECT COUNT(*) FROM vehicles v WHERE v.group_id = vg.id AND v.vehicle_type = 'BATTERY_VEHICLE') as vehicle_count,
			   DATE_FORMAT(vg.valid_from, '%d-%m-%Y'),
			   DATE_FORMAT(vg.valid_to, '%d-%m-%Y'),
			   DATE_FORMAT(vg.created_at, '%Y-%m-%d %H:%i:%s'),
			   DATE_FORMAT(vg.updated_at, '%Y-%m-%d %H:%i:%s')
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
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group name is required"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO vehicle_groups (name, description, valid_from, valid_to)
		VALUES (?, ?, ?, ?)
	`, req.Name, req.Description, req.ValidFrom, req.ValidTo)

	if err != nil {
		log.Printf("Create vehicle group error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating vehicle group"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Vehicle group created successfully"})
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
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err = config.DB.Exec(`
		UPDATE vehicle_groups 
		SET name = ?, description = ?, valid_from = ?, valid_to = ?
		WHERE id = ?
	`, req.Name, req.Description, req.ValidFrom, req.ValidTo, id)

	if err != nil {
		log.Printf("Update vehicle group error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating vehicle group"})
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

	// First, unassign all vehicles from this group
	_, err = config.DB.Exec("UPDATE vehicles SET group_id = NULL WHERE group_id = ?", id)
	if err != nil {
		log.Printf("Unassign vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error unassigning vehicles"})
		return
	}

	// Then delete the group
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
			   (SELECT COUNT(*) FROM vehicles v WHERE v.group_id = vg.id AND v.vehicle_type = 'BATTERY_VEHICLE') as vehicle_count,
			   DATE_FORMAT(vg.valid_from, '%d-%m-%Y'),
			   DATE_FORMAT(vg.valid_to, '%d-%m-%Y'),
			   DATE_FORMAT(vg.created_at, '%Y-%m-%d %H:%i:%s'),
			   DATE_FORMAT(vg.updated_at, '%Y-%m-%d %H:%i:%s')
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

	// Get vehicles in this group
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.group_id
		FROM vehicles v
		WHERE v.group_id = ? AND v.vehicle_type = 'BATTERY_VEHICLE'
		ORDER BY v.vehicle_number
	`, id)

	if err != nil {
		log.Printf("Get group vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching group vehicles"})
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

	c.JSON(http.StatusOK, gin.H{
		"group":    group,
		"vehicles": vehicles,
	})
}

/*
=========================
  POST /api/admin/vehicle-groups/:id/assign-vehicles
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
		VehicleIDs []int `json:"vehicle_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if len(req.VehicleIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No vehicles selected"})
		return
	}

	// Assign vehicles to group
	for _, vehicleID := range req.VehicleIDs {
		_, err := config.DB.Exec("UPDATE vehicles SET group_id = ? WHERE id = ? AND vehicle_type = 'BATTERY_VEHICLE'", groupID, vehicleID)
		if err != nil {
			log.Printf("Assign vehicle error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error assigning vehicles"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicles assigned successfully"})
}

/*
=========================
  POST /api/admin/vehicle-groups/:id/remove-vehicle
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

	_, err = config.DB.Exec("UPDATE vehicles SET group_id = NULL WHERE id = ? AND group_id = ?", req.VehicleID, groupID)
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
  Get all EV vehicles not assigned to any group
=========================
*/
func GetUnassignedEVVehicles(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.group_id
		FROM vehicles v
		WHERE v.vehicle_type = 'BATTERY_VEHICLE' AND v.group_id IS NULL
		ORDER BY v.vehicle_number
	`)

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
