package driver

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// KmLog - kilometer log entry
type KmLog struct {
	ID            int     `json:"id"`
	DriverID      int     `json:"driver_id"`
	Date          string  `json:"date"`
	StartKm       float64 `json:"start_km"`
	EndKm         float64 `json:"end_km"`
	TotalKm       float64 `json:"total_km"`
	Remarks       string  `json:"remarks"`
	VehicleType   string  `json:"vehicle_type"`
	VehicleID     *int    `json:"vehicle_id"`
	VehicleNumber *string `json:"vehicle_number"`
}

// KmLogRequest - request to add km log
type KmLogRequest struct {
	DriverID     int     `json:"driver_id"`
	Date         string  `json:"date"`
	StartKm      float64 `json:"start_km"`
	EndKm        float64 `json:"end_km"`
	TotalKm      float64 `json:"total_km"`
	Remarks      string  `json:"remarks"`
	VehicleType  string  `json:"vehicle_type"`
	VehicleID    *int    `json:"vehicle_id"`
	AssignmentID *int    `json:"assignment_id"`
}

/*
=========================

	GET /api/driver/km-logs

=========================
*/
func GetDriverKmLogs(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT k.id, k.driver_id, DATE_FORMAT(k.date, '%Y-%m-%d') as date, 
		       k.start_km, k.end_km, k.total_km, COALESCE(k.remarks, '') as remarks,
			   COALESCE(k.vehicle_type, 'BUS') as vehicle_type, k.vehicle_id, v.vehicle_number
		FROM km_logs k
		LEFT JOIN vehicles v ON k.vehicle_id = v.id
		WHERE k.driver_id = ?
		ORDER BY k.date DESC
		LIMIT 30
	`, driverID)

	if err != nil {
		log.Printf("Get km logs error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching km logs"})
		return
	}
	defer rows.Close()

	var logs []KmLog
	for rows.Next() {
		var l KmLog
		var vehicleID *int
		var vehicleNumber *string
		rows.Scan(&l.ID, &l.DriverID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.Remarks, &l.VehicleType, &vehicleID, &vehicleNumber)
		l.VehicleID = vehicleID
		l.VehicleNumber = vehicleNumber
		logs = append(logs, l)
	}

	c.JSON(http.StatusOK, logs)
}

/*
=========================

	POST /api/driver/km-log/add

=========================
*/
func AddDriverKmLog(c *gin.Context) {
	var req KmLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate
	if req.DriverID == 0 || req.Date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	if req.VehicleID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	if req.EndKm < req.StartKm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End KM must be greater than Start KM"})
		return
	}

	// Calculate total if not provided or incorrect
	if req.TotalKm == 0 {
		req.TotalKm = req.EndKm - req.StartKm
	}

	// Fetch driver user info for recorded_by metadata
	var recordedByUserID int
	var recordedByName string
	err := config.DB.QueryRow(`
		SELECT u.id, u.full_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.id = ?
	`, req.DriverID).Scan(&recordedByUserID, &recordedByName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	// Default vehicle type from vehicles table when missing
	if req.VehicleType == "" {
		config.DB.QueryRow(`SELECT vehicle_type FROM vehicles WHERE id = ?`, *req.VehicleID).Scan(&req.VehicleType)
		if req.VehicleType == "" {
			req.VehicleType = "BUS"
		}
	}

	// Auto-detect assignment if not provided
	if req.AssignmentID == nil {
		var assignmentID sql.NullInt64
		err = config.DB.QueryRow(`
			SELECT id FROM assignments
			WHERE driver_id = ? AND vehicle_id = ? AND ? BETWEEN start_date AND end_date
			ORDER BY start_date DESC
			LIMIT 1
		`, req.DriverID, *req.VehicleID, req.Date).Scan(&assignmentID)
		if err == nil && assignmentID.Valid {
			val := int(assignmentID.Int64)
			req.AssignmentID = &val
		}
	}

	var vehicleID interface{}
	if req.VehicleID != nil {
		vehicleID = *req.VehicleID
	}

	var assignmentID interface{}
	if req.AssignmentID != nil {
		assignmentID = *req.AssignmentID
	}

	// Insert into DB with recorded metadata
	result, err := config.DB.Exec(`
		INSERT INTO km_logs (
			driver_id, date, start_km, end_km, total_km, remarks,
			vehicle_type, vehicle_id, assignment_id,
			recorded_by_user_id, recorded_by_role, recorded_by_name
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRIVER', ?)
	`, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, req.Remarks, req.VehicleType, vehicleID, assignmentID, recordedByUserID, recordedByName)

	if err != nil {
		log.Printf("Add km log error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding km log"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Km log added successfully",
		"id":      id,
	})
}

/*
=========================

	GET /api/driver/vehicle-last-log

=========================
*/
func GetLastLogForVehicle(c *gin.Context) {
	vehicleID := c.Query("vehicle_id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	var endKm float64
	err := config.DB.QueryRow(`
		SELECT end_km 
		FROM km_logs 
		WHERE vehicle_id = ? 
		ORDER BY date DESC, end_km DESC 
		LIMIT 1
	`, vehicleID).Scan(&endKm)

	if err != nil {
		endKm = 0
	}

	c.JSON(http.StatusOK, gin.H{"end_km": endKm})
}
