package admin

import (
	"log"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/*
=========================

	GET /api/admin/temporary-assignments
	Get all temporary assignments

=========================
*/
func GetTemporaryAssignments(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT ta.id, ta.original_driver_id, ta.replacement_driver_id,
		       ta.shift_id, ta.vehicle_id,
		       DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
		       ta.reason, ta.status,
		       DATE_FORMAT(ta.created_at, '%d-%m-%Y %H:%i') as created_at,
		       u_orig.full_name as original_driver_name,
		       COALESCE(u_repl.full_name, 'Not Assigned') as replacement_driver_name,
		       COALESCE(s.name, 'EV Cluster') as shift_name,
		       COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '') as start_time,
		       COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '') as end_time,
		       v.vehicle_number, v.vehicle_type, COALESCE(v.vehicle_name, '') as vehicle_name
		FROM temporary_assignments ta
		JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
		JOIN users u_orig ON d_orig.user_id = u_orig.id
		LEFT JOIN drivers d_repl ON ta.replacement_driver_id = d_repl.id
		LEFT JOIN users u_repl ON d_repl.user_id = u_repl.id
		LEFT JOIN shifts s ON ta.shift_id = s.id
		JOIN vehicles v ON ta.vehicle_id = v.id
		WHERE (CURDATE() BETWEEN ta.start_date AND ta.end_date
		   OR ta.start_date >= CURDATE())
		AND ta.status = 'active'
		ORDER BY ta.start_date DESC, ta.id DESC
	`)
	if err != nil {
		log.Printf("Get temporary assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.TemporaryAssignment
	for rows.Next() {
		var ta models.TemporaryAssignment
		err := rows.Scan(&ta.ID, &ta.OriginalDriverID, &ta.ReplacementDriverID,
			&ta.ShiftID, &ta.VehicleID, &ta.StartDate, &ta.EndDate,
			&ta.Reason, &ta.Status, &ta.CreatedAt,
			&ta.OriginalDriverName, &ta.ReplacementDriverName,
			&ta.ShiftName, &ta.StartTime, &ta.EndTime,
			&ta.VehicleNumber, &ta.VehicleType, &ta.VehicleName)
		if err != nil {
			log.Printf("Scan error for temporary assignment: %v", err)
			continue
		}
		
		// Fetch shift slots if shift_id is available
		if ta.ShiftID != nil && *ta.ShiftID > 0 {
			slotRows, slotErr := config.DB.Query(`
				SELECT TIME_FORMAT(start_time, '%H:%i'), TIME_FORMAT(end_time, '%H:%i')
				FROM shift_slots
				WHERE shift_id = ?
				ORDER BY slot_order ASC
			`, *ta.ShiftID)
			if slotErr == nil {
				for slotRows.Next() {
					var slot models.ShiftSlot
					if err := slotRows.Scan(&slot.StartTime, &slot.EndTime); err == nil {
						ta.Slots = append(ta.Slots, slot)
					}
				}
				slotRows.Close()
			}
		}
		
		log.Printf("Found temporary assignment: ID=%d, ShiftID=%v, VehicleID=%d", ta.ID, ta.ShiftID, ta.VehicleID)
		list = append(list, ta)
	}

	log.Printf("Returning %d temporary assignments", len(list))
	c.JSON(http.StatusOK, list)
}

/*
=========================

	POST /api/admin/temporary-assignments/create
	Create a new temporary assignment

=========================
*/
func CreateTemporaryAssignment(c *gin.Context) {
	// Either bind JSON directly or use context if called internally
	var req models.CreateTemporaryAssignmentRequest
	if val, exists := c.Get("tempReq"); exists {
		req = val.(models.CreateTemporaryAssignmentRequest)
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
	}

	// Prefer creator from auth token/cookie; fall back to request body if provided.
	createdBy := getUserIDFromRequest(c)
	if createdBy == nil && req.CreatedBy != nil {
		createdBy = req.CreatedBy
	}

	// Validate required fields
	if req.OriginalDriverID == 0 || req.ReplacementDriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both original and replacement drivers are required"})
		return
	}

	if req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start date and end date are required"})
		return
	}

	// Check if replacement driver is already assigned during this period
	var count int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM assignments 
		WHERE driver_id = ? 
		AND (
			(start_date <= ? AND end_date >= ?) OR
			(start_date <= ? AND end_date >= ?) OR
			(start_date >= ? AND end_date <= ?)
		)
	`, req.ReplacementDriverID, req.StartDate, req.StartDate,
		req.EndDate, req.EndDate, req.StartDate, req.EndDate).Scan(&count)

	if err != nil {
		log.Printf("Check assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking driver availability"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Replacement driver already has regular assignment during this period"})
		return
	}

	// Check for overlapping temporary assignments
	err = config.DB.QueryRow(`
		SELECT COUNT(*) FROM temporary_assignments 
		WHERE replacement_driver_id = ? 
		AND status = 'active'
		AND (
			(start_date <= ? AND end_date >= ?) OR
			(start_date <= ? AND end_date >= ?) OR
			(start_date >= ? AND end_date <= ?)
		)
	`, req.ReplacementDriverID, req.StartDate, req.StartDate,
		req.EndDate, req.EndDate, req.StartDate, req.EndDate).Scan(&count)

	if err != nil {
		log.Printf("Check temp assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking temporary assignments"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Replacement driver already has temporary assignment during this period"})
		return
	}

	// Insert into temporary_assignments
	var shiftID interface{}
	if req.ShiftID != nil && *req.ShiftID > 0 {
		shiftID = *req.ShiftID
	} else {
		shiftID = nil
	}
	result, err := config.DB.Exec(`
		INSERT INTO temporary_assignments (
			original_driver_id, replacement_driver_id, shift_id, vehicle_id,
			start_date, end_date, reason, status, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
	`, req.OriginalDriverID, req.ReplacementDriverID, shiftID, req.VehicleID,
		req.StartDate, req.EndDate, req.Reason, createdBy)

	if err != nil {
		log.Printf("Create temporary assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Temporary assignment created successfully",
		"id":      id,
	})
}

/*
=========================

	DELETE /api/admin/temporary-assignments/:id
	Cancel a temporary assignment

=========================
*/
func CancelTemporaryAssignment(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE temporary_assignments SET status='cancelled' WHERE id=?
	`, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Temporary assignment cancelled"})
}
