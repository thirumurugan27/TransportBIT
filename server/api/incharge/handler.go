package incharge

import (
	"database/sql"
	"log"
	"net/http"

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
	Get all drivers in the incharge's cluster for attendance marking

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

	// Get cluster ID for this incharge
	var clusterID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT cluster_id FROM drivers WHERE id = ? AND is_incharge = 1
	`, inchargeID).Scan(&clusterID)

	if err != nil {
		log.Printf("Get incharge cluster error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Incharge not found or is_incharge flag not set"})
		return
	}

	// If incharge has no cluster assigned, return all drivers for now
	// This allows the incharge to mark attendance even without cluster setup
	var rows *sql.Rows
	if !clusterID.Valid || clusterID.Int64 == 0 {
		log.Printf("Incharge %s has no cluster assigned, returning all drivers", inchargeID)
		rows, err = config.DB.Query(`
			SELECT 
				d.id as driver_id, 
				d.user_id,
				u.full_name,
				COALESCE(att.status, 'not_marked') as attendance_status,
				att.checkin_time,
				CASE WHEN lr.id IS NOT NULL THEN 1 ELSE 0 END as has_approved_leave
			FROM drivers d
			JOIN users u ON d.user_id = u.id
			LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = ` + date + `
			LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
				AND lr.status = 'admin_approved' 
				AND ` + date + ` BETWEEN lr.start_date AND lr.end_date
			WHERE u.role = 'DRIVER'
			ORDER BY u.full_name
		`)
	} else {
		// Get all drivers in the cluster with their attendance status
		rows, err = config.DB.Query(`
			SELECT 
				d.id as driver_id, 
				d.user_id,
				u.full_name,
				COALESCE(att.status, 'not_marked') as attendance_status,
				att.checkin_time,
				CASE WHEN lr.id IS NOT NULL THEN 1 ELSE 0 END as has_approved_leave
			FROM drivers d
			JOIN users u ON d.user_id = u.id
			LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = `+date+`
			LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
				AND lr.status = 'admin_approved' 
				AND `+date+` BETWEEN lr.start_date AND lr.end_date
			WHERE d.cluster_id = ?
			ORDER BY u.full_name
		`, clusterID.Int64)
	}

	if err != nil {
		log.Printf("Get cluster drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching drivers"})
		return
	}
	defer rows.Close()

	type ClusterDriver struct {
		DriverID         int     `json:"driver_id"`
		UserID           int     `json:"user_id"`
		FullName         string  `json:"full_name"`
		AttendanceStatus string  `json:"attendance_status"`
		CheckinTime      *string `json:"checkin_time"`
		HasApprovedLeave bool    `json:"has_approved_leave"`
	}

	var drivers []ClusterDriver
	for rows.Next() {
		var d ClusterDriver
		var hasLeave int
		rows.Scan(&d.DriverID, &d.UserID, &d.FullName, &d.AttendanceStatus, &d.CheckinTime, &hasLeave)
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
	Incharge marks attendance for a driver in their cluster

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

	// Check if incharge has a cluster assigned
	var clusterID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT cluster_id FROM drivers WHERE id = ? AND is_incharge = 1
	`, req.InchargeID).Scan(&clusterID)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Incharge not found or is_incharge flag not set"})
		return
	}

	// If incharge has no cluster, allow marking attendance for any driver
	if !clusterID.Valid || clusterID.Int64 == 0 {
		// Just verify the target user is a driver
		var count int
		err = config.DB.QueryRow(`
			SELECT COUNT(*) FROM drivers WHERE user_id = ?
		`, req.UserID).Scan(&count)
		if err != nil || count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Target user is not a driver"})
			return
		}
	} else {
		// Verify incharge has permission (driver is in their cluster)
		var count int
		err = config.DB.QueryRow(`
			SELECT COUNT(*) FROM drivers d1
			JOIN drivers d2 ON d1.cluster_id = d2.cluster_id
			WHERE d1.id = ? AND d1.is_incharge = 1 AND d2.user_id = ?
		`, req.InchargeID, req.UserID).Scan(&count)

		if err != nil || count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to mark attendance for this driver"})
			return
		}
	}

	// Upsert attendance
	_, err = config.DB.Exec(`
		INSERT INTO attendance (user_id, date, status, checkin_time)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time)
	`, req.UserID, req.Date, req.Status, req.CheckinTime)

	if err != nil {
		log.Printf("Mark attendance error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error marking attendance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Attendance marked successfully"})
}

/*
=========================

	GET /api/incharge/attendance/history
	Get attendance history for incharge's cluster

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

	// Get cluster ID for this incharge
	var clusterID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT cluster_id FROM drivers WHERE id = ? AND is_incharge = 1
	`, inchargeID).Scan(&clusterID)

	if err != nil {
		log.Printf("Get incharge cluster error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Incharge not found"})
		return
	}

	var rows *sql.Rows
	if !clusterID.Valid || clusterID.Int64 == 0 {
		// No cluster - show all driver attendance
		rows, err = config.DB.Query(`
			SELECT 
				a.id,
				a.user_id,
				u.full_name as driver_name,
				DATE_FORMAT(a.date, '%Y-%m-%d') as date,
				a.status,
				a.checkin_time,
				a.checkout_time
			FROM attendance a
			JOIN users u ON a.user_id = u.id
			JOIN drivers d ON d.user_id = u.id
			WHERE a.date BETWEEN ` + startDate + ` AND ` + endDate + statusCondition + `
			ORDER BY a.date DESC, u.full_name ASC
		`)
	} else {
		// Show attendance for drivers in the cluster
		rows, err = config.DB.Query(`
			SELECT 
				a.id,
				a.user_id,
				u.full_name as driver_name,
				DATE_FORMAT(a.date, '%Y-%m-%d') as date,
				a.status,
				a.checkin_time,
				a.checkout_time
			FROM attendance a
			JOIN users u ON a.user_id = u.id
			JOIN drivers d ON d.user_id = u.id
			WHERE d.cluster_id = ?
			AND a.date BETWEEN `+startDate+` AND `+endDate+statusCondition+`
			ORDER BY a.date DESC, u.full_name ASC
		`, clusterID.Int64)
	}

	if err != nil {
		log.Printf("Get attendance history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching attendance history"})
		return
	}
	defer rows.Close()

	type AttendanceRecord struct {
		ID           int     `json:"id"`
		UserID       int     `json:"user_id"`
		DriverName   string  `json:"driver_name"`
		Date         string  `json:"date"`
		Status       string  `json:"status"`
		CheckinTime  *string `json:"checkin_time"`
		CheckoutTime *string `json:"checkout_time"`
	}

	var records []AttendanceRecord
	for rows.Next() {
		var r AttendanceRecord
		rows.Scan(&r.ID, &r.UserID, &r.DriverName, &r.Date, &r.Status, &r.CheckinTime, &r.CheckoutTime)
		records = append(records, r)
	}

	c.JSON(http.StatusOK, records)
}
