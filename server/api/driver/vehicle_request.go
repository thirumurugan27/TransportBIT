package driver

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"transport-server/api/admin"
	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GET /api/driver/vehicle-requests - Get vehicle requests assigned to driver
func GetDriverVehicleRequests(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists, _ := config.HasColumns(
		"vehiclerequests",
		"Purpose",
		"PurposeOfVisit",
		"RequestUnder",
		"Vertical",
		"OralApproval",
		"TravellerName",
		"Address",
		"MobileNumber",
	)
	purposeExpr := "'' as Purpose"
	if colExists["Purpose"] && colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose"
	} else if colExists["Purpose"] {
		purposeExpr = "COALESCE(vr.Purpose, '') as Purpose"
	} else if colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.PurposeOfVisit, '') as Purpose"
	}
	requestUnderExpr := "'' as RequestUnder"
	if colExists["RequestUnder"] {
		requestUnderExpr = "COALESCE(vr.RequestUnder, '') as RequestUnder"
	}
	verticalExpr := "'' as Vertical"
	if colExists["Vertical"] {
		verticalExpr = "COALESCE(vr.Vertical, '') as Vertical"
	}
	oralApprovalExpr := "0 as OralApproval"
	if colExists["OralApproval"] {
		oralApprovalExpr = "COALESCE(vr.OralApproval, 0) as OralApproval"
	}
	travellerNameExpr := "'' as TravellerName"
	if colExists["TravellerName"] {
		travellerNameExpr = "COALESCE(vr.TravellerName, '') as TravellerName"
	}
	addressExpr := "'' as Address"
	if colExists["Address"] {
		addressExpr = "COALESCE(vr.Address, '') as Address"
	}
	mobileNumberExpr := "'' as MobileNumber"
	if colExists["MobileNumber"] {
		mobileNumberExpr = "COALESCE(vr.MobileNumber, '') as MobileNumber"
	}

	// Fetch assigned vehicle requests
	query := fmt.Sprintf(`
		SELECT 
			vr.id, vr.faculty_id,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			COALESCE(vr.TripMode, 'official') as TripMode,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vr.OnwardFromPlace, '') as OnwardFromPlace,
			COALESCE(vr.OnwardToPlace, '') as OnwardToPlace,
		COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardFromDateTime,
		COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardTodateTime,
		COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
		COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
		COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as ReturnFromDateTime,
		COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at,
			COALESCE(DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_started_at,
			COALESCE(DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_ended_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? AND vr.status IN ('assigned', 'trip_started', 'completed')
		ORDER BY vr.OnwardFromDateTime DESC
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, mobileNumberExpr, travellerNameExpr, addressExpr)
	rows, err := config.DB.Query(query, driverID)
	if err != nil {
		log.Printf("Error fetching driver vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var requests []models.VehicleRequest
	for rows.Next() {
		var r models.VehicleRequest
		var tripStartedAt, tripEndedAt string
		err := rows.Scan(
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone, &r.MobileNumber, &r.GuestName, &r.Address,
			&r.Status, &r.AdminRemarks,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.CreatedAt, &tripStartedAt, &tripEndedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		if tripStartedAt != "" {
			r.TripStartedAt = &tripStartedAt
		}
		if tripEndedAt != "" {
			r.TripEndedAt = &tripEndedAt
		}

		// Map to structured Trips slice
		r.Trips = []models.Trip{}

		// Onward Trip
		onwardDate, onwardTime := splitDateTime(r.OnwardFromDateTime)
		onwardArrivalDate, onwardArrivalTime := splitDateTime(r.OnwardToDateTime)
		r.Trips = append(r.Trips, models.Trip{
			DepartureLocation: r.OnwardFromPlace,
			ArrivalLocation:   r.OnwardToPlace,
			DepartureDate:     onwardDate,
			DepartureTime:     onwardTime,
			ArrivalDate:       onwardArrivalDate,
			ArrivalTime:       onwardArrivalTime,
		})

		// Return Trip (if exists)
		if r.TripType == "round_trip" || r.ReturnFromPlace != "" {
			returnDate, returnTime := splitDateTime(r.ReturnFromDateTime)
			returnArrivalDate, returnArrivalTime := splitDateTime(r.ReturnToDateTime)
			r.Trips = append(r.Trips, models.Trip{
				DepartureLocation: r.ReturnFromPlace,
				ArrivalLocation:   r.ReturnToPlace,
				DepartureDate:     returnDate,
				DepartureTime:     returnTime,
				ArrivalDate:       returnArrivalDate,
				ArrivalTime:       returnArrivalTime,
			})
		}

		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// GET /api/driver/vehicle-requests/upcoming - Get upcoming vehicle requests
func GetDriverUpcomingVehicleRequests(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists, _ := config.HasColumns(
		"vehiclerequests",
		"Purpose",
		"PurposeOfVisit",
		"RequestUnder",
		"Vertical",
		"OralApproval",
		"TravellerName",
		"Address",
		"MobileNumber",
	)
	purposeExpr := "'' as Purpose"
	if colExists["Purpose"] && colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose"
	} else if colExists["Purpose"] {
		purposeExpr = "COALESCE(vr.Purpose, '') as Purpose"
	} else if colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.PurposeOfVisit, '') as Purpose"
	}
	requestUnderExpr := "'' as RequestUnder"
	if colExists["RequestUnder"] {
		requestUnderExpr = "COALESCE(vr.RequestUnder, '') as RequestUnder"
	}
	verticalExpr := "'' as Vertical"
	if colExists["Vertical"] {
		verticalExpr = "COALESCE(vr.Vertical, '') as Vertical"
	}
	oralApprovalExpr := "0 as OralApproval"
	if colExists["OralApproval"] {
		oralApprovalExpr = "COALESCE(vr.OralApproval, 0) as OralApproval"
	}
	travellerNameExpr := "'' as TravellerName"
	if colExists["TravellerName"] {
		travellerNameExpr = "COALESCE(vr.TravellerName, '') as TravellerName"
	}
	addressExpr := "'' as Address"
	if colExists["Address"] {
		addressExpr = "COALESCE(vr.Address, '') as Address"
	}
	mobileNumberExpr := "'' as MobileNumber"
	if colExists["MobileNumber"] {
		mobileNumberExpr = "COALESCE(vr.MobileNumber, '') as MobileNumber"
	}

	// Fetch upcoming assigned vehicle requests (departure date >= today)
	query := fmt.Sprintf(`
		SELECT 
			vr.id, vr.faculty_id,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			COALESCE(vr.TripMode, 'official') as TripMode,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vr.OnwardFromPlace, '') as OnwardFromPlace,
			COALESCE(vr.OnwardToPlace, '') as OnwardToPlace,
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at,
			COALESCE(DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_started_at,
			COALESCE(DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_ended_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? 
		AND vr.status IN ('assigned', 'trip_started')
		AND DATE(vr.OnwardFromDateTime) >= CURDATE()
		ORDER BY vr.OnwardFromDateTime ASC
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, mobileNumberExpr, travellerNameExpr, addressExpr)
	rows, err := config.DB.Query(query, driverID)
	if err != nil {
		log.Printf("Error fetching upcoming vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var requests []models.VehicleRequest
	for rows.Next() {
		var r models.VehicleRequest
		var tripStartedAt, tripEndedAt string
		err := rows.Scan(
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone, &r.MobileNumber, &r.GuestName, &r.Address,
			&r.Status, &r.AdminRemarks,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.CreatedAt, &tripStartedAt, &tripEndedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		if tripStartedAt != "" {
			r.TripStartedAt = &tripStartedAt
		}
		if tripEndedAt != "" {
			r.TripEndedAt = &tripEndedAt
		}

		// Map to structured Trips slice
		r.Trips = []models.Trip{}

		// Onward Trip
		onwardDate, onwardTime := splitDateTime(r.OnwardFromDateTime)
		onwardArrivalDate, onwardArrivalTime := splitDateTime(r.OnwardToDateTime)
		r.Trips = append(r.Trips, models.Trip{
			DepartureLocation: r.OnwardFromPlace,
			ArrivalLocation:   r.OnwardToPlace,
			DepartureDate:     onwardDate,
			DepartureTime:     onwardTime,
			ArrivalDate:       onwardArrivalDate,
			ArrivalTime:       onwardArrivalTime,
		})

		// Return Trip (if exists)
		if r.TripType == "round_trip" || r.ReturnFromPlace != "" {
			returnDate, returnTime := splitDateTime(r.ReturnFromDateTime)
			returnArrivalDate, returnArrivalTime := splitDateTime(r.ReturnToDateTime)
			r.Trips = append(r.Trips, models.Trip{
				DepartureLocation: r.ReturnFromPlace,
				ArrivalLocation:   r.ReturnToPlace,
				DepartureDate:     returnDate,
				DepartureTime:     returnTime,
				ArrivalDate:       returnArrivalDate,
				ArrivalTime:       returnArrivalTime,
			})
		}

		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/driver/vehicle-request/verify-start-otp - Driver verifies start OTP to begin trip
func VerifyStartOTP(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	var req struct {
		RequestID int    `json:"request_id"`
		OTP       string `json:"otp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status, storedOTP string
	var facultyName string
	err = config.DB.QueryRow(`
		SELECT vr.status, COALESCE(vr.start_otp, ''), u.full_name
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		WHERE vr.id = ? AND vr.driver_id = ?
	`, req.RequestID, driverID).Scan(&status, &storedOTP, &facultyName)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found or not assigned to you"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if status != "assigned" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip can only be started from assigned status"})
		return
	}

	if storedOTP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No start OTP has been generated for this request"})
		return
	}

	if req.OTP != storedOTP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP. Please check and try again."})
		return
	}

	// Generate end OTP for trip completion
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	endOTP := fmt.Sprintf("%06d", rng.Intn(1000000))

	_, err = config.DB.Exec(`
		UPDATE vehiclerequests 
		SET status = 'trip_started', trip_started_at = NOW(),
			end_otp = ?, end_otp_generated_at = NOW()
		WHERE id = ?
	`, endOTP, req.RequestID)
	if err != nil {
		log.Printf("Error starting trip: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start trip"})
		return
	}

	admin.CreateAdminNotification("trip_started", "Trip Started",
		fmt.Sprintf("Trip for request #%d by %s has started.", req.RequestID, facultyName))

	c.JSON(http.StatusOK, gin.H{
		"message": "Trip started successfully. End OTP has been sent to the requester.",
	})
}

// POST /api/driver/vehicle-request/verify-end-otp - Driver verifies end OTP to complete trip
func VerifyEndOTP(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	var req struct {
		RequestID int    `json:"request_id"`
		OTP       string `json:"otp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status, storedOTP string
	var facultyName string
	err = config.DB.QueryRow(`
		SELECT vr.status, COALESCE(vr.end_otp, ''), u.full_name
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		WHERE vr.id = ? AND vr.driver_id = ?
	`, req.RequestID, driverID).Scan(&status, &storedOTP, &facultyName)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found or not assigned to you"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if status != "trip_started" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip can only be ended from trip_started status"})
		return
	}

	if storedOTP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No end OTP has been generated for this request"})
		return
	}

	if req.OTP != storedOTP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP. Please check and try again."})
		return
	}

	_, err = config.DB.Exec(`
		UPDATE vehiclerequests 
		SET status = 'completed', trip_ended_at = NOW()
		WHERE id = ?
	`, req.RequestID)
	if err != nil {
		log.Printf("Error ending trip: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end trip"})
		return
	}

	admin.CreateAdminNotification("trip_completed", "Trip Completed",
		fmt.Sprintf("Trip for request #%d by %s has been completed.", req.RequestID, facultyName))

	c.JSON(http.StatusOK, gin.H{
		"message": "Trip completed successfully!",
	})
}

// Helper function to split date and time from "DD-MM-YYYY hh:ii AM/PM"
func splitDateTime(dtStr string) (string, string) {
	if dtStr == "" {
		return "", ""
	}
	// Expected format: "10-02-2026 07:10 AM"
	if len(dtStr) >= 10 {
		date := dtStr[:10]
		timeStr := ""
		if len(dtStr) > 11 {
			timeStr = dtStr[11:] // Get everything after the date (includes AM/PM)
		}
		return date, timeStr
	}
	return dtStr, ""
}
