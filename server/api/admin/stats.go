package admin

import (
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   DASHBOARD STATS
========================= */

// GET /api/admin/dashboard/stats
func GetDashboardStats(c *gin.Context) {
	var stats models.DashboardStats

	// Count all drivers from drivers table joined with users
	config.DB.QueryRow("SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.id").Scan(&stats.TotalDrivers)

	// Count present drivers from TODAY's attendance records
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM attendance a 
		JOIN drivers d ON a.user_id = d.user_id 
		WHERE a.date = CURDATE() AND a.status = 'present'
	`).Scan(&stats.PresentDrivers)

	// Count absent drivers from TODAY's attendance records
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM attendance a 
		JOIN drivers d ON a.user_id = d.user_id 
		WHERE a.date = CURDATE() AND a.status = 'absent'
	`).Scan(&stats.AbsentDrivers)

	// Also count drivers on approved leave for today
	var onLeaveCount int
	config.DB.QueryRow(`
		SELECT COUNT(DISTINCT d.id) FROM drivers d
		JOIN leave_requests lr ON d.id = lr.driver_id
		WHERE lr.status = 'admin_approved' 
		AND CURDATE() BETWEEN lr.start_date AND lr.end_date
	`).Scan(&onLeaveCount)

	// Add on_leave count to absent for the alert
	stats.AbsentDrivers += onLeaveCount

	config.DB.QueryRow("SELECT COUNT(*) FROM vehicles").Scan(&stats.TotalVehicles)
	config.DB.QueryRow("SELECT COUNT(*) FROM duties WHERE status IN ('planned','ongoing')").Scan(&stats.ActiveDuties)

	// Pending leaves
	config.DB.QueryRow("SELECT COUNT(*) FROM leave_requests WHERE status='pending'").Scan(&stats.PendingLeaves)

	c.JSON(http.StatusOK, stats)
}
