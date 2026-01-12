package admin

import (
	"log"
	"net/http"
	"strconv"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   ADMIN → DRIVER MANAGEMENT
========================= */

// GET /api/admin/drivers
func GetDrivers(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT d.id, u.full_name, u.phone, u.email,
		       d.license_number, d.license_type,
		       d.experience_years, d.home_vehicle_id, u.status,
		       d.cluster_id, COALESCE(c.name, '') as cluster_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_clusters c ON d.cluster_id = c.id
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var drivers []models.DriverResponse

	for rows.Next() {
		var d models.DriverResponse
		if err := rows.Scan(
			&d.ID,
			&d.FullName,
			&d.Phone,
			&d.Email,
			&d.LicenseNumber,
			&d.LicenseType,
			&d.ExperienceYears,
			&d.HomeVehicleID,
			&d.Status,
			&d.ClusterID,
			&d.ClusterName,
		); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}

func CreateDriver(c *gin.Context) {
	var req models.CreateDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Insert into users table
	result, err := config.DB.Exec(`
		INSERT INTO users (username, password, full_name, phone, email, role)
		VALUES (?, ?, ?, ?, ?, 'DRIVER')
	`,
		req.Username,
		req.Password,
		req.FullName,
		req.Phone,
		req.Email,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	userID, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user ID"})
		return
	}

	// Insert into drivers table
	_, err = config.DB.Exec(`
		INSERT INTO drivers (
			user_id, license_number, license_type, license_expiry,
			experience_years, allowed_vehicle_type,
			home_vehicle_id, home_stop_id, is_incharge
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		userID,
		req.LicenseNumber,
		req.LicenseType,
		req.LicenseExpiry,
		req.ExperienceYears,
		req.AllowedVehicleType,
		req.HomeVehicleID,
		req.HomeStopID,
		req.IsIncharge,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver created successfully"})
}

// POST /api/admin/drivers/update
func UpdateDriver(c *gin.Context) {
	var req models.DriverResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Update users table
	_, err := config.DB.Exec(`
		UPDATE users SET full_name=?, phone=?, email=?, status=?
		WHERE id=?
	`, req.FullName, req.Phone, req.Email, req.Status, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update drivers table
	_, err = config.DB.Exec(`
		UPDATE drivers SET license_number=?, license_type=?, license_expiry=?,
		       experience_years=?, home_vehicle_id=?, home_stop_id=?, is_incharge=?
		WHERE id=?
	`, req.LicenseNumber, req.LicenseType, req.LicenseExpiry,
		req.ExperienceYears, req.HomeVehicleID, req.HomeStopID, req.IsIncharge, req.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver updated successfully"})
}

// DELETE /api/admin/drivers/delete?id=X
func DeleteDriver(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}
	id, _ := strconv.Atoi(idStr)

	// Get user_id first
	var userID int
	err := config.DB.QueryRow("SELECT user_id FROM drivers WHERE id=?", id).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	// Delete driver (cascades from users due to FK)
	_, err = config.DB.Exec("DELETE FROM users WHERE id=?", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver deleted successfully"})
}
