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

// DriverCluster - cluster struct
type DriverCluster struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	DefaultShiftID *int    `json:"default_shift_id"`
	DriverCount    int     `json:"driver_count"`
	StartTime      *string `json:"start_time"`
	EndTime        *string `json:"end_time"`
	ValidFrom      *string `json:"valid_from"`
	ValidTo        *string `json:"valid_to"`
}

// ClusterDriver - driver in a cluster
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
			   c.default_shift_id,
			   (SELECT COUNT(*) FROM drivers d WHERE d.cluster_id = c.id) as driver_count,
			   c.start_time, c.end_time, 
			   DATE_FORMAT(c.valid_from, '%d-%m-%Y'), 
			   DATE_FORMAT(c.valid_to, '%d-%m-%Y'),
			   s.name as shift_name,
			   TIME_FORMAT(s.start_time, '%H:%i') as shift_start,
			   TIME_FORMAT(s.end_time, '%H:%i') as shift_end
		FROM driver_clusters c
		LEFT JOIN shifts s ON c.default_shift_id = s.id
		ORDER BY c.name
	`)
	if err != nil {
		log.Printf("Get clusters error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching clusters"})
		return
	}
	defer rows.Close()

	type ClusterResponse struct {
		ID             int     `json:"id"`
		Name           string  `json:"name"`
		Description    string  `json:"description"`
		DefaultShiftID *int    `json:"default_shift_id"`
		DriverCount    int     `json:"driver_count"`
		StartTime      *string `json:"start_time"`
		EndTime        *string `json:"end_time"`
		ValidFrom      *string `json:"valid_from"`
		ValidTo        *string `json:"valid_to"`
		ShiftName      *string `json:"shift_name"`
		ShiftStart     *string `json:"shift_start"`
		ShiftEnd       *string `json:"shift_end"`
	}

	var clusters []ClusterResponse
	for rows.Next() {
		var cluster ClusterResponse
		var shiftID *int
		var startTime, endTime, validFrom, validTo, shiftName, shiftStart, shiftEnd *string
		err := rows.Scan(&cluster.ID, &cluster.Name, &cluster.Description, &shiftID, &cluster.DriverCount,
			&startTime, &endTime, &validFrom, &validTo, &shiftName, &shiftStart, &shiftEnd)
		if err != nil {
			log.Printf("Scan cluster error: %v", err)
			continue
		}
		cluster.DefaultShiftID = shiftID
		cluster.StartTime = startTime
		cluster.EndTime = endTime
		cluster.ValidFrom = validFrom
		cluster.ValidTo = validTo
		cluster.ShiftName = shiftName
		cluster.ShiftStart = shiftStart
		cluster.ShiftEnd = shiftEnd
		clusters = append(clusters, cluster)
	}

	c.JSON(http.StatusOK, clusters)
}

/*
=========================

	POST /api/admin/clusters/create

=========================
*/
func CreateCluster(c *gin.Context) {
	var req struct {
		Name           string `json:"name"`
		Description    string `json:"description"`
		DefaultShiftID *int   `json:"default_shift_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO driver_clusters (name, description, default_shift_id)
		VALUES (?, ?, ?)
	`, req.Name, req.Description, req.DefaultShiftID)

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
	Unified form: create cluster + shift timing + validity + assign drivers

=========================
*/
func CreateClusterWithSchedule(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ShiftID     *int   `json:"shift_id"`
		StartTime   string `json:"start_time"`
		EndTime     string `json:"end_time"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		DriverIDs   []int  `json:"driver_ids"`
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

	// Create the cluster with schedule info
	result, err := config.DB.Exec(`
		INSERT INTO driver_clusters (name, description, default_shift_id, start_time, end_time, valid_from, valid_to)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, req.Name, req.Description, req.ShiftID, req.StartTime, req.EndTime, req.ValidFrom, req.ValidTo)

	if err != nil {
		log.Printf("Create cluster with schedule error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating driver group"})
		return
	}

	clusterID, _ := result.LastInsertId()

	// Assign all selected drivers to this cluster
	for _, driverID := range req.DriverIDs {
		_, err := config.DB.Exec("UPDATE drivers SET cluster_id = ? WHERE id = ?", clusterID, driverID)
		if err != nil {
			log.Printf("Error assigning driver %d to cluster: %v", driverID, err)
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
		ShiftID     *int   `json:"shift_id"`
		StartTime   string `json:"start_time"`
		EndTime     string `json:"end_time"`
		ValidFrom   string `json:"valid_from"`
		ValidTo     string `json:"valid_to"`
		DriverIDs   []int  `json:"driver_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Update cluster details
	_, err := config.DB.Exec(`
		UPDATE driver_clusters 
		SET name=?, description=?, default_shift_id=?, start_time=?, end_time=?, valid_from=?, valid_to=?
		WHERE id=?
	`, req.Name, req.Description, req.ShiftID, req.StartTime, req.EndTime, req.ValidFrom, req.ValidTo, req.ID)

	if err != nil {
		log.Printf("Update cluster error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating driver group"})
		return
	}

	// Update drivers (strategies: 1. clear all and re-add, 2. smart diff)
	// Simple approach: Set all drivers in this cluster to NULL, then set selected to this cluster
	// Note: This removes drivers who were in this cluster but not in the new list.
	
	// 1. Unassign all current drivers of this cluster
	_, err = config.DB.Exec("UPDATE drivers SET cluster_id = NULL WHERE cluster_id = ?", req.ID)
	if err != nil {
		log.Printf("Error unassigning old drivers: %v", err)
	}

	// 2. Assign selected drivers
	for _, driverID := range req.DriverIDs {
		config.DB.Exec("UPDATE drivers SET cluster_id = ? WHERE id = ?", req.ID, driverID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver group updated successfully"})
}

/*
=========================

	POST /api/admin/clusters/assign-drivers

=========================
*/
func AssignDriversToCluster(c *gin.Context) {
	var req struct {
		ClusterID int   `json:"cluster_id"`
		DriverIDs []int `json:"driver_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Update all specified drivers
	for _, driverID := range req.DriverIDs {
		config.DB.Exec("UPDATE drivers SET cluster_id = ? WHERE id = ?", req.ClusterID, driverID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Drivers assigned to cluster"})
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

	// Get all drivers in the cluster
	rows, err := config.DB.Query("SELECT id FROM drivers WHERE cluster_id = ?", req.ClusterID)
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
	// Need to assign vehicles too - get available vehicles
	vehicleRows, _ := config.DB.Query("SELECT id FROM vehicles WHERE status = 'available' LIMIT ?", len(driverIDs))
	defer vehicleRows.Close()

	var vehicleIDs []int
	for vehicleRows.Next() {
		var id int
		vehicleRows.Scan(&id)
		vehicleIDs = append(vehicleIDs, id)
	}

	assignedCount := 0
	for i, driverID := range driverIDs {
		vehicleID := 0
		if i < len(vehicleIDs) {
			vehicleID = vehicleIDs[i]
		} else if len(vehicleIDs) > 0 {
			vehicleID = vehicleIDs[0] // Reuse first vehicle if not enough
		}

		if vehicleID > 0 {
			_, err := config.DB.Exec(`
				INSERT INTO assignments (driver_id, vehicle_id, shift_id, assigned_date, status)
				VALUES (?, ?, ?, ?, 'assigned')
				ON DUPLICATE KEY UPDATE shift_id = ?, vehicle_id = ?
			`, driverID, vehicleID, req.ShiftID, req.AssignedDate, req.ShiftID, vehicleID)
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
	Delete a cluster and unassign all drivers

=========================
*/
func DeleteCluster(c *gin.Context) {
	// Try getting ID from query first (standard for DELETE)
	idStr := c.Query("id")
	var id int
	
	if idStr != "" {
		// Parse query param
		parsed, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
			return
		}
		id = parsed
	} else {
		// Try JSON body (fallback for POST compatibility)
		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID required (query or body)"})
			return
		}
		id = req.ID
	}

	// First, unassign all drivers from this cluster
	_, err := config.DB.Exec("UPDATE drivers SET cluster_id = NULL WHERE cluster_id = ?", id)
	if err != nil {
		log.Printf("Error unassigning drivers from cluster: %v", err)
	}

	// Delete from ev_assignments if any
	_, err = config.DB.Exec("DELETE FROM ev_assignments WHERE cluster_id = ?", id)
	if err != nil {
		log.Printf("Error deleting ev_assignments for cluster: %v", err)
		// Non-fatal, proceed
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
