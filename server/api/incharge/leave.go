package incharge

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// LeaveRequest - leave request struct for incharge
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

// ApproveLeaveRequest - request to approve/reject leave
type ApproveLeaveRequest struct {
	LeaveID    int    `json:"leave_id"`
	InchargeID int    `json:"incharge_id"`
	ApproverID int    `json:"approver_id"`
	Status     string `json:"status"` // "approved" or "rejected"
	Remarks    string `json:"remarks"`
}

/*
=========================

	GET /api/incharge/leave/pending
	Get pending leave requests for incharge approval

=========================
*/
func GetPendingLeaveRequests(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT lr.id, lr.driver_id, u.full_name as driver_name, lr.leave_type,
			   DATE_FORMAT(lr.start_date, '%d-%m-%Y') as start_date,
			   TIME_FORMAT(lr.start_time, '%h:%i %p') as start_time,
			   DATE_FORMAT(lr.end_date, '%d-%m-%Y') as end_date,
			   TIME_FORMAT(lr.end_time, '%h:%i %p') as end_time,
			   lr.reason, lr.status,
			   lr.incharge_id, u_inc.full_name as incharge_name, lr.incharge_approved_at, lr.incharge_remarks,
			   lr.admin_id, u_adm.full_name as admin_name, lr.admin_approved_at, lr.admin_remarks,
			   lr.created_at
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN users u_inc ON lr.incharge_id = u_inc.id
		LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
		WHERE lr.status IN ('pending', 'incharge_approved', 'rejected', 'admin_approved')
		ORDER BY 
			CASE 
				WHEN lr.status = 'pending' THEN 1
				WHEN lr.status = 'incharge_approved' THEN 2
				ELSE 3
			END,
			lr.created_at DESC
		LIMIT 100
	`)
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

	POST /api/incharge/leave/approve
	Incharge approves or rejects a leave request

=========================
*/
func ApproveLeave(c *gin.Context) {
	var req ApproveLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "approved" && status != "rejected" && status != "incharge_approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Use 'approved' or 'rejected'"})
		return
	}

	// Resolve approver ID (frontend may send either approver_id or incharge_id)
	approverID := req.ApproverID
	if approverID == 0 {
		approverID = req.InchargeID
	}

	// Validate incharge
	var inchargeName string
	err := config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d 
		JOIN users u ON d.user_id = u.id 
		WHERE d.id = ? AND d.is_incharge = 1
	`, approverID).Scan(&inchargeName)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized: User is not an incharge"})
		return
	}

	// Get current leave status and admin decision
	var currentStatus string
	var driverID int
	var startDate, endDate string
	var adminApprovedAt sql.NullString
	var inchargeApprovedAt sql.NullString
	err = config.DB.QueryRow(`
		SELECT status, driver_id, 
			DATE_FORMAT(start_date, '%d-%m-%Y'), 
			DATE_FORMAT(end_date, '%d-%m-%Y'),
			admin_approved_at,
			incharge_approved_at
		FROM leave_requests 
		WHERE id = ?
	`, req.LeaveID).Scan(&currentStatus, &driverID, &startDate, &endDate, &adminApprovedAt, &inchargeApprovedAt)

	if err != nil {
		log.Printf("Get leave status error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave request not found"})
		return
	}

	// Check if incharge already processed this request
	if inchargeApprovedAt.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This leave request has already been processed by incharge"})
		return
	}

	// Determine new status based on incharge decision and admin decision
	var newStatus string
	if status == "rejected" {
		// If incharge rejects, the leave is rejected regardless of admin decision
		newStatus = "rejected"
	} else {
		// Incharge approved - check if admin has also approved
		if adminApprovedAt.Valid && currentStatus != "rejected" {
			// Both have approved - mark as fully approved
			newStatus = "approved"
		} else if currentStatus == "rejected" {
			// Admin already rejected, keep it rejected
			newStatus = "rejected"
		} else {
			// Incharge approved but admin hasn't decided yet
			newStatus = "incharge_approved"
		}
	}

	// Update leave request with incharge decision
	// Use NULL for incharge_id if approver_id is 0 or invalid
	var inchargeID interface{}
	if approverID > 0 {
		inchargeID = approverID
	} else {
		inchargeID = nil
	}

	result, err := config.DB.Exec(`
		UPDATE leave_requests 
		SET status = ?, 
			incharge_id = ?, 
			incharge_approved_at = NOW(), 
			incharge_remarks = ?
		WHERE id = ?
	`, newStatus, inchargeID, req.Remarks, req.LeaveID)

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

	// Send notification to driver
	var driverUserID int
	config.DB.QueryRow("SELECT user_id FROM drivers WHERE id = ?", driverID).Scan(&driverUserID)

	var notifTitle string
	var notifMessage string
	var nextStep string

	if newStatus == "rejected" {
		notifTitle = "Leave Request Rejected by Incharge"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been rejected by incharge %s. Reason: %s",
			startDate, endDate, inchargeName, req.Remarks)
		nextStep = "Leave request rejected"
	} else if newStatus == "approved" {
		notifTitle = "Leave Request Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been fully approved by both incharge %s and admin.",
			startDate, endDate, inchargeName)
		nextStep = "Leave approved - attendance will be marked automatically"
	} else {
		notifTitle = "Leave Request - Incharge Approved"
		notifMessage = fmt.Sprintf("Your leave request from %s to %s has been approved by incharge %s. Waiting for admin approval.",
			startDate, endDate, inchargeName)
		nextStep = "Waiting for admin approval"
	}

	_, _ = config.DB.Exec(`
		INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
		VALUES ('DRIVER', ?, ?, ?, 'leave', ?)
	`, driverID, notifTitle, notifMessage, req.LeaveID)

	c.JSON(http.StatusOK, gin.H{
		"message":       fmt.Sprintf("Leave request processed successfully"),
		"status":        newStatus,
		"approved_by":   inchargeName,
		"next_step":     nextStep,
		"incharge_id":   approverID,
		"incharge_name": inchargeName,
	})
}
