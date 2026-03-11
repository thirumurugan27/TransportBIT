package faculty

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

func vehicleRequestColumns(columnNames ...string) map[string]bool {
	known := map[string]bool{
		"requester_id":       true,
		"approved_by":        true,
		"faculty_id":         true,
		"BookingType":        true,
		"TripType":           true,
		"TripMode":           false,
		"RequestUnder":       true,
		"Vertical":           true,
		"OralApproval":       false,
		"OnwardFromPlace":    true,
		"OnwardToPlace":      true,
		"OnwardFromDateTime": true,
		"OnwardTodateTime":   true,
		"ReturnFromPlace":    false,
		"ReturnToPlace":      false,
		"ReturnFromDateTime": false,
		"ReturnTodateTime":   false,
		"CountPerson":        true,
		"Purpose":            true,
		"PurposeOfVisit":     true,
		"TravellerName":      true,
		"Address":            true,
		"MobileNumber":       true,
		"ContactName":        true,
		"ContactPhone":       true,
		"TaskID":             true,
		"OutcomeExpected":    false,
		"OutcomeAuditable":   false,
		"status":             true,
	}
	out := make(map[string]bool, len(columnNames))
	for _, c := range columnNames {
		out[c] = known[c]
	}
	return out
}

func upsertPrimaryVehicleRequestTrip(requestID int64, req models.CreateVehicleRequestInput) error {
	if strings.TrimSpace(req.OnwardFromDateTime) == "" || strings.TrimSpace(req.OnwardFromPlace) == "" || strings.TrimSpace(req.OnwardToPlace) == "" {
		return nil
	}

	_, err := config.DB.Exec(`
		INSERT INTO vehicle_request_trips (request_id, trip_order, from_place, to_place, from_datetime, to_datetime)
		VALUES (?, 1, ?, ?, ?, NULLIF(?, ''))
		ON DUPLICATE KEY UPDATE
			from_place = VALUES(from_place),
			to_place = VALUES(to_place),
			from_datetime = VALUES(from_datetime),
			to_datetime = VALUES(to_datetime)
	`, requestID, strings.TrimSpace(req.OnwardFromPlace), strings.TrimSpace(req.OnwardToPlace), req.OnwardFromDateTime, strings.TrimSpace(req.OnwardToDateTime))

	return err
}

// POST /api/faculty/vehicle-request
func CreateVehicleRequest(c *gin.Context) {
	userID := c.GetInt("user_id")

	var facultyID int
	err := config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	// Fetch faculty details to populate legacy indenter columns (older schemas often require these in strict mode)
	var facultyName, facultyPhone, facultyDepartment, facultyDesignation string
	err = config.DB.QueryRow(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.phone, ''), COALESCE(f.department, ''), COALESCE(f.designation, '')
		FROM faculty f
		JOIN users u ON f.user_id = u.id
		WHERE f.id = ?
	`, facultyID).Scan(&facultyName, &facultyPhone, &facultyDepartment, &facultyDesignation)
	if err != nil {
		log.Printf("Error fetching faculty profile details: %v", err)
		// Don't block request creation; we'll still attempt insert with what we have.
	}

	var req models.CreateVehicleRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Bind JSON Error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	log.Printf("Received Vehicle Request: %+v", req)

	// Accept legacy payload key as an alias
	if strings.TrimSpace(req.Purpose) == "" && strings.TrimSpace(req.PurposeOfVisit) != "" {
		req.Purpose = strings.TrimSpace(req.PurposeOfVisit)
	}
	if strings.TrimSpace(req.ContactPhone) == "" && strings.TrimSpace(req.MobileNumber) != "" {
		req.ContactPhone = strings.TrimSpace(req.MobileNumber)
	}

	if req.Purpose == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purpose is required"})
		return
	}
	if req.OnwardFromPlace == "" || req.OnwardToPlace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Onward journey details are required"})
		return
	}
	if req.OnwardFromDateTime == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Departure date/time is required"})
		return
	}

	// Apply defaults when client sends empty strings (otherwise DB defaults won't be used because we specify columns explicitly)
	if strings.TrimSpace(req.BookingType) == "" {
		req.BookingType = "faculty"
	}
	if strings.TrimSpace(req.TripType) == "" {
		req.TripType = "one_way"
	}
	if strings.TrimSpace(req.TripMode) == "" {
		req.TripMode = "official"
	}
	if req.CountPerson <= 0 {
		req.CountPerson = 1
	}

	// Normalize datetime values to MySQL-friendly format.
	normalizeDateTime := func(input string) (string, error) {
		input = strings.TrimSpace(input)
		if input == "" {
			return "", nil
		}

		// Common formats from HTML datetime-local and JS.
		layouts := []string{
			"2006-01-02 15:04:05",
			"2006-01-02 15:04",
			"2006-01-02T15:04:05",
			"2006-01-02T15:04",
			time.RFC3339,
			"2006-01-02T15:04:05.000Z07:00",
		}

		var lastErr error
		for _, layout := range layouts {
			t, err := time.Parse(layout, input)
			if err == nil {
				return t.Format("2006-01-02 15:04:05"), nil
			}
			lastErr = err
		}
		return "", lastErr
	}

	var errNorm error
	req.OnwardFromDateTime, errNorm = normalizeDateTime(req.OnwardFromDateTime)
	if errNorm != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid onward departure date/time"})
		return
	}
	req.OnwardToDateTime, errNorm = normalizeDateTime(req.OnwardToDateTime)
	if errNorm != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid onward arrival date/time"})
		return
	}
	req.ReturnFromDateTime, errNorm = normalizeDateTime(req.ReturnFromDateTime)
	if errNorm != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid return departure date/time"})
		return
	}
	req.ReturnToDateTime, errNorm = normalizeDateTime(req.ReturnToDateTime)
	if errNorm != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid return arrival date/time"})
		return
	}

	// Helper to convert empty string to nil for SQL
	toNull := func(s string) interface{} {
		if s == "" {
			return nil
		}
		return s
	}

	// Build values used by legacy columns
	indenterName := facultyName
	if strings.TrimSpace(indenterName) == "" {
		indenterName = req.ContactName
	}
	indenterMobile := facultyPhone
	if strings.TrimSpace(indenterMobile) == "" {
		indenterMobile = req.ContactPhone
	}

	// Travelling person's mobile number (from the form's "Travelling Persons Contact Details" section)
	travellerMobile := strings.TrimSpace(req.MobileNumber)

	guestName := strings.TrimSpace(req.GuestName)
	address := strings.TrimSpace(req.Address)
	taskID := strings.TrimSpace(req.TaskID)
	vertical := strings.TrimSpace(req.Vertical)
	outcomeExpected := strings.TrimSpace(req.OutcomeExpected)
	outcomeAuditable := strings.TrimSpace(req.OutcomeAuditable)

	// Insert using only the columns that exist in the current DB schema.
	// This supports both legacy tables (PurposeOfVisit, Indenter*) and newer tables (Purpose, ContactName/Phone, RequestUnder, etc.).
	colsToCheck := []string{
		"requester_id", "faculty_id",
		"BookingType", "TripType", "TripMode", "RequestUnder", "Vertical", "OralApproval",
		"OnwardFromPlace", "OnwardToPlace", "OnwardFromDateTime", "OnwardTodateTime",
		"ReturnFromPlace", "ReturnToPlace", "ReturnFromDateTime", "ReturnTodateTime",
		"CountPerson",
		"Purpose", "PurposeOfVisit",
		"TravellerName", "Address", "MobileNumber",
		"ContactName", "ContactPhone",
		"IndenterName", "IndenterDesignation", "IndenterDepartment", "IndenterMobileNo",
		"TaskID", "OutcomeExpected", "OutcomeAuditable",
		"status",
	}
	colExists := vehicleRequestColumns(colsToCheck...)

	// Require the core columns that are needed for a meaningful vehicle request
	required := []string{"BookingType", "TripType", "CountPerson"}
	for _, rc := range required {
		if !colExists[rc] {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database schema missing required column: " + rc})
			return
		}
	}
	if !colExists["requester_id"] && !colExists["faculty_id"] {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database schema missing requester/faculty ownership column"})
		return
	}

	columns := make([]string, 0, 24)
	placeholders := make([]string, 0, 24)
	args := make([]interface{}, 0, 24)
	add := func(col string, val interface{}) {
		if colExists[col] {
			columns = append(columns, col)
			placeholders = append(placeholders, "?")
			args = append(args, val)
		}
	}

	add("requester_id", userID)
	add("faculty_id", facultyID)
	add("BookingType", req.BookingType)
	add("TripType", req.TripType)
	add("TripMode", req.TripMode)
	add("RequestUnder", strings.TrimSpace(req.RequestUnder))
	add("Vertical", vertical)
	add("OralApproval", req.OralApproval)
	add("OnwardFromPlace", req.OnwardFromPlace)
	add("OnwardToPlace", req.OnwardToPlace)
	add("OnwardFromDateTime", req.OnwardFromDateTime)
	add("OnwardTodateTime", toNull(req.OnwardToDateTime))
	add("ReturnFromPlace", req.ReturnFromPlace)
	add("ReturnToPlace", req.ReturnToPlace)
	add("ReturnFromDateTime", toNull(req.ReturnFromDateTime))
	add("ReturnTodateTime", toNull(req.ReturnToDateTime))
	add("CountPerson", req.CountPerson)

	// Purpose mapping: write to Purpose (new) and/or PurposeOfVisit (legacy) depending on which exist.
	add("Purpose", req.Purpose)
	add("PurposeOfVisit", req.Purpose)

	// Contact / legacy-personal fields (Faculty/Indenter)
	add("ContactName", req.ContactName)
	add("ContactPhone", req.ContactPhone)

	// Travelling Persons Contact Details
	add("MobileNumber", travellerMobile)
	add("TravellerName", guestName)
	add("Address", address)

	add("TaskID", taskID)
	add("OutcomeExpected", outcomeExpected)
	add("OutcomeAuditable", outcomeAuditable)

	// Legacy indenter fields (often strict-mode NOT NULL in older schemas)
	add("IndenterName", strings.TrimSpace(indenterName))
	add("IndenterDesignation", strings.TrimSpace(facultyDesignation))
	add("IndenterDepartment", strings.TrimSpace(facultyDepartment))
	add("IndenterMobileNo", strings.TrimSpace(indenterMobile))

	// Status
	add("status", "pending")

	if len(columns) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No compatible columns found in vehiclerequests"})
		return
	}

	insertSQL := fmt.Sprintf("INSERT INTO vehiclerequests (%s) VALUES (%s)", strings.Join(columns, ", "), strings.Join(placeholders, ", "))
	result, err := config.DB.Exec(insertSQL, args...)
	if err != nil {
		log.Printf("Error creating vehicle request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request: " + err.Error()})
		return
	}

	requestID, _ := result.LastInsertId()

	// Store trip legs in vehicle_request_trips
	if len(req.Trips) > 0 {
		// Multi-leg trips provided (round_trip or multi_stop)
		for i, trip := range req.Trips {
			fromDT := ""
			if trip.DepartureDate != "" && trip.DepartureTime != "" {
				fromDT = trip.DepartureDate + " " + trip.DepartureTime
			}
			toDT := ""
			if trip.ArrivalDate != "" && trip.ArrivalTime != "" {
				toDT = trip.ArrivalDate + " " + trip.ArrivalTime
			}
			if fromDTNorm, err := normalizeDateTime(fromDT); err == nil {
				fromDT = fromDTNorm
			}
			if toDTNorm, err := normalizeDateTime(toDT); err == nil {
				toDT = toDTNorm
			}
			_, err := config.DB.Exec(`
				INSERT INTO vehicle_request_trips (request_id, trip_order, from_place, to_place, from_datetime, to_datetime)
				VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''))
				ON DUPLICATE KEY UPDATE
					from_place = VALUES(from_place),
					to_place = VALUES(to_place),
					from_datetime = VALUES(from_datetime),
					to_datetime = VALUES(to_datetime)
			`, requestID, i+1,
				strings.TrimSpace(trip.DepartureLocation),
				strings.TrimSpace(trip.ArrivalLocation),
				fromDT, toDT)
			if err != nil {
				log.Printf("Error inserting trip leg %d for request %d: %v", i+1, requestID, err)
			}
		}
	} else {
		// Fallback: single onward trip
		if err := upsertPrimaryVehicleRequestTrip(requestID, req); err != nil {
			log.Printf("Error syncing normalized trip for request %d: %v", requestID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle request submitted successfully", "id": requestID})
}

// GET /api/faculty/vehicle-requests
func GetMyVehicleRequests(c *gin.Context) {
	userID := c.GetInt("user_id")

	var facultyID int
	err := config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	colExists := vehicleRequestColumns(
		"requester_id",
		"approved_by",
		"BookingType", "TripType", "TripMode", "CountPerson",
		"Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval",
		"TaskID", "OutcomeExpected", "OutcomeAuditable",
		"TravellerName", "MobileNumber", "Address",
		"ReturnFromPlace", "ReturnToPlace", "ReturnFromDateTime", "ReturnTodateTime",
		"ContactName", "ContactPhone",
	)
	requesterIDExpr := "0 as requester_id"
	if colExists["requester_id"] {
		requesterIDExpr = "COALESCE(vr.requester_id, 0) as requester_id"
	}
	bookingTypeExpr := "'faculty' as BookingType"
	if colExists["BookingType"] {
		bookingTypeExpr = "COALESCE(vr.BookingType, 'faculty') as BookingType"
	}
	tripTypeExpr := "'' as TripType"
	if colExists["TripType"] {
		tripTypeExpr = "COALESCE(vr.TripType, '') as TripType"
	}
	tripModeExpr := "'official' as TripMode"
	if colExists["TripMode"] {
		tripModeExpr = "COALESCE(vr.TripMode, 'official') as TripMode"
	}
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
	taskIDExpr := "'' as TaskID"
	if colExists["TaskID"] {
		taskIDExpr = "COALESCE(vr.TaskID, '') as TaskID"
	}
	outcomeExpectedExpr := "'' as OutcomeExpected"
	if colExists["OutcomeExpected"] {
		outcomeExpectedExpr = "COALESCE(vr.OutcomeExpected, '') as OutcomeExpected"
	}
	outcomeAuditableExpr := "'' as OutcomeAuditable"
	if colExists["OutcomeAuditable"] {
		outcomeAuditableExpr = "COALESCE(vr.OutcomeAuditable, '') as OutcomeAuditable"
	}
	returnFromPlaceExpr := "'' as ReturnFromPlace"
	if colExists["ReturnFromPlace"] {
		returnFromPlaceExpr = "COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace"
	}
	returnToPlaceExpr := "'' as ReturnToPlace"
	if colExists["ReturnToPlace"] {
		returnToPlaceExpr = "COALESCE(vr.ReturnToPlace, '') as ReturnToPlace"
	}
	returnFromDateTimeExpr := "'' as ReturnFromDateTime"
	if colExists["ReturnFromDateTime"] {
		returnFromDateTimeExpr = "COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%d-%m-%Y %h:%i %p'), '') as ReturnFromDateTime"
	}
	returnToDateTimeExpr := "'' as ReturnTodateTime"
	if colExists["ReturnTodateTime"] {
		returnToDateTimeExpr = "COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%d-%m-%Y %h:%i %p'), '') as ReturnTodateTime"
	}
	contactNameExpr := "'' as ContactName"
	if colExists["ContactName"] {
		contactNameExpr = "COALESCE(vr.ContactName, '') as ContactName"
	}
	contactPhoneExpr := "'' as ContactPhone"
	if colExists["ContactPhone"] {
		contactPhoneExpr = "COALESCE(vr.ContactPhone, '') as ContactPhone"
	}
	travellerNameExpr := "'' as TravellerName"
	if colExists["TravellerName"] {
		travellerNameExpr = "COALESCE(vr.TravellerName, '') as TravellerName"
	}
	mobileNumberExpr := "'' as MobileNumber"
	if colExists["MobileNumber"] {
		mobileNumberExpr = "COALESCE(vr.MobileNumber, '') as MobileNumber"
	}
	addressExpr := "'' as Address"
	if colExists["Address"] {
		addressExpr = "COALESCE(vr.Address, '') as Address"
	}

	ownerFilter := "vr.faculty_id = ?"
	ownerArg := interface{}(facultyID)
	requesterUserJoin := "LEFT JOIN users ru ON 1=0"
	requesterFacultyJoin := "LEFT JOIN faculty rf ON 1=0"
	approvalUserJoin := "LEFT JOIN users ua ON 1=0"
	if colExists["requester_id"] {
		ownerFilter = "vr.requester_id = ?"
		ownerArg = userID
		requesterUserJoin = "LEFT JOIN users ru ON vr.requester_id = ru.id"
		requesterFacultyJoin = "LEFT JOIN faculty rf ON rf.user_id = ru.id"
	}
	if colExists["approved_by"] {
		approvalUserJoin = "LEFT JOIN users ua ON vr.approved_by = ua.id"
	}

	approvedByNameExpr := "'' as approved_by_name"
	if colExists["approved_by"] {
		approvedByNameExpr = "COALESCE(ua.full_name, '') as approved_by_name"
	}

	facultyIDExpr := "0 as faculty_id"
	if colExists["faculty_id"] {
		facultyIDExpr = "COALESCE(vr.faculty_id, COALESCE(f.id, rf.id), 0) as faculty_id"
	}
	query := fmt.Sprintf(`
		SELECT 
			vr.id, %s, %s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vrt.from_place, '') as OnwardFromPlace,
			COALESCE(vrt_last.to_place, vrt.to_place, '') as OnwardToPlace,
			COALESCE(DATE_FORMAT(vrt.from_datetime, '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(COALESCE(vrt_last.to_datetime, vrt.to_datetime), '%%d-%%m-%%Y %%h:%%i %%p'), '') as OnwardTodateTime,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.status, 'pending') as status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			'' as vehicle_type,
			COALESCE(IFNULL(v.vehicle_name, v.vehicle_number), '') as vehicle_name,
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			COALESCE(ru.full_name, uf.full_name, '') as requester_name,
			COALESCE(ru.email, uf.email, '') as requester_email,
			COALESCE(ru.phone, uf.phone, '') as requester_phone,
			'FACULTY' as requester_role,
			COALESCE(uf.full_name, ru.full_name, '') as faculty_name,
			COALESCE(uf.phone, ru.phone, '') as faculty_phone,
			COALESCE(f.department, rf.department, '') as faculty_department,
			%s,
			DATE_FORMAT(COALESCE(vr.created_at, NOW()), '%%d-%%m-%%Y %%h:%%i %%p') as created_at
		FROM vehiclerequests vr
		LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
		LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
			SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
		)
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
		%s
		%s
		%s
		LEFT JOIN faculty f ON 1=0
		LEFT JOIN faculty ff ON 1=0
		LEFT JOIN users uf ON f.user_id = uf.id
		WHERE %s
		ORDER BY COALESCE(vrt.from_datetime, vr.created_at) DESC
	`,
		requesterIDExpr,
		facultyIDExpr,
		bookingTypeExpr, tripTypeExpr, tripModeExpr,
		requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr,
		returnFromPlaceExpr, returnToPlaceExpr, returnFromDateTimeExpr, returnToDateTimeExpr,
		contactNameExpr, contactPhoneExpr,
		taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr,
		travellerNameExpr, mobileNumberExpr, addressExpr,
		approvedByNameExpr,
		requesterUserJoin, requesterFacultyJoin,
		approvalUserJoin,
		ownerFilter,
	)
	if colExists["faculty_id"] {
		query = strings.Replace(query, "LEFT JOIN faculty f ON 1=0", "LEFT JOIN faculty f ON vr.faculty_id = f.id", 1)
	}

	rows, err := config.DB.Query(query, ownerArg)
	if err != nil {
		log.Printf("Error fetching vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	var requests []models.VehicleRequest
	for rows.Next() {
		var r models.VehicleRequest
		err := rows.Scan(
			&r.ID, &r.RequesterID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone,
			&r.TaskID, &r.OutcomeExpected, &r.OutcomeAuditable,
			&r.GuestName, &r.MobileNumber, &r.Address,
			&r.Status, &r.AdminRemarks,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.DriverName, &r.DriverPhone,
			&r.RequesterName, &r.RequesterEmail, &r.RequesterPhone, &r.RequesterRole,
			&r.FacultyName, &r.FacultyPhone, &r.FacultyDepartment,
			&r.ApprovedByName,
			&r.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		// Load all trip legs from vehicle_request_trips
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

		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/faculty/vehicle-request/cancel
func CancelVehicleRequest(c *gin.Context) {
	userID := c.GetInt("user_id")

	var facultyID int
	err := config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status string
	ownerCols := vehicleRequestColumns("requester_id")
	ownerQuery := `SELECT status FROM vehiclerequests WHERE id = ? AND faculty_id = ?`
	ownerID := interface{}(facultyID)
	if ownerCols["requester_id"] {
		ownerQuery = `SELECT status FROM vehiclerequests WHERE id = ? AND requester_id = ?`
		ownerID = userID
	}
	err = config.DB.QueryRow(ownerQuery, req.RequestID, ownerID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending requests can be cancelled"})
		return
	}

	_, err = config.DB.Exec(`UPDATE vehiclerequests SET status = 'cancelled' WHERE id = ?`, req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request cancelled successfully"})
}

// GET /api/faculty/vehicle-request/:id/otp - Faculty gets their OTP for a request
func GetVehicleRequestOTP(c *gin.Context) {
	userID := c.GetInt("user_id")

	var facultyID int
	err := config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	requestID := c.Param("id")
	ownerCols := vehicleRequestColumns("requester_id")
	ownerQuery := `
		SELECT status, start_otp, end_otp
		FROM vehiclerequests
		WHERE id = ? AND faculty_id = ?
	`
	ownerID := interface{}(facultyID)
	if ownerCols["requester_id"] {
		ownerQuery = `
			SELECT status, start_otp, end_otp
			FROM vehiclerequests
			WHERE id = ? AND requester_id = ?
		`
		ownerID = userID
	}

	var status string
	var startOTP, endOTP sql.NullString
	err = config.DB.QueryRow(ownerQuery, requestID, ownerID).Scan(&status, &startOTP, &endOTP)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	result := gin.H{
		"status": status,
	}

	// Show start OTP when status is assigned (driver needs it to start trip)
	if status == "assigned" && startOTP.Valid {
		result["start_otp"] = startOTP.String
		result["otp_type"] = "start"
		result["message"] = "Share this OTP with the driver to start the trip"
	}

	// Show end OTP when status is trip_started (driver needs it to end trip)
	if status == "trip_started" && endOTP.Valid {
		result["end_otp"] = endOTP.String
		result["otp_type"] = "end"
		result["message"] = "Share this OTP with the driver to end the trip"
	}

	c.JSON(http.StatusOK, result)
}
