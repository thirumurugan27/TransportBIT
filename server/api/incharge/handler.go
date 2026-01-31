package incharge

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/*
	=========================
	  INCHARGE HANDLERS
	=========================
*/

// InchargeLoginResponse - response after incharge login
type InchargeLoginResponse struct {
	InchargeID int    `json:"incharge_id"`
	UserID     int    `json:"user_id"`
	FullName   string `json:"full_name"`
}

/*
=========================

	POST /api/incharge/login

=========================
*/
func InchargeLogin(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	log.Printf("Incharge login attempt: username=%s", req.Username)

	// Check user credentials with role = 'INCHARGE'
	var userID int
	var dbPassword, fullName string
	err := config.DB.QueryRow(`
		SELECT id, password, full_name FROM users 
		WHERE username = ? AND role = 'INCHARGE'
	`, req.Username).Scan(&userID, &dbPassword, &fullName)

	if err == sql.ErrNoRows {
		log.Printf("Incharge not found: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		log.Printf("Incharge login error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	// Check password
	if dbPassword != req.Password {
		log.Printf("Password mismatch for incharge: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Get driver_id for this user (since InchargeID refers to the driver record)
	var driverID int
	err = config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		log.Printf("Incharge user %s has no driver record: %v", req.Username, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incharge driver record not found"})
		return
	}

	log.Printf("Incharge login successful: %s (DriverID: %d)", req.Username, driverID)

	c.JSON(http.StatusOK, InchargeLoginResponse{
		InchargeID: driverID,
		UserID:     userID,
		FullName:   fullName,
	})
}

// InchargeAssignment - assignment view for incharge (includes driver name)
type InchargeAssignment struct {
	ID            int    `json:"id"`
	DriverID      int    `json:"driver_id"`
	DriverName    string `json:"driver_name"`
	DriverStatus  string `json:"driver_status"`
	VehicleID     int    `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	VehicleType   string `json:"vehicle_type"`
	ShiftID       int    `json:"shift_id"`
	ShiftName     string `json:"shift_name"`
	StartTime     string `json:"start_time"`
	EndTime       string `json:"end_time"`
	AssignedDate  string `json:"assigned_date"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	Status        string `json:"status"`
}

/*
=========================

	GET /api/incharge/assignments
	Get all assignments (for incharge to monitor)

=========================
*/
func GetInchargeAssignments(c *gin.Context) {
	// Optional date filter
	dateFilter := c.Query("date")

	var query string
	var args []interface{}

	if dateFilter != "" {
		query = `
			SELECT 
				a.id, a.driver_id, u.full_name as driver_name,
				CASE 
				    WHEN ? > CURDATE() THEN 'scheduled'
				    WHEN EXISTS(SELECT 1 FROM leave_requests lr 
				                WHERE lr.driver_id = a.driver_id 
				                AND lr.status = 'admin_approved'
				                AND ? BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
				    WHEN att.status = 'present' THEN 'present'
				    WHEN att.status = 'absent' THEN 'absent'
				    ELSE 'not_marked'
				END as driver_status,
				a.vehicle_id, v.vehicle_number, v.vehicle_type,
				a.shift_id, s.name as shift_name, 
				TIME_FORMAT(s.start_time, '%H:%i') as start_time,
				TIME_FORMAT(s.end_time, '%H:%i') as end_time,
				DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
				DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
				DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
				a.status
			FROM assignments a
			JOIN drivers d ON a.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			JOIN vehicles v ON a.vehicle_id = v.id
			JOIN shifts s ON a.shift_id = s.id
			LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = ?
			WHERE ? BETWEEN a.start_date AND a.end_date
			ORDER BY a.assigned_date DESC, s.start_time ASC
		`
		args = append(args, dateFilter, dateFilter, dateFilter, dateFilter)
	} else {
		query = `
			SELECT 
				a.id, a.driver_id, u.full_name as driver_name,
				CASE 
				    WHEN a.assigned_date > CURDATE() THEN 'scheduled'
				    WHEN EXISTS(SELECT 1 FROM leave_requests lr 
				                WHERE lr.driver_id = a.driver_id 
				                AND lr.status = 'admin_approved'
				                AND a.assigned_date BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
				    WHEN att.status = 'present' THEN 'present'
				    WHEN att.status = 'absent' THEN 'absent'
				    ELSE 'not_marked'
				END as driver_status,
				a.vehicle_id, v.vehicle_number, v.vehicle_type,
				a.shift_id, s.name as shift_name, 
				TIME_FORMAT(s.start_time, '%H:%i') as start_time,
				TIME_FORMAT(s.end_time, '%H:%i') as end_time,
				DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
				DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
				DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
				a.status
			FROM assignments a
			JOIN drivers d ON a.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			JOIN vehicles v ON a.vehicle_id = v.id
			JOIN shifts s ON a.shift_id = s.id
			LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = a.assigned_date
			ORDER BY a.assigned_date DESC, s.start_time ASC
			LIMIT 100
		`
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get incharge assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	var assignments []InchargeAssignment
	for rows.Next() {
		var a InchargeAssignment
		var assignedDate, startDate, endDate []byte

		err := rows.Scan(&a.ID, &a.DriverID, &a.DriverName, &a.DriverStatus,
			&a.VehicleID, &a.VehicleNumber, &a.VehicleType,
			&a.ShiftID, &a.ShiftName, &a.StartTime, &a.EndTime,
			&assignedDate, &startDate, &endDate, &a.Status)
		if err != nil {
			log.Printf("Scan incharge assignment error: %v", err)
			continue
		}

		a.AssignedDate = string(assignedDate)
		a.StartDate = string(startDate)
		a.EndDate = string(endDate)
		assignments = append(assignments, a)
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	GET /api/incharge/cluster-drivers
	Get all drivers for attendance marking (any incharge can mark any driver)

=========================
*/
func GetInchargeClusterDrivers(c *gin.Context) {
	inchargeID := c.Query("incharge_id")
	date := c.Query("date")
	if inchargeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "incharge_id required"})
		return
	}

	// Store the original date for leave check
	originalDate := date
	if date == "" {
		date = "CURDATE()"
		originalDate = "CURDATE()"
	} else {
		originalDate = date
		date = "'" + date + "'"
	}

	// Verify this is a valid incharge
	var inchargeExists int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM drivers WHERE id = ? AND is_incharge = 1
	`, inchargeID).Scan(&inchargeExists)

	if err != nil || inchargeExists == 0 {
		log.Printf("Get incharge error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Incharge not found or is_incharge flag not set"})
		return
	}

	// Get ALL drivers (excluding incharges - they are sub-admins, not drivers)
	// Include which incharge marked attendance
	rows, err := config.DB.Query(`
		SELECT 
			d.id as driver_id, 
			d.user_id,
			u.full_name,
			COALESCE(att.status, 'not_marked') as attendance_status,
			att.checkin_time,
			CASE WHEN lr.id IS NOT NULL THEN 1 ELSE 0 END as has_approved_leave,
			att.marked_by_incharge_id,
			att.marked_by_incharge_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = ` + date + `
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
			AND lr.status = 'admin_approved' 
			AND ` + date + ` BETWEEN lr.start_date AND lr.end_date
		WHERE d.is_incharge = 0
		ORDER BY u.full_name
	`)

	if err != nil {
		log.Printf("Get cluster drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching drivers"})
		return
	}
	defer rows.Close()

	type ClusterDriver struct {
		DriverID             int     `json:"driver_id"`
		UserID               int     `json:"user_id"`
		FullName             string  `json:"full_name"`
		AttendanceStatus     string  `json:"attendance_status"`
		CheckinTime          *string `json:"checkin_time"`
		HasApprovedLeave     bool    `json:"has_approved_leave"`
		MarkedByInchargeID   *int    `json:"marked_by_incharge_id"`
		MarkedByInchargeName *string `json:"marked_by_incharge_name"`
	}

	var drivers []ClusterDriver
	for rows.Next() {
		var d ClusterDriver
		var hasLeave int
		rows.Scan(&d.DriverID, &d.UserID, &d.FullName, &d.AttendanceStatus, &d.CheckinTime, &hasLeave, &d.MarkedByInchargeID, &d.MarkedByInchargeName)
		d.HasApprovedLeave = hasLeave == 1

		// Auto-mark absent for drivers with approved leave if not already marked
		if d.HasApprovedLeave && d.AttendanceStatus == "not_marked" {
			// Auto insert absent attendance for this driver
			_, err := config.DB.Exec(`
				INSERT INTO attendance (user_id, date, status, checkin_time)
				VALUES (?, ?, 'absent', NULL)
				ON DUPLICATE KEY UPDATE status = status
			`, d.UserID, originalDate)
			if err == nil {
				d.AttendanceStatus = "absent"
				log.Printf("Auto-marked absent for driver %d (user %d) due to approved leave on %s", d.DriverID, d.UserID, originalDate)
			}
		}

		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}

/*
=========================

	POST /api/incharge/attendance/mark
	Any incharge can mark attendance for any driver

=========================
*/
func InchargeMarkAttendance(c *gin.Context) {
	var req struct {
		InchargeID  int     `json:"incharge_id"`
		UserID      int     `json:"user_id"`
		Date        string  `json:"date"`
		Status      string  `json:"status"`
		CheckinTime *string `json:"checkin_time"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Verify this is a valid incharge and get their name
	var inchargeName string
	err := config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d 
		JOIN users u ON d.user_id = u.id 
		WHERE d.id = ? AND d.is_incharge = 1
	`, req.InchargeID).Scan(&inchargeName)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Incharge not found or is_incharge flag not set"})
		return
	}

	// Verify the target user is a driver (not an incharge) and get driver_id
	var driverID int
	err = config.DB.QueryRow(`
		SELECT id FROM drivers WHERE user_id = ? AND is_incharge = 0
	`, req.UserID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Target user is not a driver"})
		return
	}

	// Upsert attendance with incharge tracking
	_, err = config.DB.Exec(`
		INSERT INTO attendance (user_id, date, status, checkin_time, marked_by_incharge_id, marked_by_incharge_name)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time), 
			marked_by_incharge_id=VALUES(marked_by_incharge_id), marked_by_incharge_name=VALUES(marked_by_incharge_name)
	`, req.UserID, req.Date, req.Status, req.CheckinTime, req.InchargeID, inchargeName)

	if err != nil {
		log.Printf("Mark attendance error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error marking attendance"})
		return
	}

	// Send notification to the driver
	notifTitle := "Attendance Marked by Incharge"
	statusText := "Present"
	if req.Status == "absent" {
		statusText = "Absent"
	}
	notifMessage := fmt.Sprintf("Incharge %s has marked your attendance as %s for %s.",
		inchargeName, statusText, req.Date)
	_, _ = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type)
		VALUES (?, ?, ?, 'info')
	`, driverID, notifTitle, notifMessage)

	c.JSON(http.StatusOK, gin.H{"message": "Attendance marked successfully", "marked_by": inchargeName})
}

/*
=========================

	GET /api/incharge/attendance/history
	Get attendance history for all drivers (any incharge can view)

=========================
*/
func GetInchargeAttendanceHistory(c *gin.Context) {
	inchargeID := c.Query("incharge_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	status := c.Query("status")

	if inchargeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "incharge_id required"})
		return
	}

	// Verify this is a valid incharge
	var inchargeExists int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM drivers WHERE id = ? AND is_incharge = 1
	`, inchargeID).Scan(&inchargeExists)

	if err != nil || inchargeExists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incharge not found"})
		return
	}

	// Default to last 30 days if no dates provided
	if startDate == "" {
		startDate = "DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
	} else {
		startDate = "'" + startDate + "'"
	}
	if endDate == "" {
		endDate = "CURDATE()"
	} else {
		endDate = "'" + endDate + "'"
	}

	// Build status condition
	statusCondition := ""
	if status != "" && (status == "present" || status == "absent") {
		statusCondition = " AND a.status = '" + status + "'"
	}

	// Get ALL driver attendance (excluding incharges)
	rows, err := config.DB.Query(`
		SELECT 
			a.id,
			a.user_id,
			u.full_name as driver_name,
			DATE_FORMAT(a.date, '%Y-%m-%d') as date,
			a.status,
			a.checkin_time,
			a.checkout_time,
			a.marked_by_incharge_id,
			a.marked_by_incharge_name
		FROM attendance a
		JOIN users u ON a.user_id = u.id
		JOIN drivers d ON d.user_id = u.id AND d.is_incharge = 0
		WHERE a.date BETWEEN ` + startDate + ` AND ` + endDate + statusCondition + `
		ORDER BY a.date DESC, u.full_name ASC
	`)

	if err != nil {
		log.Printf("Get attendance history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching attendance history"})
		return
	}
	defer rows.Close()

	type AttendanceRecord struct {
		ID                   int     `json:"id"`
		UserID               int     `json:"user_id"`
		DriverName           string  `json:"driver_name"`
		Date                 string  `json:"date"`
		Status               string  `json:"status"`
		CheckinTime          *string `json:"checkin_time"`
		CheckoutTime         *string `json:"checkout_time"`
		MarkedByInchargeID   *int    `json:"marked_by_incharge_id"`
		MarkedByInchargeName *string `json:"marked_by_incharge_name"`
	}

	var records []AttendanceRecord
	for rows.Next() {
		var r AttendanceRecord
		rows.Scan(&r.ID, &r.UserID, &r.DriverName, &r.Date, &r.Status, &r.CheckinTime, &r.CheckoutTime, &r.MarkedByInchargeID, &r.MarkedByInchargeName)
		records = append(records, r)
	}

	c.JSON(http.StatusOK, records)
}

// GET /api/incharge/vehicles/alerts - Get vehicle alerts for incharge's cluster
func GetInchargeVehicleAlerts(c *gin.Context) {
	// Get driver_id from query (incharge's driver record)
	driverIDStr := c.Query("driver_id")
	if driverIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	// Get the cluster_id for this incharge
	var clusterID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT cluster_id FROM drivers WHERE id = ?
	`, driverIDStr).Scan(&clusterID)

	if err != nil || !clusterID.Valid {
		// No cluster assigned, return empty
		c.JSON(http.StatusOK, gin.H{
			"alerts":   []interface{}{},
			"expired":  0,
			"critical": 0,
			"total":    0,
		})
		return
	}

	// Get vehicles assigned to drivers in this cluster with expired or expiring (<=10 days) documents
	rows, err := config.DB.Query(`
		SELECT DISTINCT v.id, v.vehicle_number, v.vehicle_type, v.status,
		       v.insurance_expire_date, v.fc_expire_date, v.permit_expire_date,
		       DATEDIFF(v.insurance_expire_date, CURDATE()) as insurance_days,
		       DATEDIFF(v.fc_expire_date, CURDATE()) as fc_days,
		       DATEDIFF(v.permit_expire_date, CURDATE()) as permit_days
		FROM vehicles v
		INNER JOIN assignments a ON a.vehicle_id = v.id
		INNER JOIN drivers d ON d.id = a.driver_id
		WHERE d.cluster_id = ?
		  AND v.status = 'active'
		  AND (
		    (v.insurance_expire_date IS NOT NULL AND DATEDIFF(v.insurance_expire_date, CURDATE()) <= 10)
		    OR (v.fc_expire_date IS NOT NULL AND DATEDIFF(v.fc_expire_date, CURDATE()) <= 10)
		    OR (v.permit_expire_date IS NOT NULL AND DATEDIFF(v.permit_expire_date, CURDATE()) <= 10)
		  )
		ORDER BY 
		  LEAST(
		    COALESCE(DATEDIFF(v.insurance_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.fc_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.permit_expire_date, CURDATE()), 999)
		  ) ASC
	`, clusterID.Int64)

	if err != nil {
		log.Printf("Incharge vehicle alerts error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type VehicleAlert struct {
		ID              int     `json:"id"`
		VehicleNumber   string  `json:"vehicle_number"`
		VehicleType     string  `json:"vehicle_type"`
		Status          string  `json:"status"`
		InsuranceExpire *string `json:"insurance_expire_date"`
		FCExpire        *string `json:"fc_expire_date"`
		PermitExpire    *string `json:"permit_expire_date"`
		InsuranceDays   *int    `json:"insurance_days"`
		FCDays          *int    `json:"fc_days"`
		PermitDays      *int    `json:"permit_days"`
	}

	var alerts []VehicleAlert
	for rows.Next() {
		var a VehicleAlert
		rows.Scan(&a.ID, &a.VehicleNumber, &a.VehicleType, &a.Status,
			&a.InsuranceExpire, &a.FCExpire, &a.PermitExpire,
			&a.InsuranceDays, &a.FCDays, &a.PermitDays)
		alerts = append(alerts, a)
	}

	// Count expired (< 0 days) and critical (0-10 days)
	expired := 0
	critical := 0
	for _, a := range alerts {
		hasExpired := false
		hasCritical := false

		if a.InsuranceDays != nil && *a.InsuranceDays < 0 {
			hasExpired = true
		} else if a.InsuranceDays != nil && *a.InsuranceDays <= 10 {
			hasCritical = true
		}

		if a.FCDays != nil && *a.FCDays < 0 {
			hasExpired = true
		} else if a.FCDays != nil && *a.FCDays <= 10 {
			hasCritical = true
		}

		if a.PermitDays != nil && *a.PermitDays < 0 {
			hasExpired = true
		} else if a.PermitDays != nil && *a.PermitDays <= 10 {
			hasCritical = true
		}

		if hasExpired {
			expired++
		} else if hasCritical {
			critical++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts":   alerts,
		"expired":  expired,
		"critical": critical,
		"total":    len(alerts),
	})
}

// POST /api/incharge/fc-replacement/request - Incharge requests FC replacement (needs admin approval)
func RequestFCReplacement(c *gin.Context) {
	var req struct {
		VehicleID  int    `json:"vehicle_id"`
		DriverID   int    `json:"driver_id"`
		StartDate  string `json:"start_date"`
		EndDate    string `json:"end_date"`
		Reason     string `json:"reason"`
		Notes      string `json:"notes"`
		InchargeID int    `json:"incharge_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Create request with pending status (needs admin approval)
	result, err := config.DB.Exec(`
		INSERT INTO fc_replacement_requests 
		(vehicle_id, driver_id, start_date, end_date, reason, status, requested_by_role, requested_by_id, notes)
		VALUES (?, ?, ?, ?, ?, 'pending', 'incharge', ?, ?)
	`, req.VehicleID, req.DriverID, req.StartDate, req.EndDate, req.Reason, req.InchargeID, req.Notes)

	if err != nil {
		log.Printf("Create FC replacement request error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	requestID, _ := result.LastInsertId()

	// Get vehicle number and incharge name for notification
	var vehicleNumber, inchargeName string
	config.DB.QueryRow(`SELECT vehicle_number FROM vehicles WHERE id = ?`, req.VehicleID).Scan(&vehicleNumber)
	config.DB.QueryRow(`SELECT full_name FROM users u JOIN drivers d ON d.user_id = u.id WHERE d.id = ?`, req.InchargeID).Scan(&inchargeName)

	// Create notification for admin
	_, err = config.DB.Exec(`
		INSERT INTO admin_notifications (type, title, message, reference_id, is_read)
		VALUES ('fc_replacement_request', 'New FC Replacement Request', ?, ?, 0)
	`, fmt.Sprintf("Incharge %s requested FC replacement for vehicle %s (%s to %s). Reason: %s",
		inchargeName, vehicleNumber, req.StartDate, req.EndDate, req.Reason), requestID)

	if err != nil {
		log.Printf("Failed to create admin notification: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "FC replacement request submitted for admin approval",
		"id":      requestID,
		"status":  "pending",
	})
}

// GET /api/incharge/fc-replacements - Get FC replacements for incharge's cluster
func GetInchargeFCReplacements(c *gin.Context) {
	inchargeID := c.Query("incharge_id")
	if inchargeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "incharge_id required"})
		return
	}

	// Get cluster ID for this incharge
	var clusterID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT cluster_id FROM drivers WHERE id = ?
	`, inchargeID).Scan(&clusterID)

	if err != nil || !clusterID.Valid {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			r.id, r.vehicle_id, v.vehicle_number, v.vehicle_type,
			r.replacement_vehicle_id, rv.vehicle_number as replacement_vehicle_number,
			r.driver_id, u.full_name as driver_name,
			DATE_FORMAT(r.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(r.end_date, '%Y-%m-%d') as end_date,
			r.reason, r.status, r.requested_by_role,
			r.notes, r.driver_notified,
			DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') as created_at,
			DATEDIFF(r.end_date, CURDATE()) as days_remaining
		FROM fc_replacement_requests r
		JOIN vehicles v ON r.vehicle_id = v.id
		LEFT JOIN vehicles rv ON r.replacement_vehicle_id = rv.id
		JOIN drivers d ON r.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE d.cluster_id = ?
		ORDER BY r.created_at DESC
	`, clusterID.Int64)

	if err != nil {
		log.Printf("Get incharge FC replacements error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type FCReplacement struct {
		ID                    int     `json:"id"`
		VehicleID             int     `json:"vehicle_id"`
		VehicleNumber         string  `json:"vehicle_number"`
		VehicleType           string  `json:"vehicle_type"`
		ReplacementVehicleID  *int    `json:"replacement_vehicle_id"`
		ReplacementVehicleNum *string `json:"replacement_vehicle_number"`
		DriverID              int     `json:"driver_id"`
		DriverName            string  `json:"driver_name"`
		StartDate             string  `json:"start_date"`
		EndDate               string  `json:"end_date"`
		Reason                string  `json:"reason"`
		Status                string  `json:"status"`
		RequestedByRole       string  `json:"requested_by_role"`
		Notes                 *string `json:"notes"`
		DriverNotified        bool    `json:"driver_notified"`
		CreatedAt             string  `json:"created_at"`
		DaysRemaining         int     `json:"days_remaining"`
	}

	var requests []FCReplacement
	for rows.Next() {
		var r FCReplacement
		rows.Scan(
			&r.ID, &r.VehicleID, &r.VehicleNumber, &r.VehicleType,
			&r.ReplacementVehicleID, &r.ReplacementVehicleNum,
			&r.DriverID, &r.DriverName,
			&r.StartDate, &r.EndDate,
			&r.Reason, &r.Status, &r.RequestedByRole,
			&r.Notes, &r.DriverNotified,
			&r.CreatedAt, &r.DaysRemaining,
		)
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

/*
=========================

	GET /api/incharge/driver-assignments
	Get all driver-vehicle assignments for incharge to view

=========================
*/
func GetDriverAssignments(c *gin.Context) {
	type DriverAssignment struct {
		DriverID         int     `json:"driver_id"`
		DriverName       string  `json:"driver_name"`
		DriverPhone      *string `json:"driver_phone"`
		VehicleID        int     `json:"vehicle_id"`
		VehicleNumber    string  `json:"vehicle_number"`
		VehicleType      string  `json:"vehicle_type"`
		ShiftID          *int    `json:"shift_id"`
		ShiftName        *string `json:"shift_name"`
		StartTime        *string `json:"start_time"`
		EndTime          *string `json:"end_time"`
		AssignmentStatus string  `json:"assignment_status"`
		ClusterName      *string `json:"cluster_name"`
	}

	var assignments []DriverAssignment

	// 1. Get regular BUS/FC assignments
	rows, err := config.DB.Query(`
		SELECT 
			d.id as driver_id,
			u.full_name as driver_name,
			u.phone as driver_phone,
			v.id as vehicle_id,
			v.vehicle_number,
			v.vehicle_type,
			s.id as shift_id,
			s.shift_name,
			s.start_time,
			s.end_time,
			a.status as assignment_status,
			c.name as cluster_name
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN driver_clusters c ON d.cluster_id = c.id
		WHERE d.is_incharge = 0
		ORDER BY u.full_name
	`)

	if err != nil {
		log.Printf("Get driver assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a DriverAssignment
		rows.Scan(&a.DriverID, &a.DriverName, &a.DriverPhone, &a.VehicleID, &a.VehicleNumber,
			&a.VehicleType, &a.ShiftID, &a.ShiftName, &a.StartTime, &a.EndTime,
			&a.AssignmentStatus, &a.ClusterName)
		assignments = append(assignments, a)
	}

	// 2. Get EV assignments (drivers in clusters with active EV assignments)
	today := time.Now().Format("2006-01-02")
	evRows, err := config.DB.Query(`
		SELECT 
			d.id as driver_id,
			u.full_name as driver_name,
			u.phone as driver_phone,
			v.id as vehicle_id,
			v.vehicle_number,
			'EV' as vehicle_type,
			s.id as shift_id,
			s.name as shift_name,
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			ev.status as assignment_status,
			c.name as cluster_name
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters c ON ev.cluster_id = c.id
		JOIN drivers d ON d.cluster_id = c.id AND d.is_incharge = 0
		JOIN users u ON d.user_id = u.id
		LEFT JOIN shifts s ON s.id = c.default_shift_id
		WHERE ev.status = 'active'
		  AND ? BETWEEN ev.start_date AND ev.end_date
		ORDER BY u.full_name
	`, today)

	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		// Don't fail, just skip EV assignments
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var a DriverAssignment
			evRows.Scan(&a.DriverID, &a.DriverName, &a.DriverPhone, &a.VehicleID, &a.VehicleNumber,
				&a.VehicleType, &a.ShiftID, &a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignmentStatus, &a.ClusterName)
			assignments = append(assignments, a)
		}
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	GET /api/incharge/all-drivers
	Get all drivers for incharge operations (KM log, leave request)

=========================
*/
func GetAllDriversForIncharge(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			d.id as driver_id,
			u.full_name,
			u.phone,
			d.license_number,
			d.cluster_id,
			c.name as cluster_name,
			v.vehicle_number as assigned_vehicle
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_clusters c ON d.cluster_id = c.id
		LEFT JOIN assignments a ON a.driver_id = d.id AND a.status = 'active'
		LEFT JOIN vehicles v ON a.vehicle_id = v.id
		WHERE d.is_incharge = 0
		ORDER BY u.full_name
	`)

	if err != nil {
		log.Printf("Get all drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching drivers"})
		return
	}
	defer rows.Close()

	type DriverInfo struct {
		DriverID        int     `json:"driver_id"`
		FullName        string  `json:"full_name"`
		Phone           *string `json:"phone"`
		LicenseNumber   *string `json:"license_number"`
		ClusterID       *int    `json:"cluster_id"`
		ClusterName     *string `json:"cluster_name"`
		AssignedVehicle *string `json:"assigned_vehicle"`
	}

	var drivers []DriverInfo
	for rows.Next() {
		var d DriverInfo
		rows.Scan(&d.DriverID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.ClusterID, &d.ClusterName, &d.AssignedVehicle)
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}

/*
=========================

	POST /api/incharge/km-log/add
	Incharge adds KM log on behalf of a driver

=========================
*/
func InchargeAddKmLog(c *gin.Context) {
	var req struct {
		InchargeID  int     `json:"incharge_id"`
		DriverID    int     `json:"driver_id"`
		Date        string  `json:"date"`
		StartKm     float64 `json:"start_km"`
		EndKm       float64 `json:"end_km"`
		TotalKm     float64 `json:"total_km"`
		Remarks     string  `json:"remarks"`
		VehicleType string  `json:"vehicle_type"`
		VehicleID   *int    `json:"vehicle_id"`
		AssignmentID *int   `json:"assignment_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Verify incharge and fetch user metadata
	var inchargeName string
	var inchargeUserID int
	err := config.DB.QueryRow(`
		SELECT u.full_name, u.id FROM drivers d 
		JOIN users u ON d.user_id = u.id 
		WHERE d.id = ? AND d.is_incharge = 1
	`, req.InchargeID).Scan(&inchargeName, &inchargeUserID)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Incharge not found"})
		return
	}

	// Validate
	if req.DriverID == 0 || req.Date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	if req.VehicleID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	if req.EndKm < req.StartKm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End KM must be greater than Start KM"})
		return
	}

	// Calculate total if not provided
	if req.TotalKm == 0 {
		req.TotalKm = req.EndKm - req.StartKm
	}

	if req.VehicleType == "" {
		config.DB.QueryRow(`SELECT vehicle_type FROM vehicles WHERE id = ?`, *req.VehicleID).Scan(&req.VehicleType)
		if req.VehicleType == "" {
			req.VehicleType = "BUS"
		}
	}

	// Auto-detect assignment when not provided
	if req.AssignmentID == nil {
		var assignmentID sql.NullInt64
		err = config.DB.QueryRow(`
			SELECT id FROM assignments
			WHERE driver_id = ? AND vehicle_id = ? AND ? BETWEEN start_date AND end_date
			ORDER BY start_date DESC
			LIMIT 1
		`, req.DriverID, *req.VehicleID, req.Date).Scan(&assignmentID)
		if err == nil && assignmentID.Valid {
			val := int(assignmentID.Int64)
			req.AssignmentID = &val
		}
	}

	// Add remark about who filled it
	remarks := req.Remarks
	if remarks != "" {
		remarks = remarks + " (Added by Incharge: " + inchargeName + ")"
	} else {
		remarks = "Added by Incharge: " + inchargeName
	}

	var vehicleID interface{}
	if req.VehicleID != nil {
		vehicleID = *req.VehicleID
	}

	var assignmentID interface{}
	if req.AssignmentID != nil {
		assignmentID = *req.AssignmentID
	}

	// Insert into DB capturing recorded metadata
	result, err := config.DB.Exec(`
		INSERT INTO km_logs (
			driver_id, date, start_km, end_km, total_km, remarks,
			vehicle_type, vehicle_id, assignment_id,
			recorded_by_user_id, recorded_by_name
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, remarks, req.VehicleType, vehicleID, assignmentID, inchargeUserID, inchargeName)

	if err != nil {
		log.Printf("Incharge add km log error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding km log"})
		return
	}

	id, _ := result.LastInsertId()

	// Send notification to the driver
	notifTitle := "KM Log Added by Incharge"
	notifMessage := fmt.Sprintf("Incharge %s has added a KM log on your behalf for %s. Start KM: %.1f, End KM: %.1f, Total: %.1f KM.",
		inchargeName, req.Date, req.StartKm, req.EndKm, req.TotalKm)
	_, _ = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'info', ?)
	`, req.DriverID, notifTitle, notifMessage, id)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Km log added successfully on behalf of driver",
		"id":       id,
		"added_by": inchargeName,
	})
}

/*
=========================

	POST /api/incharge/leave/apply
	Incharge applies leave on behalf of a driver

=========================
*/
func InchargeApplyLeave(c *gin.Context) {
	var req struct {
		InchargeID int    `json:"incharge_id"`
		DriverID   int    `json:"driver_id"`
		LeaveType  string `json:"leave_type"`
		StartDate  string `json:"start_date"`
		StartTime  string `json:"start_time"`
		EndDate    string `json:"end_date"`
		EndTime    string `json:"end_time"`
		Reason     string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Verify incharge
	var inchargeName string
	err := config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d 
		JOIN users u ON d.user_id = u.id 
		WHERE d.id = ? AND d.is_incharge = 1
	`, req.InchargeID).Scan(&inchargeName)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Incharge not found"})
		return
	}

	if req.DriverID == 0 || req.StartDate == "" || req.EndDate == "" || req.StartTime == "" || req.EndTime == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields"})
		return
	}

	leaveType := req.LeaveType
	if leaveType == "" {
		leaveType = "Leave"
	}

	// Add note about who raised it
	reason := req.Reason
	if reason != "" {
		reason = reason + " (Raised by Incharge: " + inchargeName + ")"
	} else {
		reason = "Raised by Incharge: " + inchargeName
	}

	result, err := config.DB.Exec(`
		INSERT INTO leave_requests (driver_id, leave_type, start_date, start_time, end_date, end_time, reason, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
	`, req.DriverID, leaveType, req.StartDate, req.StartTime, req.EndDate, req.EndTime, reason)

	if err != nil {
		log.Printf("Incharge apply leave error: %v", err)
		if strings.Contains(err.Error(), "Unknown column") && (strings.Contains(err.Error(), "start_time") || strings.Contains(err.Error(), "end_time")) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Database schema missing start_time/end_time. Run migration 20260131_add_leave_time_fields.sql",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error applying for leave"})
		return
	}

	id, _ := result.LastInsertId()

	// Send notification to the driver
	notifTitle := "Leave Request Submitted by Incharge"
	notifMessage := fmt.Sprintf("Incharge %s has submitted a %s leave request on your behalf from %s %s to %s %s. Status: Pending approval.",
		inchargeName, leaveType, req.StartDate, req.StartTime, req.EndDate, req.EndTime)
	_, _ = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'leave', ?)
	`, req.DriverID, notifTitle, notifMessage, id)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Leave request submitted on behalf of driver",
		"id":         id,
		"applied_by": inchargeName,
	})
}

/*
=========================

	GET /api/incharge/driver-km-logs
	Get KM logs for a specific driver

=========================
*/
func GetDriverKmLogs(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			kl.id, kl.driver_id, kl.date, kl.start_km, kl.end_km, kl.total_km, 
			kl.remarks, kl.vehicle_type, u.full_name as driver_name
		FROM km_logs kl
		JOIN drivers d ON kl.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE kl.driver_id = ?
		ORDER BY kl.date DESC
		LIMIT 50
	`, driverID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching km logs"})
		return
	}
	defer rows.Close()

	type KmLog struct {
		ID          int     `json:"id"`
		DriverID    int     `json:"driver_id"`
		Date        string  `json:"date"`
		StartKm     float64 `json:"start_km"`
		EndKm       float64 `json:"end_km"`
		TotalKm     float64 `json:"total_km"`
		Remarks     *string `json:"remarks"`
		VehicleType *string `json:"vehicle_type"`
		DriverName  string  `json:"driver_name"`
	}

	var logs []KmLog
	for rows.Next() {
		var l KmLog
		rows.Scan(&l.ID, &l.DriverID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.Remarks, &l.VehicleType, &l.DriverName)
		logs = append(logs, l)
	}

	c.JSON(http.StatusOK, logs)
}

/*
=========================

	GET /api/incharge/km-summary
	Get detailed KM summary for incharge - all drivers' KM logs with full details

=========================
*/
func GetInchargeKmSummary(c *gin.Context) {
	period := c.DefaultQuery("period", "today")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	driverParam := c.Query("driver_id")
	vehicleParam := c.Query("vehicle_id")
	limitParam := c.DefaultQuery("limit", "200")

	limit, err := strconv.Atoi(limitParam)
	if err != nil || limit <= 0 {
		limit = 200
	} else if limit > 500 {
		limit = 500
	}

	var driverID *int
	if driverParam != "" {
		if id, err := strconv.Atoi(driverParam); err == nil {
			driverID = &id
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid driver_id"})
			return
		}
	}

	var vehicleID *int
	if vehicleParam != "" {
		if id, err := strconv.Atoi(vehicleParam); err == nil {
			vehicleID = &id
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_id"})
			return
		}
	}

	filters := kmSummaryFilters{
		Period:    period,
		StartDate: startDate,
		EndDate:   endDate,
		DriverID:  driverID,
		VehicleID: vehicleID,
	}

	whereClause, args := buildKmWhereClause(filters)
	if whereClause == "" {
		whereClause = "WHERE 1=1"
	}

	logArgs := append(copyArgs(args), limit)
	rows, err := config.DB.Query(`
		SELECT 
			kl.id,
			kl.driver_id,
			u.full_name as driver_name,
			DATE_FORMAT(kl.date, '%Y-%m-%d') as date,
			kl.start_km,
			kl.end_km,
			kl.total_km,
			kl.remarks,
			COALESCE(kl.vehicle_type, 'UNKNOWN') as vehicle_type,
			COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
			COALESCE(s.name, 'N/A') as shift,
			COALESCE(a.route_name, 'N/A') as route_name,
			kl.recorded_by_name
		FROM km_logs kl
		JOIN drivers d ON kl.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN vehicles v ON kl.vehicle_id = v.id
		LEFT JOIN assignments a ON kl.assignment_id = a.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		`+whereClause+`
		ORDER BY kl.date DESC, kl.id DESC
		LIMIT ?
	`, logArgs...)

	if err != nil {
		log.Printf("Get incharge KM summary error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching KM summary"})
		return
	}
	defer rows.Close()

	type DetailedKmLog struct {
		ID             int      `json:"id"`
		DriverID       int      `json:"driver_id"`
		DriverName     string   `json:"driver_name"`
		Date           string   `json:"date"`
		StartKm        float64  `json:"start_km"`
		EndKm          float64  `json:"end_km"`
		TotalKm        float64  `json:"total_km"`
		Remarks        *string  `json:"remarks"`
		VehicleType    string   `json:"vehicle_type"`
		VehicleNumber  string   `json:"vehicle_number"`
		Shift          string   `json:"shift"`
		RouteName      string   `json:"route_name"`
		RecordedByName *string  `json:"recorded_by_name"`
	}

	var logs []DetailedKmLog
	var listedKm float64

	for rows.Next() {
		var l DetailedKmLog
		if err := rows.Scan(&l.ID, &l.DriverID, &l.DriverName, &l.Date, &l.StartKm, &l.EndKm,
			&l.TotalKm, &l.Remarks, &l.VehicleType, &l.VehicleNumber, &l.Shift, &l.RouteName,
			&l.RecordedByName); err == nil {
			logs = append(logs, l)
			listedKm += l.TotalKm
		}
	}

	// Overall stats for the filter range
	var totalKm float64
	var totalTrips int
	totalRow := config.DB.QueryRow(`
		SELECT COALESCE(SUM(kl.total_km), 0), COUNT(*)
		FROM km_logs kl
		` + whereClause + `
	`, args...)
	totalRow.Scan(&totalKm, &totalTrips)

	avgPerTrip := 0.0
	if totalTrips > 0 {
		avgPerTrip = totalKm / float64(totalTrips)
	}

	// Driver focus (top performer for filters)
	var driverFocus interface{}
	driverRow := config.DB.QueryRow(`
		SELECT kl.driver_id, u.full_name, SUM(kl.total_km) as total_km, COUNT(*) as trips
		FROM km_logs kl
		JOIN drivers d ON kl.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		` + whereClause + `
		GROUP BY kl.driver_id, u.full_name
		ORDER BY total_km DESC
		LIMIT 1
	`, args...)
	var focusDriverID int
	var focusDriverName string
	var focusDriverKm float64
	var focusDriverTrips int
	if err := driverRow.Scan(&focusDriverID, &focusDriverName, &focusDriverKm, &focusDriverTrips); err == nil {
		driverFocus = gin.H{
			"driver_id":   focusDriverID,
			"driver_name": focusDriverName,
			"total_km":    focusDriverKm,
			"trips":       focusDriverTrips,
		}
	}

	// Vehicle focus (top vehicle for filters)
	var vehicleFocus interface{}
	vehicleRow := config.DB.QueryRow(`
		SELECT kl.vehicle_id, COALESCE(v.vehicle_number, 'Unassigned') as vehicle_number,
		       COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
		       SUM(kl.total_km) as total_km, COUNT(*) as trips
		FROM km_logs kl
		LEFT JOIN vehicles v ON kl.vehicle_id = v.id
		` + whereClause + ` AND kl.vehicle_id IS NOT NULL
		GROUP BY kl.vehicle_id, v.vehicle_number, v.vehicle_type
		ORDER BY total_km DESC
		LIMIT 1
	`, args...)
	var focusVehicleID int
	var focusVehicleNumber string
	var focusVehicleType string
	var focusVehicleKm float64
	var focusVehicleTrips int
	if err := vehicleRow.Scan(&focusVehicleID, &focusVehicleNumber, &focusVehicleType, &focusVehicleKm, &focusVehicleTrips); err == nil {
		vehicleFocus = gin.H{
			"vehicle_id":     focusVehicleID,
			"vehicle_number": focusVehicleNumber,
			"vehicle_type":   focusVehicleType,
			"total_km":       focusVehicleKm,
			"trips":          focusVehicleTrips,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
		"summary": gin.H{
			"total_km":        totalKm,
			"total_trips":     totalTrips,
			"avg_km_per_trip": avgPerTrip,
			"listed_km":       listedKm,
		},
		"driver_focus":  driverFocus,
		"vehicle_focus": vehicleFocus,
		"filters": gin.H{
			"period":     period,
			"start_date": startDate,
			"end_date":   endDate,
			"driver_id":  driverParam,
			"vehicle_id": vehicleParam,
		},
	})
}

// GetInchargeKmFilters returns dropdown data for drivers and vehicles
func GetInchargeKmFilters(c *gin.Context) {
	driverRows, err := config.DB.Query(`
		SELECT d.id, u.full_name, COALESCE(c.name, 'Unassigned') as cluster_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_clusters c ON d.cluster_id = c.id
		WHERE d.is_incharge = 0
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Get KM filter drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to load driver filters"})
		return
	}
	defer driverRows.Close()

	type filterDriver struct {
		ID      int     `json:"id"`
		Name    string  `json:"name"`
		Cluster *string `json:"cluster"`
	}

	var drivers []filterDriver
	for driverRows.Next() {
		var d filterDriver
		if err := driverRows.Scan(&d.ID, &d.Name, &d.Cluster); err == nil {
			drivers = append(drivers, d)
		}
	}

	vehicleRows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, 
		       COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
		       COALESCE(NULLIF(v.name, ''), v.vehicle_number) as bus_name
		FROM vehicles v
		WHERE v.status IN ('active', 'available')
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("Get KM filter vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to load vehicle filters"})
		return
	}
	defer vehicleRows.Close()

	type filterVehicle struct {
		ID            int    `json:"id"`
		VehicleNumber string `json:"vehicle_number"`
		VehicleType   string `json:"vehicle_type"`
		BusName       string `json:"bus_name"`
	}

	var vehicles []filterVehicle
	for vehicleRows.Next() {
		var v filterVehicle
		if err := vehicleRows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.BusName); err != nil {
			log.Printf("Error scanning vehicle row: %v", err)
			continue
		}
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, gin.H{
		"drivers":  drivers,
		"vehicles": vehicles,
	})
}

type kmSummaryFilters struct {
	Period    string
	StartDate string
	EndDate   string
	DriverID  *int
	VehicleID *int
}

func buildKmWhereClause(f kmSummaryFilters) (string, []interface{}) {
	filters := []string{}
	args := []interface{}{}

	if f.StartDate != "" {
		end := f.EndDate
		if end == "" {
			end = f.StartDate
		}
		filters = append(filters, "kl.date BETWEEN ? AND ?")
		args = append(args, f.StartDate, end)
	} else {
		switch f.Period {
		case "today":
			filters = append(filters, "kl.date = CURDATE()")
		case "week":
			filters = append(filters, "YEARWEEK(kl.date) = YEARWEEK(CURDATE())")
		case "month":
			filters = append(filters, "MONTH(kl.date) = MONTH(CURDATE()) AND YEAR(kl.date) = YEAR(CURDATE())")
		default:
			filters = append(filters, "kl.date = CURDATE()")
		}
	}

	if f.DriverID != nil {
		filters = append(filters, "kl.driver_id = ?")
		args = append(args, *f.DriverID)
	}

	if f.VehicleID != nil {
		filters = append(filters, "kl.vehicle_id = ?")
		args = append(args, *f.VehicleID)
	}

	if len(filters) == 0 {
		return "", args
	}

	return "WHERE " + strings.Join(filters, " AND "), args
}

func copyArgs(args []interface{}) []interface{} {
	dup := make([]interface{}, len(args))
	copy(dup, args)
	return dup
}
