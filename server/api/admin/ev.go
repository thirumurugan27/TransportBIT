package admin

import (
	"log"
	"net/http"
	"strconv"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/*
	=========================
	  EV ASSIGNMENT HANDLERS
	=========================
*/

// EVAssignment - EV vehicle to cluster assignment
type EVAssignment struct {
	ID            int                 `json:"id"`
	VehicleID     int                 `json:"vehicle_id"`
	VehicleNumber string              `json:"vehicle_number"`
	ClusterID     int                 `json:"cluster_id"`
	ClusterName   string              `json:"cluster_name"`
	DriverCount   int                 `json:"driver_count"`
	StartDate     string              `json:"start_date"`
	EndDate       string              `json:"end_date"`
	Status        string              `json:"status"`
	Drivers       []ClusterDriverInfo `json:"drivers"`
}

type ClusterDriverInfo struct {
	DriverID   int    `json:"driver_id"`
	DriverName string `json:"driver_name"`
	Status     string `json:"status"`
	OnLeave    bool   `json:"on_leave"`
}

/*
=========================

	GET /api/admin/ev-vehicles
	Get all EV vehicles for assignment

=========================
*/
func GetEVVehicles(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, vehicle_number, vehicle_type, fuel_type, seating_capacity, status
		FROM vehicles 
		WHERE fuel_type = 'EV'
		ORDER BY vehicle_number
	`)
	if err != nil {
		log.Printf("Get EV vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching EV vehicles"})
		return
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status)
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, vehicles)
}

/*
=========================

	GET /api/admin/ev-assignments
	Get all EV assignments

=========================
*/
func GetEVAssignments(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT ea.id, ea.vehicle_id, v.vehicle_number, 
		       ea.cluster_id, c.name as cluster_name,
		       (SELECT COUNT(*) FROM drivers d WHERE d.cluster_id = ea.cluster_id) as driver_count,
		       DATE_FORMAT(ea.start_date, '%Y-%m-%d') as start_date, 
			   DATE_FORMAT(ea.end_date, '%Y-%m-%d') as end_date, 
			   ea.status
		FROM ev_assignments ea
		JOIN vehicles v ON ea.vehicle_id = v.id
		JOIN driver_clusters c ON ea.cluster_id = c.id
		ORDER BY ea.start_date DESC, ea.id DESC
	`)
	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching EV assignments"})
		return
	}
	defer rows.Close()

	var assignments []EVAssignment
	for rows.Next() {
		var a EVAssignment
		rows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.ClusterID, &a.ClusterName,
			&a.DriverCount, &a.StartDate, &a.EndDate, &a.Status)

		// Get drivers in the cluster
		driverRows, _ := config.DB.Query(`
			SELECT d.id, u.full_name, u.status,
			       EXISTS(SELECT 1 FROM leave_requests lr 
			              WHERE lr.driver_id = d.id 
			              AND lr.status = 'admin_approved'
			              AND CURDATE() BETWEEN lr.start_date AND lr.end_date) as on_leave
			FROM drivers d
			JOIN users u ON d.user_id = u.id
			WHERE d.cluster_id = ?
		`, a.ClusterID)

		if driverRows != nil {
			for driverRows.Next() {
				var di ClusterDriverInfo
				var onLeave int
				driverRows.Scan(&di.DriverID, &di.DriverName, &di.Status, &onLeave)
				di.OnLeave = onLeave == 1
				a.Drivers = append(a.Drivers, di)
			}
			driverRows.Close()
		}

		assignments = append(assignments, a)
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	POST /api/admin/ev-assignments/create
	Create EV assignment (cluster to EV vehicle for date range)

=========================
*/
func CreateEVAssignment(c *gin.Context) {
	var req struct {
		VehicleID int    `json:"vehicle_id"`
		ClusterID int    `json:"cluster_id"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO ev_assignments (vehicle_id, cluster_id, start_date, end_date, status)
		VALUES (?, ?, ?, ?, 'active')
	`, req.VehicleID, req.ClusterID, req.StartDate, req.EndDate)

	if err != nil {
		log.Printf("Create EV assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating EV assignment"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"message": "EV assignment created successfully",
	})
}
/*
=========================

	DELETE /api/admin/ev-assignments/delete
	Delete an EV assignment

=========================
*/
func DeleteEVAssignment(c *gin.Context) {
	// Try query param first
	idStr := c.Query("id")
	if idStr == "" {
		// Fallback to JSON body
		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err == nil && req.ID > 0 {
			idStr = strconv.Itoa(req.ID)
		}
	}

	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	_, err = config.DB.Exec("DELETE FROM ev_assignments WHERE id = ?", id)
	if err != nil {
		log.Printf("Delete EV assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete EV assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "EV assignment deleted"})
}