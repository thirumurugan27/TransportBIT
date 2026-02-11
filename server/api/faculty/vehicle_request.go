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
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// POST /api/faculty/vehicle-request
func CreateVehicleRequest(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var facultyID int
	err = config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
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
	mobileNumber := req.ContactPhone
	if strings.TrimSpace(mobileNumber) == "" {
		mobileNumber = facultyPhone
	}
	if strings.TrimSpace(mobileNumber) == "" {
		mobileNumber = strings.TrimSpace(req.MobileNumber)
	}
	guestName := strings.TrimSpace(req.GuestName)
	address := strings.TrimSpace(req.Address)
	taskID := strings.TrimSpace(req.TaskID)
	vertical := strings.TrimSpace(req.Vertical)
	outcomeExpected := strings.TrimSpace(req.OutcomeExpected)
	outcomeAuditable := strings.TrimSpace(req.OutcomeAuditable)

	// Insert using only the columns that exist in the current DB schema.
	// This supports both legacy tables (PurposeOfVisit, Indenter*) and newer tables (Purpose, ContactName/Phone, RequestUnder, etc.).
	colsToCheck := []string{
		"faculty_id",
		"BookingType", "TripType", "TripMode", "RequestUnder", "Vertical", "OralApproval",
		"OnwardFromPlace", "OnwardToPlace", "OnwardFromDateTime", "OnwardTodateTime",
		"ReturnFromPlace", "ReturnToPlace", "ReturnFromDateTime", "ReturnTodateTime",
		"CountPerson",
		"Purpose", "PurposeOfVisit",
		"Guestname", "Address", "MobileNumber",
		"ContactName", "ContactPhone",
		"IndenterName", "IndenterDesignation", "IndenterDepartment", "IndenterMobileNo",
		"TaskID", "OutcomeExpected", "OutcomeAuditable",
		"status",
	}
	colExists, colErr := config.HasColumns("vehiclerequests", colsToCheck...)
	if colErr != nil {
		log.Printf("Error checking vehiclerequests columns: %v", colErr)
	}

	// Require the core columns that are needed for a meaningful vehicle request
	if colErr == nil {
		required := []string{"faculty_id", "BookingType", "TripType", "TripMode", "OnwardFromPlace", "OnwardToPlace", "OnwardFromDateTime", "CountPerson"}
		for _, rc := range required {
			if !colExists[rc] {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database schema missing required column: " + rc})
				return
			}
		}
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

	// Contact / legacy-personal fields
	add("ContactName", req.ContactName)
	add("ContactPhone", req.ContactPhone)
	add("MobileNumber", strings.TrimSpace(mobileNumber))
	add("Guestname", guestName)
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
	c.JSON(http.StatusOK, gin.H{"message": "Vehicle request submitted successfully", "id": requestID})
}

// GET /api/faculty/vehicle-requests
func GetMyVehicleRequests(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var facultyID int
	err = config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeExpected", "OutcomeAuditable")
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

	query := fmt.Sprintf(`
		SELECT 
			vr.id, vr.faculty_id,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, '') as TripType,
			COALESCE(vr.TripMode, 'official') as TripMode,
			%s,
			%s,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vr.OnwardFromPlace, '') as OnwardFromPlace,
			COALESCE(vr.OnwardToPlace, '') as OnwardToPlace,
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %%H:%%i'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%d-%m-%Y %%H:%%i'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%d-%m-%Y %%H:%%i'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%d-%m-%Y %%H:%%i'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			%s,
			%s,
			%s,
			COALESCE(vr.status, 'pending') as status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(IFNULL(v.vehicle_name, v.vehicle_number), '') as vehicle_name,
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			DATE_FORMAT(COALESCE(vr.created_at, NOW()), '%d-%m-%Y %%H:%%i') as created_at
		FROM vehiclerequests vr
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
		WHERE vr.faculty_id = ?
		ORDER BY vr.created_at DESC
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr)

	rows, err := config.DB.Query(query, facultyID)
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
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone,
			&r.TaskID, &r.OutcomeExpected, &r.OutcomeAuditable,
			&r.Status, &r.AdminRemarks,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.DriverName, &r.DriverPhone,
			&r.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/faculty/vehicle-request/cancel
func CancelVehicleRequest(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var facultyID int
	err = config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
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
	err = config.DB.QueryRow(`SELECT status FROM vehiclerequests WHERE id = ? AND faculty_id = ?`,
		req.RequestID, facultyID).Scan(&status)
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
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var facultyID int
	err = config.DB.QueryRow(`SELECT id FROM faculty WHERE user_id = ?`, userID).Scan(&facultyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}

	requestID := c.Param("id")

	var status string
	var startOTP, endOTP sql.NullString
	err = config.DB.QueryRow(`
		SELECT status, start_otp, end_otp
		FROM vehiclerequests
		WHERE id = ? AND faculty_id = ?
	`, requestID, facultyID).Scan(&status, &startOTP, &endOTP)

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
