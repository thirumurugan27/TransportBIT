package admin

import (
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   ATTENDANCE HANDLERS
========================= */

// GET /api/admin/attendance?date=YYYY-MM-DD&status=present|absent|on_leave|not_marked
// Returns ALL drivers with their attendance status for the given date
func GetAttendance(c *gin.Context) {
	date := c.Query("date")
	status := c.Query("status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// If date range is provided and it's the SAME day, treat as single date query
	// to show ALL drivers with their status
	if startDate != "" && endDate != "" {
		if startDate == endDate {
			// Same day - show all drivers with status
			getSingleDayAttendance(c, startDate, status)
			return
		}
		// Different days - show historical records
		getAttendanceRange(c, startDate, endDate, status)
		return
	}

	// For single date queries, return ALL drivers with their status
	if date == "" {
		date = "CURDATE()"
	} else {
		date = "'" + date + "'"
	}

	getSingleDayAttendanceByDate(c, date, status)
}

// getSingleDayAttendance shows ALL drivers with their status for a specific date string
func getSingleDayAttendance(c *gin.Context, dateStr, status string) {
	getSingleDayAttendanceByDate(c, "'"+dateStr+"'", status)
}

// getSingleDayAttendanceByDate shows ALL drivers with status for a date (can be CURDATE() or 'YYYY-MM-DD')
func getSingleDayAttendanceByDate(c *gin.Context, date, status string) {
	// Query all drivers and LEFT JOIN with attendance for the specific date
	// Also check for approved leaves
	query := `
		SELECT 
			COALESCE(a.id, 0) as id,
			u.id as user_id,
			DATE_FORMAT(` + date + `, '%d-%m-%Y') as date,
			CASE 
				WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved' 
					AND ` + date + ` BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
				WHEN a.status IS NOT NULL THEN a.status
				ELSE 'not_marked'
			END as status,
			a.checkin_time,
			a.checkout_time,
			u.full_name,
			a.marked_by_incharge_id,
			COALESCE(incharge_u.full_name, '') as marked_by_incharge_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ` + date + `
		LEFT JOIN users incharge_u ON a.marked_by_incharge_id = incharge_u.id
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
			AND lr.status = 'admin_approved'
			AND ` + date + ` BETWEEN lr.start_date AND lr.end_date
		WHERE d.is_incharge = 0
		ORDER BY u.full_name
	`

	rows, err := config.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Attendance
	for rows.Next() {
		var a models.Attendance
		rows.Scan(&a.ID, &a.UserID, &a.Date, &a.Status, &a.CheckinTime, &a.CheckoutTime, &a.FullName, &a.MarkedByInchargeID, &a.MarkedByInchargeName)
		list = append(list, a)
	}

	// Filter by status if provided
	if status != "" && status != "all" {
		var filtered []models.Attendance
		for _, a := range list {
			if a.Status == status {
				filtered = append(filtered, a)
			}
		}
		c.JSON(http.StatusOK, filtered)
		return
	}

	c.JSON(http.StatusOK, list)
}

// getAttendanceRange returns attendance records for a date range (historical view)
func getAttendanceRange(c *gin.Context, startDate, endDate, status string) {
	dateCondition := "a.date BETWEEN '" + startDate + "' AND '" + endDate + "'"

	// Build status condition
	statusCondition := ""
	if status != "" && status != "all" {
		statusCondition = " AND a.status = '" + status + "'"
	}

	query := `
		SELECT a.id, a.user_id, DATE_FORMAT(a.date, '%d-%m-%Y') as date, a.status, a.checkin_time, a.checkout_time, u.full_name,
			a.marked_by_incharge_id, COALESCE(incharge_u.full_name, '') as marked_by_incharge_name
		FROM attendance a
		JOIN users u ON a.user_id = u.id
		JOIN drivers d ON d.user_id = u.id AND d.is_incharge = 0
		LEFT JOIN users incharge_u ON a.marked_by_incharge_id = incharge_u.id
		WHERE ` + dateCondition + statusCondition + `
		ORDER BY a.date DESC, a.id DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Attendance
	for rows.Next() {
		var a models.Attendance
		rows.Scan(&a.ID, &a.UserID, &a.Date, &a.Status, &a.CheckinTime, &a.CheckoutTime, &a.FullName, &a.MarkedByInchargeID, &a.MarkedByInchargeName)
		list = append(list, a)
	}

	c.JSON(http.StatusOK, list)
}

// POST /api/admin/attendance/mark
func MarkAttendance(c *gin.Context) {
	var req models.MarkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Upsert attendance
	var checkinTime interface{}
	if req.CheckinTime != nil && *req.CheckinTime != "" {
		checkinTime = *req.CheckinTime
	}

	_, err := config.DB.Exec(`
		INSERT INTO attendance (user_id, date, status, checkin_time)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time)
	`, req.UserID, req.Date, req.Status, checkinTime)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also update users.status for quick lookup
	userStatus := req.Status
	config.DB.Exec("UPDATE users SET status=? WHERE id=?", userStatus, req.UserID)

	c.JSON(http.StatusOK, gin.H{"message": "Attendance marked"})
}
