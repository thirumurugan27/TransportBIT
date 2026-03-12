package admin

import (
	"net/http"
	"time"

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
			a.marked_by,
			u.full_name,
			COALESCE(marker.full_name, '') as marked_by_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ` + date + `
		LEFT JOIN users marker ON a.marked_by = marker.id
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
			AND lr.status = 'admin_approved'
			AND ` + date + ` BETWEEN lr.start_date AND lr.end_date
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
		rows.Scan(&a.ID, &a.UserID, &a.Date, &a.Status, &a.CheckinTime, &a.CheckoutTime, &a.MarkedBy, &a.FullName, &a.MarkedByName)
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

// getAttendanceRange returns attendance records for a date range.
// Uses a date_range CTE + CROSS JOIN drivers so that drivers with no
// attendance record on a given day appear as 'not_marked'.
func getAttendanceRange(c *gin.Context, startDate, endDate, status string) {
	query := `
		WITH RECURSIVE date_range AS (
			SELECT ? AS d
			UNION ALL
			SELECT d + INTERVAL 1 DAY FROM date_range WHERE d < ?
		)
		SELECT
			COALESCE(a.id, 0) as id,
			u.id as user_id,
			DATE_FORMAT(dr.d, '%d-%m-%Y') as date,
			CASE
				WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved'
					AND dr.d BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
				WHEN a.status IS NOT NULL THEN a.status
				ELSE 'not_marked'
			END as status,
			a.checkin_time,
			a.checkout_time,
			a.marked_by,
			u.full_name,
			COALESCE(marker.full_name, '') as marked_by_name
		FROM date_range dr
		CROSS JOIN drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = dr.d
		LEFT JOIN users marker ON a.marked_by = marker.id
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id
			AND lr.status = 'admin_approved'
			AND dr.d BETWEEN lr.start_date AND lr.end_date
		ORDER BY dr.d DESC, u.full_name
	`
	rows, err := config.DB.Query(query, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Attendance
	for rows.Next() {
		var a models.Attendance
		rows.Scan(&a.ID, &a.UserID, &a.Date, &a.Status, &a.CheckinTime, &a.CheckoutTime, &a.MarkedBy, &a.FullName, &a.MarkedByName)
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

// POST /api/admin/attendance/mark
func MarkAttendance(c *gin.Context) {
	var req models.MarkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.UserID == 0 || req.Date == "" || req.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id, date and status are required"})
		return
	}

	// Get the admin who is marking the attendance
	markedBy := getUserIDFromRequest(c)

	if err := upsertAttendanceRecord(req.UserID, req.Date, req.Status, req.CheckinTime, markedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Attendance marked"})
}

// POST /api/admin/attendance/mark-bulk
func MarkAttendanceBulk(c *gin.Context) {
	var req models.BulkMarkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date is required"})
		return
	}
	if len(req.Updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "updates cannot be empty"})
		return
	}

	markedBy := getUserIDFromRequest(c)

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, item := range req.Updates {
		if item.UserID == 0 || item.Status == "" {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "each update must include user_id and status"})
			return
		}

		status := item.Status
		if status != "present" && status != "absent" && status != "on_leave" && status != "not_marked" {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status in updates"})
			return
		}

		var checkinTime interface{}
		if item.CheckinTime != nil && *item.CheckinTime != "" {
			checkinTime = *item.CheckinTime
		} else if status == "present" {
			now := time.Now().Format("2006-01-02 15:04:05")
			checkinTime = now
		}

		_, err = tx.Exec(`
			INSERT INTO attendance (user_id, date, status, checkin_time, marked_by)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time), marked_by=VALUES(marked_by)
		`, item.UserID, req.Date, status, checkinTime, markedBy)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		_, err = tx.Exec("UPDATE users SET status=? WHERE id=?", status, item.UserID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Attendance updates saved", "updated_count": len(req.Updates)})
}

func upsertAttendanceRecord(userID int, date, status string, checkinTimePtr *string, markedBy *int) error {
	var checkinTime interface{}
	if checkinTimePtr != nil && *checkinTimePtr != "" {
		checkinTime = *checkinTimePtr
	}

	_, err := config.DB.Exec(`
		INSERT INTO attendance (user_id, date, status, checkin_time, marked_by)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time), marked_by=VALUES(marked_by)
	`, userID, date, status, checkinTime, markedBy)
	if err != nil {
		return err
	}

	_, err = config.DB.Exec("UPDATE users SET status=? WHERE id=?", status, userID)
	return err
}
