package driver

import (
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

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
	DateOfJoining   string `json:"date_of_joining"`
	DateOfRelieving string `json:"date_of_relieving"`
	Status          string `json:"status"`
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
			d.experience_years, 
			DATE_FORMAT(d.date_of_joining, '%d-%m-%Y') as date_of_joining,
			DATE_FORMAT(d.date_of_relieving, '%d-%m-%Y') as date_of_relieving,
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
		&profile.ExperienceYears, &profile.DateOfJoining, &profile.DateOfRelieving,
		&profile.Status,
	)

	if err != nil {
		log.Printf("Get driver profile error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	c.JSON(http.StatusOK, profile)
}
