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

	config.DB.QueryRow("SELECT COUNT(*) FROM drivers").Scan(&stats.TotalDrivers)
	config.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role='DRIVER' AND status='present'").Scan(&stats.PresentDrivers)
	stats.AbsentDrivers = stats.TotalDrivers - stats.PresentDrivers
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicles").Scan(&stats.TotalVehicles)
	config.DB.QueryRow("SELECT COUNT(*) FROM duties WHERE status IN ('planned','ongoing')").Scan(&stats.ActiveDuties)
	
	// Pending leaves
	config.DB.QueryRow("SELECT COUNT(*) FROM leave_requests WHERE status='pending'").Scan(&stats.PendingLeaves)

	c.JSON(http.StatusOK, stats)
}
