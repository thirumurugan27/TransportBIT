package admin

import (
	"net/http"
	"transport-server/config"
	"transport-server/models"
	"github.com/gin-gonic/gin"
)
/* =========================
   DUTY HANDLERS
========================= */
// GET /api/admin/duties
func GetAllDuties(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT d.id, d.assignment_id, COALESCE(d.route_from,''), COALESCE(d.route_to,''),
		       d.start_time, d.end_time, d.status, d.approved_by, d.approved_at
		FROM duties d
		ORDER BY d.id DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Duty
	for rows.Next() {
		var d models.Duty
		rows.Scan(&d.ID, &d.AssignmentID, &d.RouteFrom, &d.RouteTo,
			&d.StartTime, &d.EndTime, &d.Status, &d.ApprovedBy, &d.ApprovedAt)
		list = append(list, d)
	}

	c.JSON(http.StatusOK, list)
}

// POST /api/admin/duties/create
func CreateDuty(c *gin.Context) {
	var req models.CreateDutyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`
		INSERT INTO duties (assignment_id, route_from, route_to, start_time, end_time)
		VALUES (?, ?, ?, ?, ?)
	`, req.AssignmentID, req.RouteFrom, req.RouteTo, req.StartTime, req.EndTime)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Duty created successfully"})
}

// POST /api/admin/duties/approve
func ApproveDuty(c *gin.Context) {
	var req struct {
		DutyID     int    `json:"duty_id"`
		ApprovedBy int    `json:"approved_by"`
		Action     string `json:"action"` // approve or reject
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	status := "completed"
	if req.Action == "reject" {
		status = "cancelled"
	}

	_, err := config.DB.Exec(`
		UPDATE duties SET status=?, approved_by=?, approved_at=NOW()
		WHERE id=?
	`, status, req.ApprovedBy, req.DutyID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Duty status updated"})
}
