package admin

import (
	"database/sql"
	"log"
	"net/http"

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
			   DATE_FORMAT(lr.end_date, '%Y-%m-%d') as end_date,
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
		EndDate            string  `json:"end_date"`
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
		var startDate, endDate, createdAt []byte
		var inchargeApprovedAt, adminApprovedAt sql.NullString
		var inchargeRemarks, adminRemarks sql.NullString
		var inchargeName, adminName sql.NullString
		var inchargeID, adminID sql.NullInt64

		err := rows.Scan(&req.ID, &req.DriverID, &req.DriverName, &req.LeaveType,
			&startDate, &endDate, &req.Reason, &req.Status,
			&inchargeID, &inchargeName, &inchargeApprovedAt, &inchargeRemarks,
			&adminID, &adminName, &adminApprovedAt, &adminRemarks, &createdAt)

		if err != nil {
			log.Printf("Scan leave request error: %v", err)
			continue
		}

		req.StartDate = string(startDate)
		req.EndDate = string(endDate)
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
	EndDate            string  `json:"end_date"`
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
				   DATE_FORMAT(lr.start_date, '%Y-%m-%d'), DATE_FORMAT(lr.end_date, '%Y-%m-%d'), lr.reason, lr.status,
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
		var startDate, endDate, createdAt []byte
		var inchargeApprovedAt, adminApprovedAt sql.NullString
		var inchargeRemarks, adminRemarks sql.NullString
		var inchargeName, adminName sql.NullString
		var inchargeID, adminID sql.NullInt64

		err := rows.Scan(&req.ID, &req.DriverID, &req.DriverName, &req.LeaveType,
			&startDate, &endDate, &req.Reason, &req.Status,
			&inchargeID, &inchargeName, &inchargeApprovedAt, &inchargeRemarks,
			&adminID, &adminName, &adminApprovedAt, &adminRemarks, &createdAt)

		if err != nil {
			log.Printf("Scan leave request error: %v", err)
			continue
		}

		req.StartDate = string(startDate)
		req.EndDate = string(endDate)
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
	Incharge or Admin approves/rejects leave

=========================
*/
func ApproveLeave(c *gin.Context) {
	var req ApproveLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get current leave status
	var currentStatus string
	err := config.DB.QueryRow("SELECT status FROM leave_requests WHERE id = ?", req.LeaveID).Scan(&currentStatus)
	if err != nil {
		log.Printf("Get leave status error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Leave request not found"})
		return
	}

	var query string
	var args []interface{}

	if req.Status == "rejected" {
		// Both incharge and admin can reject
		if currentStatus == "pending" {
			query = `UPDATE leave_requests SET status = 'rejected', 
					 incharge_id = ?, incharge_approved_at = NOW(), incharge_remarks = ?
					 WHERE id = ?`
		} else {
			query = `UPDATE leave_requests SET status = 'rejected', 
					 admin_id = ?, admin_approved_at = NOW(), admin_remarks = ?
					 WHERE id = ?`
		}
		args = []interface{}{req.ApproverID, req.Remarks, req.LeaveID}
	} else if currentStatus == "pending" {
		// Incharge approval - move to incharge_approved
		query = `UPDATE leave_requests SET status = 'incharge_approved', 
				 incharge_id = ?, incharge_approved_at = NOW(), incharge_remarks = ?
				 WHERE id = ?`
		args = []interface{}{req.ApproverID, req.Remarks, req.LeaveID}
	} else if currentStatus == "incharge_approved" {
		// Admin approval - move to admin_approved (final)
		query = `UPDATE leave_requests SET status = 'admin_approved', 
				 admin_id = ?, admin_approved_at = NOW(), admin_remarks = ?
				 WHERE id = ?`
		args = []interface{}{req.ApproverID, req.Remarks, req.LeaveID}

		// Also update driver status to "on leave"
		var driverID int
		config.DB.QueryRow("SELECT driver_id FROM leave_requests WHERE id = ?", req.LeaveID).Scan(&driverID)
		if driverID > 0 {
			config.DB.Exec("UPDATE drivers SET status = 'on leave' WHERE id = ?", driverID)
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Leave request already processed"})
		return
	}

	_, err = config.DB.Exec(query, args...)
	if err != nil {
		log.Printf("Approve leave error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing leave request"})
		return
	}

	// If admin approved and leave is final, check for affected assignments and suggest replacements
	if currentStatus == "incharge_approved" && req.Status != "rejected" {
		var driverID int
		var startDate, endDate string
		err = config.DB.QueryRow(`
			SELECT driver_id, 
				DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
				DATE_FORMAT(end_date, '%Y-%m-%d') as end_date
			FROM leave_requests WHERE id = ?
		`, req.LeaveID).Scan(&driverID, &startDate, &endDate)

		if err == nil {
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
					var assignment map[string]interface{} = make(map[string]interface{})
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
				"message":              "Leave request approved successfully",
				"affected_assignments": affectedAssignments,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Leave request updated successfully"})
}
