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
			fi.completed_at, COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(u.full_name, ''),
			COALESCE(fi.fuel_indent_number, ''), COALESCE(fi.vehicle_type, ''), COALESCE(fi.fuel_type, ''),
			COALESCE(fi.filled_date, ''), COALESCE(fi.filled_time, '')
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

// CreateFuelIndent creates a new fuel indent request (admin can create for any driver)
func CreateFuelIndent(c *gin.Context) {
	var req models.DriverCreateFuelIndentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.VehicleID == 0 || req.DriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle and driver are required"})
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

// ApproveFuelIndent approves a pending fuel indent
func ApproveFuelIndent(c *gin.Context) {
	idStr := c.Query("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = config.DB.Exec(
		`UPDATE fuel_indents SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'pending'`,
		now, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve fuel indent"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fuel indent approved"})
}

// RejectFuelIndent rejects a pending fuel indent
func RejectFuelIndent(c *gin.Context) {
	idStr := c.Query("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	_, err = config.DB.Exec(
		`UPDATE fuel_indents SET status = 'rejected' WHERE id = ? AND status = 'pending'`,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject fuel indent"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fuel indent rejected"})
}

// GetPendingFuelIndentCount returns count of pending fuel indents
func GetPendingFuelIndentCount(c *gin.Context) {
	var count int
	config.DB.QueryRow(`SELECT COUNT(*) FROM fuel_indents WHERE status = 'pending'`).Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}
