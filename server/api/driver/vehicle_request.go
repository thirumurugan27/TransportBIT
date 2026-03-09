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

	"github.com/gin-gonic/gin"
)

func vehicleRequestColumns(columnNames ...string) map[string]bool {
	known := map[string]bool{
		"requester_id":       true,
		"faculty_id":         true,
		"Purpose":            true,
		"PurposeOfVisit":     true,
		"RequestUnder":       true,
		"Vertical":           true,
		"OralApproval":       false,
		"TravellerName":      true,
		"Address":            true,
		"MobileNumber":       true,
		"OnwardFromDateTime": true,
		"OnwardTodateTime":   true,
		"OnwardToDateTime":   false,
	}
	out := make(map[string]bool, len(columnNames))
	for _, c := range columnNames {
		out[c] = known[c]
	}
	return out
}

// GET /api/driver/vehicle-requests - Get vehicle requests assigned to driver
func GetDriverVehicleRequests(c *gin.Context) {
	userID := c.GetInt("user_id")

	// Get driver ID
	var driverID int
	err := config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists := vehicleRequestColumns(
		"requester_id",
		"faculty_id",
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

	onwardFromExpr := "COALESCE(DATE_FORMAT(vrt.from_datetime, '%d-%m-%Y %h:%i %p'), '') as OnwardFromDateTime"
	onwardToExpr := "COALESCE(DATE_FORMAT(vrt.to_datetime, '%d-%m-%Y %h:%i %p'), '') as OnwardTodateTime"

	// Fetch assigned vehicle requests
	facultyIDExpr := "0 as faculty_id"
	if colExists["faculty_id"] {
		facultyIDExpr = "COALESCE(vr.faculty_id, 0) as faculty_id"
	}
	query := fmt.Sprintf(`
		SELECT 
			vr.id, %s,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			'official' as TripMode,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vrt.from_place, '') as OnwardFromPlace,
			COALESCE(vrt.to_place, '') as OnwardToPlace,
			%s,
			%s,
			'' as ReturnFromPlace,
			'' as ReturnToPlace,
			'' as ReturnFromDateTime,
			'' as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			COALESCE(ru.full_name, '') as faculty_name,
			COALESCE(ru.email, '') as faculty_email,
			COALESCE(ru.phone, '') as faculty_phone,
			COALESCE(rf.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			'' as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at,
			COALESCE(DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_started_at,
			COALESCE(DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_ended_at
		FROM vehiclerequests vr
		LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
		LEFT JOIN users ru ON vr.requester_id = ru.id
		LEFT JOIN faculty rf ON rf.user_id = ru.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? AND vr.status IN ('assigned', 'trip_started', 'completed')
		ORDER BY COALESCE(vrt.from_datetime, vr.created_at) DESC
	`, facultyIDExpr, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, onwardFromExpr, onwardToExpr, mobileNumberExpr, travellerNameExpr, addressExpr)
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

		// Load trips from vehicle_request_trips table
		r.Trips = []models.Trip{}
		tripRows, tripErr := config.DB.Query(`
			SELECT trip_order, COALESCE(from_place, '') as from_place, COALESCE(to_place, '') as to_place,
				COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') as dep_date,
				COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') as dep_time,
				COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') as arr_date,
				COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') as arr_time
			FROM vehicle_request_trips
			WHERE request_id = ?
			ORDER BY trip_order ASC
		`, r.ID)
		if tripErr == nil {
			for tripRows.Next() {
				var t models.Trip
				if err := tripRows.Scan(&t.TripOrder, &t.DepartureLocation, &t.ArrivalLocation, &t.DepartureDate, &t.DepartureTime, &t.ArrivalDate, &t.ArrivalTime); err == nil {
					r.Trips = append(r.Trips, t)
				}
			}
			tripRows.Close()
		}

		// Fallback: construct from onward/return fields
		if len(r.Trips) == 0 {
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

			if r.ReturnFromPlace != "" || r.ReturnToPlace != "" {
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
		}

		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// GET /api/driver/vehicle-requests/upcoming - Get upcoming vehicle requests
func GetDriverUpcomingVehicleRequests(c *gin.Context) {
	userID := c.GetInt("user_id")

	var driverID int
	err := config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists := vehicleRequestColumns(
		"requester_id",
		"faculty_id",
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

	onwardFromExpr := "COALESCE(DATE_FORMAT(vrt.from_datetime, '%d-%m-%Y %h:%i %p'), '') as OnwardFromDateTime"
	onwardToExpr := "COALESCE(DATE_FORMAT(vrt.to_datetime, '%d-%m-%Y %h:%i %p'), '') as OnwardTodateTime"

	// Fetch upcoming assigned vehicle requests (departure date >= today)
	facultyIDExpr := "0 as faculty_id"
	if colExists["faculty_id"] {
		facultyIDExpr = "COALESCE(vr.faculty_id, 0) as faculty_id"
	}
	query := fmt.Sprintf(`
		SELECT 
			vr.id, %s,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			'official' as TripMode,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vrt.from_place, '') as OnwardFromPlace,
			COALESCE(vrt.to_place, '') as OnwardToPlace,
			%s,
			%s,
			'' as ReturnFromPlace,
			'' as ReturnToPlace,
			'' as ReturnFromDateTime,
			'' as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			COALESCE(ru.full_name, '') as faculty_name,
			COALESCE(ru.email, '') as faculty_email,
			COALESCE(ru.phone, '') as faculty_phone,
			COALESCE(rf.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			'' as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at,
			COALESCE(DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_started_at,
			COALESCE(DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p'), '') as trip_ended_at
		FROM vehiclerequests vr
		LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
		LEFT JOIN users ru ON vr.requester_id = ru.id
		LEFT JOIN faculty rf ON rf.user_id = ru.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? 
		AND vr.status IN ('assigned', 'trip_started')
		AND DATE(vrt.from_datetime) >= CURDATE()
		ORDER BY vrt.from_datetime ASC
	`, facultyIDExpr, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, onwardFromExpr, onwardToExpr, mobileNumberExpr, travellerNameExpr, addressExpr)
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

		// Load trips from vehicle_request_trips table
		r.Trips = []models.Trip{}
		tripRows2, tripErr2 := config.DB.Query(`
			SELECT trip_order, COALESCE(from_place, '') as from_place, COALESCE(to_place, '') as to_place,
				COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') as dep_date,
				COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') as dep_time,
				COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') as arr_date,
				COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') as arr_time
			FROM vehicle_request_trips
			WHERE request_id = ?
			ORDER BY trip_order ASC
		`, r.ID)
		if tripErr2 == nil {
			for tripRows2.Next() {
				var t models.Trip
				if err := tripRows2.Scan(&t.TripOrder, &t.DepartureLocation, &t.ArrivalLocation, &t.DepartureDate, &t.DepartureTime, &t.ArrivalDate, &t.ArrivalTime); err == nil {
					r.Trips = append(r.Trips, t)
				}
			}
			tripRows2.Close()
		}

		// Fallback: construct from onward/return fields
		if len(r.Trips) == 0 {
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

			if r.ReturnFromPlace != "" || r.ReturnToPlace != "" {
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
		}

		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/driver/vehicle-request/verify-start-otp - Driver verifies start OTP to begin trip
func VerifyStartOTP(c *gin.Context) {
	userID := c.GetInt("user_id")

	var driverID int
	err := config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
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
		SELECT vr.status, COALESCE(vr.start_otp, ''), COALESCE(ru.full_name, 'Requester')
		FROM vehiclerequests vr
		LEFT JOIN users ru ON vr.requester_id = ru.id
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
	userID := c.GetInt("user_id")

	var driverID int
	err := config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
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
		SELECT vr.status, COALESCE(vr.end_otp, ''), COALESCE(ru.full_name, 'Requester')
		FROM vehiclerequests vr
		LEFT JOIN users ru ON vr.requester_id = ru.id
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
