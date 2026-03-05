package driver

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// LeaveRequest - leave request struct
type LeaveRequest struct {
	ID              int     `json:"id"`
	DriverID        int     `json:"driver_id"`
	DriverName      string  `json:"driver_name"`
	LeaveType       string  `json:"leave_type"`
	StartDate       string  `json:"start_date"`
	StartTime       string  `json:"start_time"`
	EndDate         string  `json:"end_date"`
	EndTime         string  `json:"end_time"`
	Reason          string  `json:"reason"`
	Status          string  `json:"status"`
	AdminID         *int    `json:"admin_id"`
	AdminName       *string `json:"admin_name"`
	AdminApprovedAt *string `json:"admin_approved_at"`
	AdminRemarks    *string `json:"admin_remarks"`
	CreatedAt       string  `json:"created_at"`
}

// ApplyLeaveRequest - request to apply for leave
type ApplyLeaveRequest struct {
	DriverID  int    `json:"driver_id"`
	LeaveType string `json:"leave_type"`
	StartDate string `json:"start_date"`
	StartTime string `json:"start_time"`
	EndDate   string `json:"end_date"`
	EndTime   string `json:"end_time"`
	Reason    string `json:"reason"`
}

/*
=========================

	POST /api/driver/leave/apply

=========================
*/

func ApplyLeave(c *gin.Context) {
	var req ApplyLeaveRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.DriverID == 0 ||
		req.StartDate == "" ||
		req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields: driver_id, start_date, end_date"})
		return
	}

	// Set default times if not provided
	startTime := req.StartTime
	if startTime == "" {
		startTime = "09:00:00"
	}
	endTime := req.EndTime
	if endTime == "" {
		endTime = "17:00:00"
	}

	leaveType := req.LeaveType
	if leaveType == "" {
		leaveType = "Leave"
	}

	query := `
		INSERT INTO leave_requests
		(driver_id, leave_type, start_date, start_time, end_date, end_time, reason, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
	`

	result, err := config.DB.Exec(
		query,
		req.DriverID,
		leaveType,
		req.StartDate,
		startTime,
		req.EndDate,
		endTime,
		req.Reason,
		"PENDING", // ENUM-safe
	)

	if err != nil {
		log.Println("ApplyLeave DB Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply leave"})
		return
	}

	id, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"message": "Leave request submitted successfully",
		"id":      id,
	})
}

/*
=========================

	GET /api/driver/leave?driver_id=X

=========================
*/
func GetMyLeaveRequests(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id is required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT lr.id, lr.driver_id, lr.leave_type,
			   DATE_FORMAT(lr.start_date, '%d-%m-%Y') as start_date,
			   TIME_FORMAT(lr.start_time, '%h:%i %p') as start_time,
			   DATE_FORMAT(lr.end_date, '%d-%m-%Y') as end_date,
			   TIME_FORMAT(lr.end_time, '%h:%i %p') as end_time,
			   lr.reason, lr.status,
			   lr.admin_id, u_adm.full_name as admin_name, lr.admin_approved_at, lr.admin_remarks, lr.created_at
		FROM leave_requests lr
		LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
		WHERE lr.driver_id = ?
		ORDER BY lr.created_at DESC
	`, driverID)

	if err != nil {
		log.Printf("Get leave requests error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching leave requests"})
		return
	}
	defer rows.Close()

	var leaves []LeaveRequest
	for rows.Next() {
		var l LeaveRequest
		var startDate, startTime, endDate, endTime, createdAt []byte
		var adminApprovedAt sql.NullString
		var adminRemarks sql.NullString
		var adminName sql.NullString
		var adminID sql.NullInt64

		err := rows.Scan(&l.ID, &l.DriverID, &l.LeaveType, &startDate, &startTime, &endDate, &endTime, &l.Reason, &l.Status,
			&adminID, &adminName, &adminApprovedAt, &adminRemarks, &createdAt)
		if err != nil {
			log.Printf("Scan leave request error: %v", err)
			continue
		}

		l.StartDate = string(startDate)
		l.StartTime = string(startTime)
		l.EndDate = string(endDate)
		l.EndTime = string(endTime)
		l.CreatedAt = string(createdAt)

		if adminID.Valid {
			id := int(adminID.Int64)
			l.AdminID = &id
		}
		if adminName.Valid {
			l.AdminName = &adminName.String
		}
		if adminApprovedAt.Valid {
			l.AdminApprovedAt = &adminApprovedAt.String
		}
		if adminRemarks.Valid {
			l.AdminRemarks = &adminRemarks.String
		}

		leaves = append(leaves, l)
	}

	c.JSON(http.StatusOK, gin.H{"leaves": leaves})
}
