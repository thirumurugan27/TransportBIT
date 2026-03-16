package admin

import (
	"net/http"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

func getUserIDFromRequest(c *gin.Context) *int {
	// Try header first
	tokenStr := c.GetHeader("Authorization")
	if tokenStr == "" {
		// Try cookie
		var err error
		tokenStr, err = c.Cookie("TRANSPORT_AUTH")
		if err != nil {
			return nil
		}
	} else if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}

	claims, err := utils.ParseJWT(tokenStr)
	if err != nil || claims == nil {
		return nil
	}

	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return nil
	}
	userID := int(userIDFloat)
	return &userID
}

/* =========================
   SHIFT HANDLERS
========================= */

// GET /api/admin/shifts
func GetAllShifts(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, name,
		       TIME_FORMAT(start_time, '%h:%i %p') AS start_time,
		       TIME_FORMAT(end_time, '%h:%i %p') AS end_time,
		       COALESCE(description,''), created_by
		FROM shifts ORDER BY id DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var shifts []models.Shift
	for rows.Next() {
		var s models.Shift
		rows.Scan(&s.ID, &s.Name, &s.StartTime, &s.EndTime, &s.Description, &s.CreatedBy)
		shifts = append(shifts, s)
	}

	c.JSON(http.StatusOK, shifts)
}

// POST /api/admin/shifts/create
func CreateShift(c *gin.Context) {
	var req models.CreateShiftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	createdBy := getUserIDFromRequest(c)

	_, err := config.DB.Exec(`
		INSERT INTO shifts (name, start_time, end_time, description, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, req.Name, req.StartTime, req.EndTime, req.Description, createdBy)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Shift created successfully"})
}

// POST /api/admin/shifts/update
func UpdateShift(c *gin.Context) {
	var req models.CreateShiftWithSlotsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE shifts SET name=?, start_time=?, end_time=?, description=?
		WHERE id=?
	`, req.Name, req.StartTime, req.EndTime, req.Description, req.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Shift updated successfully"})
}

// DELETE /api/admin/shifts/delete?id=X
func DeleteShift(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec("DELETE FROM shifts WHERE id=?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Shift deleted successfully"})
}
