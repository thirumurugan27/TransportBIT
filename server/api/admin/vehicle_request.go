package admin

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// generateOTP generates a random 6-digit OTP
func generateOTP() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%06d", r.Intn(1000000))
}

// splitDateTime splits a formatted date-time string into date and time parts
func splitDateTime(dtStr string) (string, string) {
	if dtStr == "" {
		return "", ""
	}
	if len(dtStr) >= 10 {
		date := dtStr[:10]
		timeStr := ""
		if len(dtStr) > 11 {
			timeStr = dtStr[11:]
		}
		return date, timeStr
	}
	return dtStr, ""
}

func vehicleRequestColumns(columnNames ...string) map[string]bool {
	// Canonical cleaned schema flags for vehicle request module.
	known := map[string]bool{
		"id":                     true,
		"requester_id":           true,
		"faculty_id":             true,
		"BookingType":            true,
		"TripType":               true,
		"TripMode":               false,
		"RequestUnder":           true,
		"Vertical":               true,
		"OralApproval":           false,
		"OnwardFromPlace":        true,
		"OnwardToPlace":          true,
		"OnwardFromDateTime":     true,
		"OnwardTodateTime":       true,
		"OnwardToDateTime":       false,
		"ReturnFromPlace":        false,
		"ReturnToPlace":          false,
		"ReturnFromDateTime":     false,
		"ReturnTodateTime":       false,
		"ReturnToDateTime":       false,
		"CountPerson":            true,
		"Purpose":                true,
		"PurposeOfVisit":         true,
		"TravellerName":          true,
		"Address":                true,
		"MobileNumber":           true,
		"ContactName":            true,
		"ContactPhone":           true,
		"TaskID":                 true,
		"OutcomeExpected":        false,
		"OutcomeAuditable":       false,
		"status":                 true,
		"admin_remarks":          true,
		"created_at":             true,
		"vehicle_id":             true,
		"driver_id":              true,
		"approved_by":            true,
		"approved_at":            true,
		"assigned_at":            true,
		"start_otp":              true,
		"end_otp":                true,
		"start_otp_generated_at": true,
		"end_otp_generated_at":   true,
		"trip_started_at":        true,
		"trip_ended_at":          true,
	}
	out := make(map[string]bool, len(columnNames))
	for _, c := range columnNames {
		out[c] = known[c]
	}
	return out
}
func optionalTextExpr(colExists map[string]bool, column, alias string) string {
	if colExists[column] {
		return fmt.Sprintf("COALESCE(vr.%s, '') as %s", column, alias)
	}
	return fmt.Sprintf("'' as %s", alias)
}
func optionalIntExpr(colExists map[string]bool, column, alias string, fallback int) string {
	if colExists[column] {
		return fmt.Sprintf("COALESCE(vr.%s, %d) as %s", column, fallback, alias)
	}
	return fmt.Sprintf("%d as %s", fallback, alias)
}
func optionalBoolExpr(colExists map[string]bool, column, alias string) string {
	if colExists[column] {
		return fmt.Sprintf("COALESCE(vr.%s, 0) as %s", column, alias)
	}
	return fmt.Sprintf("0 as %s", alias)
}

func optionalDateExpr(colExists map[string]bool, column, alias string) string {
	if colExists[column] {
		return fmt.Sprintf("COALESCE(DATE_FORMAT(vr.%s, '%%d-%%m-%%Y %%h:%%i %%p'), '') as %s", column, alias)
	}
	return fmt.Sprintf("'' as %s", alias)
}

func pickExistingColumn(colExists map[string]bool, candidates ...string) string {
	for _, candidate := range candidates {
		if colExists[candidate] {
			return candidate
		}
	}
	return ""
}

func loadVehicleRequestSchedule(requestID int) (sql.NullString, sql.NullString, sql.NullString, sql.NullString, error) {
	var onwardFrom, onwardTo, returnFrom, returnTo sql.NullString

	// Try to load from vehicle_request_trips: first leg start + last leg end
	err := config.DB.QueryRow(`
		SELECT
			DATE_FORMAT(first_leg.from_datetime, '%Y-%m-%d %H:%i:%s') as onward_from,
			DATE_FORMAT(COALESCE(last_leg.to_datetime, first_leg.to_datetime), '%Y-%m-%d %H:%i:%s') as onward_to
		FROM vehicle_request_trips first_leg
		LEFT JOIN (
			SELECT request_id, to_datetime
			FROM vehicle_request_trips vrt_inner
			WHERE vrt_inner.request_id = ? AND vrt_inner.trip_order = (
				SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vrt_inner.request_id
			)
		) last_leg ON last_leg.request_id = first_leg.request_id
		WHERE first_leg.request_id = ? AND first_leg.trip_order = 1
	`, requestID, requestID).Scan(&onwardFrom, &onwardTo)
	if err == nil {
		return onwardFrom, onwardTo, returnFrom, returnTo, nil
	}
	if err != sql.ErrNoRows {
		return onwardFrom, onwardTo, returnFrom, returnTo, err
	}

	dateCols := vehicleRequestColumns("OnwardFromDateTime", "OnwardTodateTime", "OnwardToDateTime", "ReturnFromDateTime", "ReturnTodateTime", "ReturnToDateTime")
	onwardFromCol := pickExistingColumn(dateCols, "OnwardFromDateTime")
	onwardToCol := pickExistingColumn(dateCols, "OnwardTodateTime", "OnwardToDateTime")
	returnFromCol := pickExistingColumn(dateCols, "ReturnFromDateTime")
	returnToCol := pickExistingColumn(dateCols, "ReturnTodateTime", "ReturnToDateTime")

	onwardFromExpr := "NULL"
	if onwardFromCol != "" {
		onwardFromExpr = "vr." + onwardFromCol
	}
	onwardToExpr := "NULL"
	if onwardToCol != "" {
		onwardToExpr = "vr." + onwardToCol
	}
	returnFromExpr := "NULL"
	if returnFromCol != "" {
		returnFromExpr = "vr." + returnFromCol
	}
	returnToExpr := "NULL"
	if returnToCol != "" {
		returnToExpr = "vr." + returnToCol
	}

	query := fmt.Sprintf(`
		SELECT %s, %s, %s, %s
		FROM vehiclerequests vr
		WHERE vr.id = ?
	`, onwardFromExpr, onwardToExpr, returnFromExpr, returnToExpr)

	err = config.DB.QueryRow(query, requestID).Scan(&onwardFrom, &onwardTo, &returnFrom, &returnTo)
	return onwardFrom, onwardTo, returnFrom, returnTo, err
}

func getVehicleRequestRequesterName(requestID int) string {
	name := "Requester"
	colExists := vehicleRequestColumns("requester_id")
	if colExists["requester_id"] {
		_ = config.DB.QueryRow(`
			SELECT COALESCE(ru.full_name, u.full_name, 'Requester')
			FROM vehiclerequests vr
			LEFT JOIN users ru ON vr.requester_id = ru.id
			LEFT JOIN faculty f ON vr.faculty_id = f.id
			LEFT JOIN users u ON f.user_id = u.id
			WHERE vr.id = ?
		`, requestID).Scan(&name)
		return name
	}

	_ = config.DB.QueryRow(`
		SELECT COALESCE(u.full_name, 'Requester')
		FROM vehiclerequests vr
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.id = ?
	`, requestID).Scan(&name)

	return name
}

// GET /api/admin/vehicle-requests
func GetAllVehicleRequests(c *gin.Context) {
	statusFilter := c.Query("status")

	colExists := vehicleRequestColumns(
		"id", "requester_id", "faculty_id", "BookingType", "TripType", "TripMode", "CountPerson",
		"OnwardFromPlace", "OnwardToPlace", "OnwardFromDateTime", "OnwardTodateTime",
		"ReturnFromPlace", "ReturnToPlace", "ReturnFromDateTime", "ReturnTodateTime",
		"ContactName", "ContactPhone", "status", "admin_remarks", "created_at", "vehicle_id", "driver_id",
		"Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeExpected", "OutcomeAuditable",
		"approved_by", "approved_at", "assigned_at", "start_otp", "end_otp", "start_otp_generated_at", "end_otp_generated_at", "trip_started_at", "trip_ended_at",
		"TravellerName", "MobileNumber", "Address",
	)
	idExpr := optionalIntExpr(colExists, "id", "id", 0)
	requesterIDExpr := optionalIntExpr(colExists, "requester_id", "requester_id", 0)
	facultyIDExpr := optionalIntExpr(colExists, "faculty_id", "faculty_id", 0)
	bookingTypeExpr := optionalTextExpr(colExists, "BookingType", "BookingType")
	tripTypeExpr := optionalTextExpr(colExists, "TripType", "TripType")
	tripModeExpr := optionalTextExpr(colExists, "TripMode", "TripMode")
	countPersonExpr := optionalIntExpr(colExists, "CountPerson", "CountPerson", 1)
	onwardFromPlaceExpr := optionalTextExpr(colExists, "OnwardFromPlace", "OnwardFromPlace")
	onwardToPlaceExpr := optionalTextExpr(colExists, "OnwardToPlace", "OnwardToPlace")
	onwardFromDateExpr := optionalDateExpr(colExists, "OnwardFromDateTime", "OnwardFromDateTime")
	onwardToDateExpr := optionalDateExpr(colExists, "OnwardTodateTime", "OnwardTodateTime")
	returnFromPlaceExpr := optionalTextExpr(colExists, "ReturnFromPlace", "ReturnFromPlace")
	returnToPlaceExpr := optionalTextExpr(colExists, "ReturnToPlace", "ReturnToPlace")
	returnFromDateExpr := optionalDateExpr(colExists, "ReturnFromDateTime", "ReturnFromDateTime")
	returnToDateExpr := optionalDateExpr(colExists, "ReturnTodateTime", "ReturnTodateTime")
	contactNameExpr := optionalTextExpr(colExists, "ContactName", "ContactName")
	contactPhoneExpr := optionalTextExpr(colExists, "ContactPhone", "ContactPhone")
	statusExpr := optionalTextExpr(colExists, "status", "status")
	adminRemarksExpr := optionalTextExpr(colExists, "admin_remarks", "admin_remarks")
	createdAtExpr := optionalDateExpr(colExists, "created_at", "created_at")
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
	oralApprovalExpr := optionalBoolExpr(colExists, "OralApproval", "OralApproval")
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
	approvedByExpr := "NULL as approved_by"
	if colExists["approved_by"] {
		approvedByExpr = "vr.approved_by as approved_by"
	}
	approvedAtExpr := "NULL as approved_at"
	if colExists["approved_at"] {
		approvedAtExpr = "DATE_FORMAT(vr.approved_at, '%%d-%%m-%%Y %%h:%%i %%p') as approved_at"
	}
	assignedAtExpr := "NULL as assigned_at"
	if colExists["assigned_at"] {
		assignedAtExpr = "DATE_FORMAT(vr.assigned_at, '%%d-%%m-%%Y %%h:%%i %%p') as assigned_at"
	}
	startOtpExpr := "'' as start_otp"
	if colExists["start_otp"] {
		startOtpExpr = "COALESCE(vr.start_otp, '') as start_otp"
	}
	endOtpExpr := "'' as end_otp"
	if colExists["end_otp"] {
		endOtpExpr = "COALESCE(vr.end_otp, '') as end_otp"
	}
	startOtpGeneratedAtExpr := "NULL as start_otp_generated_at"
	if colExists["start_otp_generated_at"] {
		startOtpGeneratedAtExpr = "DATE_FORMAT(vr.start_otp_generated_at, '%%d-%%m-%%Y %%h:%%i %%p') as start_otp_generated_at"
	}
	endOtpGeneratedAtExpr := "NULL as end_otp_generated_at"
	if colExists["end_otp_generated_at"] {
		endOtpGeneratedAtExpr = "DATE_FORMAT(vr.end_otp_generated_at, '%%d-%%m-%%Y %%h:%%i %%p') as end_otp_generated_at"
	}
	tripStartedAtExpr := "NULL as trip_started_at"
	if colExists["trip_started_at"] {
		tripStartedAtExpr = "DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p') as trip_started_at"
	}
	tripEndedAtExpr := "NULL as trip_ended_at"
	if colExists["trip_ended_at"] {
		tripEndedAtExpr = "DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p') as trip_ended_at"
	}

	requesterJoin := "LEFT JOIN users ru ON 1=0 LEFT JOIN faculty rf ON 1=0"
	if colExists["requester_id"] {
		requesterJoin = "LEFT JOIN users ru ON vr.requester_id = ru.id LEFT JOIN faculty rf ON rf.user_id = ru.id"
	}
	facultyJoin := "LEFT JOIN faculty f ON 1=0 LEFT JOIN users u ON 1=0"
	if colExists["faculty_id"] {
		facultyJoin = "LEFT JOIN faculty f ON vr.faculty_id = f.id LEFT JOIN users u ON f.user_id = u.id"
	}
	vehicleJoin := "LEFT JOIN vehicles v ON 1=0"
	if colExists["vehicle_id"] {
		vehicleJoin = "LEFT JOIN vehicles v ON vr.vehicle_id = v.id"
	}
	driverJoin := "LEFT JOIN drivers d ON 1=0 LEFT JOIN users ud ON 1=0"
	if colExists["driver_id"] {
		driverJoin = "LEFT JOIN drivers d ON vr.driver_id = d.id LEFT JOIN users ud ON d.user_id = ud.id"
	}

	selectCols := []string{
		idExpr, requesterIDExpr, facultyIDExpr, bookingTypeExpr, tripTypeExpr, tripModeExpr,
		requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, countPersonExpr,
		onwardFromPlaceExpr, onwardToPlaceExpr, onwardFromDateExpr, onwardToDateExpr,
		returnFromPlaceExpr, returnToPlaceExpr, returnFromDateExpr, returnToDateExpr,
		contactNameExpr, contactPhoneExpr,
		taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr,
		travellerNameExpr, mobileNumberExpr, addressExpr,
		statusExpr, adminRemarksExpr,
		approvedByExpr, approvedAtExpr, assignedAtExpr,
		startOtpExpr, endOtpExpr, startOtpGeneratedAtExpr, endOtpGeneratedAtExpr, tripStartedAtExpr, tripEndedAtExpr,
		"COALESCE(ru.full_name, u.full_name, '') as requester_name",
		"COALESCE(ru.email, u.email, '') as requester_email",
		"COALESCE(ru.phone, u.phone, '') as requester_phone",
		"'FACULTY' as requester_role",
		"COALESCE(u.full_name, ru.full_name, '') as faculty_name",
		"COALESCE(u.email, ru.email, '') as faculty_email",
		"COALESCE(u.phone, ru.phone, '') as faculty_phone",
		"COALESCE(f.department, rf.department, '') as faculty_department",
		"COALESCE(v.vehicle_number, '') as vehicle_number",
		"'' as vehicle_type",
		"COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name",
		"COALESCE(ud.full_name, '') as driver_name",
		"COALESCE(ud.phone, '') as driver_phone",
		createdAtExpr,
	}

	tripJoin := "LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1 " +
		"LEFT JOIN vehicle_request_trips vrt2 ON vrt2.request_id = vr.id AND vrt2.trip_order = 2"
	query := fmt.Sprintf("SELECT %s FROM vehiclerequests vr %s %s %s %s %s", strings.Join(selectCols, ", "), requesterJoin, facultyJoin, vehicleJoin, driverJoin, tripJoin)

	var args []interface{}
	if statusFilter != "" && colExists["status"] {
		query += " WHERE vr.status = ?"
		args = append(args, statusFilter)
	}
	if colExists["created_at"] {
		query += " ORDER BY vr.created_at DESC"
	} else {
		query += " ORDER BY 1 DESC"
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error fetching vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
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
			&r.ApprovedBy, &r.ApprovedAt, &r.AssignedAt,
			&r.StartOTP, &r.EndOTP, &r.StartOTPGeneratedAt, &r.EndOTPGeneratedAt, &r.TripStartedAt, &r.TripEndedAt,
			&r.RequesterName, &r.RequesterEmail, &r.RequesterPhone, &r.RequesterRole,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.DriverName, &r.DriverPhone,
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

// GET /api/admin/vehicle-request/:id
func GetVehicleRequestDetails(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var r models.VehicleRequest

	colExists := vehicleRequestColumns(
		"id", "requester_id", "faculty_id", "BookingType", "TripType", "TripMode", "CountPerson",
		"OnwardFromPlace", "OnwardToPlace", "OnwardFromDateTime", "OnwardTodateTime",
		"ReturnFromPlace", "ReturnToPlace", "ReturnFromDateTime", "ReturnTodateTime",
		"ContactName", "ContactPhone", "status", "admin_remarks", "created_at", "vehicle_id", "driver_id",
		"Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeExpected", "OutcomeAuditable",
		"approved_by", "approved_at", "assigned_at", "start_otp", "end_otp", "start_otp_generated_at", "end_otp_generated_at", "trip_started_at", "trip_ended_at",
		"TravellerName", "MobileNumber", "Address",
	)
	idExpr := optionalIntExpr(colExists, "id", "id", 0)
	requesterIDExpr := optionalIntExpr(colExists, "requester_id", "requester_id", 0)
	facultyIDExpr := optionalIntExpr(colExists, "faculty_id", "faculty_id", 0)
	bookingTypeExpr := optionalTextExpr(colExists, "BookingType", "BookingType")
	tripTypeExpr := optionalTextExpr(colExists, "TripType", "TripType")
	tripModeExpr := optionalTextExpr(colExists, "TripMode", "TripMode")
	countPersonExpr := optionalIntExpr(colExists, "CountPerson", "CountPerson", 1)
	onwardFromPlaceExpr := optionalTextExpr(colExists, "OnwardFromPlace", "OnwardFromPlace")
	onwardToPlaceExpr := optionalTextExpr(colExists, "OnwardToPlace", "OnwardToPlace")
	onwardFromDateExpr := optionalDateExpr(colExists, "OnwardFromDateTime", "OnwardFromDateTime")
	onwardToDateExpr := optionalDateExpr(colExists, "OnwardTodateTime", "OnwardTodateTime")
	returnFromPlaceExpr := optionalTextExpr(colExists, "ReturnFromPlace", "ReturnFromPlace")
	returnToPlaceExpr := optionalTextExpr(colExists, "ReturnToPlace", "ReturnToPlace")
	returnFromDateExpr := optionalDateExpr(colExists, "ReturnFromDateTime", "ReturnFromDateTime")
	returnToDateExpr := optionalDateExpr(colExists, "ReturnTodateTime", "ReturnTodateTime")
	contactNameExpr := optionalTextExpr(colExists, "ContactName", "ContactName")
	contactPhoneExpr := optionalTextExpr(colExists, "ContactPhone", "ContactPhone")
	statusExpr := optionalTextExpr(colExists, "status", "status")
	adminRemarksExpr := optionalTextExpr(colExists, "admin_remarks", "admin_remarks")
	createdAtExpr := optionalDateExpr(colExists, "created_at", "created_at")
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
	oralApprovalExpr := optionalBoolExpr(colExists, "OralApproval", "OralApproval")
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
	approvedByExpr := "NULL as approved_by"
	if colExists["approved_by"] {
		approvedByExpr = "vr.approved_by as approved_by"
	}
	approvedAtExpr := "NULL as approved_at"
	if colExists["approved_at"] {
		approvedAtExpr = "DATE_FORMAT(vr.approved_at, '%%d-%%m-%%Y %%h:%%i %%p') as approved_at"
	}
	assignedAtExpr := "NULL as assigned_at"
	if colExists["assigned_at"] {
		assignedAtExpr = "DATE_FORMAT(vr.assigned_at, '%%d-%%m-%%Y %%h:%%i %%p') as assigned_at"
	}
	startOtpExpr := "'' as start_otp"
	if colExists["start_otp"] {
		startOtpExpr = "COALESCE(vr.start_otp, '') as start_otp"
	}
	endOtpExpr := "'' as end_otp"
	if colExists["end_otp"] {
		endOtpExpr = "COALESCE(vr.end_otp, '') as end_otp"
	}
	startOtpGeneratedAtExpr := "NULL as start_otp_generated_at"
	if colExists["start_otp_generated_at"] {
		startOtpGeneratedAtExpr = "DATE_FORMAT(vr.start_otp_generated_at, '%%d-%%m-%%Y %%h:%%i %%p') as start_otp_generated_at"
	}
	endOtpGeneratedAtExpr := "NULL as end_otp_generated_at"
	if colExists["end_otp_generated_at"] {
		endOtpGeneratedAtExpr = "DATE_FORMAT(vr.end_otp_generated_at, '%%d-%%m-%%Y %%h:%%i %%p') as end_otp_generated_at"
	}
	tripStartedAtExpr := "NULL as trip_started_at"
	if colExists["trip_started_at"] {
		tripStartedAtExpr = "DATE_FORMAT(vr.trip_started_at, '%%d-%%m-%%Y %%h:%%i %%p') as trip_started_at"
	}
	tripEndedAtExpr := "NULL as trip_ended_at"
	if colExists["trip_ended_at"] {
		tripEndedAtExpr = "DATE_FORMAT(vr.trip_ended_at, '%%d-%%m-%%Y %%h:%%i %%p') as trip_ended_at"
	}

	requesterJoin := "LEFT JOIN users ru ON 1=0 LEFT JOIN faculty rf ON 1=0"
	if colExists["requester_id"] {
		requesterJoin = "LEFT JOIN users ru ON vr.requester_id = ru.id LEFT JOIN faculty rf ON rf.user_id = ru.id"
	}
	facultyJoin := "LEFT JOIN faculty f ON 1=0 LEFT JOIN users u ON 1=0"
	if colExists["faculty_id"] {
		facultyJoin = "LEFT JOIN faculty f ON vr.faculty_id = f.id LEFT JOIN users u ON f.user_id = u.id"
	}
	vehicleJoin := "LEFT JOIN vehicles v ON 1=0"
	if colExists["vehicle_id"] {
		vehicleJoin = "LEFT JOIN vehicles v ON vr.vehicle_id = v.id"
	}
	driverJoin := "LEFT JOIN drivers d ON 1=0 LEFT JOIN users ud ON 1=0"
	if colExists["driver_id"] {
		driverJoin = "LEFT JOIN drivers d ON vr.driver_id = d.id LEFT JOIN users ud ON d.user_id = ud.id"
	}

	selectCols := []string{
		idExpr, requesterIDExpr, facultyIDExpr, bookingTypeExpr, tripTypeExpr, tripModeExpr,
		requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, countPersonExpr,
		onwardFromPlaceExpr, onwardToPlaceExpr, onwardFromDateExpr, onwardToDateExpr,
		returnFromPlaceExpr, returnToPlaceExpr, returnFromDateExpr, returnToDateExpr,
		contactNameExpr, contactPhoneExpr,
		taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr,
		travellerNameExpr, mobileNumberExpr, addressExpr,
		statusExpr, adminRemarksExpr,
		approvedByExpr, approvedAtExpr, assignedAtExpr,
		startOtpExpr, endOtpExpr, startOtpGeneratedAtExpr, endOtpGeneratedAtExpr, tripStartedAtExpr, tripEndedAtExpr,
		"COALESCE(ru.full_name, u.full_name, '') as requester_name",
		"COALESCE(ru.email, u.email, '') as requester_email",
		"COALESCE(ru.phone, u.phone, '') as requester_phone",
		"'FACULTY' as requester_role",
		"COALESCE(u.full_name, ru.full_name, '') as faculty_name",
		"COALESCE(u.email, ru.email, '') as faculty_email",
		"COALESCE(u.phone, ru.phone, '') as faculty_phone",
		"COALESCE(f.department, rf.department, '') as faculty_department",
		"COALESCE(v.vehicle_number, '') as vehicle_number",
		"'' as vehicle_type",
		"COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name",
		"COALESCE(ud.full_name, '') as driver_name",
		"COALESCE(ud.phone, '') as driver_phone",
		createdAtExpr,
	}

	tripJoin := "LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1 " +
		"LEFT JOIN vehicle_request_trips vrt2 ON vrt2.request_id = vr.id AND vrt2.trip_order = 2"
	query := fmt.Sprintf("SELECT %s FROM vehiclerequests vr %s %s %s %s %s WHERE vr.id = ?", strings.Join(selectCols, ", "), requesterJoin, facultyJoin, vehicleJoin, driverJoin, tripJoin)

	err = config.DB.QueryRow(query, id).Scan(
		&r.ID, &r.RequesterID, &r.FacultyID,
		&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
		&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
		&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
		&r.ContactName, &r.ContactPhone,
		&r.TaskID, &r.OutcomeExpected, &r.OutcomeAuditable,
		&r.GuestName, &r.MobileNumber, &r.Address,
		&r.Status, &r.AdminRemarks,
		&r.ApprovedBy, &r.ApprovedAt, &r.AssignedAt,
		&r.StartOTP, &r.EndOTP, &r.StartOTPGeneratedAt, &r.EndOTPGeneratedAt, &r.TripStartedAt, &r.TripEndedAt,
		&r.RequesterName, &r.RequesterEmail, &r.RequesterPhone, &r.RequesterRole,
		&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
		&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
		&r.DriverName, &r.DriverPhone,
		&r.CreatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching vehicle request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Load all trip legs from vehicle_request_trips
	tripRows, tripErr := config.DB.Query(`
		SELECT trip_order, COALESCE(from_place, '') as from_place, COALESCE(to_place, '') as to_place,
			COALESCE(DATE_FORMAT(from_datetime, '%Y-%m-%d'), '') as dep_date,
			COALESCE(DATE_FORMAT(from_datetime, '%H:%i'), '') as dep_time,
			COALESCE(DATE_FORMAT(to_datetime, '%Y-%m-%d'), '') as arr_date,
			COALESCE(DATE_FORMAT(to_datetime, '%H:%i'), '') as arr_time
		FROM vehicle_request_trips
		WHERE request_id = ?
		ORDER BY trip_order ASC
	`, r.ID)
	if tripErr == nil {
		defer tripRows.Close()
		r.Trips = []models.Trip{}
		for tripRows.Next() {
			var t models.Trip
			if err := tripRows.Scan(&t.TripOrder, &t.DepartureLocation, &t.ArrivalLocation, &t.DepartureDate, &t.DepartureTime, &t.ArrivalDate, &t.ArrivalTime); err == nil {
				r.Trips = append(r.Trips, t)
			}
		}
	}

	// Fallback: if no trips loaded from table, construct from onward/return fields
	if len(r.Trips) == 0 {
		r.Trips = []models.Trip{}
		if r.OnwardFromPlace != "" || r.OnwardToPlace != "" {
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
		}
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

	c.JSON(http.StatusOK, r)
}

// POST /api/admin/vehicle-request/approve
// Supports optional vehicle_id and driver_id for direct assignment during approval
func ApproveVehicleRequest(c *gin.Context) {
	adminID := getUserIDFromRequest(c)

	var req struct {
		RequestID    int    `json:"request_id"`
		AdminRemarks string `json:"admin_remarks"`
		VehicleID    int    `json:"vehicle_id"`
		DriverID     int    `json:"driver_id"`
		ForceAssign  bool   `json:"force_assign"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status string
	err := config.DB.QueryRow(`SELECT status FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending requests can be approved"})
		return
	}

	colExists := vehicleRequestColumns("approved_by", "approved_at", "assigned_at", "start_otp", "start_otp_generated_at")
	approvedBy := interface{}(nil)
	if adminID != nil {
		approvedBy = *adminID
	}

	// If vehicle and driver are provided, approve and assign in one step
	if req.VehicleID > 0 && req.DriverID > 0 {
		// Get request details for conflict checking
		onwardFrom, onwardTo, returnFrom, returnTo, err := loadVehicleRequestSchedule(req.RequestID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Check for conflicts (skip if force_assign)
		if onwardFrom.Valid && !req.ForceAssign {
			hasConflict, driverConflicts, err := checkDriverConflict(req.DriverID,
				onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
			if err != nil {
				log.Printf("Error checking driver conflict: %v", err)
			}
			if hasConflict {
				// Extract date for message
				conflictDate := onwardFrom.String
				if len(conflictDate) >= 10 {
					conflictDate = conflictDate[:10]
				}
				log.Printf("[VR-APPROVE] Driver conflict found. driverID=%d, date=%s, conflicts=%d items", req.DriverID, conflictDate, len(driverConflicts))
				for i, cf := range driverConflicts {
					log.Printf("  Conflict %d: %+v", i, cf)
				}
				// Get available drivers list
				availableDrivers := getAvailableDriversForRequest(req.DriverID,
					onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
				c.JSON(http.StatusConflict, gin.H{
					"error":             "driver_conflict",
					"message":           fmt.Sprintf("Driver is already assigned during this time range (conflict on %s)", conflictDate),
					"conflicts":         driverConflicts,
					"available_drivers": availableDrivers,
				})
				return
			}

			hasVehicleConflict, vehicleConflicts, err := checkVehicleConflict(req.VehicleID,
				onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
			if err != nil {
				log.Printf("Error checking vehicle conflict: %v", err)
			}
			if hasVehicleConflict {
				c.JSON(http.StatusConflict, gin.H{
					"error":     "vehicle_conflict",
					"message":   "Vehicle has a conflicting assignment during this time interval",
					"conflicts": vehicleConflicts,
				})
				return
			}
		}

		// Generate start OTP
		startOTP := generateOTP()

		setParts := []string{"status = 'assigned'", "admin_remarks = ?", "vehicle_id = ?", "driver_id = ?"}
		args := []interface{}{req.AdminRemarks, req.VehicleID, req.DriverID}
		if colExists["start_otp"] {
			setParts = append(setParts, "start_otp = ?")
			args = append(args, startOTP)
		}
		if colExists["start_otp_generated_at"] {
			setParts = append(setParts, "start_otp_generated_at = NOW()")
		}
		if colExists["approved_by"] {
			setParts = append(setParts, "approved_by = ?")
			args = append(args, approvedBy)
		}
		if colExists["approved_at"] {
			setParts = append(setParts, "approved_at = NOW()")
		}
		if colExists["assigned_at"] {
			setParts = append(setParts, "assigned_at = NOW()")
		}

		query := fmt.Sprintf("UPDATE vehiclerequests SET %s WHERE id = ?", strings.Join(setParts, ", "))
		args = append(args, req.RequestID)
		_, err = config.DB.Exec(query, args...)
		if err != nil {
			log.Printf("Error approving and assigning request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve and assign request"})
			return
		}

		// Notify admin about assignment
		facultyName := getVehicleRequestRequesterName(req.RequestID)
		CreateAdminNotification("vehicle_assigned", "Vehicle Assigned", fmt.Sprintf("Vehicle assigned to request #%d by %s. Start OTP sent to requester.", req.RequestID, facultyName))

		c.JSON(http.StatusOK, gin.H{"message": "Request approved and vehicle assigned successfully", "start_otp": startOTP})
		return
	}

	setParts := []string{"status = 'approved'", "admin_remarks = ?"}
	args := []interface{}{req.AdminRemarks}
	if colExists["approved_by"] {
		setParts = append(setParts, "approved_by = ?")
		args = append(args, approvedBy)
	}
	if colExists["approved_at"] {
		setParts = append(setParts, "approved_at = NOW()")
	}
	query := fmt.Sprintf("UPDATE vehiclerequests SET %s WHERE id = ?", strings.Join(setParts, ", "))
	args = append(args, req.RequestID)
	_, err = config.DB.Exec(query, args...)
	if err != nil {
		log.Printf("Error approving request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request approved successfully"})
}

// POST /api/admin/vehicle-request/reject
func RejectVehicleRequest(c *gin.Context) {
	adminID := getUserIDFromRequest(c)

	var req struct {
		RequestID    int    `json:"request_id"`
		AdminRemarks string `json:"admin_remarks"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status string
	err := config.DB.QueryRow(`SELECT status FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		log.Printf("Error reading request status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if status != "pending" && status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This request cannot be rejected"})
		return
	}

	colExists := vehicleRequestColumns("approved_by", "approved_at")
	approvedBy := interface{}(nil)
	if adminID != nil {
		approvedBy = *adminID
	}
	setParts := []string{"status = 'rejected'", "admin_remarks = ?"}
	args := []interface{}{req.AdminRemarks}
	if colExists["approved_by"] {
		setParts = append(setParts, "approved_by = ?")
		args = append(args, approvedBy)
	}
	if colExists["approved_at"] {
		setParts = append(setParts, "approved_at = NOW()")
	}
	query := fmt.Sprintf("UPDATE vehiclerequests SET %s WHERE id = ?", strings.Join(setParts, ", "))
	args = append(args, req.RequestID)
	_, err = config.DB.Exec(query, args...)
	if err != nil {
		log.Printf("Error rejecting request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request rejected"})
}

// POST /api/admin/vehicle-request/cancel
func CancelVehicleRequestByAdmin(c *gin.Context) {
	var req struct {
		RequestID    int    `json:"request_id"`
		AdminRemarks string `json:"admin_remarks"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Fetch current request details for notifications
	var status string
	var driverID, vehicleID, facultyID, requesterID sql.NullInt64
	var purpose, bookingType sql.NullString
	requestCols := vehicleRequestColumns("requester_id")
	metaQuery := `
		SELECT status, driver_id, vehicle_id, faculty_id, NULL as requester_id,
		       COALESCE(Purpose,''), COALESCE(BookingType,'faculty')
		FROM vehiclerequests WHERE id = ?`
	if requestCols["requester_id"] {
		metaQuery = `
			SELECT status, driver_id, vehicle_id, faculty_id, requester_id,
			       COALESCE(Purpose,''), COALESCE(BookingType,'faculty')
			FROM vehiclerequests WHERE id = ?`
	}
	err := config.DB.QueryRow(metaQuery, req.RequestID).Scan(
		&status, &driverID, &vehicleID, &facultyID, &requesterID, &purpose, &bookingType)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	// Admin can cancel pending, approved, or assigned requests
	if status != "pending" && status != "approved" && status != "assigned" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This request cannot be cancelled (status: " + status + ")"})
		return
	}

	// If request was assigned, clear the driver and vehicle assignment
	if status == "assigned" {
		_, err = config.DB.Exec(`UPDATE vehiclerequests SET status = 'cancelled', admin_remarks = ?, driver_id = NULL, vehicle_id = NULL WHERE id = ?`,
			req.AdminRemarks, req.RequestID)
	} else {
		_, err = config.DB.Exec(`UPDATE vehiclerequests SET status = 'cancelled', admin_remarks = ? WHERE id = ?`,
			req.AdminRemarks, req.RequestID)
	}
	if err != nil {
		log.Printf("Error cancelling request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel request"})
		return
	}

	// Build notification message
	remarkText := ""
	if req.AdminRemarks != "" {
		remarkText = fmt.Sprintf(" Reason: %s", req.AdminRemarks)
	}
	purposeText := ""
	if purpose.Valid && purpose.String != "" {
		purposeText = fmt.Sprintf(" for \"%s\"", purpose.String)
	}

	// Notify the assigned driver (if any)
	if driverID.Valid && driverID.Int64 > 0 {
		var vehicleNumber string
		if vehicleID.Valid {
			config.DB.QueryRow("SELECT COALESCE(vehicle_name, vehicle_number) FROM vehicles WHERE id = ?", vehicleID.Int64).Scan(&vehicleNumber)
		}
		driverMsg := fmt.Sprintf("Vehicle request #%d%s has been cancelled by admin. Your assignment to vehicle %s has been removed.%s",
			req.RequestID, purposeText, vehicleNumber, remarkText)
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
			VALUES ('DRIVER', ?, ?, ?, 'warning', ?)
		`, driverID.Int64, "Vehicle Request Cancelled", driverMsg, req.RequestID)
	}

	// Notify the requester (requester_id preferred, fallback to faculty.user_id)
	requesterUserID := int64(0)
	if requesterID.Valid && requesterID.Int64 > 0 {
		requesterUserID = requesterID.Int64
	} else if facultyID.Valid && facultyID.Int64 > 0 {
		_ = config.DB.QueryRow("SELECT user_id FROM faculty WHERE id = ?", facultyID.Int64).Scan(&requesterUserID)
	}
	if requesterUserID > 0 {
		facultyMsg := fmt.Sprintf("Your vehicle request #%d%s has been cancelled by admin.%s",
			req.RequestID, purposeText, remarkText)
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
			VALUES ('FACULTY', ?, ?, ?, 'warning', ?)
		`, requesterUserID, "Vehicle Request Cancelled", facultyMsg, req.RequestID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request cancelled"})
}

// POST /api/admin/vehicle-request/assign
func AssignVehicleToRequest(c *gin.Context) {
	var req models.AssignVehicleRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.VehicleID == 0 || req.DriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle and driver are required"})
		return
	}

	var status string
	err := config.DB.QueryRow(`SELECT status FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only approved requests can be assigned a vehicle"})
		return
	}

	onwardFrom, onwardTo, returnFrom, returnTo, err := loadVehicleRequestSchedule(req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	assignCols := vehicleRequestColumns("assigned_at", "start_otp", "start_otp_generated_at")

	// Check for conflicts before assigning (skip if force_assign)
	if onwardFrom.Valid && !req.ForceAssign {
		hasDriverConflict, driverConflicts, err := checkDriverConflict(req.DriverID,
			onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
		if err != nil {
			log.Printf("Error checking driver conflict: %v", err)
		}
		if hasDriverConflict {
			// Extract date for message
			conflictDate := onwardFrom.String
			if len(conflictDate) >= 10 {
				conflictDate = conflictDate[:10]
			}
			log.Printf("[VR-ASSIGN] Driver conflict found. driverID=%d, date=%s, conflicts=%d items", req.DriverID, conflictDate, len(driverConflicts))
			for i, cf := range driverConflicts {
				log.Printf("  Conflict %d: %+v", i, cf)
			}
			availableDrivers := getAvailableDriversForRequest(req.DriverID,
				onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
			c.JSON(http.StatusConflict, gin.H{
				"error":             "driver_conflict",
				"message":           fmt.Sprintf("Driver is already assigned during this time range (conflict on %s)", conflictDate),
				"conflicts":         driverConflicts,
				"available_drivers": availableDrivers,
			})
			return
		}

		hasVehicleConflict, vehicleConflicts, err := checkVehicleConflict(req.VehicleID,
			onwardFrom.String, utils.NullStr(onwardTo), utils.NullStr(returnFrom), utils.NullStr(returnTo))
		if err != nil {
			log.Printf("Error checking vehicle conflict: %v", err)
		}
		if hasVehicleConflict {
			c.JSON(http.StatusConflict, gin.H{
				"error":     "vehicle_conflict",
				"message":   "Vehicle has a conflicting assignment during this time interval",
				"conflicts": vehicleConflicts,
			})
			return
		}
	}

	// Generate start OTP
	startOTP := generateOTP()

	setParts := []string{"vehicle_id = ?", "driver_id = ?", "status = 'assigned'"}
	args := []interface{}{req.VehicleID, req.DriverID}
	if assignCols["assigned_at"] {
		setParts = append(setParts, "assigned_at = NOW()")
	}
	if assignCols["start_otp"] {
		setParts = append(setParts, "start_otp = ?")
		args = append(args, startOTP)
	}
	if assignCols["start_otp_generated_at"] {
		setParts = append(setParts, "start_otp_generated_at = NOW()")
	}
	updateQuery := fmt.Sprintf("UPDATE vehiclerequests SET %s WHERE id = ?", strings.Join(setParts, ", "))
	args = append(args, req.RequestID)
	_, err = config.DB.Exec(updateQuery, args...)
	if err != nil {
		log.Printf("Error assigning vehicle: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign vehicle"})
		return
	}

	// Notify admin about assignment
	facultyName := getVehicleRequestRequesterName(req.RequestID)
	CreateAdminNotification("vehicle_assigned", "Vehicle Assigned", fmt.Sprintf("Vehicle assigned to request #%d by %s. Start OTP sent to requester.", req.RequestID, facultyName))

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle and driver assigned successfully", "start_otp": startOTP})
}

// POST /api/admin/vehicle-request/complete
// Admin can still manually complete a request (e.g., in case of OTP issues)
func CompleteVehicleRequest(c *gin.Context) {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status string
	err := config.DB.QueryRow(`SELECT status FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if status != "assigned" && status != "trip_started" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only assigned or in-progress requests can be marked as completed"})
		return
	}

	_, err = config.DB.Exec(`UPDATE vehiclerequests SET status = 'completed', trip_ended_at = NOW() WHERE id = ?`, req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete request"})
		return
	}

	CreateAdminNotification("trip_completed", "Trip Completed", fmt.Sprintf("Vehicle request #%d has been manually marked as completed by admin.", req.RequestID))

	c.JSON(http.StatusOK, gin.H{"message": "Request marked as completed"})
}

// GET /api/admin/vehicle-requests/pending-count
func GetPendingVehicleRequestCount(c *gin.Context) {
	var count int
	err := config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE status = 'pending'`).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ========== CONFLICT CHECK HELPERS ==========

// checkDriverConflict checks if a driver has ANY conflicting assignment
// (bus assignments, temporary assignments, EV assignments, or other vehicle requests)
// during the given time interval. Returns (hasConflict, conflictDetails, error).
func checkDriverConflict(driverID int, onwardFrom, onwardTo, returnFrom, returnTo string) (bool, []map[string]interface{}, error) {
	// Determine the overall occupied time range for this request
	tripStart := strings.TrimSpace(onwardFrom)
	tripEnd := strings.TrimSpace(onwardTo)
	if tripEnd == "" {
		tripEnd = tripStart
	}
	if strings.TrimSpace(returnTo) != "" {
		tripEnd = strings.TrimSpace(returnTo)
	} else if strings.TrimSpace(returnFrom) != "" {
		tripEnd = strings.TrimSpace(returnFrom)
	}
	if tripStart == "" {
		return false, nil, nil
	}

	var conflicts []map[string]interface{}
	seen := make(map[string]bool) // Track already added assignments to avoid duplicates

	// Parse date and time components
	tripDate := tripStart
	if len(tripDate) > 10 {
		tripDate = tripDate[:10]
	}
	tripStartTime := ""
	tripEndTime := ""
	if len(strings.TrimSpace(onwardFrom)) > 11 {
		tripStartTime = strings.TrimSpace(onwardFrom)[11:]
	}
	if len(tripEnd) > 11 {
		tripEndTime = tripEnd[11:]
	}
	if tripStartTime == "" {
		tripStartTime = "00:00"
	}
	if tripEndTime == "" {
		tripEndTime = "23:59"
	}

	// 1️⃣  Conflicting vehicle requests (status assigned / trip_started)
	// Use vehicle_request_trips as primary datetime source, fall back to main table columns.
	// For round trips, use first leg start and last leg end as the full occupied range.
	vrConflictQuery := `
		SELECT vr.id, COALESCE(v.vehicle_number,'N/A'), COALESCE(vt.type, ''),
			   COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) as onward_from,
			   COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime) as onward_to,
			   COALESCE(u.full_name,'') as faculty_name
		FROM vehiclerequests vr
		LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
		LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
			SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
		)
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.driver_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) IS NOT NULL
		AND (
			COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) <= ?
			AND COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime, vrt.from_datetime, vr.OnwardFromDateTime) >= ?
		)
	`
	vrRows, err := config.DB.Query(vrConflictQuery, driverID, tripEnd, tripStart)
	if err != nil {
		log.Printf("Error checking VR conflict: %v", err)
	} else {
		defer vrRows.Close()
		for vrRows.Next() {
			var vrID int
			var vehNum, vehType, onFrom, onTo, facName string
			vrRows.Scan(&vrID, &vehNum, &vehType, &onFrom, &onTo, &facName)
			conflicts = append(conflicts, map[string]interface{}{
				"assignment_type": "VEHICLE_REQUEST",
				"shift_name":      fmt.Sprintf("Vehicle Request #%d", vrID),
				"vehicle_number":  vehNum,
				"vehicle_type":    vehType,
				"start_time":      onFrom,
				"end_time":        onTo,
				"start_date":      onFrom,
				"end_date":        onTo,
				"faculty_name":    facName,
			})
		}
	}

	// 2️⃣  Regular bus/car assignments (shift-based)
	rows, err := config.DB.Query(`
		SELECT a.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       a.start_date, a.end_date
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		JOIN shifts s ON a.shift_id = s.id
		WHERE a.driver_id = ?
		AND ? BETWEEN a.start_date AND a.end_date
		AND a.status IN ('assigned','active')
	`, driverID, tripDate)
	if err != nil {
		log.Printf("Error checking assignment conflict: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var aID int
			var vehNum, vehType, shiftName string
			var startTime, endTime sql.NullString
			var startDate, endDate string
			rows.Scan(&aID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &startDate, &endDate)
			if startTime.Valid && endTime.Valid && timesOverlap(tripStartTime, tripEndTime, startTime.String, endTime.String) {
				key := fmt.Sprintf("REGULAR_%d", aID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "REGULAR",
						"assignment_id":   aID,
						"shift_name":      shiftName,
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      startTime.String,
						"end_time":        endTime.String,
						"start_date":      startDate,
						"end_date":        endDate,
					})
				}
			}
		}
	}

	// 3️⃣  Temporary replacement assignments (shift-based)
	rows2, err := config.DB.Query(`
		SELECT ta.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       ta.start_date, ta.end_date
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		JOIN shifts s ON ta.shift_id = s.id
		WHERE ta.replacement_driver_id = ?
		AND ? BETWEEN ta.start_date AND ta.end_date
	`, driverID, tripDate)
	if err != nil {
		log.Printf("Error checking temp assignment conflict: %v", err)
	} else {
		defer rows2.Close()
		for rows2.Next() {
			var taID int
			var vehNum, vehType, shiftName string
			var startTime, endTime sql.NullString
			var startDate, endDate string
			rows2.Scan(&taID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &startDate, &endDate)
			if startTime.Valid && endTime.Valid && timesOverlap(tripStartTime, tripEndTime, startTime.String, endTime.String) {
				key := fmt.Sprintf("TEMP_%d", taID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "TEMP_REPLACEMENT",
						"assignment_id":   taID,
						"shift_name":      shiftName + " (Temp)",
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      startTime.String,
						"end_time":        endTime.String,
						"start_date":      startDate,
						"end_date":        endDate,
					})
				}
			}
		}
	}

	// 4️⃣  EV cluster assignments (shift-based)
	rows3, err := config.DB.Query(`
		SELECT ev.id, COALESCE(vg.name, 'EV Group') as vehicle_number, 'EV' as vehicle_type, dc.name as cluster_name,
		       s.start_time, s.end_time,
		       ev.start_date, ev.end_date
		FROM ev_assignments ev
		LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
		  AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN shifts s ON ev.shift_id = s.id
		WHERE d.id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`, tripDate, driverID, tripDate)
	if err != nil {
		log.Printf("Error checking EV assignment conflict: %v", err)
	} else {
		defer rows3.Close()
		for rows3.Next() {
			var evID int
			var vehNum, vehType, clusterName string
			var startTime, endTime sql.NullString
			var startDate, endDate string
			rows3.Scan(&evID, &vehNum, &vehType, &clusterName, &startTime, &endTime, &startDate, &endDate)
			if startTime.Valid && endTime.Valid && timesOverlap(tripStartTime, tripEndTime, startTime.String, endTime.String) {
				key := fmt.Sprintf("EV_%d", evID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "EV_CLUSTER",
						"assignment_id":   evID,
						"shift_name":      "EV: " + clusterName,
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      startTime.String,
						"end_time":        endTime.String,
						"start_date":      startDate,
						"end_date":        endDate,
					})
				}
			}
		}
	}

	log.Printf("[checkDriverConflict] driverID=%d, date=%s, times=%s-%s, found %d conflicts", driverID, tripDate, tripStartTime, tripEndTime, len(conflicts))
	return len(conflicts) > 0, conflicts, nil
}

// checkVehicleConflict checks if a vehicle has ANY conflicting assignment
// during the given time interval. Returns (hasConflict, conflictDetails, error).
func checkVehicleConflict(vehicleID int, onwardFrom, onwardTo, returnFrom, returnTo string) (bool, []map[string]interface{}, error) {
	tripStart := strings.TrimSpace(onwardFrom)
	tripEnd := strings.TrimSpace(onwardTo)
	if tripEnd == "" {
		tripEnd = tripStart
	}
	if strings.TrimSpace(returnTo) != "" {
		tripEnd = strings.TrimSpace(returnTo)
	} else if strings.TrimSpace(returnFrom) != "" {
		tripEnd = strings.TrimSpace(returnFrom)
	}
	if tripStart == "" {
		return false, nil, nil
	}

	var conflicts []map[string]interface{}

	// Parse date and time components
	tripDate := tripStart
	if len(tripDate) > 10 {
		tripDate = tripDate[:10]
	}
	tripStartTime := ""
	tripEndTime := ""
	if len(strings.TrimSpace(onwardFrom)) > 11 {
		tripStartTime = strings.TrimSpace(onwardFrom)[11:]
	}
	if len(tripEnd) > 11 {
		tripEndTime = tripEnd[11:]
	}
	if tripStartTime == "" {
		tripStartTime = "00:00"
	}
	if tripEndTime == "" {
		tripEndTime = "23:59"
	}

	// 1️⃣  Conflicting vehicle requests
	// Use vehicle_request_trips as primary datetime source, fall back to main table columns.
	// For round trips, use first leg start and last leg end as the full occupied range.
	vrConflictQuery := `
		SELECT vr.id,
			   COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) as onward_from,
			   COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime) as onward_to,
			   COALESCE(d.full_name,'') as driver_name,
			   COALESCE(u.full_name,'') as faculty_name
		FROM vehiclerequests vr
		LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
		LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
			SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
		)
		LEFT JOIN drivers dr ON vr.driver_id = dr.id
		LEFT JOIN users d ON dr.user_id = d.id
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.vehicle_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) IS NOT NULL
		AND (
			COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) <= ?
			AND COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime, vrt.from_datetime, vr.OnwardFromDateTime) >= ?
		)
	`
	vrRows, err := config.DB.Query(vrConflictQuery, vehicleID, tripEnd, tripStart)
	if err != nil {
		log.Printf("Error checking VR vehicle conflict: %v", err)
	} else {
		defer vrRows.Close()
		for vrRows.Next() {
			var vrID int
			var onFrom, onTo, driverName, facName string
			vrRows.Scan(&vrID, &onFrom, &onTo, &driverName, &facName)
			conflicts = append(conflicts, map[string]interface{}{
				"assignment_type": "VEHICLE_REQUEST",
				"shift_name":      fmt.Sprintf("Vehicle Request #%d", vrID),
				"start_time":      onFrom,
				"end_time":        onTo,
				"start_date":      onFrom,
				"end_date":        onTo,
				"driver_name":     driverName,
				"faculty_name":    facName,
			})
		}
	}

	// 2️⃣  Regular bus/car assignments
	rows, err := config.DB.Query(`
		SELECT a.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       a.start_date, a.end_date, COALESCE(u.full_name,'') as driver_name
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN drivers d ON a.driver_id = d.id
		LEFT JOIN users u ON d.user_id = u.id
		WHERE a.vehicle_id = ?
		AND ? BETWEEN a.start_date AND a.end_date
		AND a.status IN ('assigned','active')
	`, vehicleID, tripDate)
	if err != nil {
		log.Printf("Error checking vehicle assignment conflict: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var aID int
			var vehNum, vehType, shiftName string
			var startTime, endTime sql.NullString
			var startDate, endDate, driverName string
			rows.Scan(&aID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &startDate, &endDate, &driverName)
			if startTime.Valid && endTime.Valid && timesOverlap(tripStartTime, tripEndTime, startTime.String, endTime.String) {
				conflicts = append(conflicts, map[string]interface{}{
					"assignment_type": "REGULAR",
					"assignment_id":   aID,
					"shift_name":      shiftName,
					"vehicle_number":  vehNum,
					"vehicle_type":    vehType,
					"start_time":      startTime.String,
					"end_time":        endTime.String,
					"start_date":      startDate,
					"end_date":        endDate,
					"driver_name":     driverName,
				})
			}
		}
	}

	// 3️⃣  EV assignments (vehicle-level via vehicle_groups)
	rows2, err := config.DB.Query(`
		SELECT ev.id, COALESCE(vg.name, 'EV Group') as vehicle_number, 'EV' as vehicle_type, dc.name as cluster_name,
		       s.start_time, s.end_time,
		       ev.start_date, ev.end_date
		FROM ev_assignments ev
		LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN vehicle_group_members vgm ON vg.id = vgm.group_id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN shifts s ON ev.shift_id = s.id
		WHERE vgm.vehicle_id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`, vehicleID, tripDate)
	if err != nil {
		log.Printf("Error checking EV vehicle conflict: %v", err)
	} else {
		defer rows2.Close()
		for rows2.Next() {
			var evID int
			var vehNum, vehType, clusterName string
			var startTime, endTime sql.NullString
			var startDate, endDate string
			rows2.Scan(&evID, &vehNum, &vehType, &clusterName, &startTime, &endTime, &startDate, &endDate)
			if startTime.Valid && endTime.Valid && timesOverlap(tripStartTime, tripEndTime, startTime.String, endTime.String) {
				conflicts = append(conflicts, map[string]interface{}{
					"assignment_type": "EV_CLUSTER",
					"assignment_id":   evID,
					"shift_name":      "EV: " + clusterName,
					"vehicle_number":  vehNum,
					"vehicle_type":    vehType,
					"start_time":      startTime.String,
					"end_time":        endTime.String,
					"start_date":      startDate,
					"end_date":        endDate,
				})
			}
		}
	}

	return len(conflicts) > 0, conflicts, nil
}

// getAvailableDriversForRequest returns a list of drivers that do NOT have conflicts during the request time
func getAvailableDriversForRequest(excludeDriverID int, onwardFrom, onwardTo, returnFrom, returnTo string) []map[string]interface{} {
	var drivers []map[string]interface{}
	rows, err := config.DB.Query(`
		SELECT d.id, u.full_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE u.is_active = 1
		ORDER BY u.full_name ASC
	`)
	if err != nil {
		log.Printf("Error fetching drivers for available list: %v", err)
		return drivers
	}
	defer rows.Close()

	for rows.Next() {
		var dID int
		var fullName string
		rows.Scan(&dID, &fullName)
		if dID == excludeDriverID {
			continue
		}
		hasConflict, _, _ := checkDriverConflict(dID, onwardFrom, onwardTo, returnFrom, returnTo)
		drivers = append(drivers, map[string]interface{}{
			"id":        dID,
			"full_name": fullName,
			"available": !hasConflict,
		})
	}
	return drivers
}
