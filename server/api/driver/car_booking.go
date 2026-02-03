package driver

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GetDriverCarBookings - Get car bookings assigned to the driver
func GetDriverCarBookings(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		log.Printf("Driver not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	status := c.Query("status") // optional filter

	query := `
		SELECT cb.id, cb.faculty_id, f.user_id as faculty_user_id,
		       u.full_name as faculty_name, COALESCE(u.email, '') as faculty_email,
		       COALESCE(u.phone, '') as faculty_phone, COALESCE(f.department, '') as department,
		       cb.vehicle_id, COALESCE(v.vehicle_number, '') as vehicle_number,
		       cb.driver_id, COALESCE(du.full_name, '') as driver_name,
		       cb.booking_date, cb.start_time, cb.end_time,
		       cb.purpose, cb.destination, cb.passenger_count,
		       cb.status, '' as otp, cb.otp_generated_at, cb.otp_verified_at,
		       COALESCE(cb.admin_remarks, '') as admin_remarks,
		       cb.approved_by, COALESCE(au.full_name, '') as approved_by_name,
		       cb.approved_at, cb.created_at, cb.updated_at
		FROM car_bookings cb
		JOIN faculty f ON cb.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON cb.vehicle_id = v.id
		LEFT JOIN drivers d ON cb.driver_id = d.id
		LEFT JOIN users du ON d.user_id = du.id
		LEFT JOIN users au ON cb.approved_by = au.id
		WHERE cb.driver_id = ?
	`

	args := []interface{}{driverID}
	if status != "" {
		query += " AND cb.status = ?"
		args = append(args, status)
	} else {
		// By default, show only relevant bookings (not cancelled or rejected)
		query += " AND cb.status IN ('onhold', 'booked', 'completed')"
	}

	query += " ORDER BY cb.booking_date DESC, cb.start_time ASC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error fetching bookings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var bookings []models.CarBooking
	for rows.Next() {
		var b models.CarBooking
		if err := rows.Scan(&b.ID, &b.FacultyID, &b.FacultyUserID, &b.FacultyName,
			&b.FacultyEmail, &b.FacultyPhone, &b.Department,
			&b.VehicleID, &b.VehicleNumber, &b.DriverID, &b.DriverName,
			&b.BookingDate, &b.StartTime, &b.EndTime,
			&b.Purpose, &b.Destination, &b.PassengerCount,
			&b.Status, &b.OTP, &b.OTPGeneratedAt, &b.OTPVerifiedAt,
			&b.AdminRemarks, &b.ApprovedBy, &b.ApprovedByName,
			&b.ApprovedAt, &b.CreatedAt, &b.UpdatedAt); err != nil {
			log.Printf("Error scanning booking: %v", err)
			continue
		}
		bookings = append(bookings, b)
	}

	if bookings == nil {
		bookings = []models.CarBooking{}
	}

	c.JSON(http.StatusOK, bookings)
}

// GetTodayCarBookings - Get driver's car bookings for today
func GetTodayCarBookings(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		log.Printf("Driver not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	today := time.Now().Format("2006-01-02")

	rows, err := config.DB.Query(`
		SELECT cb.id, cb.faculty_id, f.user_id as faculty_user_id,
		       u.full_name as faculty_name, COALESCE(u.email, '') as faculty_email,
		       COALESCE(u.phone, '') as faculty_phone, COALESCE(f.department, '') as department,
		       cb.vehicle_id, COALESCE(v.vehicle_number, '') as vehicle_number,
		       cb.driver_id, COALESCE(du.full_name, '') as driver_name,
		       cb.booking_date, cb.start_time, cb.end_time,
		       cb.purpose, cb.destination, cb.passenger_count,
		       cb.status, '' as otp, cb.otp_generated_at, cb.otp_verified_at,
		       COALESCE(cb.admin_remarks, '') as admin_remarks,
		       cb.approved_by, COALESCE(au.full_name, '') as approved_by_name,
		       cb.approved_at, cb.created_at, cb.updated_at
		FROM car_bookings cb
		JOIN faculty f ON cb.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON cb.vehicle_id = v.id
		LEFT JOIN drivers d ON cb.driver_id = d.id
		LEFT JOIN users du ON d.user_id = du.id
		LEFT JOIN users au ON cb.approved_by = au.id
		WHERE cb.driver_id = ? AND cb.booking_date = ? AND cb.status IN ('onhold', 'booked')
		ORDER BY cb.start_time ASC
	`, driverID, today)

	if err != nil {
		log.Printf("Error fetching bookings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var bookings []models.CarBooking
	for rows.Next() {
		var b models.CarBooking
		if err := rows.Scan(&b.ID, &b.FacultyID, &b.FacultyUserID, &b.FacultyName,
			&b.FacultyEmail, &b.FacultyPhone, &b.Department,
			&b.VehicleID, &b.VehicleNumber, &b.DriverID, &b.DriverName,
			&b.BookingDate, &b.StartTime, &b.EndTime,
			&b.Purpose, &b.Destination, &b.PassengerCount,
			&b.Status, &b.OTP, &b.OTPGeneratedAt, &b.OTPVerifiedAt,
			&b.AdminRemarks, &b.ApprovedBy, &b.ApprovedByName,
			&b.ApprovedAt, &b.CreatedAt, &b.UpdatedAt); err != nil {
			log.Printf("Error scanning booking: %v", err)
			continue
		}
		bookings = append(bookings, b)
	}

	if bookings == nil {
		bookings = []models.CarBooking{}
	}

	c.JSON(http.StatusOK, bookings)
}

// VerifyCarBookingOTP - Driver verifies OTP to confirm booking
func VerifyCarBookingOTP(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		log.Printf("Driver not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	var req models.VerifyCarBookingOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.OTP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP is required"})
		return
	}

	// Get booking details
	var bookingDriverID int
	var storedOTP, status, bookingDate string
	err = config.DB.QueryRow(`
		SELECT driver_id, otp, status, booking_date FROM car_bookings WHERE id = ?
	`, req.BookingID).Scan(&bookingDriverID, &storedOTP, &status, &bookingDate)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Verify driver is assigned to this booking
	if bookingDriverID != driverID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not assigned to this booking"})
		return
	}

	// Check booking status
	if status != "onhold" {
		if status == "booked" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This booking is already verified"})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This booking cannot be verified"})
		}
		return
	}

	// Check if booking date is today
	today := time.Now().Format("2006-01-02")
	// Handle different date formats from database (might include time)
	bookingDateOnly := bookingDate
	if len(bookingDate) > 10 {
		bookingDateOnly = bookingDate[:10]
	}
	if bookingDateOnly != today {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP can only be verified on the booking date"})
		return
	}

	// Verify OTP
	if req.OTP != storedOTP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP"})
		return
	}

	// Update booking status to 'booked'
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = config.DB.Exec(`
		UPDATE car_bookings SET status = 'booked', otp_verified_at = ?, updated_at = ? WHERE id = ?
	`, now, now, req.BookingID)

	if err != nil {
		log.Printf("Error updating booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify booking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP verified successfully. Booking confirmed!",
		"status":  "booked",
	})
}

// CompleteCarBooking - Driver marks car booking as completed
func CompleteCarBooking(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		log.Printf("Driver not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	var req models.CompleteCarBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get booking details
	var bookingDriverID int
	var status string
	err = config.DB.QueryRow(`
		SELECT driver_id, status FROM car_bookings WHERE id = ?
	`, req.BookingID).Scan(&bookingDriverID, &status)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Verify driver is assigned to this booking
	if bookingDriverID != driverID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not assigned to this booking"})
		return
	}

	// Check booking status - must be 'booked' to complete
	if status != "booked" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only active bookings can be completed"})
		return
	}

	// Update booking status to 'completed'
	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = config.DB.Exec(`
		UPDATE car_bookings SET status = 'completed', updated_at = ? WHERE id = ?
	`, now, req.BookingID)

	if err != nil {
		log.Printf("Error completing booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete booking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Booking completed successfully",
		"status":  "completed",
	})
}
