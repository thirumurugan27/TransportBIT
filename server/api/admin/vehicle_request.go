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

// GET /api/admin/vehicle-requests
func GetAllVehicleRequests(c *gin.Context) {
	statusFilter := c.Query("status")

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeExpected", "OutcomeAuditable", "approved_by", "approved_at", "assigned_at", "start_otp", "end_otp", "start_otp_generated_at", "end_otp_generated_at", "trip_started_at", "trip_ended_at", "TravellerName", "MobileNumber", "Address")
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
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr, travellerNameExpr, mobileNumberExpr, addressExpr, approvedByExpr, approvedAtExpr, assignedAtExpr, startOtpExpr, endOtpExpr, startOtpGeneratedAtExpr, endOtpGeneratedAtExpr, tripStartedAtExpr, tripEndedAtExpr)

	var args []interface{}
	if statusFilter != "" {
		query += " WHERE vr.status = ?"
		args = append(args, statusFilter)
	}
	query += " ORDER BY vr.created_at DESC"

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
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone,
			&r.TaskID, &r.OutcomeExpected, &r.OutcomeAuditable,
			&r.GuestName, &r.MobileNumber, &r.Address,
			&r.Status, &r.AdminRemarks,
			&r.ApprovedBy, &r.ApprovedAt, &r.AssignedAt,
			&r.StartOTP, &r.EndOTP, &r.StartOTPGeneratedAt, &r.EndOTPGeneratedAt, &r.TripStartedAt, &r.TripEndedAt,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
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

// GET /api/admin/vehicle-request/:id
func GetVehicleRequestDetails(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var r models.VehicleRequest

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeExpected", "OutcomeAuditable", "approved_by", "approved_at", "assigned_at", "start_otp", "end_otp", "start_otp_generated_at", "end_otp_generated_at", "trip_started_at", "trip_ended_at", "TravellerName", "MobileNumber", "Address")
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
			%s,
			%s,
			%s,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			DATE_FORMAT(vr.created_at, '%%d-%%m-%%Y %%h:%%i %%p') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
		WHERE vr.id = ?
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, taskIDExpr, outcomeExpectedExpr, outcomeAuditableExpr, travellerNameExpr, mobileNumberExpr, addressExpr, approvedByExpr, approvedAtExpr, assignedAtExpr, startOtpExpr, endOtpExpr, startOtpGeneratedAtExpr, endOtpGeneratedAtExpr, tripStartedAtExpr, tripEndedAtExpr)

	err = config.DB.QueryRow(query, id).Scan(
		&r.ID, &r.FacultyID,
		&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
		&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
		&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
		&r.ContactName, &r.ContactPhone,
		&r.TaskID, &r.OutcomeExpected, &r.OutcomeAuditable,
		&r.GuestName, &r.MobileNumber, &r.Address,
		&r.Status, &r.AdminRemarks,
		&r.ApprovedBy, &r.ApprovedAt, &r.AssignedAt,
		&r.StartOTP, &r.EndOTP, &r.StartOTPGeneratedAt, &r.EndOTPGeneratedAt, &r.TripStartedAt, &r.TripEndedAt,
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

	colExists, _ := config.HasColumns("vehiclerequests", "approved_by", "approved_at", "assigned_at")
	approvedBy := interface{}(nil)
	if adminID != nil {
		approvedBy = *adminID
	}

	// If vehicle and driver are provided, approve and assign in one step
	if req.VehicleID > 0 && req.DriverID > 0 {
		// Get request details for conflict checking
		var onwardFrom, onwardTo, returnFrom, returnTo sql.NullString
		err = config.DB.QueryRow(`
			SELECT OnwardFromDateTime, OnwardTodateTime, ReturnFromDateTime, ReturnTodateTime FROM vehiclerequests WHERE id = ?
		`, req.RequestID).Scan(&onwardFrom, &onwardTo, &returnFrom, &returnTo)
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

		setParts := []string{"status = 'assigned'", "admin_remarks = ?", "vehicle_id = ?", "driver_id = ?", "start_otp = ?", "start_otp_generated_at = NOW()"}
		args := []interface{}{req.AdminRemarks, req.VehicleID, req.DriverID, startOTP}
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
		var facultyName string
		config.DB.QueryRow(`SELECT u.full_name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = (SELECT faculty_id FROM vehiclerequests WHERE id = ?)`, req.RequestID).Scan(&facultyName)
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

	colExists, _ := config.HasColumns("vehiclerequests", "approved_by", "approved_at")
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
	var driverID, vehicleID, facultyID sql.NullInt64
	var purpose, bookingType sql.NullString
	err := config.DB.QueryRow(`
		SELECT status, driver_id, vehicle_id, faculty_id, 
		       COALESCE(Purpose,''), COALESCE(BookingType,'faculty')
		FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(
		&status, &driverID, &vehicleID, &facultyID, &purpose, &bookingType)
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

	// Notify the requesting faculty
	if facultyID.Valid && facultyID.Int64 > 0 {
		var userID int
		err := config.DB.QueryRow("SELECT user_id FROM faculty WHERE id = ?", facultyID.Int64).Scan(&userID)
		if err == nil {
			facultyMsg := fmt.Sprintf("Your vehicle request #%d%s has been cancelled by admin.%s",
				req.RequestID, purposeText, remarkText)
			config.DB.Exec(`
				INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
				VALUES ('FACULTY', ?, ?, ?, 'warning', ?)
			`, userID, "Vehicle Request Cancelled", facultyMsg, req.RequestID)
		}
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
	var onwardFrom, onwardTo, returnFrom, returnTo sql.NullString
	err := config.DB.QueryRow(`SELECT status, OnwardFromDateTime, OnwardTodateTime, ReturnFromDateTime, ReturnTodateTime FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status, &onwardFrom, &onwardTo, &returnFrom, &returnTo)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only approved requests can be assigned a vehicle"})
		return
	}

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

	_, err = config.DB.Exec(`
		UPDATE vehiclerequests 
		SET vehicle_id = ?, driver_id = ?, status = 'assigned', assigned_at = NOW(),
			start_otp = ?, start_otp_generated_at = NOW()
		WHERE id = ?
	`, req.VehicleID, req.DriverID, startOTP, req.RequestID)
	if err != nil {
		log.Printf("Error assigning vehicle: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign vehicle"})
		return
	}

	// Notify admin about assignment
	var facultyName string
	config.DB.QueryRow(`SELECT u.full_name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = (SELECT faculty_id FROM vehiclerequests WHERE id = ?)`, req.RequestID).Scan(&facultyName)
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
	vrRows, err := config.DB.Query(`
		SELECT vr.id, COALESCE(v.vehicle_number,'N/A'), COALESCE(v.vehicle_type,''),
			   vr.OnwardFromDateTime, COALESCE(vr.OnwardTodateTime,''),
			   COALESCE(u.full_name,'') as faculty_name
		FROM vehiclerequests vr
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.driver_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND vr.OnwardFromDateTime IS NOT NULL
		AND TRIM(vr.OnwardFromDateTime) != ''
		AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
		AND (
			(vr.OnwardFromDateTime <= ? AND COALESCE(
				NULLIF(vr.ReturnTodateTime,''),
				NULLIF(vr.ReturnFromDateTime,''),
				NULLIF(vr.OnwardTodateTime,''),
				vr.OnwardFromDateTime) >= ?)
		)
	`, driverID, tripEnd, tripStart)
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
		SELECT a.id, v.vehicle_number, v.vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       a.start_date, a.end_date
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
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
			var slotStart, slotEnd sql.NullString
			var startDate, endDate string
			rows.Scan(&aID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate)
			effStart := startTime
			effEnd := endTime
			if slotStart.Valid && slotEnd.Valid {
				effStart = slotStart
				effEnd = slotEnd
			}
			if effStart.Valid && effEnd.Valid && timesOverlap(tripStartTime, tripEndTime, effStart.String, effEnd.String) {
				key := fmt.Sprintf("REGULAR_%d", aID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "REGULAR",
						"assignment_id":   aID,
						"shift_name":      shiftName,
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      effStart.String,
						"end_time":        effEnd.String,
						"start_date":      startDate,
						"end_date":        endDate,
					})
				}
			}
		}
	}

	// 3️⃣  Temporary replacement assignments (shift-based)
	rows2, err := config.DB.Query(`
		SELECT ta.id, v.vehicle_number, v.vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       ta.start_date, ta.end_date
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		JOIN shifts s ON ta.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
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
			var slotStart, slotEnd sql.NullString
			var startDate, endDate string
			rows2.Scan(&taID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate)
			effStart := startTime
			effEnd := endTime
			if slotStart.Valid && slotEnd.Valid {
				effStart = slotStart
				effEnd = slotEnd
			}
			if effStart.Valid && effEnd.Valid && timesOverlap(tripStartTime, tripEndTime, effStart.String, effEnd.String) {
				key := fmt.Sprintf("TEMP_%d", taID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "TEMP_REPLACEMENT",
						"assignment_id":   taID,
						"shift_name":      shiftName + " (Temp)",
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      effStart.String,
						"end_time":        effEnd.String,
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
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       ev.start_date, ev.end_date
		FROM ev_assignments ev
		LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
		  AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN shifts s ON ev.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
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
			var slotStart, slotEnd sql.NullString
			var startDate, endDate string
			rows3.Scan(&evID, &vehNum, &vehType, &clusterName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate)
			effStart := startTime
			effEnd := endTime
			if slotStart.Valid && slotEnd.Valid {
				effStart = slotStart
				effEnd = slotEnd
			}
			if effStart.Valid && effEnd.Valid && timesOverlap(tripStartTime, tripEndTime, effStart.String, effEnd.String) {
				key := fmt.Sprintf("EV_%d", evID)
				if !seen[key] {
					seen[key] = true
					conflicts = append(conflicts, map[string]interface{}{
						"assignment_type": "EV_CLUSTER",
						"assignment_id":   evID,
						"shift_name":      "EV: " + clusterName,
						"vehicle_number":  vehNum,
						"vehicle_type":    vehType,
						"start_time":      effStart.String,
						"end_time":        effEnd.String,
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
	vrRows, err := config.DB.Query(`
		SELECT vr.id, vr.OnwardFromDateTime, COALESCE(vr.OnwardTodateTime,''),
		       COALESCE(d.full_name,'') as driver_name,
		       COALESCE(u.full_name,'') as faculty_name
		FROM vehiclerequests vr
		LEFT JOIN drivers dr ON vr.driver_id = dr.id
		LEFT JOIN users d ON dr.user_id = d.id
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.vehicle_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND vr.OnwardFromDateTime IS NOT NULL
		AND TRIM(vr.OnwardFromDateTime) != ''
		AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
		AND (
			(vr.OnwardFromDateTime <= ? AND COALESCE(
				NULLIF(vr.ReturnTodateTime,''),
				NULLIF(vr.ReturnFromDateTime,''),
				NULLIF(vr.OnwardTodateTime,''),
				vr.OnwardFromDateTime) >= ?)
		)
	`, vehicleID, tripEnd, tripStart)
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
		SELECT a.id, v.vehicle_number, v.vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       a.start_date, a.end_date, COALESCE(u.full_name,'') as driver_name
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id AND ss.slot_order = 1
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
			var slotStart, slotEnd sql.NullString
			var startDate, endDate, driverName string
			rows.Scan(&aID, &vehNum, &vehType, &shiftName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate, &driverName)
			effStart := startTime
			effEnd := endTime
			if slotStart.Valid && slotEnd.Valid {
				effStart = slotStart
				effEnd = slotEnd
			}
			if effStart.Valid && effEnd.Valid && timesOverlap(tripStartTime, tripEndTime, effStart.String, effEnd.String) {
				conflicts = append(conflicts, map[string]interface{}{
					"assignment_type": "REGULAR",
					"assignment_id":   aID,
					"shift_name":      shiftName,
					"vehicle_number":  vehNum,
					"vehicle_type":    vehType,
					"start_time":      effStart.String,
					"end_time":        effEnd.String,
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
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       ev.start_date, ev.end_date
		FROM ev_assignments ev
		LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN vehicle_group_members vgm ON vg.id = vgm.group_id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN shifts s ON ev.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
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
			var slotStart, slotEnd sql.NullString
			var startDate, endDate string
			rows2.Scan(&evID, &vehNum, &vehType, &clusterName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate)
			effStart := startTime
			effEnd := endTime
			if slotStart.Valid && slotEnd.Valid {
				effStart = slotStart
				effEnd = slotEnd
			}
			if effStart.Valid && effEnd.Valid && timesOverlap(tripStartTime, tripEndTime, effStart.String, effEnd.String) {
				conflicts = append(conflicts, map[string]interface{}{
					"assignment_type": "EV_CLUSTER",
					"assignment_id":   evID,
					"shift_name":      "EV: " + clusterName,
					"vehicle_number":  vehNum,
					"vehicle_type":    vehType,
					"start_time":      effStart.String,
					"end_time":        effEnd.String,
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
