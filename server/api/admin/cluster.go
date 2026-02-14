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
	  CLUSTER HANDLERS
	=========================
*/

// InitClusterMemberTables creates the driver_cluster_members table
func InitClusterMemberTables() {
	_, err := config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS driver_cluster_members (
			id INT AUTO_INCREMENT PRIMARY KEY,
			cluster_id INT NOT NULL,
			driver_id INT NOT NULL,
			valid_from DATE NOT NULL,
			valid_to DATE NOT NULL,
			added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (cluster_id) REFERENCES driver_clusters(id) ON DELETE CASCADE,
			FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
			CHECK (valid_from <= valid_to)
		)
	`)
	if err != nil {
		log.Printf("Error creating driver_cluster_members table: %v", err)
	} else {
		log.Println("✅ driver_cluster_members table ready")
	}
}

// DriverCluster - cluster struct
type DriverCluster struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	DriverCount int     `json:"driver_count"`
	ValidFrom   *string `json:"valid_from"`
	ValidTo     *string `json:"valid_to"`
}

// ClusterMember - driver membership in a cluster
type ClusterMember struct {
	ID         int    `json:"id"`
	ClusterID  int    `json:"cluster_id"`
	DriverID   int    `json:"driver_id"`
	DriverName string `json:"driver_name"`
	ValidFrom  string `json:"valid_from"`
	ValidTo    string `json:"valid_to"`
	AddedAt    string `json:"added_at"`
}

// ClusterDriver - driver in a cluster (for listing)
type ClusterDriver struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	ClusterID *int   `json:"cluster_id"`
	Status    string `json:"status"`
}

/*
=========================

	GET /api/admin/clusters

=========================
*/
func GetClusters(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT c.id, c.name, COALESCE(c.description, '') as description, 
			   (SELECT COUNT(DISTINCT dcm.driver_id) FROM driver_cluster_members dcm 
			    WHERE dcm.cluster_id = c.id) as driver_count,
			   DATE_FORMAT(c.valid_from, '%d-%m-%Y'), 
			   DATE_FORMAT(c.valid_to, '%d-%m-%Y')
		FROM driver_clusters c
		ORDER BY c.name
	`)
	if err != nil {
		log.Printf("Get clusters error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching clusters"})
		return
	}
	defer rows.Close()

	type ClusterResponse struct {
		ID          int     `json:"id"`
		Name        string  `json:"name"`
		Description string  `json:"description"`
		DriverCount int     `json:"driver_count"`
		ValidFrom   *string `json:"valid_from"`
		ValidTo     *string `json:"valid_to"`
	}

	var clusters []ClusterResponse
	for rows.Next() {
		var cluster ClusterResponse
		var validFrom, validTo *string
		err := rows.Scan(&cluster.ID, &cluster.Name, &cluster.Description, &cluster.DriverCount,
			&validFrom, &validTo)
		if err != nil {
			log.Printf("Scan cluster error: %v", err)
			continue
		}
		cluster.ValidFrom = validFrom
		cluster.ValidTo = validTo
		clusters = append(clusters, cluster)
	}

	c.JSON(http.StatusOK, clusters)
}

/*
=========================

	GET /api/admin/clusters/:id/members
	Get all members of a cluster

=========================
*/
func GetClusterMembers(c *gin.Context) {
	clusterID := c.Param("id")
	if clusterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cluster ID required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT dcm.id, dcm.cluster_id, dcm.driver_id, 
		       COALESCE(u.full_name, '') as driver_name,
		       DATE_FORMAT(dcm.valid_from, '%d-%m-%Y') as valid_from,
		       DATE_FORMAT(dcm.valid_to, '%d-%m-%Y') as valid_to,
		       DATE_FORMAT(dcm.added_at, '%d-%m-%Y %H:%i') as added_at
		FROM driver_cluster_members dcm
		JOIN drivers d ON dcm.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE dcm.cluster_id = ?
		ORDER BY dcm.valid_from DESC, u.full_name
	`, clusterID)
	if err != nil {
		log.Printf("Get cluster members error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching members"})
		return
	}
	defer rows.Close()

	var members []ClusterMember
	for rows.Next() {
		var m ClusterMember
		err := rows.Scan(&m.ID, &m.ClusterID, &m.DriverID, &m.DriverName, &m.ValidFrom, &m.ValidTo, &m.AddedAt)
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

	POST /api/admin/clusters/create

=========================
*/
func CreateCluster(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO driver_clusters (name, description)
		VALUES (?, ?)
	`, req.Name, req.Description)

	if err != nil {
		log.Printf("Create cluster error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating cluster"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Cluster created"})
}

/*
=========================

	POST /api/admin/clusters/create-with-schedule
	Unified form: create cluster + validity + assign drivers

=========================
*/
func CreateClusterWithSchedule(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		DriverIDs   []int  `json:"driver_ids"`
		Force       bool   `json:"force"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group name is required"})
		return
	}

	if len(req.DriverIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one driver must be selected"})
		return
	}

	if req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid from and valid to dates are required"})
		return
	}

	// Check for conflicts
	var warnings []string
	for _, driverID := range req.DriverIDs {
		hasConflict, conflictMsg := checkDriverClusterConflict(driverID, 0, req.ValidFrom, req.ValidTo)
		if hasConflict {
			warnings = append(warnings, conflictMsg)
		}
	}

	// If conflicts exist and not forced, return conflicts for confirmation
	if len(warnings) > 0 && !req.Force {
		c.JSON(http.StatusConflict, gin.H{"conflicts": warnings})
		return
	}

	// Create the cluster with schedule info
	result, err := config.DB.Exec(`
		INSERT INTO driver_clusters (name, description, valid_from, valid_to)
		VALUES (?, ?, ?, ?)
	`, req.Name, req.Description, req.ValidFrom, req.ValidTo)

	if err != nil {
		log.Printf("Create cluster with schedule error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating driver group"})
		return
	}

	clusterID, _ := result.LastInsertId()

	// Add all selected drivers as members with the specified date range
	for _, driverID := range req.DriverIDs {
		_, err := config.DB.Exec(`
			INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
			VALUES (?, ?, ?, ?)
		`, clusterID, driverID, req.ValidFrom, req.ValidTo)
		if err != nil {
			log.Printf("Error adding driver %d to cluster: %v", driverID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            clusterID,
		"message":       "Driver group created successfully",
		"drivers_added": len(req.DriverIDs),
	})
}

/*
=========================

	POST /api/admin/clusters/update
	Update cluster details

=========================
*/
func UpdateCluster(c *gin.Context) {
	var req struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		DriverIDs   []int  `json:"driver_ids"`
		Force       bool   `json:"force"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get cluster valid dates (use provided or fetch existing)
	validFrom := req.ValidFrom
	validTo := req.ValidTo

	// If no dates provided, get existing dates from cluster
	if validFrom == "" || validTo == "" {
		var existingFrom, existingTo *string
		err := config.DB.QueryRow(`SELECT DATE_FORMAT(valid_from, '%d-%m-%Y'), DATE_FORMAT(valid_to, '%d-%m-%Y') FROM driver_clusters WHERE id = ?`, req.ID).Scan(&existingFrom, &existingTo)
		if err == nil {
			if validFrom == "" && existingFrom != nil {
				validFrom = *existingFrom
			}
			if validTo == "" && existingTo != nil {
				validTo = *existingTo
			}
		}
		// Default to current year if still empty
		if validFrom == "" {
			validFrom = "2024-01-01"
		}
		if validTo == "" {
			validTo = "2025-12-31"
		}
	}

	// Update cluster details
	_, err := config.DB.Exec(`
		UPDATE driver_clusters 
		SET name=?, description=?, valid_from=?, valid_to=?
		WHERE id=?
	`, req.Name, req.Description, validFrom, validTo, req.ID)

	if err != nil {
		log.Printf("Update cluster error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating driver group"})
		return
	}

	// Check for conflicts before modifying members
	var warnings []string
	for _, driverID := range req.DriverIDs {
		hasConflict, conflictMsg := checkDriverClusterConflict(driverID, req.ID, validFrom, validTo)
		if hasConflict {
			warnings = append(warnings, conflictMsg)
		}
	}

	// If conflicts exist and not forced, return conflicts for confirmation
	if len(warnings) > 0 && !req.Force {
		c.JSON(http.StatusConflict, gin.H{"conflicts": warnings})
		return
	}

	// Update driver assignments in driver_cluster_members table (clear first, then assign new ones)
	_, err = config.DB.Exec(`DELETE FROM driver_cluster_members WHERE cluster_id = ?`, req.ID)
	if err != nil {
		log.Printf("Error clearing cluster members: %v", err)
	}

	// Insert new driver memberships
	for _, driverID := range req.DriverIDs {
		_, err = config.DB.Exec(`
			INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
			VALUES (?, ?, ?, ?)
		`, req.ID, driverID, validFrom, validTo)
		if err != nil {
			log.Printf("Error adding driver %d to cluster: %v", driverID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver group updated successfully"})
}

/*
=========================

	POST /api/admin/clusters/:id/add-member
	Add a driver to a cluster with date range

=========================
*/
func AddClusterMember(c *gin.Context) {
	clusterID := c.Param("id")
	if clusterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cluster ID required"})
		return
	}

	var req struct {
		DriverID  int    `json:"driver_id"`
		ValidFrom string `json:"valid_from"`
		ValidTo   string `json:"valid_to"`
		Force     bool   `json:"force"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.DriverID == 0 || req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver ID, valid_from, and valid_to are required"})
		return
	}

	clusterIDInt, _ := strconv.Atoi(clusterID)

	// Check for conflicts
	hasConflict, conflictMsg := checkDriverClusterConflict(req.DriverID, clusterIDInt, req.ValidFrom, req.ValidTo)
	if hasConflict && !req.Force {
		c.JSON(http.StatusConflict, gin.H{"conflicts": []string{conflictMsg}})
		return
	}

	// Add member
	_, err := config.DB.Exec(`
		INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
		VALUES (?, ?, ?, ?)
	`, clusterID, req.DriverID, req.ValidFrom, req.ValidTo)

	if err != nil {
		log.Printf("Add cluster member error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver added to group successfully"})
}

/*
=========================

	DELETE /api/admin/clusters/:id/remove-member
	Remove a driver membership from cluster

=========================
*/
func RemoveClusterMember(c *gin.Context) {
	memberID := c.Query("member_id")
	if memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Member ID required"})
		return
	}

	_, err := config.DB.Exec(`DELETE FROM driver_cluster_members WHERE id = ?`, memberID)
	if err != nil {
		log.Printf("Remove cluster member error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error removing member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// checkDriverClusterConflict checks if a driver has overlapping membership in any cluster
func checkDriverClusterConflict(driverID int, excludeClusterID int, validFrom, validTo string) (bool, string) {
	// Check for overlapping dates: NOT (new_to < existing_from OR new_from > existing_to)
	query := `
		SELECT c.name, DATE_FORMAT(dcm.valid_from, '%d-%m-%Y'), DATE_FORMAT(dcm.valid_to, '%d-%m-%Y')
		FROM driver_cluster_members dcm
		JOIN driver_clusters c ON dcm.cluster_id = c.id
		WHERE dcm.driver_id = ?
		AND dcm.cluster_id != ?
		AND NOT (? < dcm.valid_from OR ? > dcm.valid_to)
		LIMIT 1
	`
	var clusterName, existingFrom, existingTo string
	err := config.DB.QueryRow(query, driverID, excludeClusterID, validTo, validFrom).Scan(&clusterName, &existingFrom, &existingTo)
	if err == nil {
		// Get driver name
		var driverName string
		config.DB.QueryRow(`
			SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
		`, driverID).Scan(&driverName)

		return true, "Driver '" + driverName + "' is already assigned to '" + clusterName + "' from " + existingFrom + " to " + existingTo + ". Dates overlap with your selection."
	}
	return false, ""
}

/*
=========================

	POST /api/admin/clusters/assign-drivers
	(Legacy - kept for compatibility)

=========================
*/
func AssignDriversToCluster(c *gin.Context) {
	var req struct {
		ClusterID int    `json:"cluster_id"`
		DriverIDs []int  `json:"driver_ids"`
		ValidFrom string `json:"valid_from"`
		ValidTo   string `json:"valid_to"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.ValidFrom == "" || req.ValidTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid from and valid to dates are required"})
		return
	}

	addedCount := 0
	for _, driverID := range req.DriverIDs {
		hasConflict, _ := checkDriverClusterConflict(driverID, req.ClusterID, req.ValidFrom, req.ValidTo)
		if !hasConflict {
			_, err := config.DB.Exec(`
				INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
				VALUES (?, ?, ?, ?)
			`, req.ClusterID, driverID, req.ValidFrom, req.ValidTo)
			if err == nil {
				addedCount++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Drivers assigned to cluster", "added": addedCount})
}

/*
=========================

	POST /api/admin/clusters/assign-shift
	Assign all drivers in a cluster to a shift

=========================
*/
func AssignClusterToShift(c *gin.Context) {
	var req struct {
		ClusterID    int    `json:"cluster_id"`
		ShiftID      int    `json:"shift_id"`
		AssignedDate string `json:"assigned_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get all active drivers in the cluster for the given date
	rows, err := config.DB.Query(`
		SELECT dcm.driver_id FROM driver_cluster_members dcm
		WHERE dcm.cluster_id = ? AND ? BETWEEN dcm.valid_from AND dcm.valid_to
	`, req.ClusterID, req.AssignedDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching drivers"})
		return
	}
	defer rows.Close()

	var driverIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		driverIDs = append(driverIDs, id)
	}

	// Create assignments for each driver
	vehicleRows, _ := config.DB.Query("SELECT id FROM vehicles WHERE status = 'available' LIMIT ?", len(driverIDs))
	defer vehicleRows.Close()

	var vehicleIDs []int
	for vehicleRows.Next() {
		var id int
		vehicleRows.Scan(&id)
		vehicleIDs = append(vehicleIDs, id)
	}

	assignedCount := 0
	createdBy := getUserIDFromRequest(c)
	for i, driverID := range driverIDs {
		vehicleID := 0
		if i < len(vehicleIDs) {
			vehicleID = vehicleIDs[i]
		} else if len(vehicleIDs) > 0 {
			vehicleID = vehicleIDs[0]
		}

		if vehicleID > 0 {
			_, err := config.DB.Exec(`
				INSERT INTO assignments (driver_id, vehicle_id, shift_id, assigned_date, status, created_by)
				VALUES (?, ?, ?, ?, 'assigned', ?)
				ON DUPLICATE KEY UPDATE shift_id = ?, vehicle_id = ?
			`, driverID, vehicleID, req.ShiftID, req.AssignedDate, createdBy, req.ShiftID, vehicleID)
			if err == nil {
				assignedCount++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Cluster assigned to shift",
		"assigned_count": assignedCount,
		"total_drivers":  len(driverIDs),
	})
}

/*
=========================

	DELETE /api/admin/clusters/delete?id=X
	Delete a cluster and all memberships

=========================
*/
func DeleteCluster(c *gin.Context) {
	idStr := c.Query("id")
	var id int

	if idStr != "" {
		parsed, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
			return
		}
		id = parsed
	} else {
		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID required (query or body)"})
			return
		}
		id = req.ID
	}

	// Memberships will be deleted by CASCADE
	// Delete from ev_assignments if any
	_, err := config.DB.Exec("DELETE FROM ev_assignments WHERE cluster_id = ?", id)
	if err != nil {
		log.Printf("Error deleting ev_assignments for cluster: %v", err)
	}

	// Delete the cluster
	_, err = config.DB.Exec("DELETE FROM driver_clusters WHERE id = ?", id)
	if err != nil {
		log.Printf("Delete cluster error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting cluster"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver group deleted"})
}

/*
=========================

	GET /api/admin/drivers/available-for-cluster
	Get drivers available for a date range (not already in a cluster)

=========================
*/
func GetAvailableDriversForCluster(c *gin.Context) {
	validFrom := c.Query("valid_from")
	validTo := c.Query("valid_to")
	excludeClusterID := c.Query("exclude_cluster_id")

	if validFrom == "" || validTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid_from and valid_to required"})
		return
	}

	query := `
		SELECT d.id, u.full_name, d.license_type
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.id NOT IN (
			SELECT dcm.driver_id FROM driver_cluster_members dcm
			WHERE dcm.cluster_id != COALESCE(?, 0)
			AND NOT (? < dcm.valid_from OR ? > dcm.valid_to)
		)
		ORDER BY u.full_name
	`

	rows, err := config.DB.Query(query, excludeClusterID, validTo, validFrom)
	if err != nil {
		log.Printf("Get available drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching drivers"})
		return
	}
	defer rows.Close()

	type AvailableDriver struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		LicenseType string `json:"license_type"`
	}

	var drivers []AvailableDriver
	for rows.Next() {
		var d AvailableDriver
		var licenseType *string
		err := rows.Scan(&d.ID, &d.Name, &licenseType)
		if err != nil {
			continue
		}
		if licenseType != nil {
			d.LicenseType = *licenseType
		}
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}
