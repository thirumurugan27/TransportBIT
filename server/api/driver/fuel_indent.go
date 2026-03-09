package driver

import (
	"database/sql"
	"net/http"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// GetDriverFuelIndents returns fuel indents for the logged-in driver
func GetDriverFuelIndents(c *gin.Context) {
	userID, _ := c.Get("user_id")

	// Get driver_id from user_id
	var driverID int
	err := config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	query := `
		SELECT 
			fi.id, fi.vehicle_id, fi.driver_id, fi.fuel_requested,
			COALESCE(fi.fuel_filled, 0), fi.odometer_reading, fi.status, fi.requested_at,
			fi.completed_at, COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(u.full_name, ''),
			COALESCE(fi.fuel_indent_number, ''), COALESCE(fi.vehicle_type, ''), COALESCE(fi.fuel_type, ''),
			COALESCE(fi.filled_date, ''), COALESCE(fi.filled_time, '')
		FROM fuel_indents fi
		LEFT JOIN vehicles v ON fi.vehicle_id = v.id
		LEFT JOIN drivers dr ON fi.driver_id = dr.id
		LEFT JOIN users u ON dr.user_id = u.id
		WHERE fi.driver_id = ?
		ORDER BY fi.requested_at DESC
	`

	rows, err := config.DB.Query(query, driverID)
	if err != nil {
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
			&completedAt, &fi.VehicleNumber, &fi.VehicleName, &fi.DriverName,
			&fi.FuelIndentNumber, &fi.VehicleType, &fi.FuelType,
			&fi.FilledDate, &fi.FilledTime,
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

// CreateDriverFuelIndent allows a driver to raise a fuel indent
func CreateDriverFuelIndent(c *gin.Context) {
	var req models.DriverCreateFuelIndentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.VehicleID == 0 || req.DriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle and driver are required"})
		return
	}
	if req.FuelIndentNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel indent number is required"})
		return
	}
	if req.FilledDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled date is required"})
		return
	}
	if req.FilledLiters <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled liters must be greater than 0"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	query := `
		INSERT INTO fuel_indents 
			(vehicle_id, driver_id, fuel_requested, fuel_filled, odometer_reading, status, requested_at,
			 fuel_indent_number, vehicle_type, fuel_type, filled_date, filled_time)
		VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
	`
	result, err := config.DB.Exec(query,
		req.VehicleID, req.DriverID, req.FilledLiters, req.FilledLiters,
		req.OdometerReading, now,
		req.FuelIndentNumber, req.VehicleType, req.FuelType,
		req.FilledDate, req.FilledTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create fuel indent: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Fuel indent raised successfully",
		"id":      id,
	})
}

// GetDriversDropdown returns all drivers for dropdown selection
func GetDriversDropdown(c *gin.Context) {
	query := `
		SELECT d.id, u.full_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE u.status != 'inactive'
		ORDER BY u.full_name
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusOK, []gin.H{})
		return
	}
	defer rows.Close()

	var drivers []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		drivers = append(drivers, gin.H{"id": id, "full_name": name})
	}
	if drivers == nil {
		drivers = []gin.H{}
	}
	c.JSON(http.StatusOK, drivers)
}
