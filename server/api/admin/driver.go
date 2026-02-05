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
	// Get today's attendance status for each driver
	// Priority: on_leave (from approved leave) > attendance record > not_marked
	rows, err := config.DB.Query(`
		SELECT d.id, d.user_id,
		       COALESCE(u.full_name, '') as full_name,
		       COALESCE(u.role, '') as role,
		       COALESCE(u.phone, '') as phone,
		       COALESCE(u.email, '') as email,
		       COALESCE(d.license_number, '') as license_number,
		       COALESCE(d.license_type, '') as license_type,
		       COALESCE(DATE_FORMAT(d.license_expiry, '%d-%m-%Y'), '') as license_expiry,
		       COALESCE(d.experience_years, 0) as experience_years,
		       COALESCE(DATE_FORMAT(d.date_of_joining, '%d-%m-%Y'), '') as date_of_joining,
		       COALESCE(DATE_FORMAT(d.date_of_relieving, '%d-%m-%Y'), '') as date_of_relieving,
		       COALESCE(d.allowed_vehicle_type, '') as allowed_vehicle_type,
		       d.home_vehicle_id, d.home_stop_id, COALESCE(d.is_incharge, 0) as is_incharge,
		       CASE 
		           WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved' 
		               AND CURDATE() BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
		           WHEN a.status IS NOT NULL THEN a.status
		           ELSE 'not_marked'
		       END as status,
		       dcm.cluster_id, COALESCE(c.name, '') as cluster_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = CURDATE()
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
		    AND lr.status = 'admin_approved'
		    AND CURDATE() BETWEEN lr.start_date AND lr.end_date
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
			&d.UserID,
			&d.FullName,
			&d.Role,
			&d.Phone,
			&d.Email,
			&d.LicenseNumber,
			&d.LicenseType,
			&d.LicenseExpiry,
			&d.ExperienceYears,
			&d.DateOfJoining,
			&d.DateOfRelieving,
			&d.AllowedVehicleType,
			&d.HomeVehicleID,
			&d.HomeStopID,
			&d.IsIncharge,
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

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Insert into users table
	result, err := tx.Exec(`
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
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	userID, err := result.LastInsertId()
	if err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user ID"})
		return
	}

	var licenseExpiry interface{}
	if req.LicenseExpiry == "" {
		licenseExpiry = nil
	} else {
		licenseExpiry = req.LicenseExpiry
	}

	var dateOfJoining interface{}
	if req.DateOfJoining == "" {
		dateOfJoining = nil
	} else {
		dateOfJoining = req.DateOfJoining
	}

	var dateOfRelieving interface{}
	if req.DateOfRelieving == "" {
		dateOfRelieving = nil
	} else {
		dateOfRelieving = req.DateOfRelieving
	}

	// Insert into drivers table
	_, err = tx.Exec(`
		INSERT INTO drivers (
			user_id, license_number, license_type, license_expiry,
			experience_years, date_of_joining, date_of_relieving, allowed_vehicle_type,
			home_vehicle_id, home_stop_id, is_incharge
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		userID,
		req.LicenseNumber,
		req.LicenseType,
		licenseExpiry,
		req.ExperienceYears,
		dateOfJoining,
		dateOfRelieving,
		req.AllowedVehicleType,
		req.HomeVehicleID,
		req.HomeStopID,
		req.IsIncharge,
	)

	if err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
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

	// Resolve driver ID (from query or body)
	idStr := c.Query("id")
	if idStr != "" {
		if id, convErr := strconv.Atoi(idStr); convErr == nil {
			req.ID = id
		}
	}
	if req.ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver ID required"})
		return
	}

	// Resolve user ID if not provided
	if req.UserID == 0 {
		var userID int
		if err := config.DB.QueryRow("SELECT user_id FROM drivers WHERE id=?", req.ID).Scan(&userID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
			return
		}
		req.UserID = userID
	}

	var licenseExpiry interface{}
	if req.LicenseExpiry == "" {
		licenseExpiry = nil
	} else {
		licenseExpiry = req.LicenseExpiry
	}

	var dateOfJoining interface{}
	if req.DateOfJoining == "" {
		dateOfJoining = nil
	} else {
		dateOfJoining = req.DateOfJoining
	}

	var dateOfRelieving interface{}
	if req.DateOfRelieving == "" {
		dateOfRelieving = nil
	} else {
		dateOfRelieving = req.DateOfRelieving
	}

	// Update users table
	_, err := config.DB.Exec(`
		UPDATE users SET full_name=?, phone=?, email=?
		WHERE id=?
	`, req.FullName, req.Phone, req.Email, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update drivers table
	_, err = config.DB.Exec(`
		UPDATE drivers SET license_number=?, license_type=?, license_expiry=?,
		       experience_years=?, date_of_joining=?, date_of_relieving=?, allowed_vehicle_type=?, home_vehicle_id=?, home_stop_id=?, is_incharge=?
		WHERE id=?
	`, req.LicenseNumber, req.LicenseType, licenseExpiry,
		req.ExperienceYears, dateOfJoining, dateOfRelieving, req.AllowedVehicleType, req.HomeVehicleID, req.HomeStopID, req.IsIncharge, req.ID)

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
