package admin

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

/* =========================
   STUDENT TRANSPORT ADMIN HANDLERS
========================= */

// GET /api/admin/students - Get all students (for dropdown)
func GetAllStudents(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			u.id, u.full_name, COALESCE(u.email, ''), COALESCE(u.phone, ''),
			CASE WHEN st.id IS NOT NULL THEN 1 ELSE 0 END as has_transport
		FROM users u
		LEFT JOIN student_transport st ON st.user_id = u.id AND st.status = 'active'
		WHERE u.role = 'STUDENT'
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Error fetching students: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch students"})
		return
	}
	defer rows.Close()

	var students []models.StudentListItem
	for rows.Next() {
		var s models.StudentListItem
		var hasTransport int
		if err := rows.Scan(&s.UserID, &s.FullName, &s.Email, &s.Phone, &hasTransport); err != nil {
			log.Printf("Error scanning student: %v", err)
			continue
		}
		s.ID = s.UserID
		s.HasTransport = hasTransport == 1
		students = append(students, s)
	}

	c.JSON(http.StatusOK, students)
}

// POST /api/admin/students/create - Create a new student
func CreateStudent(c *gin.Context) {
	var req models.CreateStudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Username == "" || req.Password == "" || req.FullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username, password, and full name are required"})
		return
	}

	// Check if username already exists
	var existingID int
	err := config.DB.QueryRow(`SELECT id FROM users WHERE username = ?`, req.Username).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
		return
	}

	// Insert into users table with STUDENT role (including department, year, roll_number)
	result, err := config.DB.Exec(`
		INSERT INTO users (username, password, full_name, phone, email, department, year, roll_number, role, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STUDENT', 'active')
	`, req.Username, req.Password, req.FullName, req.Phone, req.Email, req.Department, req.Year, req.RollNumber)
	if err != nil {
		log.Printf("Error creating student: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create student"})
		return
	}

	userID, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Student created successfully",
		"user_id": userID,
	})
}

// DELETE /api/admin/students/delete - Delete a student
func DeleteStudent(c *gin.Context) {
	userID := c.Query("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Student ID required"})
		return
	}

	// Delete from users table (cascade will handle related records)
	_, err := config.DB.Exec(`DELETE FROM users WHERE id = ? AND role = 'STUDENT'`, userID)
	if err != nil {
		log.Printf("Error deleting student: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete student"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
}

// GET /api/admin/student-transport - Get all student transport assignments
func GetAllStudentTransport(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			st.id, st.user_id, COALESCE(u.full_name, u.username, ''), COALESCE(u.email, ''),
			st.bus_id, COALESCE(v.vehicle_name, ''), COALESCE(v.vehicle_number, ''), COALESCE(b.start_point, ''), COALESCE(b.end_point, ''),
			st.stop_id, COALESCE(bs.stop_name, ''), '',
			st.total_fee, st.paid_amount, st.balance,
			st.academic_year, st.status,
			'', ''
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN buses b ON st.bus_id = b.id
		LEFT JOIN vehicles v ON b.vehicle_id = v.id
		LEFT JOIN bus_stops bs ON st.stop_id = bs.id
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Error fetching student transport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch data"})
		return
	}
	defer rows.Close()

	var list []models.StudentTransport
	for rows.Next() {
		var t models.StudentTransport
		err := rows.Scan(
			&t.ID, &t.UserID, &t.StudentName, &t.StudentEmail,
			&t.BusID, &t.VehicleName, &t.BusNumber, &t.RouteStart, &t.RouteEnd,
			&t.StopID, &t.StopName, &t.StopLocation,
			&t.TotalFee, &t.PaidAmount, &t.Balance,
			&t.AcademicYear, &t.Status,
			&t.ArrivalTime, &t.DepartureTime,
		)
		if err != nil {
			log.Printf("Error scanning: %v", err)
			continue
		}
		list = append(list, t)
	}

	c.JSON(http.StatusOK, list)
}

// POST /api/admin/student-transport/assign - Assign bus and stop to student
func AssignStudentTransport(c *gin.Context) {
	var req models.AssignStudentTransportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.AcademicYear == "" {
		req.AcademicYear = "2025-2026"
	}

	// Get fee for the selected stop
	var feeAmount float64
	err := config.DB.QueryRow(`
		SELECT fee_amount FROM transport_fees 
		WHERE stop_id = ? AND academic_year = ? AND is_active = TRUE
	`, req.StopID, req.AcademicYear).Scan(&feeAmount)
	if err == sql.ErrNoRows {
		// Try without academic year filter
		err = config.DB.QueryRow(`
			SELECT fee_amount FROM transport_fees 
			WHERE stop_id = ? AND is_active = TRUE
			ORDER BY id DESC LIMIT 1
		`, req.StopID).Scan(&feeAmount)
	}

	// Fallback to bus_stops fee if not found in transport_fees
	if err == sql.ErrNoRows {
		err = config.DB.QueryRow(`
			SELECT COALESCE(fee, 0) FROM bus_stops WHERE id = ?
		`, req.StopID).Scan(&feeAmount)
	}

	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error fetching fee: %v", err)
	}

	// Get transport_fee_id
	var transportFeeID sql.NullInt64
	config.DB.QueryRow(`
		SELECT id FROM transport_fees 
		WHERE stop_id = ? AND is_active = TRUE
		ORDER BY id DESC LIMIT 1
	`, req.StopID).Scan(&transportFeeID)

	// Check if student already has active transport
	var existingID int
	err = config.DB.QueryRow(`
		SELECT id FROM student_transport 
		WHERE user_id = ? AND academic_year = ?
	`, req.UserID, req.AcademicYear).Scan(&existingID)

	switch err {
	case sql.ErrNoRows:
		// Create new assignment
		var feeID interface{}
		if transportFeeID.Valid {
			feeID = transportFeeID.Int64
		} else {
			feeID = nil
		}
		_, err = config.DB.Exec(`
			INSERT INTO student_transport 
			(user_id, bus_id, stop_id, transport_fee_id, total_fee, paid_amount, academic_year, status)
			VALUES (?, ?, ?, ?, ?, 0, ?, 'active')
		`, req.UserID, req.BusID, req.StopID, feeID, feeAmount, req.AcademicYear)
		if err != nil {
			log.Printf("Error creating assignment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assignment"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Student transport assigned successfully", "fee": feeAmount})
	case nil:
		// Update existing
		_, err = config.DB.Exec(`
			UPDATE student_transport 
			SET bus_id = ?, stop_id = ?, total_fee = ?, status = 'active'
			WHERE id = ?
		`, req.BusID, req.StopID, feeAmount, existingID)
		if err != nil {
			log.Printf("Error updating assignment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Student transport updated successfully", "fee": feeAmount})
	default:
		log.Printf("Error checking existing: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
	}
}

// POST /api/admin/student-transport/update - Update student transport
func UpdateStudentTransport(c *gin.Context) {
	var req models.UpdateStudentTransportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get new fee if stop changed
	var newFee float64
	config.DB.QueryRow(`
		SELECT tf.fee_amount FROM transport_fees tf
		WHERE tf.stop_id = ? AND tf.is_active = TRUE
		ORDER BY tf.id DESC LIMIT 1
	`, req.StopID).Scan(&newFee)

	_, err := config.DB.Exec(`
		UPDATE student_transport 
		SET bus_id = ?, stop_id = ?, total_fee = ?, status = ?
		WHERE id = ?
	`, req.BusID, req.StopID, newFee, req.Status, req.ID)
	if err != nil {
		log.Printf("Error updating: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

// DELETE /api/admin/student-transport/delete - Remove student transport
func DeleteStudentTransport(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec(`DELETE FROM student_transport WHERE id = ?`, id)
	if err != nil {
		log.Printf("Error deleting: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

// =====================
// PAYMENTS
// =====================

// GET /api/admin/transport-payments - Get all payments
func GetAllTransportPayments(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			p.id, p.student_transport_id, u.full_name,
			p.amount, DATE_FORMAT(p.payment_date, '%d-%m-%Y'),
			p.payment_method, COALESCE(p.transaction_id, ''),
			COALESCE(p.receipt_number, ''), COALESCE(p.remarks, ''),
			COALESCE(p.recorded_by, 0), COALESCE(admin.full_name, 'System')
		FROM transport_payments p
		JOIN student_transport st ON p.student_transport_id = st.id
		JOIN users u ON st.user_id = u.id
		LEFT JOIN users admin ON p.recorded_by = admin.id
		ORDER BY p.payment_date DESC, p.id DESC
	`)
	if err != nil {
		log.Printf("Error fetching payments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payments"})
		return
	}
	defer rows.Close()

	var payments []models.TransportPayment
	for rows.Next() {
		var p models.TransportPayment
		if err := rows.Scan(
			&p.ID, &p.StudentTransportID, &p.StudentName,
			&p.Amount, &p.PaymentDate, &p.PaymentMethod,
			&p.TransactionID, &p.ReceiptNumber, &p.Remarks,
			&p.RecordedBy, &p.RecordedByName,
		); err != nil {
			continue
		}
		payments = append(payments, p)
	}

	c.JSON(http.StatusOK, payments)
}

// POST /api/admin/transport-payments/record - Record a payment
func RecordTransportPayment(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, _ := utils.ParseJWT(tokenStr)
	adminID := 0
	if claims != nil {
		adminID = int(claims["user_id"].(float64))
	}

	var req models.RecordPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.PaymentDate == "" {
		req.PaymentDate = time.Now().Format("2006-01-02")
	}

	// Insert payment
	_, err := config.DB.Exec(`
		INSERT INTO transport_payments 
		(student_transport_id, amount, payment_date, payment_method, transaction_id, receipt_number, remarks, recorded_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, req.StudentTransportID, req.Amount, req.PaymentDate, req.PaymentMethod, req.TransactionID, req.ReceiptNumber, req.Remarks, adminID)
	if err != nil {
		log.Printf("Error recording payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record payment"})
		return
	}

	// Update paid amount in student_transport
	_, err = config.DB.Exec(`
		UPDATE student_transport 
		SET paid_amount = paid_amount + ?
		WHERE id = ?
	`, req.Amount, req.StudentTransportID)
	if err != nil {
		log.Printf("Error updating paid amount: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment recorded successfully"})
}

// =====================
// STOP CHANGE REQUESTS
// =====================

// GET /api/admin/stop-change-requests - Get all stop change requests
func GetAllStopChangeRequests(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")

	query := `
		SELECT 
			scr.id, COALESCE(scr.student_transport_id, 0),
			COALESCE(u.full_name, 'Unknown Student'), COALESCE(u.email, ''),
			COALESCE(scr.current_stop_id, 0), COALESCE(cs.stop_name, gs.stop_name, 'Unknown Stop'),
			COALESCE(scr.requested_stop_id, 0), COALESCE(rs.stop_name, 'Unknown Stop'),
			COALESCE(scr.current_fee, 0), COALESCE(scr.new_fee, 0), COALESCE(scr.fee_difference, 0),
			COALESCE(scr.reason, ''), scr.status,
			COALESCE(scr.admin_remarks, ''),
			scr.processed_by, COALESCE(admin.full_name, ''),
			DATE_FORMAT(scr.processed_at, '%d-%m-%Y %h:%i %p'), DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p')
		FROM stop_change_requests scr
		LEFT JOIN student_transport st ON scr.student_transport_id = st.id
		LEFT JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
		LEFT JOIN stops gs ON scr.current_stop_id = gs.id
		LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
		LEFT JOIN users admin ON scr.processed_by = admin.id
	`

	var args []interface{}
	if status != "" && status != "all" {
		query += ` WHERE scr.status = ?`
		args = append(args, status)
	}
	query += ` ORDER BY scr.created_at DESC`

	log.Printf("GetAllStopChangeRequests: status=%s, query=%s, args=%v", status, query, args)
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error fetching stop change requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch requests"})
		return
	}
	defer rows.Close()

	var requests []models.StopChangeRequest
	for rows.Next() {
		var r models.StopChangeRequest
		var processedAt sql.NullString
		var processedBy sql.NullInt64
		var createdAt sql.NullString

		err := rows.Scan(
			&r.ID, &r.StudentTransportID,
			&r.StudentName, &r.StudentEmail,
			&r.CurrentStopID, &r.CurrentStopName,
			&r.RequestedStopID, &r.RequestedStopName,
			&r.CurrentFee, &r.NewFee, &r.FeeDifference,
			&r.Reason, &r.Status,
			&r.AdminRemarks,
			&processedBy, &r.ProcessedByName,
			&processedAt, &createdAt,
		)
		if err != nil {
			log.Printf("Error scanning stop change request: %v", err)
			continue
		}
		if createdAt.Valid {
			r.CreatedAt = createdAt.String
		}
		if processedBy.Valid {
			id := int(processedBy.Int64)
			r.ProcessedBy = &id
		}
		if processedAt.Valid {
			r.ProcessedAt = &processedAt.String
		}
		requests = append(requests, r)
	}

	log.Printf("GetAllStopChangeRequests: Found %d requests", len(requests))
	c.JSON(http.StatusOK, requests)
}

// POST /api/admin/stop-change-requests/process - Approve or reject request
func ProcessStopChangeRequest(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, _ := utils.ParseJWT(tokenStr)
	adminID := 0
	if claims != nil {
		adminID = int(claims["user_id"].(float64))
	}

	var req models.ProcessStopChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status must be 'approved' or 'rejected'"})
		return
	}

	// Get request details
	var studentTransportID, requestedStopID int
	var newFee, paidAmount float64
	err := config.DB.QueryRow(`
		SELECT scr.student_transport_id, scr.requested_stop_id, scr.new_fee, st.paid_amount
		FROM stop_change_requests scr
		JOIN student_transport st ON scr.student_transport_id = st.id
		WHERE scr.id = ?
	`, req.RequestID).Scan(&studentTransportID, &requestedStopID, &newFee, &paidAmount)
	if err != nil {
		log.Printf("Error fetching request: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	var requestedBusID int
	err = config.DB.QueryRow(`
		SELECT b.id
		FROM bus_stops bs
		JOIN buses b ON b.vehicle_id = bs.vehicle_id
		WHERE bs.id = ?
	`, requestedStopID).Scan(&requestedBusID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Requested stop is not linked to any bus"})
		return
	}
	if err != nil {
		log.Printf("Error fetching bus for stop %d: %v", requestedStopID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	// Update request status
	_, err = config.DB.Exec(`
		UPDATE stop_change_requests 
		SET status = ?, admin_remarks = ?, processed_by = ?, processed_at = NOW()
		WHERE id = ?
	`, req.Status, req.AdminRemarks, adminID, req.RequestID)
	if err != nil {
		log.Printf("Error updating request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	// If approved, update student transport
	if req.Status == "approved" {
		// Update stop, bus, and recalculate balance
		_, err = config.DB.Exec(`
			UPDATE student_transport 
			SET stop_id = ?, bus_id = ?, total_fee = ?
			WHERE id = ?
		`, requestedStopID, requestedBusID, newFee, studentTransportID)
		if err != nil {
			log.Printf("Error updating student transport: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request " + req.Status + " successfully"})
}

// GET /api/admin/stop-change-requests/pending-count - Get count of pending requests
func GetPendingStopChangeCount(c *gin.Context) {
	var count int
	config.DB.QueryRow(`SELECT COUNT(*) FROM stop_change_requests WHERE status = 'pending'`).Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ============ TRANSPORT REQUESTS ============

// GET /api/admin/transport-requests - Get all transport requests
func GetAllTransportRequests(c *gin.Context) {
	status := c.Query("status") // pending, approved, rejected, all

	query := `
		SELECT 
			tr.id, COALESCE(tr.user_id, 0), COALESCE(tr.bus_id, 0), COALESCE(tr.stop_id, 0), tr.academic_year, COALESCE(tr.reason, ''),
			tr.status, COALESCE(tr.admin_remarks, ''), tr.processed_by, tr.processed_at,
			tr.created_at,
			COALESCE(u.full_name, u.username, '') as student_name, 
			COALESCE(u.email, '') as email,
			COALESCE(u.phone, '') as phone,
			COALESCE(u.department, '') as department,
			COALESCE(u.year, 0) as year,
			COALESCE(u.roll_number, '') as roll_number,
			COALESCE(v.vehicle_name, '') as vehicle_name, 
			COALESCE(CONCAT(b.start_point, ' → ', b.end_point), '') as route,
			COALESCE(bs.stop_name, '') as stop_name, 
			COALESCE(bs.fee, 0) as fee
		FROM transport_requests tr
		LEFT JOIN users u ON tr.user_id = u.id
		LEFT JOIN buses b ON tr.bus_id = b.id
		LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
	`

	if status != "" && status != "all" {
		query += ` WHERE tr.status = '` + status + `'`
	}

	query += ` ORDER BY tr.created_at DESC`

	log.Printf("Fetching transport requests with query: %s", query)

	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("Error fetching transport requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transport requests"})
		return
	}
	defer rows.Close()

	var requests []models.TransportRequest
	for rows.Next() {
		var req models.TransportRequest
		var processedBy sql.NullInt64
		var processedAt sql.NullTime
		var createdAt sql.NullTime

		err := rows.Scan(
			&req.ID, &req.UserID, &req.BusID, &req.StopID, &req.AcademicYear, &req.Reason,
			&req.Status, &req.AdminRemarks, &processedBy, &processedAt,
			&createdAt,
			&req.StudentName, &req.Email, &req.Phone,
			&req.Department, &req.Year, &req.RollNumber,
			&req.VehicleName, &req.Route,
			&req.StopName, &req.Fee,
		)
		if err != nil {
			log.Printf("Error scanning transport request: %v", err)
			continue
		}

		if processedBy.Valid {
			req.ProcessedBy = int(processedBy.Int64)
		}
		if processedAt.Valid {
			req.ProcessedAt = &processedAt.Time
		}
		if createdAt.Valid {
			req.CreatedAt = createdAt.Time
		}

		requests = append(requests, req)
	}

	log.Printf("Found %d transport requests", len(requests))
	c.JSON(http.StatusOK, requests)
}

// POST /api/admin/transport-requests/process - Approve or reject a transport request
func ProcessTransportRequest(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
		return
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := utils.ParseJWT(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	adminID := int(claims["user_id"].(float64))

	var req models.ProcessTransportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status must be 'approved' or 'rejected'"})
		return
	}

	// Get transport request details
	var userID, busID, stopID int
	var academicYear, currentStatus string
	var fee float64
	err = config.DB.QueryRow(`
		SELECT tr.user_id, tr.bus_id, tr.stop_id, tr.academic_year, COALESCE(bs.fee, 0), tr.status
		FROM transport_requests tr
		LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
		WHERE tr.id = ?
	`, req.RequestID).Scan(&userID, &busID, &stopID, &academicYear, &fee, &currentStatus)
	if err != nil {
		log.Printf("Error fetching transport request: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Allow re-processing if already approved but student_transport doesn't exist
	if currentStatus != "pending" && req.Status == "approved" {
		// Check if student_transport exists
		var existingID int
		err := config.DB.QueryRow(`SELECT id FROM student_transport WHERE user_id = ? AND academic_year = ?`, userID, academicYear).Scan(&existingID)
		if err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Request already processed and transport assigned"})
			return
		}
		// If no transport exists, allow re-processing
		log.Printf("Re-processing approved request %d - creating missing student_transport", req.RequestID)
	}

	// Update request status
	_, err = config.DB.Exec(`
		UPDATE transport_requests 
		SET status = ?, admin_remarks = ?, processed_by = ?, processed_at = NOW()
		WHERE id = ?
	`, req.Status, req.AdminRemarks, adminID, req.RequestID)
	if err != nil {
		log.Printf("Error updating transport request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	// If approved, create student_transport entry
	if req.Status == "approved" {
		// Check if student already has transport for this year
		var existingID int
		err := config.DB.QueryRow(`
			SELECT id FROM student_transport 
			WHERE user_id = ? AND academic_year = ?
		`, userID, academicYear).Scan(&existingID)

		switch err {
		case sql.ErrNoRows:
			// Create new transport assignment
			_, err = config.DB.Exec(`
				INSERT INTO student_transport (user_id, bus_id, stop_id, academic_year, total_fee, paid_amount, status)
				VALUES (?, ?, ?, ?, ?, 0, 'active')
			`, userID, busID, stopID, academicYear, fee)
			if err != nil {
				log.Printf("Error creating student transport: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Request approved but failed to assign transport"})
				return
			}
		case nil:
			// Update existing transport
			_, err = config.DB.Exec(`
				UPDATE student_transport 
				SET bus_id = ?, stop_id = ?, total_fee = ?, status = 'active'
				WHERE id = ?
			`, busID, stopID, fee, existingID)
			if err != nil {
				log.Printf("Error updating student transport: %v", err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transport request " + req.Status + " successfully"})
}

// POST /api/admin/transport-requests/fix-approved - Fix approved requests that are missing student_transport entries
func FixApprovedRequests(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT tr.id, tr.user_id, tr.bus_id, tr.stop_id, tr.academic_year, COALESCE(bs.fee, 0)
		FROM transport_requests tr
		LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
		LEFT JOIN student_transport st ON tr.user_id = st.user_id AND tr.academic_year = st.academic_year
		WHERE tr.status = 'approved' AND st.id IS NULL
	`)
	if err != nil {
		log.Printf("Error finding approved requests without transport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find requests"})
		return
	}
	defer rows.Close()

	fixedCount := 0
	for rows.Next() {
		var requestID, userID, busID, stopID int
		var academicYear string
		var fee float64
		if err := rows.Scan(&requestID, &userID, &busID, &stopID, &academicYear, &fee); err != nil {
			continue
		}

		_, err := config.DB.Exec(`
			INSERT INTO student_transport (user_id, bus_id, stop_id, academic_year, total_fee, paid_amount, status)
			VALUES (?, ?, ?, ?, ?, 0, 'active')
		`, userID, busID, stopID, academicYear, fee)
		if err != nil {
			log.Printf("Error creating transport for user %d: %v", userID, err)
			continue
		}
		fixedCount++
		log.Printf("Created student_transport for user %d, request %d", userID, requestID)
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Fixed %d approved requests", fixedCount), "fixed_count": fixedCount})
}

// GET /api/admin/transport-requests/pending-count - Get count of pending transport requests
func GetPendingTransportRequestCount(c *gin.Context) {
	var count int
	config.DB.QueryRow(`SELECT COUNT(*) FROM transport_requests WHERE status = 'pending'`).Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GET /api/admin/buses/:id/students - Get all students assigned to a specific bus
func GetStudentsByBus(c *gin.Context) {
	busID := c.Param("id")

	rows, err := config.DB.Query(`
		SELECT 
			st.id, st.user_id, COALESCE(u.full_name, u.username, ''), COALESCE(u.email, ''),
			COALESCE(u.department, '') as department,
			COALESCE(u.year, 0) as year,
			COALESCE(u.roll_number, '') as roll_number,
			COALESCE(bs.stop_name, '') as stop_name, COALESCE(bs.fee, 0),
			st.total_fee, st.paid_amount, st.status,
			st.academic_year, st.created_at
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops bs ON st.stop_id = bs.id
		WHERE st.bus_id = ? AND st.status = 'active'
		ORDER BY bs.stop_name, u.full_name
	`, busID)
	if err != nil {
		log.Printf("Error fetching students by bus: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch students"})
		return
	}
	defer rows.Close()

	type StudentInfo struct {
		ID           int       `json:"id"`
		UserID       int       `json:"user_id"`
		Name         string    `json:"name"`
		Email        string    `json:"email"`
		Department   string    `json:"department"`
		Year         int       `json:"year"`
		RollNumber   string    `json:"roll_number"`
		StopName     string    `json:"stop_name"`
		StopFee      float64   `json:"stop_fee"`
		TotalFee     float64   `json:"total_fee"`
		PaidAmount   float64   `json:"paid_amount"`
		Status       string    `json:"status"`
		AcademicYear string    `json:"academic_year"`
		CreatedAt    time.Time `json:"created_at"`
	}

	var students []StudentInfo
	for rows.Next() {
		var s StudentInfo
		err := rows.Scan(
			&s.ID, &s.UserID, &s.Name, &s.Email,
			&s.Department, &s.Year, &s.RollNumber,
			&s.StopName, &s.StopFee,
			&s.TotalFee, &s.PaidAmount, &s.Status,
			&s.AcademicYear, &s.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning student: %v", err)
			continue
		}
		students = append(students, s)
	}

	c.JSON(http.StatusOK, students)
}

// GET /api/admin/buses/with-students - Get all buses with their student counts
func GetBusesWithStudentCounts(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			b.id, COALESCE(v.vehicle_name, v.vehicle_number, ''), CONCAT(COALESCE(b.start_point, ''), ' → ', COALESCE(b.end_point, '')), 
			COALESCE(v.seating_capacity, 50),
			0 as driver_id,
			'Unassigned' as driver_name,
			COUNT(DISTINCT st.user_id) as student_count
		FROM buses b
		LEFT JOIN vehicles v ON b.vehicle_id = v.id
		LEFT JOIN student_transport st ON b.id = st.bus_id AND st.status = 'active'
		GROUP BY b.id, COALESCE(v.vehicle_name, v.vehicle_number, ''), b.start_point, b.end_point, v.seating_capacity
		ORDER BY COALESCE(v.vehicle_name, v.vehicle_number) ASC
	`)
	if err != nil {
		log.Printf("Error fetching buses with students: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch buses"})
		return
	}
	defer rows.Close()

	type BusWithStudents struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		Route        string `json:"route"`
		Capacity     int    `json:"capacity"`
		DriverID     int    `json:"driver_id"`
		DriverName   string `json:"driver_name"`
		StudentCount int    `json:"student_count"`
	}

	var buses []BusWithStudents
	for rows.Next() {
		var b BusWithStudents
		err := rows.Scan(&b.ID, &b.Name, &b.Route, &b.Capacity, &b.DriverID, &b.DriverName, &b.StudentCount)
		if err != nil {
			log.Printf("Error scanning bus: %v", err)
			continue
		}
		buses = append(buses, b)
	}

	c.JSON(http.StatusOK, buses)
}
