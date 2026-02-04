package driver

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// DriverLoginResponse - response after driver login
type DriverLoginResponse struct {
	DriverID   int    `json:"driver_id"`
	UserID     int    `json:"user_id"`
	FullName   string `json:"full_name"`
	IsIncharge bool   `json:"is_incharge"`
}

// DriverProfile - full driver profile
type DriverProfile struct {
	ID              int    `json:"id"`
	UserID          int    `json:"user_id"`
	FullName        string `json:"full_name"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	LicenseNumber   string `json:"license_number"`
	LicenseType     string `json:"license_type"`
	LicenseExpiry   string `json:"license_expiry"`
	ExperienceYears int    `json:"experience_years"`
	IsIncharge      bool   `json:"is_incharge"`
	Status          string `json:"status"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

/*
	=========================
	  POST /api/driver/login
	=========================
*/
func DriverLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	log.Printf("Driver login attempt: username=%s", req.Username)

	// Check user credentials with role = 'DRIVER'
	var userID int
	var dbPassword string
	err := config.DB.QueryRow(`
		SELECT id, password FROM users 
		WHERE username = ? AND role = 'DRIVER'
	`, req.Username).Scan(&userID, &dbPassword)

	if err == sql.ErrNoRows {
		log.Printf("Driver not found: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		log.Printf("Driver login error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	log.Printf("Found driver user ID: %d", userID)

	// Check password
	if dbPassword != req.Password {
		log.Printf("Password mismatch for user: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Get driver details including is_incharge
	var driverID int
	var fullName string
	var isIncharge bool
	err = config.DB.QueryRow(`
		SELECT d.id, u.full_name, d.is_incharge FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.user_id = ?
	`, userID).Scan(&driverID, &fullName, &isIncharge)

	if err != nil {
		log.Printf("Driver fetch error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	c.JSON(http.StatusOK, DriverLoginResponse{
		DriverID:   driverID,
		UserID:     userID,
		FullName:   fullName,
		IsIncharge: isIncharge,
	})
}

/*
	=========================
	  GET /api/driver/profile
	=========================
*/
func GetDriverProfile(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	var profile DriverProfile
	err := config.DB.QueryRow(`
		SELECT 
			d.id, d.user_id, u.full_name, 
			COALESCE(u.phone, '') as phone,
			COALESCE(u.email, '') as email,
			d.license_number, d.license_type, 
			DATE_FORMAT(d.license_expiry, '%d-%m-%Y') as license_expiry,
			d.experience_years, d.is_incharge,
			CASE 
				WHEN EXISTS(SELECT 1 FROM leave_requests lr 
				            WHERE lr.driver_id = d.id 
				            AND lr.status = 'admin_approved'
				            AND CURDATE() BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
				WHEN att.status = 'present' THEN 'present'
				WHEN att.status = 'absent' THEN 'absent'
				ELSE 'not_marked'
			END as status
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
		WHERE d.id = ?
	`, driverID).Scan(
		&profile.ID, &profile.UserID, &profile.FullName,
		&profile.Phone, &profile.Email, &profile.LicenseNumber,
		&profile.LicenseType, &profile.LicenseExpiry,
		&profile.ExperienceYears, &profile.IsIncharge, &profile.Status,
	)

	if err != nil {
		log.Printf("Get driver profile error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	c.JSON(http.StatusOK, profile)
}
