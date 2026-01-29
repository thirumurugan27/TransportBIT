package admin

import (
	"log"
	"net/http"
	"strconv"
	"time"

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
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       COALESCE(v.name, b.bus_name, v.vehicle_number) as bus_name
		FROM vehicles v
		LEFT JOIN buses b ON b.vehicle_id = v.id
		WHERE v.fuel_type = 'EV'
		ORDER BY v.vehicle_number
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
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status, &v.BusName)
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

/*
=========================

	GET /api/admin/ev-assignments/:id/details
	Get detailed EV assignment info with drivers and KM logs

=========================
*/
func GetEVAssignmentDetails(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment ID"})
		return
	}

	// Get assignment details
	var assignment struct {
		ID            int    `json:"id"`
		VehicleID     int    `json:"vehicle_id"`
		VehicleNumber string `json:"vehicle_number"`
		VehicleType   string `json:"vehicle_type"`
		ClusterID     int    `json:"cluster_id"`
		ClusterName   string `json:"cluster_name"`
		StartDate     string `json:"start_date"`
		EndDate       string `json:"end_date"`
		Status        string `json:"status"`
		DaysTotal     int    `json:"days_total"`
		DaysRemaining int    `json:"days_remaining"`
		DaysCompleted int    `json:"days_completed"`
	}

	err = config.DB.QueryRow(`
		SELECT ea.id, ea.vehicle_id, v.vehicle_number, v.vehicle_type,
		       ea.cluster_id, c.name as cluster_name,
		       DATE_FORMAT(ea.start_date, '%Y-%m-%d') as start_date,
		       DATE_FORMAT(ea.end_date, '%Y-%m-%d') as end_date,
		       ea.status
		FROM ev_assignments ea
		JOIN vehicles v ON ea.vehicle_id = v.id
		JOIN driver_clusters c ON ea.cluster_id = c.id
		WHERE ea.id = ?
	`, id).Scan(&assignment.ID, &assignment.VehicleID, &assignment.VehicleNumber,
		&assignment.VehicleType, &assignment.ClusterID, &assignment.ClusterName,
		&assignment.StartDate, &assignment.EndDate, &assignment.Status)

	if err != nil {
		log.Printf("Get EV assignment details error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	// Calculate days
	startDate, _ := time.Parse("2006-01-02", assignment.StartDate)
	endDate, _ := time.Parse("2006-01-02", assignment.EndDate)
	today := time.Now().Truncate(24 * time.Hour)

	assignment.DaysTotal = int(endDate.Sub(startDate).Hours()/24) + 1

	if today.Before(startDate) {
		assignment.DaysRemaining = assignment.DaysTotal
		assignment.DaysCompleted = 0
	} else if today.After(endDate) {
		assignment.DaysRemaining = 0
		assignment.DaysCompleted = assignment.DaysTotal
	} else {
		assignment.DaysCompleted = int(today.Sub(startDate).Hours()/24) + 1
		assignment.DaysRemaining = assignment.DaysTotal - assignment.DaysCompleted
	}

	// Get drivers in the cluster with their initials
	type DriverInfo struct {
		DriverID   int     `json:"driver_id"`
		DriverName string  `json:"driver_name"`
		Initials   string  `json:"initials"`
		Status     string  `json:"status"`
		OnLeave    bool    `json:"on_leave"`
		TotalKM    float64 `json:"total_km"`
	}

	driverRows, err := config.DB.Query(`
		SELECT d.id, u.full_name, u.status,
		       EXISTS(SELECT 1 FROM leave_requests lr 
		              WHERE lr.driver_id = d.id 
		              AND lr.status = 'admin_approved'
		              AND CURDATE() BETWEEN lr.start_date AND lr.end_date) as on_leave,
		       COALESCE((SELECT SUM(total_km) FROM km_logs kl 
		                 WHERE kl.driver_id = d.id 
		                 AND kl.vehicle_id = ?
		                 AND kl.date BETWEEN ? AND ?), 0) as total_km
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.cluster_id = ?
		ORDER BY u.full_name
	`, assignment.VehicleID, assignment.StartDate, assignment.EndDate, assignment.ClusterID)

	var drivers []DriverInfo
	if err == nil {
		defer driverRows.Close()
		for driverRows.Next() {
			var di DriverInfo
			var onLeave int
			driverRows.Scan(&di.DriverID, &di.DriverName, &di.Status, &onLeave, &di.TotalKM)
			di.OnLeave = onLeave == 1

			// Generate initials from name
			words := splitName(di.DriverName)
			for _, w := range words {
				if len(w) > 0 {
					di.Initials += string(w[0])
				}
			}
			drivers = append(drivers, di)
		}
	}

	// Get total KM for this vehicle during assignment period
	var totalVehicleKM float64
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_km), 0) 
		FROM km_logs 
		WHERE vehicle_id = ? 
		AND date BETWEEN ? AND ?
	`, assignment.VehicleID, assignment.StartDate, assignment.EndDate).Scan(&totalVehicleKM)

	// Get recent KM logs for this vehicle
	type KMLog struct {
		ID         int     `json:"id"`
		Date       string  `json:"date"`
		DriverName string  `json:"driver_name"`
		StartKM    float64 `json:"start_km"`
		EndKM      float64 `json:"end_km"`
		TotalKM    float64 `json:"total_km"`
	}

	kmRows, err := config.DB.Query(`
		SELECT kl.id, DATE_FORMAT(kl.date, '%Y-%m-%d') as date, 
		       u.full_name as driver_name, kl.start_km, kl.end_km, kl.total_km
		FROM km_logs kl
		JOIN drivers d ON kl.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE kl.vehicle_id = ?
		AND kl.date BETWEEN ? AND ?
		ORDER BY kl.date DESC, kl.id DESC
		LIMIT 20
	`, assignment.VehicleID, assignment.StartDate, assignment.EndDate)

	var kmLogs []KMLog
	if err == nil {
		defer kmRows.Close()
		for kmRows.Next() {
			var kl KMLog
			kmRows.Scan(&kl.ID, &kl.Date, &kl.DriverName, &kl.StartKM, &kl.EndKM, &kl.TotalKM)
			kmLogs = append(kmLogs, kl)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"assignment":       assignment,
		"drivers":          drivers,
		"total_vehicle_km": totalVehicleKM,
		"km_logs":          kmLogs,
	})
}

// Helper function to split name into words
func splitName(name string) []string {
	var words []string
	var current string
	for _, c := range name {
		if c == ' ' {
			if current != "" {
				words = append(words, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		words = append(words, current)
	}
	return words
}
