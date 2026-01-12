package admin

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// GetFuelIndents returns all fuel indents
func GetFuelIndents(c *gin.Context) {
	query := `
		SELECT 
			fi.id, fi.vehicle_id, fi.driver_id, fi.fuel_requested, 
			COALESCE(fi.fuel_filled, 0), fi.odometer_reading, fi.status, fi.requested_at,
			fi.completed_at, COALESCE(v.vehicle_number, ''), COALESCE(u.full_name, '')
		FROM fuel_indents fi
		LEFT JOIN vehicles v ON fi.vehicle_id = v.id
		LEFT JOIN drivers dr ON fi.driver_id = dr.id
		LEFT JOIN users u ON dr.user_id = u.id
		ORDER BY fi.requested_at DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		// Table might not exist yet, return empty array
		c.JSON(http.StatusOK, []models.FuelIndent{})
		return
	}
	defer rows.Close()

	var indents []models.FuelIndent
	for rows.Next() {
		var fi models.FuelIndent
		var completedAt sql.NullString
		if err := rows.Scan(
			&fi.ID, &fi.VehicleID, &fi.DriverID, &fi.FuelRequested,
			&fi.FuelFilled, &fi.OdometerReading, &fi.Status, &fi.RequestedAt,
			&completedAt, &fi.VehicleNumber, &fi.DriverName,
		); err != nil {
			continue
		}
		if completedAt.Valid {
			fi.CompletedAt = &completedAt.String
		}
		indents = append(indents, fi)
	}

	if indents == nil {
		indents = []models.FuelIndent{}
	}
	c.JSON(http.StatusOK, indents)
}

// CreateFuelIndent creates a new fuel indent request
func CreateFuelIndent(c *gin.Context) {
	var req models.CreateFuelIndentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	query := `
		INSERT INTO fuel_indents (vehicle_id, driver_id, fuel_requested, odometer_reading, status, requested_at)
		VALUES (?, ?, ?, ?, 'pending', ?)
	`
	result, err := config.DB.Exec(query, req.VehicleID, req.DriverID, req.FuelRequested, req.OdometerReading, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create fuel indent: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Fuel indent created successfully",
		"id":      id,
	})
}

// CompleteFuelIndent marks a fuel indent as completed
func CompleteFuelIndent(c *gin.Context) {
	idStr := c.Query("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	var req models.CompleteFuelIndentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	query := `
		UPDATE fuel_indents 
		SET fuel_filled = ?, status = 'completed', completed_at = ?
		WHERE id = ?
	`
	_, err = config.DB.Exec(query, req.FuelFilled, now, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete fuel indent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fuel indent completed"})
}

// GetOdometerReadings returns all odometer readings
func GetOdometerReadings(c *gin.Context) {
	query := `
		SELECT 
			o.id, o.vehicle_id, o.driver_id, o.from_reading, o.to_reading,
			COALESCE(o.fuel_used, 0), o.recorded_at,
			COALESCE(v.vehicle_number, ''), COALESCE(u.full_name, '')
		FROM odometer_readings o
		LEFT JOIN vehicles v ON o.vehicle_id = v.id
		LEFT JOIN drivers dr ON o.driver_id = dr.id
		LEFT JOIN users u ON dr.user_id = u.id
		ORDER BY o.recorded_at DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		// Table might not exist yet, return empty array
		c.JSON(http.StatusOK, []models.OdometerReading{})
		return
	}
	defer rows.Close()

	var readings []models.OdometerReading
	for rows.Next() {
		var o models.OdometerReading
		if err := rows.Scan(
			&o.ID, &o.VehicleID, &o.DriverID, &o.FromReading, &o.ToReading,
			&o.FuelUsed, &o.RecordedAt, &o.VehicleNumber, &o.DriverName,
		); err != nil {
			continue
		}
		readings = append(readings, o)
	}

	if readings == nil {
		readings = []models.OdometerReading{}
	}
	c.JSON(http.StatusOK, readings)
}

// CreateOdometerReading creates a new odometer reading log
func CreateOdometerReading(c *gin.Context) {
	var req models.CreateOdometerReadingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	query := `
		INSERT INTO odometer_readings (vehicle_id, driver_id, from_reading, to_reading, fuel_used, recorded_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := config.DB.Exec(query, req.VehicleID, req.DriverID, req.FromReading, req.ToReading, req.FuelUsed, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create odometer reading: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Odometer reading logged successfully",
		"id":      id,
	})
}
