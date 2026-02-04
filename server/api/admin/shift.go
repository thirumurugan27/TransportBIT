package admin

import (
	"log"
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
		SELECT id, name, start_time, end_time, COALESCE(description,''), created_by
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

		// load slots for this shift (if any)
		slotRows, _ := config.DB.Query(`SELECT id, shift_id, start_time, end_time, slot_order, created_by FROM shift_slots WHERE shift_id=? ORDER BY slot_order ASC`, s.ID)
		var slots []models.ShiftSlot
		for slotRows.Next() {
			var sl models.ShiftSlot
			slotRows.Scan(&sl.ID, &sl.ShiftID, &sl.StartTime, &sl.EndTime, &sl.SlotOrder, &sl.CreatedBy)
			slots = append(slots, sl)
		}
		slotRows.Close()

		// if slots exist, override shift start/end with first slot for compatibility
		if len(slots) > 0 {
			s.StartTime = slots[0].StartTime
			s.EndTime = slots[0].EndTime
		}

		// attach slots to the shift model
		s.Slots = slots

		shifts = append(shifts, s)
	}

	c.JSON(http.StatusOK, shifts)
}

// POST /api/admin/shifts/create
func CreateShift(c *gin.Context) {
	var req models.CreateShiftWithSlotsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	createdBy := getUserIDFromRequest(c)

	// 1. Create the Shift
	// Use the first slot as the shift's main time, or default
	startTime := "08:00:00"
	endTime := "17:00:00"
	if len(req.Slots) > 0 {
		startTime = req.Slots[0].StartTime
		endTime = req.Slots[0].EndTime
	}

	res, err := config.DB.Exec(`
		INSERT INTO shifts (name, start_time, end_time, description, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, req.Name, startTime, endTime, req.Description, createdBy)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	shiftID, _ := res.LastInsertId()

	// 2. Insert Slots
	for i, slot := range req.Slots {
		_, err := config.DB.Exec(`
			INSERT INTO shift_slots (shift_id, start_time, end_time, slot_order, created_by)
			VALUES (?, ?, ?, ?, ?)
		`, shiftID, slot.StartTime, slot.EndTime, i+1, createdBy)
		
		if err != nil {
			// In production, handle error
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Shift and slots created successfully"})
}

// POST /api/admin/shifts/update
func UpdateShift(c *gin.Context) {
	var req models.CreateShiftWithSlotsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Use first slot time as main shift time, or fallback to provided values
	startTime := req.StartTime
	endTime := req.EndTime
	if len(req.Slots) > 0 {
		startTime = req.Slots[0].StartTime
		endTime = req.Slots[0].EndTime
	}

	// Update main shift record
	_, err := config.DB.Exec(`
		UPDATE shifts SET name=?, start_time=?, end_time=?, description=?
		WHERE id=?
	`, req.Name, startTime, endTime, req.Description, req.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete existing slots
	_, err = config.DB.Exec(`DELETE FROM shift_slots WHERE shift_id=?`, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update slots: " + err.Error()})
		return
	}

	// Re-insert updated slots
	createdBy := getUserIDFromRequest(c)
	for i, slot := range req.Slots {
		_, err := config.DB.Exec(`
			INSERT INTO shift_slots (shift_id, start_time, end_time, slot_order, created_by)
			VALUES (?, ?, ?, ?, ?)
		`, req.ID, slot.StartTime, slot.EndTime, i+1, createdBy)
		
		if err != nil {
			// Log error but continue
			log.Printf("Error inserting slot: %v", err)
		}
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
