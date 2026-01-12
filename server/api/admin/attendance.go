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

// GET /api/admin/attendance?date=YYYY-MM-DD&status=present|absent
func GetAttendance(c *gin.Context) {
	date := c.Query("date")
	status := c.Query("status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// Build date condition
	var dateCondition string
	if startDate != "" && endDate != "" {
		dateCondition = "a.date BETWEEN '" + startDate + "' AND '" + endDate + "'"
	} else if date == "" {
		dateCondition = "a.date = CURDATE()"
	} else {
		dateCondition = "a.date = '" + date + "'"
	}

	// Build status condition
	statusCondition := ""
	if status != "" && (status == "present" || status == "absent") {
		statusCondition = " AND a.status = '" + status + "'"
	}

	query := `
		SELECT a.id, a.user_id, DATE_FORMAT(a.date, '%Y-%m-%d') as date, a.status, a.checkin_time, a.checkout_time, u.full_name
		FROM attendance a
		JOIN users u ON a.user_id = u.id
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
		rows.Scan(&a.ID, &a.UserID, &a.Date, &a.Status, &a.CheckinTime, &a.CheckoutTime, &a.FullName)
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
	_, err := config.DB.Exec(`
		INSERT INTO attendance (user_id, date, status, checkin_time)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time)
	`, req.UserID, req.Date, req.Status, req.CheckinTime)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also update users.status for quick lookup
	userStatus := req.Status
	config.DB.Exec("UPDATE users SET status=? WHERE id=?", userStatus, req.UserID)

	c.JSON(http.StatusOK, gin.H{"message": "Attendance marked"})
}
