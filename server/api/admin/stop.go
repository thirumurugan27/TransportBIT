package admin

import (
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   STOP HANDLERS
========================= */

// GET /api/admin/stops
func GetAllStops(c *gin.Context) {
	rows, err := config.DB.Query(`SELECT id, stop_name, COALESCE(location,'') FROM stops ORDER BY id DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		rows.Scan(&s.ID, &s.StopName, &s.Location)
		stops = append(stops, s)
	}

	c.JSON(http.StatusOK, stops)
}

// POST /api/admin/stops/create
func CreateStop(c *gin.Context) {
	var req models.CreateStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`INSERT INTO stops (stop_name, location) VALUES (?, ?)`, req.StopName, req.Location)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stop created successfully"})
}

// DELETE /api/admin/stops/delete?id=X
func DeleteStop(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec("DELETE FROM stops WHERE id=?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stop deleted successfully"})
}
