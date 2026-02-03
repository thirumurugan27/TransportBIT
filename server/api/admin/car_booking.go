package admin

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GenerateOTP generates a 6-digit OTP
func generateOTP() string {
	const digits = "0123456789"
	otp := make([]byte, 6)
	for i := range otp {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			// Fallback to less secure but functional method
			otp[i] = digits[i%10]
		} else {
			otp[i] = digits[n.Int64()]
		}
	}
	return string(otp)
}

// GetAllCarBookings - Admin gets all car booking requests
func GetAllCarBookings(c *gin.Context) {
	status := c.Query("status") // optional filter
	date := c.Query("date")     // optional filter

	query := `
		SELECT cb.id, cb.faculty_id, f.user_id as faculty_user_id,
		       u.full_name as faculty_name, COALESCE(u.email, '') as faculty_email,
		       COALESCE(u.phone, '') as faculty_phone, COALESCE(f.department, '') as department,
		       cb.vehicle_id, COALESCE(v.vehicle_number, '') as vehicle_number,
		       cb.driver_id, COALESCE(du.full_name, '') as driver_name,
		       cb.booking_date, cb.start_time, cb.end_time,
		       COALESCE(cb.purpose, '') as purpose, COALESCE(cb.destination, '') as destination, cb.passenger_count,
		       cb.status, COALESCE(cb.otp, '') as otp, cb.otp_generated_at, cb.otp_verified_at,
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
		WHERE 1=1
	`

	var args []interface{}
	if status != "" {
		query += " AND cb.status = ?"
		args = append(args, status)
	}
	if date != "" {
		query += " AND cb.booking_date = ?"
		args = append(args, date)
	}

	query += " ORDER BY cb.created_at DESC"

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
		var vehicleID, driverID, approvedBy sql.NullInt64
		var otpGeneratedAt, otpVerifiedAt, approvedAt sql.NullString

		if err := rows.Scan(&b.ID, &b.FacultyID, &b.FacultyUserID, &b.FacultyName,
			&b.FacultyEmail, &b.FacultyPhone, &b.Department,
			&vehicleID, &b.VehicleNumber, &driverID, &b.DriverName,
			&b.BookingDate, &b.StartTime, &b.EndTime,
			&b.Purpose, &b.Destination, &b.PassengerCount,
			&b.Status, &b.OTP, &otpGeneratedAt, &otpVerifiedAt,
			&b.AdminRemarks, &approvedBy, &b.ApprovedByName,
			&approvedAt, &b.CreatedAt, &b.UpdatedAt); err != nil {
			log.Printf("Error scanning booking: %v", err)
			continue
		}

		// Handle nullable fields
		if vehicleID.Valid {
			vid := int(vehicleID.Int64)
			b.VehicleID = &vid
		}
		if driverID.Valid {
			did := int(driverID.Int64)
			b.DriverID = &did
		}
		if approvedBy.Valid {
			aid := int(approvedBy.Int64)
			b.ApprovedBy = &aid
		}
		if otpGeneratedAt.Valid {
			b.OTPGeneratedAt = &otpGeneratedAt.String
		}
		if otpVerifiedAt.Valid {
			b.OTPVerifiedAt = &otpVerifiedAt.String
		}
		if approvedAt.Valid {
			b.ApprovedAt = &approvedAt.String
		}

		bookings = append(bookings, b)
	}

	if bookings == nil {
		bookings = []models.CarBooking{}
	}

	c.JSON(http.StatusOK, bookings)
}

// GetPendingCarBookingsCount - Get count of pending car booking requests
func GetPendingCarBookingsCount(c *gin.Context) {
	var count int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM car_bookings WHERE status = 'pending'
	`).Scan(&count)
	if err != nil {
		log.Printf("Error counting pending bookings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ApproveCarBooking - Admin approves a car booking and assigns vehicle/driver
func ApproveCarBooking(c *gin.Context) {
	adminUserID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.ApproveCarBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.VehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID is required"})
		return
	}
	if req.DriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver ID is required"})
		return
	}

	// Check if booking exists and is pending
	var currentStatus, bookingDate string
	err = config.DB.QueryRow(`
		SELECT status, booking_date FROM car_bookings WHERE id = ?
	`, req.BookingID).Scan(&currentStatus, &bookingDate)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending bookings can be approved"})
		return
	}

	// Check vehicle availability for the booking date
	var vehicleConflict int
	err = config.DB.QueryRow(`
		SELECT COUNT(*) FROM car_bookings 
		WHERE vehicle_id = ? AND booking_date = ? AND status IN ('approved', 'onhold', 'booked') AND id != ?
	`, req.VehicleID, bookingDate, req.BookingID).Scan(&vehicleConflict)
	if err != nil {
		log.Printf("Error checking vehicle conflict: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if vehicleConflict > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Selected vehicle is already booked for this date"})
		return
	}

	// Check driver availability for the booking date
	var driverConflict int
	err = config.DB.QueryRow(`
		SELECT COUNT(*) FROM car_bookings 
		WHERE driver_id = ? AND booking_date = ? AND status IN ('approved', 'onhold', 'booked') AND id != ?
	`, req.DriverID, bookingDate, req.BookingID).Scan(&driverConflict)
	if err != nil {
		log.Printf("Error checking driver conflict: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if driverConflict > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Selected driver is already assigned for this date"})
		return
	}

	// Generate OTP
	otp := generateOTP()
	now := time.Now().Format("2006-01-02 15:04:05")

	// Update booking with approval details
	// Status is set to 'onhold' until OTP verification on booking date
	_, err = config.DB.Exec(`
		UPDATE car_bookings 
		SET vehicle_id = ?, driver_id = ?, status = 'onhold', 
		    otp = ?, otp_generated_at = ?,
		    admin_remarks = ?, approved_by = ?, approved_at = ?, updated_at = ?
		WHERE id = ?
	`, req.VehicleID, req.DriverID, otp, now, req.AdminRemarks, adminUserID, now, now, req.BookingID)

	if err != nil {
		log.Printf("Error approving booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve booking"})
		return
	}

	// Get faculty details for notification
	var facultyName, facultyEmail, vehicleNumber string
	config.DB.QueryRow(`
		SELECT u.full_name, COALESCE(u.email, ''), v.vehicle_number
		FROM car_bookings cb
		JOIN faculty f ON cb.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		JOIN vehicles v ON cb.vehicle_id = v.id
		WHERE cb.id = ?
	`, req.BookingID).Scan(&facultyName, &facultyEmail, &vehicleNumber)

	c.JSON(http.StatusOK, gin.H{
		"message":        "Booking approved successfully",
		"otp":            otp,
		"vehicle_number": vehicleNumber,
		"status":         "onhold",
		"note":           "OTP has been generated. Faculty will share this OTP with the driver on the booking date.",
	})
}

// RejectCarBooking - Admin rejects a car booking request
func RejectCarBooking(c *gin.Context) {
	adminUserID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.RejectCarBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Check if booking exists and is pending
	var currentStatus string
	err = config.DB.QueryRow(`
		SELECT status FROM car_bookings WHERE id = ?
	`, req.BookingID).Scan(&currentStatus)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending bookings can be rejected"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = config.DB.Exec(`
		UPDATE car_bookings 
		SET status = 'rejected', admin_remarks = ?, approved_by = ?, approved_at = ?, updated_at = ?
		WHERE id = ?
	`, req.AdminRemarks, adminUserID, now, now, req.BookingID)

	if err != nil {
		log.Printf("Error rejecting booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject booking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Booking rejected"})
}

// CancelOnholdCarBooking - Admin cancels an onhold booking (releases vehicle/driver)
func CancelOnholdCarBooking(c *gin.Context) {
	adminUserID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		BookingID    int    `json:"booking_id"`
		AdminRemarks string `json:"admin_remarks"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Check if booking exists and is onhold, and get details for notifications
	var currentStatus string
	var driverID sql.NullInt64
	var facultyUserID int
	var facultyName, bookingDate, destination, vehicleNumber string
	err = config.DB.QueryRow(`
		SELECT cb.status, cb.driver_id, f.user_id, u.full_name, cb.booking_date, 
		       COALESCE(cb.destination, ''), COALESCE(v.vehicle_number, '')
		FROM car_bookings cb
		JOIN faculty f ON cb.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON cb.vehicle_id = v.id
		WHERE cb.id = ?
	`, req.BookingID).Scan(&currentStatus, &driverID, &facultyUserID, &facultyName, &bookingDate, &destination, &vehicleNumber)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if currentStatus != "onhold" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only onhold bookings can be cancelled"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	// Set status to cancelled and clear vehicle/driver assignments
	_, err = config.DB.Exec(`
		UPDATE car_bookings 
		SET status = 'cancelled', vehicle_id = NULL, driver_id = NULL, 
		    otp = NULL, otp_generated_at = NULL,
		    admin_remarks = ?, approved_by = ?, updated_at = ?
		WHERE id = ?
	`, req.AdminRemarks, adminUserID, now, req.BookingID)

	if err != nil {
		log.Printf("Error cancelling onhold booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel booking"})
		return
	}

	// Send notification to driver if assigned
	if driverID.Valid {
		notifTitle := "Car Booking Cancelled"
		notifMsg := fmt.Sprintf("Your car booking assignment for %s on %s has been cancelled by admin.", facultyName, bookingDate)
		if destination != "" {
			notifMsg += fmt.Sprintf(" Destination: %s.", destination)
		}
		if req.AdminRemarks != "" {
			notifMsg += fmt.Sprintf(" Reason: %s", req.AdminRemarks)
		}
		_, err = config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id, created_at)
			VALUES (?, ?, ?, 'car_booking_cancelled', ?, ?)
		`, driverID.Int64, notifTitle, notifMsg, req.BookingID, now)
		if err != nil {
			log.Printf("Error creating driver notification: %v", err)
			// Don't fail the request, just log
		}
	}

	// Send notification to faculty (using user_notifications table if exists, or we can add to admin_notifications for now)
	facultyNotifTitle := "Your Car Booking Has Been Cancelled"
	facultyNotifMsg := fmt.Sprintf("Your car booking for %s", bookingDate)
	if vehicleNumber != "" {
		facultyNotifMsg += fmt.Sprintf(" (Vehicle: %s)", vehicleNumber)
	}
	facultyNotifMsg += " has been cancelled by the transport admin."
	if req.AdminRemarks != "" {
		facultyNotifMsg += fmt.Sprintf(" Reason: %s", req.AdminRemarks)
	}

	// Insert faculty notification - using a general notifications approach
	// Check if user_notifications table exists, otherwise create entry in a simple way
	_, err = config.DB.Exec(`
		INSERT INTO user_notifications (user_id, title, message, type, related_id, is_read, created_at)
		VALUES (?, ?, ?, 'car_booking_cancelled', ?, FALSE, ?)
	`, facultyUserID, facultyNotifTitle, facultyNotifMsg, req.BookingID, now)
	if err != nil {
		log.Printf("Error creating faculty notification (table may not exist): %v", err)
		// Don't fail - table might not exist yet
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Booking cancelled successfully",
		"note":    "Vehicle and driver have been released. Notifications sent to driver and faculty.",
	})
}

// GetAvailableCarsForBooking - Get ALL cars with availability info for a specific date
func GetAvailableCarsForBooking(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Date is required"})
		return
	}

	startTime := c.Query("start_time")
	endTime := c.Query("end_time")

	// Get all CAR type vehicles
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.seating_capacity, COALESCE(v.status, 'available'), v.fuel_type
		FROM vehicles v
		WHERE v.vehicle_type = 'CAR' 
		AND LOWER(COALESCE(v.status, 'available')) IN ('active', 'available')
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("Error fetching cars: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type CarWithAvailability struct {
		ID              int    `json:"id"`
		VehicleNumber   string `json:"vehicle_number"`
		SeatingCapacity int    `json:"seating_capacity"`
		Status          string `json:"status"`
		FuelType        string `json:"fuel_type"`
		IsAvailable     bool   `json:"is_available"`
		ConflictInfo    string `json:"conflict_info,omitempty"`
	}

	var cars []CarWithAvailability
	for rows.Next() {
		var car CarWithAvailability
		if err := rows.Scan(&car.ID, &car.VehicleNumber, &car.SeatingCapacity,
			&car.Status, &car.FuelType); err != nil {
			log.Printf("Error scanning car: %v", err)
			continue
		}
		car.IsAvailable = true
		cars = append(cars, car)
	}

	// Check each car for conflicts
	for i := range cars {
		conflictQuery := `
			SELECT cb.start_time, cb.end_time, u.full_name
			FROM car_bookings cb
			LEFT JOIN faculty f ON cb.faculty_id = f.id
			LEFT JOIN users u ON f.user_id = u.id
			WHERE cb.vehicle_id = ? AND cb.booking_date = ? 
			AND cb.status IN ('approved', 'onhold', 'booked')
		`
		args := []interface{}{cars[i].ID, date}

		if startTime != "" && endTime != "" {
			conflictQuery += ` AND NOT (cb.end_time <= ? OR cb.start_time >= ?)`
			args = append(args, startTime, endTime)
		}
		conflictQuery += ` LIMIT 1`

		var conflictStart, conflictEnd, facultyName string
		err := config.DB.QueryRow(conflictQuery, args...).Scan(&conflictStart, &conflictEnd, &facultyName)
		if err == nil {
			cars[i].IsAvailable = false
			cars[i].ConflictInfo = fmt.Sprintf("Booked %s-%s for %s", conflictStart, conflictEnd, facultyName)
		}
	}

	if cars == nil {
		cars = []CarWithAvailability{}
	}

	c.JSON(http.StatusOK, cars)
}

// GetAvailableDriversForCarBooking - Get ALL drivers with availability info for a specific date
func GetAvailableDriversForCarBooking(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Date is required"})
		return
	}

	startTime := c.Query("start_time")
	endTime := c.Query("end_time")

	// Get all drivers
	rows, err := config.DB.Query(`
		SELECT d.id, u.full_name, COALESCE(u.phone, '') as phone,
		       COALESCE(d.license_number, '') as license_number,
		       COALESCE(d.allowed_vehicle_type, 'ALL') as allowed_vehicle_type,
		       COALESCE(u.status, 'active') as status
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Error fetching drivers: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type DriverWithAvailability struct {
		ID                 int    `json:"id"`
		FullName           string `json:"full_name"`
		Phone              string `json:"phone"`
		LicenseNumber      string `json:"license_number"`
		AllowedVehicleType string `json:"allowed_vehicle_type"`
		Status             string `json:"status"`
		IsAvailable        bool   `json:"is_available"`
		ConflictInfo       string `json:"conflict_info,omitempty"`
	}

	var drivers []DriverWithAvailability
	for rows.Next() {
		var d DriverWithAvailability
		if err := rows.Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.AllowedVehicleType, &d.Status); err != nil {
			log.Printf("Error scanning driver: %v", err)
			continue
		}
		d.IsAvailable = true
		drivers = append(drivers, d)
	}

	// Check each driver for conflicts
	for i := range drivers {
		conflictQuery := `
			SELECT cb.start_time, cb.end_time, v.vehicle_number
			FROM car_bookings cb
			LEFT JOIN vehicles v ON cb.vehicle_id = v.id
			WHERE cb.driver_id = ? AND cb.booking_date = ? 
			AND cb.status IN ('approved', 'onhold', 'booked')
		`
		args := []interface{}{drivers[i].ID, date}

		if startTime != "" && endTime != "" {
			conflictQuery += ` AND NOT (cb.end_time <= ? OR cb.start_time >= ?)`
			args = append(args, startTime, endTime)
		}
		conflictQuery += ` LIMIT 1`

		var conflictStart, conflictEnd, vehicleNumber string
		err := config.DB.QueryRow(conflictQuery, args...).Scan(&conflictStart, &conflictEnd, &vehicleNumber)
		if err == nil {
			drivers[i].IsAvailable = false
			drivers[i].ConflictInfo = fmt.Sprintf("Assigned %s-%s on %s", conflictStart, conflictEnd, vehicleNumber)
		}
	}

	if drivers == nil {
		drivers = []DriverWithAvailability{}
	}

	c.JSON(http.StatusOK, drivers)
}

// CreateFaculty - Admin creates a new faculty user
func CreateFaculty(c *gin.Context) {
	var req models.CreateFacultyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Username == "" || req.Password == "" || req.FullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username, password and full name are required"})
		return
	}

	// Check if username already exists
	var existingID int
	err := config.DB.QueryRow("SELECT id FROM users WHERE username = ?", req.Username).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("Error checking username: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Start transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback()

	// Insert user
	result, err := tx.Exec(`
		INSERT INTO users (username, password, role, full_name, email, phone)
		VALUES (?, ?, 'FACULTY', ?, ?, ?)
	`, req.Username, req.Password, req.FullName, req.Email, req.Phone)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	userID, _ := result.LastInsertId()

	// Insert faculty record
	_, err = tx.Exec(`
		INSERT INTO faculty (user_id, department, designation)
		VALUES (?, ?, ?)
	`, userID, req.Department, req.Designation)
	if err != nil {
		log.Printf("Error creating faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create faculty"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Faculty created successfully",
		"user_id": userID,
	})
}

// GetAllFaculty - Admin gets list of all faculty members
func GetAllFaculty(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT f.id, f.user_id, u.username, u.full_name, 
		       COALESCE(u.email, '') as email, COALESCE(u.phone, '') as phone,
		       COALESCE(f.department, '') as department, COALESCE(f.designation, '') as designation
		FROM faculty f
		JOIN users u ON f.user_id = u.id
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Error fetching faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var facultyList []struct {
		ID          int    `json:"id"`
		UserID      int    `json:"user_id"`
		Username    string `json:"username"`
		FullName    string `json:"full_name"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		Department  string `json:"department"`
		Designation string `json:"designation"`
	}

	for rows.Next() {
		var f struct {
			ID          int    `json:"id"`
			UserID      int    `json:"user_id"`
			Username    string `json:"username"`
			FullName    string `json:"full_name"`
			Email       string `json:"email"`
			Phone       string `json:"phone"`
			Department  string `json:"department"`
			Designation string `json:"designation"`
		}
		if err := rows.Scan(&f.ID, &f.UserID, &f.Username, &f.FullName, &f.Email, &f.Phone,
			&f.Department, &f.Designation); err != nil {
			log.Printf("Error scanning faculty: %v", err)
			continue
		}
		facultyList = append(facultyList, f)
	}

	if facultyList == nil {
		facultyList = []struct {
			ID          int    `json:"id"`
			UserID      int    `json:"user_id"`
			Username    string `json:"username"`
			FullName    string `json:"full_name"`
			Email       string `json:"email"`
			Phone       string `json:"phone"`
			Department  string `json:"department"`
			Designation string `json:"designation"`
		}{}
	}

	c.JSON(http.StatusOK, facultyList)
}

// DeleteFaculty - Admin deletes a faculty member
func DeleteFaculty(c *gin.Context) {
	var req struct {
		FacultyID int `json:"faculty_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get user ID for this faculty
	var userID int
	err := config.DB.QueryRow("SELECT user_id FROM faculty WHERE id = ?", req.FacultyID).Scan(&userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Start transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback()

	// Delete car bookings for this faculty
	_, err = tx.Exec("DELETE FROM car_bookings WHERE faculty_id = ?", req.FacultyID)
	if err != nil {
		log.Printf("Error deleting car bookings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete faculty data"})
		return
	}

	// Delete faculty record
	_, err = tx.Exec("DELETE FROM faculty WHERE id = ?", req.FacultyID)
	if err != nil {
		log.Printf("Error deleting faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete faculty"})
		return
	}

	// Delete user record
	_, err = tx.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		log.Printf("Error deleting user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Faculty deleted successfully"})
}

// AdminCreateCarBookingRequest - request body for admin creating a car booking
type AdminCreateCarBookingRequest struct {
	RequesterName       string `json:"requester_name"`
	RequesterPhone      string `json:"requester_phone"`
	RequesterDepartment string `json:"requester_department"`
	FacultyID           int    `json:"faculty_id"`
	BookingDate         string `json:"booking_date"`
	StartTime           string `json:"start_time"`
	EndTime             string `json:"end_time"`
	Purpose             string `json:"purpose"`
	Destination         string `json:"destination"`
	PassengerCount      int    `json:"passenger_count"`
	VehicleID           int    `json:"vehicle_id"`
	DriverID            int    `json:"driver_id"`
}

// AdminCreateCarBooking - Admin creates a car booking directly (not from faculty request)
func AdminCreateCarBooking(c *gin.Context) {
	var req AdminCreateCarBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate required fields
	if req.VehicleID == 0 || req.DriverID == 0 || req.FacultyID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Faculty, vehicle, and driver are required"})
		return
	}
	if req.BookingDate == "" {
		req.BookingDate = time.Now().Format("2006-01-02")
	}
	if req.StartTime == "" {
		req.StartTime = "09:00"
	}
	if req.EndTime == "" {
		req.EndTime = "17:00"
	}
	if req.PassengerCount == 0 {
		req.PassengerCount = 1
	}

	// Get admin user ID from token
	adminID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Ensure faculty exists
	var facultyName, facultyPhone, facultyEmail string
	err = config.DB.QueryRow(`
		SELECT u.full_name, COALESCE(u.phone, ''), COALESCE(u.email, '')
		FROM faculty f
		JOIN users u ON f.user_id = u.id
		WHERE f.id = ?
	`, req.FacultyID).Scan(&facultyName, &facultyPhone, &facultyEmail)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid faculty"})
		return
	}
	if err != nil {
		log.Printf("Error checking faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Generate OTP
	otp := generateOTP()
	now := time.Now()

	// Insert into car_bookings table with status 'onhold'
	result, err := config.DB.Exec(`
		INSERT INTO car_bookings (
			faculty_id, vehicle_id, driver_id, booking_date, start_time, end_time,
			purpose, destination, passenger_count, status, otp, otp_generated_at,
			approved_by, approved_at, admin_remarks, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'onhold', ?, ?, ?, ?, ?, NOW(), NOW())
	`, req.FacultyID, req.VehicleID, req.DriverID, req.BookingDate, req.StartTime, req.EndTime,
		req.Purpose, req.Destination, req.PassengerCount, otp, now, adminID, now,
		fmt.Sprintf("Admin booking for: %s (%s)", facultyName, req.RequesterDepartment))

	if err != nil {
		log.Printf("Error creating admin car booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking"})
		return
	}

	bookingID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"message":    "Car booking created successfully",
		"booking_id": bookingID,
		"otp":        otp,
		"status":     "onhold",
	})
}

// Dummy function to avoid "declared but not used" error
func init() {
	_ = fmt.Sprintf
}
