package driver

import (
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// KmLog - kilometer log entry
type KmLog struct {
	ID       int     `json:"id"`
	DriverID int     `json:"driver_id"`
	Date     string  `json:"date"`
	StartKm  float64 `json:"start_km"`
	EndKm    float64 `json:"end_km"`
	TotalKm  float64 `json:"total_km"`
	Remarks  string  `json:"remarks"`
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
		SELECT id, driver_id, DATE_FORMAT(date, '%Y-%m-%d') as date, 
		       start_km, end_km, total_km, COALESCE(remarks, '') as remarks
		FROM km_logs
		WHERE driver_id = ?
		ORDER BY date DESC
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
		rows.Scan(&l.ID, &l.DriverID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.Remarks)
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

	if req.EndKm < req.StartKm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End KM must be greater than Start KM"})
		return
	}

	// Calculate total if not provided or incorrect
	if req.TotalKm == 0 {
		req.TotalKm = req.EndKm - req.StartKm
	}

	// Insert into DB
	result, err := config.DB.Exec(`
		INSERT INTO km_logs (driver_id, date, start_km, end_km, total_km, remarks, vehicle_type)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, req.Remarks, req.VehicleType)

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

