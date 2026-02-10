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

	"github.com/gin-gonic/gin"
)

// generateOTP generates a random 6-digit OTP
func generateOTP() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%06d", r.Intn(1000000))
}

// EnsureVehicleRequestOTPColumns ensures OTP columns exist in vehiclerequests table
func EnsureVehicleRequestOTPColumns() {
	cols := []struct {
		name string
		ddl  string
	}{
		{"start_otp", "ALTER TABLE vehiclerequests ADD COLUMN start_otp VARCHAR(6) DEFAULT NULL"},
		{"end_otp", "ALTER TABLE vehiclerequests ADD COLUMN end_otp VARCHAR(6) DEFAULT NULL"},
		{"start_otp_generated_at", "ALTER TABLE vehiclerequests ADD COLUMN start_otp_generated_at TIMESTAMP NULL"},
		{"end_otp_generated_at", "ALTER TABLE vehiclerequests ADD COLUMN end_otp_generated_at TIMESTAMP NULL"},
		{"trip_started_at", "ALTER TABLE vehiclerequests ADD COLUMN trip_started_at TIMESTAMP NULL"},
		{"trip_ended_at", "ALTER TABLE vehiclerequests ADD COLUMN trip_ended_at TIMESTAMP NULL"},
	}
	for _, col := range cols {
		exists, _ := config.HasColumns("vehiclerequests", col.name)
		if !exists[col.name] {
			config.DB.Exec(col.ddl)
		}
	}
	// Update ENUM to include trip_started
	config.DB.Exec(`ALTER TABLE vehiclerequests MODIFY COLUMN status ENUM('pending','approved','rejected','assigned','trip_started','completed','cancelled') DEFAULT 'pending'`)
	log.Println("Vehicle request OTP columns ensured")
}

// GET /api/admin/vehicle-requests
func GetAllVehicleRequests(c *gin.Context) {
	statusFilter := c.Query("status")

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeAuditable")
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
	outcomeAuditableExpr := "'' as OutcomeAuditable"
	if colExists["OutcomeAuditable"] {
		outcomeAuditableExpr = "COALESCE(vr.OutcomeAuditable, '') as OutcomeAuditable"
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
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
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
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			DATE_FORMAT(vr.created_at, '%%Y-%%m-%%d %%H:%%i') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, taskIDExpr, outcomeAuditableExpr)

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
			&r.TaskID, &r.OutcomeAuditable,
			&r.Status, &r.AdminRemarks,
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

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder", "Vertical", "OralApproval", "TaskID", "OutcomeAuditable")
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
	outcomeAuditableExpr := "'' as OutcomeAuditable"
	if colExists["OutcomeAuditable"] {
		outcomeAuditableExpr = "COALESCE(vr.OutcomeAuditable, '') as OutcomeAuditable"
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
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
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
			COALESCE(ud.full_name, '') as driver_name,
			COALESCE(ud.phone, '') as driver_phone,
			DATE_FORMAT(vr.created_at, '%%Y-%%m-%%d %%H:%%i') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users ud ON d.user_id = ud.id
		WHERE vr.id = ?
	`, requestUnderExpr, purposeExpr, verticalExpr, oralApprovalExpr, taskIDExpr, outcomeAuditableExpr)

	err = config.DB.QueryRow(query, id).Scan(
		&r.ID, &r.FacultyID,
		&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.Vertical, &r.OralApproval, &r.CountPerson,
		&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
		&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
		&r.ContactName, &r.ContactPhone,
		&r.TaskID, &r.OutcomeAuditable,
		&r.Status, &r.AdminRemarks,
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
		var onwardDateTime, returnDateTime sql.NullString
		err = config.DB.QueryRow(`
			SELECT OnwardFromDateTime, ReturnFromDateTime FROM vehiclerequests WHERE id = ?
		`, req.RequestID).Scan(&onwardDateTime, &returnDateTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Check for conflicts (simplified check)
		if onwardDateTime.Valid {
			hasConflict, err := checkDriverConflict(req.DriverID, onwardDateTime.String)
			if err != nil {
				log.Printf("Error checking driver conflict: %v", err)
			}
			if hasConflict {
				c.JSON(http.StatusConflict, gin.H{
					"error":   "driver_conflict",
					"message": "Driver may have conflicts on this date/time",
				})
				return
			}

			hasVehicleConflict, err := checkVehicleConflict(req.VehicleID, onwardDateTime.String)
			if err != nil {
				log.Printf("Error checking vehicle conflict: %v", err)
			}
			if hasVehicleConflict {
				c.JSON(http.StatusConflict, gin.H{
					"error":   "vehicle_conflict",
					"message": "Vehicle may have conflicts on this date/time",
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
	// Admin can cancel pending, approved, or assigned requests
	if status != "pending" && status != "approved" && status != "assigned" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This request cannot be cancelled (status: " + status + ")"})
		return
	}

	_, err = config.DB.Exec(`UPDATE vehiclerequests SET status = 'cancelled', admin_remarks = ? WHERE id = ?`, req.AdminRemarks, req.RequestID)
	if err != nil {
		log.Printf("Error cancelling request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel request"})
		return
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
	var onwardDateTime, returnDateTime sql.NullString
	err := config.DB.QueryRow(`SELECT status, OnwardFromDateTime, ReturnFromDateTime FROM vehiclerequests WHERE id = ?`, req.RequestID).Scan(&status, &onwardDateTime, &returnDateTime)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only approved requests can be assigned a vehicle"})
		return
	}

	// Check for conflicts before assigning
	if onwardDateTime.Valid {
		hasDriverConflict, err := checkDriverConflict(req.DriverID, onwardDateTime.String)
		if err != nil {
			log.Printf("Error checking driver conflict: %v", err)
		}
		if hasDriverConflict {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "driver_conflict",
				"message": "Driver already has an assignment on this date/time",
			})
			return
		}

		hasVehicleConflict, err := checkVehicleConflict(req.VehicleID, onwardDateTime.String)
		if err != nil {
			log.Printf("Error checking vehicle conflict: %v", err)
		}
		if hasVehicleConflict {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "vehicle_conflict",
				"message": "Vehicle already has an assignment on this date/time",
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

func checkDriverConflict(driverID int, dateTime string) (bool, error) {
	// Simplified conflict check - check if driver has any assignments on the same date
	query := `
		SELECT COUNT(*) FROM vehiclerequests 
		WHERE driver_id = ? 
		AND status = 'assigned' 
		AND DATE(OnwardFromDateTime) = DATE(?)
	`
	var count int
	err := config.DB.QueryRow(query, driverID, dateTime).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func checkVehicleConflict(vehicleID int, dateTime string) (bool, error) {
	// Simplified conflict check - check if vehicle has any assignments on the same date
	query := `
		SELECT COUNT(*) FROM vehiclerequests 
		WHERE vehicle_id = ? 
		AND status = 'assigned' 
		AND DATE(OnwardFromDateTime) = DATE(?)
	`
	var count int
	err := config.DB.QueryRow(query, vehicleID, dateTime).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// Helper for formatting
func formatDateTime(dt string) string {
	if dt == "" {
		return ""
	}
	return fmt.Sprintf("%s", dt)
}
