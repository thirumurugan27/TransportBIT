package faculty

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GetAvailableCars - Get list of cars with availability for faculty
func GetAvailableCars(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.seating_capacity, COALESCE(v.status, 'active'), v.fuel_type,
		       CASE 
		           WHEN LOWER(COALESCE(v.status, 'active')) NOT IN ('active', 'available') THEN 0
		           WHEN EXISTS (
		               SELECT 1 FROM car_bookings cb 
		               WHERE cb.vehicle_id = v.id 
		               AND cb.booking_date = ? 
		               AND cb.status IN ('approved', 'onhold', 'booked')
		           ) THEN 0
		           ELSE 1
		       END as is_available
		FROM vehicles v
		WHERE v.vehicle_type = 'CAR'
		ORDER BY v.vehicle_number
	`, date)

	if err != nil {
		log.Printf("Error fetching cars: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var cars []models.AvailableCar
	for rows.Next() {
		var car models.AvailableCar
		if err := rows.Scan(&car.ID, &car.VehicleNumber, &car.SeatingCapacity,
			&car.Status, &car.FuelType, &car.IsAvailable); err != nil {
			log.Printf("Error scanning car: %v", err)
			continue
		}
		cars = append(cars, car)
	}

	if cars == nil {
		cars = []models.AvailableCar{}
	}

	c.JSON(http.StatusOK, cars)
}

// GetMyCarBookings - Get faculty's car booking requests
func GetMyCarBookings(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get faculty ID
	var facultyID int
	err = config.DB.QueryRow("SELECT id FROM faculty WHERE user_id = ?", userID).Scan(&facultyID)
	if err != nil {
		log.Printf("Faculty not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
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
		       cb.status, 
		       CASE WHEN cb.status IN ('approved', 'onhold') THEN cb.otp ELSE '' END as otp,
		       cb.otp_generated_at, cb.otp_verified_at,
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
		WHERE cb.faculty_id = ?
	`

	args := []interface{}{facultyID}
	if status != "" {
		query += " AND cb.status = ?"
		args = append(args, status)
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

// CreateCarBooking - Faculty submits a car booking request
func CreateCarBooking(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCarBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.BookingDate) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Booking date is required"})
		return
	}
	if strings.TrimSpace(req.StartTime) == "" || strings.TrimSpace(req.EndTime) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start and end time are required"})
		return
	}
	if strings.TrimSpace(req.Purpose) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purpose is required"})
		return
	}

	// Get faculty ID
	var facultyID int
	err = config.DB.QueryRow("SELECT id FROM faculty WHERE user_id = ?", userID).Scan(&facultyID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Check if booking date is in the future
	bookingDate, err := time.Parse("2006-01-02", req.BookingDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
		return
	}
	today := time.Now().Truncate(24 * time.Hour)
	if bookingDate.Before(today) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Booking date must be today or in the future"})
		return
	}

	// Check for duplicate pending requests on same date
	var existingCount int
	err = config.DB.QueryRow(`
		SELECT COUNT(*) FROM car_bookings 
		WHERE faculty_id = ? AND booking_date = ? AND status IN ('pending', 'approved', 'onhold', 'booked')
	`, facultyID, req.BookingDate).Scan(&existingCount)
	if err != nil {
		log.Printf("Error checking duplicates: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if existingCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "You already have a booking request for this date"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	passengerCount := req.PassengerCount
	if passengerCount == 0 {
		passengerCount = 1
	}

	result, err := config.DB.Exec(`
		INSERT INTO car_bookings (faculty_id, booking_date, start_time, end_time, 
		                          purpose, destination, passenger_count, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, facultyID, req.BookingDate, req.StartTime, req.EndTime,
		req.Purpose, req.Destination, passengerCount, now, now)

	if err != nil {
		log.Printf("Error creating booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create booking request"})
		return
	}

	bookingID, _ := result.LastInsertId()

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Car booking request submitted successfully",
		"booking_id": bookingID,
	})
}

// CancelCarBooking - Faculty cancels their pending booking
func CancelCarBooking(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		BookingID int `json:"booking_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get faculty ID
	var facultyID int
	err = config.DB.QueryRow("SELECT id FROM faculty WHERE user_id = ?", userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	// Check if booking exists and belongs to this faculty
	var status string
	err = config.DB.QueryRow(`
		SELECT status FROM car_bookings WHERE id = ? AND faculty_id = ?
	`, req.BookingID, facultyID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Only pending bookings can be cancelled by faculty
	if status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending bookings can be cancelled"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	_, err = config.DB.Exec(`
		UPDATE car_bookings SET status = 'cancelled', updated_at = ? WHERE id = ?
	`, now, req.BookingID)
	if err != nil {
		log.Printf("Error cancelling booking: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel booking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Booking cancelled successfully"})
}
