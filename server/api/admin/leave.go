package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
=========================

	GET /api/admin/leave-requests (or similar)
	Get All Leave Requests

=========================
*/
func GetAllLeaveRequests(c *gin.Context) {
	GetLeaveHistory(c)
}

/*
=========================

	GET /api/admin/leave/history
	Get all leave requests (approved, rejected, pending) for analytics

=========================
*/
func GetLeaveHistory(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT lr.id, lr.driver_id, u.full_name as driver_name, lr.leave_type,
			   DATE_FORMAT(lr.start_date, '%Y-%m-%d') as start_date,
			   TIME_FORMAT(lr.start_time, '%H:%i') as start_time,
			   DATE_FORMAT(lr.end_date, '%Y-%m-%d') as end_date,
			   TIME_FORMAT(lr.end_time, '%H:%i') as end_time,
			   lr.reason, lr.status,
			   lr.incharge_id, u_inc.full_name as incharge_name, lr.incharge_approved_at, lr.incharge_remarks,
			   lr.admin_id, u_adm.full_name as admin_name, lr.admin_approved_at, lr.admin_remarks,
			   lr.created_at
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN users u_inc ON lr.incharge_id = u_inc.id
		LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
		ORDER BY lr.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		log.Printf("Get leave history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching leave history"})
		return
	}
	defer rows.Close()

	// Define struct inline or reuse if available
	type LeaveRequest struct {
		ID                 int     `json:"id"`
		DriverID           int     `json:"driver_id"`
		DriverName         string  `json:"driver_name"`
		LeaveType          string  `json:"leave_type"`
		StartDate          string  `json:"start_date"`
		StartTime          string  `json:"start_time"`
		EndDate            string  `json:"end_date"`
		EndTime            string  `json:"end_time"`
		Reason             string  `json:"reason"`
		Status             string  `json:"status"`
		InchargeID         *int    `json:"incharge_id"`
		InchargeName       *string `json:"incharge_name"`
		InchargeApprovedAt *string `json:"incharge_approved_at"`
		InchargeRemarks    *string `json:"incharge_remarks"`
		AdminID            *int    `json:"admin_id"`
		AdminName          *string `json:"admin_name"`
		AdminApprovedAt    *string `json:"admin_approved_at"`
		AdminRemarks       *string `json:"admin_remarks"`
		CreatedAt          string  `json:"created_at"`
	}

	var requests []LeaveRequest
	for rows.Next() {
		var req LeaveRequest
		var startDate, startTime, endDate, endTime, createdAt []byte
		var inchargeApprovedAt, adminApprovedAt sql.NullString
		var inchargeRemarks, adminRemarks sql.NullString
		var inchargeName, adminName sql.NullString
		var inchargeID, adminID sql.NullInt64

		err := rows.Scan(&req.ID, &req.DriverID, &req.DriverName, &req.LeaveType,
			&startDate, &startTime, &endDate, &endTime, &req.Reason, &req.Status,
			&inchargeID, &inchargeName, &inchargeApprovedAt, &inchargeRemarks,
			&adminID, &adminName, &adminApprovedAt, &adminRemarks, &createdAt)

		if err != nil {
			log.Printf("Scan leave request error: %v", err)
			continue
		}

		req.StartDate = string(startDate)
		req.StartTime = string(startTime)
		req.EndDate = string(endDate)
		req.EndTime = string(endTime)
		req.CreatedAt = string(createdAt)

		if inchargeID.Valid {
			id := int(inchargeID.Int64)
			req.InchargeID = &id
		}
		if inchargeName.Valid {
			req.InchargeName = &inchargeName.String
		}
		if inchargeApprovedAt.Valid {
			req.InchargeApprovedAt = &inchargeApprovedAt.String
		}
		if inchargeRemarks.Valid {
			req.InchargeRemarks = &inchargeRemarks.String
		}
		if adminID.Valid {
			id := int(adminID.Int64)
			req.AdminID = &id
		}
		if adminName.Valid {
			req.AdminName = &adminName.String
		}
		if adminApprovedAt.Valid {
			req.AdminApprovedAt = &adminApprovedAt.String
		}
		if adminRemarks.Valid {
			req.AdminRemarks = &adminRemarks.String
		}

		requests = append(requests, req)
	}

	c.JSON(http.StatusOK, requests)
}

/*
=========================

	GET /api/admin/leave/stats
	Get leave statistics for dashboard

=========================
*/
func GetLeaveStats(c *gin.Context) {
	stats := map[string]int{
		"pending":           0,
		"incharge_approved": 0,
		"admin_approved":    0,
		"rejected":          0,
		"total":             0,
	}

	rows, err := config.DB.Query(`
		SELECT status, COUNT(*) as count
		FROM leave_requests
		GROUP BY status
	`)
	if err != nil {
		log.Printf("Get leave stats error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching stats"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		stats[status] = count
		stats["total"] += count
	}

	c.JSON(http.StatusOK, stats)
}

// LeaveRequest - leave request struct for admin
type LeaveRequest struct {
	ID                 int     `json:"id"`
	DriverID           int     `json:"driver_id"`
	DriverName         string  `json:"driver_name"`
	LeaveType          string  `json:"leave_type"`
	StartDate          string  `json:"start_date"`
	StartTime          string  `json:"start_time"`
	EndDate            string  `json:"end_date"`
	EndTime            string  `json:"end_time"`
	Reason             string  `json:"reason"`
	Status             string  `json:"status"`
	InchargeID         *int    `json:"incharge_id"`
	InchargeName       *string `json:"incharge_name"`
	InchargeApprovedAt *string `json:"incharge_approved_at"`
	InchargeRemarks    *string `json:"incharge_remarks"`
	AdminID            *int    `json:"admin_id"`
	AdminName          *string `json:"admin_name"`
	AdminApprovedAt    *string `json:"admin_approved_at"`
	AdminRemarks       *string `json:"admin_remarks"`
	CreatedAt          string  `json:"created_at"`
}

// ApproveLeaveRequest - request to approve leave
type ApproveLeaveRequest struct {
	LeaveID    int    `json:"leave_id"`
	ApproverID int    `json:"approver_id"`
	Status     string `json:"status"`
	Remarks    string `json:"remarks"`
}

/*
=========================

	GET /api/admin/leave/pending
	Get all pending leave requests for admin approval

=========================
*/
func GetPendingLeaveRequests(c *gin.Context) {
	// Get status filter from query params (defaults to all non-final statuses)
	status := c.Query("status")

	baseQuery := `
			SELECT lr.id, lr.driver_id, u.full_name as driver_name, lr.leave_type, 
				   DATE_FORMAT(lr.start_date, '%Y-%m-%d'), TIME_FORMAT(lr.start_time, '%H:%i'),
				   DATE_FORMAT(lr.end_date, '%Y-%m-%d'), TIME_FORMAT(lr.end_time, '%H:%i'), lr.reason, lr.status,
				   lr.incharge_id, u_inc.full_name as incharge_name, lr.incharge_approved_at, lr.incharge_remarks,
				   lr.admin_id, u_adm.full_name as admin_name, lr.admin_approved_at, lr.admin_remarks, lr.created_at
			FROM leave_requests lr
			JOIN drivers d ON lr.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			LEFT JOIN users u_inc ON lr.incharge_id = u_inc.id
			LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
	`

	var query string
	if status == "pending" {
		query = baseQuery + " WHERE lr.status = 'pending' ORDER BY lr.created_at DESC"
	} else if status == "incharge_approved" {
		query = baseQuery + " WHERE lr.status = 'incharge_approved' ORDER BY lr.created_at DESC"
	} else {
		query = baseQuery + " WHERE lr.status IN ('pending', 'incharge_approved') ORDER BY lr.created_at DESC"
	}

	var args []interface{}
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get pending leaves error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching leave requests"})
		return
	}
	defer rows.Close()

	var leaves []LeaveRequest = []LeaveRequest{}
	for rows.Next() {
		var req LeaveRequest
		var startDate, startTime, endDate, endTime, createdAt []byte
		var inchargeApprovedAt, adminApprovedAt sql.NullString
		var inchargeRemarks, adminRemarks sql.NullString
		var inchargeName, adminName sql.NullString
		var inchargeID, adminID sql.NullInt64

		err := rows.Scan(&req.ID, &req.DriverID, &req.DriverName, &req.LeaveType,
			&startDate, &startTime, &endDate, &endTime, &req.Reason, &req.Status,
			&inchargeID, &inchargeName, &inchargeApprovedAt, &inchargeRemarks,
			&adminID, &adminName, &adminApprovedAt, &adminRemarks, &createdAt)

		if err != nil {
			log.Printf("Scan leave request error: %v", err)
			continue
		}

		req.StartDate = string(startDate)
		req.StartTime = string(startTime)
		req.EndDate = string(endDate)
		req.EndTime = string(endTime)
		req.CreatedAt = string(createdAt)

		if inchargeID.Valid {
			id := int(inchargeID.Int64)
			req.InchargeID = &id
		}
		if inchargeName.Valid {
			req.InchargeName = &inchargeName.String
		}
		if inchargeApprovedAt.Valid {
			req.InchargeApprovedAt = &inchargeApprovedAt.String
		}
		if inchargeRemarks.Valid {
			req.InchargeRemarks = &inchargeRemarks.String
		}
		if adminID.Valid {
			id := int(adminID.Int64)
			req.AdminID = &id
		}
		if adminName.Valid {
			req.AdminName = &adminName.String
		}
		if adminApprovedAt.Valid {
			req.AdminApprovedAt = &adminApprovedAt.String
		}
		if adminRemarks.Valid {
			req.AdminRemarks = &adminRemarks.String
		}

		leaves = append(leaves, req)
	}

	c.JSON(http.StatusOK, leaves)
}

/*
=========================

	POST /api/admin/leave/approve
	Admin approves/rejects leave (after incharge approval)

=========================
*/
func ApproveLeave(c *gin.Context) {
	var req ApproveLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "approved" && status != "rejected" && status != "admin_approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Use 'approved' or 'rejected'"})
		return
	}

	// Get current leave status, incharge decision, and details
	var currentStatus string
	var driverID int
	var startDate, endDate string
	var inchargeApprovedAt sql.NullString
	var adminApprovedAt sql.NullString
	err := config.DB.QueryRow(`
		SELECT status, driver_id, 
			DATE_FORMAT(start_date, '%Y-%m-%d'), 
			DATE_FORMAT(end_date, '%Y-%m-%d'),
			incharge_approved_at,
			admin_approved_at
		FROM leave_requests 
		WHERE id = ?
	`, req.LeaveID).Scan(&currentStatus, &driverID, &startDate, &endDate, &inchargeApprovedAt, &adminApprovedAt)

	if err != nil {
		log.Printf("Get leave status error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave request not found"})
		return
	}

	// Check if admin already processed this request
	if adminApprovedAt.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This leave request has already been processed by admin"})
		return
	}

	// Determine new status based on admin decision and incharge decision
	var newStatus string
	if status == "rejected" {
		// If admin rejects, the leave is rejected regardless of incharge decision
		newStatus = "rejected"
	} else {
		// Admin approved - check if incharge has also approved
		if inchargeApprovedAt.Valid && currentStatus != "rejected" {
			// Both have approved - mark as fully approved
			newStatus = "approved"
		} else if currentStatus == "rejected" {
			// Incharge already rejected, keep it rejected
			newStatus = "rejected"
		} else {
			// Admin approved but incharge hasn't decided yet
			newStatus = "admin_approved"
		}
	}

	// Update leave request with admin decision
	// Use NULL for admin_id if approver_id is 0 or invalid
	var adminID interface{}
	if req.ApproverID > 0 {
		adminID = req.ApproverID
	} else {
		adminID = nil
	}

	result, err := config.DB.Exec(`
		UPDATE leave_requests 
		SET status = ?, 
			admin_id = ?, 
			admin_approved_at = NOW(), 
			admin_remarks = ?
		WHERE id = ?
	`, newStatus, adminID, req.Remarks, req.LeaveID)

	if err != nil {
		log.Printf("Approve leave error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing leave request: " + err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		log.Printf("No rows affected for leave_id: %d", req.LeaveID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update leave request"})
		return
	}

	// If admin approved (either fully approved or admin_approved), automatically mark attendance as absent for the leave period
	if newStatus == "approved" || newStatus == "admin_approved" {
		markAttendanceForLeave(driverID, startDate, endDate)
	}

	// Send notification to driver
	var driverUserID int
	config.DB.QueryRow("SELECT user_id FROM drivers WHERE id = ?", driverID).Scan(&driverUserID)

	var notifTitle string
	var notifMessage string

	if newStatus == "rejected" {
		notifTitle = "Leave Request Rejected by Admin"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been rejected by admin. Reason: %s",
			startDate, endDate, req.Remarks)
	} else if newStatus == "approved" {
		notifTitle = "Leave Request Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been fully approved by both incharge and admin. Attendance will be automatically marked as absent.",
			startDate, endDate)
	} else {
		notifTitle = "Leave Request - Admin Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been approved by admin. Waiting for incharge approval.",
			startDate, endDate)
	}

	_, _ = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'leave', ?)
	`, driverID, notifTitle, notifMessage, req.LeaveID)

	// If fully approved, check for affected assignments and suggest replacements
	if newStatus == "approved" {
		// Find affected assignments
		affectedAssignments := []map[string]interface{}{}
		rows, err := config.DB.Query(`
			SELECT a.id, a.shift_id, a.vehicle_id, 
				DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
				DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
				s.name as shift_name, v.vehicle_number
			FROM assignments a
			JOIN shifts s ON a.shift_id = s.id
			JOIN vehicles v ON a.vehicle_id = v.id
			WHERE a.driver_id = ? 
			AND (
				(a.start_date <= ? AND a.end_date >= ?) OR
				(a.start_date <= ? AND a.end_date >= ?) OR
				(a.start_date >= ? AND a.end_date <= ?)
			)
			AND a.status = 'active'
		`, driverID, startDate, startDate, endDate, endDate, startDate, endDate)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				assignment := make(map[string]interface{})
				var id, shiftID, vehicleID int
				var start, end, shiftName, vehicleNumber string
				rows.Scan(&id, &shiftID, &vehicleID, &start, &end, &shiftName, &vehicleNumber)

				assignment["id"] = id
				assignment["shift_id"] = shiftID
				assignment["vehicle_id"] = vehicleID
				assignment["start_date"] = start
				assignment["end_date"] = end
				assignment["shift_name"] = shiftName
				assignment["vehicle_number"] = vehicleNumber

				// Find available drivers for this assignment
				availableDrivers := []map[string]interface{}{}
				driverRows, err := config.DB.Query(`
					SELECT d.id, u.full_name, u.phone, d.license_number
					FROM drivers d
					JOIN users u ON d.user_id = u.id
					WHERE d.status = 'present'
					AND d.id != ?
					AND d.id NOT IN (
						SELECT driver_id FROM assignments
						WHERE (
							(start_date <= ? AND end_date >= ?) OR
							(start_date <= ? AND end_date >= ?) OR
							(start_date >= ? AND end_date <= ?)
						)
						AND status = 'active'
					)
					AND d.id NOT IN (
						SELECT driver_id FROM leave_requests
						WHERE status = 'admin_approved'
						AND (
							(start_date <= ? AND end_date >= ?) OR
							(start_date <= ? AND end_date >= ?) OR
							(start_date >= ? AND end_date <= ?)
						)
					)
					LIMIT 10
				`, driverID, startDate, startDate, endDate, endDate, startDate, endDate,
					startDate, startDate, endDate, endDate, startDate, endDate)

				if err == nil {
					defer driverRows.Close()
					for driverRows.Next() {
						var driver map[string]interface{} = make(map[string]interface{})
						var id int
						var name, phone, license string
						driverRows.Scan(&id, &name, &phone, &license)
						driver["id"] = id
						driver["name"] = name
						driver["phone"] = phone
						driver["license"] = license
						availableDrivers = append(availableDrivers, driver)
					}
				}
				assignment["available_drivers"] = availableDrivers
				affectedAssignments = append(affectedAssignments, assignment)
			}
		}

		// Return success with affected assignments and suggested drivers
		c.JSON(http.StatusOK, gin.H{
			"message":              "Leave request approved successfully. Attendance will be automatically marked as absent.",
			"affected_assignments": affectedAssignments,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Leave request updated successfully"})
}

/*
=========================

	GET /api/admin/leave/:id/affected-assignments
	Get all assignments affected by a leave request

=========================
*/
func GetLeaveAffectedAssignments(c *gin.Context) {
	leaveID := c.Param("id")
	if leaveID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Leave ID required"})
		return
	}

	// Get leave details
	var driverID int
	var startDate, endDate string
	err := config.DB.QueryRow(`
		SELECT driver_id, 
			DATE_FORMAT(start_date, '%Y-%m-%d'), 
			DATE_FORMAT(end_date, '%Y-%m-%d')
		FROM leave_requests 
		WHERE id = ?
	`, leaveID).Scan(&driverID, &startDate, &endDate)

	if err != nil {
		log.Printf("Get leave details error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave request not found"})
		return
	}

	// Get all affected assignments for this driver during the leave period
	type AffectedAssignment struct {
		ID             int    `json:"id"`
		ShiftID        int    `json:"shift_id"`
		VehicleID      int    `json:"vehicle_id"`
		StartDate      string `json:"start_date"`
		EndDate        string `json:"end_date"`
		ShiftName      string `json:"shift_name"`
		ShiftStartTime string `json:"shift_start_time"`
		ShiftEndTime   string `json:"shift_end_time"`
		VehicleNumber  string `json:"vehicle_number"`
		VehicleType    string `json:"vehicle_type"`
		BusName        string `json:"bus_name"`
	}

	rows, err := config.DB.Query(`
		SELECT a.id, a.shift_id, a.vehicle_id, 
			DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
			s.name as shift_name,
			TIME_FORMAT(s.start_time, '%H:%i') as shift_start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as shift_end_time,
			v.vehicle_number, v.vehicle_type,
			COALESCE(v.name, b.bus_name, '') as bus_name
		FROM assignments a
		JOIN shifts s ON a.shift_id = s.id
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN buses b ON v.id = b.vehicle_id
		WHERE a.driver_id = ? 
		AND a.status IN ('active', 'assigned')
		AND (
			(a.start_date <= ? AND a.end_date >= ?) OR
			(a.start_date <= ? AND a.end_date >= ?) OR
			(a.start_date >= ? AND a.end_date <= ?)
		)
		ORDER BY a.start_date, s.start_time
	`, driverID, startDate, startDate, endDate, endDate, startDate, endDate)

	if err != nil {
		log.Printf("Get affected assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	var assignments []AffectedAssignment
	for rows.Next() {
		var a AffectedAssignment
		err := rows.Scan(&a.ID, &a.ShiftID, &a.VehicleID, &a.StartDate, &a.EndDate,
			&a.ShiftName, &a.ShiftStartTime, &a.ShiftEndTime,
			&a.VehicleNumber, &a.VehicleType, &a.BusName)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		assignments = append(assignments, a)
	}

	// Get available drivers for replacement (not on leave, not the same driver)
	type AvailableDriver struct {
		ID            int    `json:"id"`
		FullName      string `json:"full_name"`
		Phone         string `json:"phone"`
		LicenseNumber string `json:"license_number"`
		LicenseType   string `json:"license_type"`
	}

	// Query all drivers except the one on leave, excluding those who are also on leave during this period
	driverRows, err := config.DB.Query(`
		SELECT d.id, u.full_name, COALESCE(u.phone, ''), COALESCE(d.license_number, ''), COALESCE(d.license_type, '')
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.id != ?
		AND d.id NOT IN (
			SELECT lr.driver_id FROM leave_requests lr
			WHERE lr.status IN ('approved', 'admin_approved', 'incharge_approved')
			AND (
				(lr.start_date <= ? AND lr.end_date >= ?) OR
				(lr.start_date <= ? AND lr.end_date >= ?) OR
				(lr.start_date >= ? AND lr.end_date <= ?)
			)
		)
		ORDER BY u.full_name
	`, driverID, startDate, startDate, endDate, endDate, startDate, endDate)

	var availableDrivers []AvailableDriver
	if err != nil {
		log.Printf("Error fetching available drivers: %v", err)
	} else {
		defer driverRows.Close()
		for driverRows.Next() {
			var d AvailableDriver
			err := driverRows.Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.LicenseType)
			if err != nil {
				log.Printf("Error scanning driver: %v", err)
				continue
			}
			availableDrivers = append(availableDrivers, d)
		}
	}

	log.Printf("Found %d available drivers for leave period %s to %s", len(availableDrivers), startDate, endDate)

	c.JSON(http.StatusOK, gin.H{
		"driver_id":         driverID,
		"start_date":        startDate,
		"end_date":          endDate,
		"assignments":       assignments,
		"available_drivers": availableDrivers,
	})
}

/*
=========================

	POST /api/admin/leave/approve-with-assignments
	Approve leave and create temporary assignments in one transaction

=========================
*/
type TempAssignmentInput struct {
	AssignmentID        int    `json:"assignment_id"`
	ShiftID             int    `json:"shift_id"`
	VehicleID           int    `json:"vehicle_id"`
	ReplacementDriverID int    `json:"replacement_driver_id"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
}

type ApproveWithAssignmentsRequest struct {
	LeaveID              int                   `json:"leave_id"`
	ApproverID           int                   `json:"approver_id"`
	Remarks              string                `json:"remarks"`
	TemporaryAssignments []TempAssignmentInput `json:"temporary_assignments"`
}

func ApproveLeaveWithAssignments(c *gin.Context) {
	var req ApproveWithAssignmentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get leave details
	var driverID int
	var startDate, endDate string
	var currentStatus string
	var inchargeApprovedAt sql.NullString
	var adminApprovedAt sql.NullString

	err := config.DB.QueryRow(`
		SELECT driver_id, 
			DATE_FORMAT(start_date, '%Y-%m-%d'), 
			DATE_FORMAT(end_date, '%Y-%m-%d'),
			status,
			incharge_approved_at,
			admin_approved_at
		FROM leave_requests 
		WHERE id = ?
	`, req.LeaveID).Scan(&driverID, &startDate, &endDate, &currentStatus, &inchargeApprovedAt, &adminApprovedAt)

	if err != nil {
		log.Printf("Get leave details error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave request not found"})
		return
	}

	// Check if already processed
	if adminApprovedAt.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Leave request already processed by admin"})
		return
	}

	// Determine final status
	var newStatus string
	if inchargeApprovedAt.Valid && currentStatus != "rejected" {
		newStatus = "approved"
	} else if currentStatus == "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot approve a rejected leave request"})
		return
	} else {
		newStatus = "admin_approved"
	}

	// Start transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}

	// Create temporary assignments
	for _, ta := range req.TemporaryAssignments {
		if ta.ReplacementDriverID == 0 {
			continue // Skip if no replacement driver selected
		}

		// Use the leave period dates for the temporary assignment
		taStartDate := ta.StartDate
		taEndDate := ta.EndDate
		if taStartDate == "" {
			taStartDate = startDate
		}
		if taEndDate == "" {
			taEndDate = endDate
		}

		_, err := tx.Exec(`
			INSERT INTO temporary_assignments (
				original_driver_id, replacement_driver_id, shift_id, vehicle_id,
				start_date, end_date, reason, status
			) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
		`, driverID, ta.ReplacementDriverID, ta.ShiftID, ta.VehicleID,
			taStartDate, taEndDate, "Leave replacement")

		if err != nil {
			tx.Rollback()
			log.Printf("Create temp assignment error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating temporary assignment: " + err.Error()})
			return
		}
	}

	// Approve the leave
	var adminID interface{}
	if req.ApproverID > 0 {
		adminID = req.ApproverID
	} else {
		adminID = nil
	}

	_, err = tx.Exec(`
		UPDATE leave_requests 
		SET status = ?, 
			admin_id = ?, 
			admin_approved_at = NOW(), 
			admin_remarks = ?
		WHERE id = ?
	`, newStatus, adminID, req.Remarks, req.LeaveID)

	if err != nil {
		tx.Rollback()
		log.Printf("Approve leave error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error approving leave"})
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		log.Printf("Commit error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing transaction"})
		return
	}

	// Mark attendance as absent if admin approved (either fully approved or admin_approved)
	if newStatus == "approved" || newStatus == "admin_approved" {
		markAttendanceForLeave(driverID, startDate, endDate)
	}

	// Send notification to driver
	var driverUserID int
	config.DB.QueryRow("SELECT user_id FROM drivers WHERE id = ?", driverID).Scan(&driverUserID)

	var notifTitle, notifMessage string
	if newStatus == "approved" {
		notifTitle = "Leave Request Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been fully approved. Attendance will be automatically marked as absent.", startDate, endDate)
	} else {
		notifTitle = "Leave Request - Admin Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been approved by admin. Waiting for incharge approval.", startDate, endDate)
	}

	_, _ = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'leave', ?)
	`, driverID, notifTitle, notifMessage, req.LeaveID)

	c.JSON(http.StatusOK, gin.H{
		"message":             "Leave approved and temporary assignments created successfully",
		"status":              newStatus,
		"assignments_created": len(req.TemporaryAssignments),
	})
}

// markAttendanceForLeave automatically marks attendance as absent for approved leave period
func markAttendanceForLeave(driverID int, startDateStr, endDateStr string) {
	// Get user_id for the driver
	var userID int
	err := config.DB.QueryRow("SELECT user_id FROM drivers WHERE id = ?", driverID).Scan(&userID)
	if err != nil {
		log.Printf("Error getting user_id for driver %d: %v", driverID, err)
		return
	}

	// Parse dates
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		log.Printf("Error parsing start date %s: %v", startDateStr, err)
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		log.Printf("Error parsing end date %s: %v", endDateStr, err)
		return
	}

	// Mark attendance as absent for each day in the leave period
	for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
		dateStr := date.Format("2006-01-02")

		// Check if attendance already exists for this date
		var existingStatus string
		err := config.DB.QueryRow(`
			SELECT status FROM attendance 
			WHERE user_id = ? AND date = ?
		`, userID, dateStr).Scan(&existingStatus)

		if err == sql.ErrNoRows {
			// No attendance record exists, insert new one
			_, err = config.DB.Exec(`
				INSERT INTO attendance (user_id, date, status, checkin_time)
				VALUES (?, ?, 'absent', NULL)
			`, userID, dateStr)
			if err != nil {
				log.Printf("Error inserting attendance for user %d on %s: %v", userID, dateStr, err)
			} else {
				log.Printf("Automatically marked absent for user %d (driver %d) on %s due to approved leave",
					userID, driverID, dateStr)
			}
		} else if err == nil {
			// Attendance record exists, update it if it's not already marked
			if existingStatus == "not_marked" || existingStatus == "" {
				_, err = config.DB.Exec(`
					UPDATE attendance 
					SET status = 'absent'
					WHERE user_id = ? AND date = ?
				`, userID, dateStr)
				if err != nil {
					log.Printf("Error updating attendance for user %d on %s: %v", userID, dateStr, err)
				} else {
					log.Printf("Updated attendance to absent for user %d (driver %d) on %s due to approved leave",
						userID, driverID, dateStr)
				}
			}
		}
	}
}
