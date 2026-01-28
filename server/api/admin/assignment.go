package admin

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   ASSIGNMENT HANDLERS
========================= */

// GET /api/admin/assignments
func GetAllAssignments(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT a.id, a.shift_id, a.vehicle_id, a.driver_id, 
		       DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
		       DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
		       DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
		       a.status,
		       a.is_temporary_replacement,
		       a.original_driver_id,
		       s.name AS shift_name, 
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time, 
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       v.vehicle_number, v.vehicle_type,
		       u.full_name AS driver_name,
		       COALESCE(u_orig.full_name, '') as original_driver_name,
		       CASE 
		           WHEN a.start_date > CURDATE() THEN 'scheduled'
		           WHEN EXISTS(SELECT 1 FROM leave_requests lr 
		                       WHERE lr.driver_id = a.driver_id 
		                       AND lr.status = 'admin_approved'
		                       AND CURDATE() BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
		           WHEN att.status = 'present' THEN 'present'
		           WHEN att.status = 'absent' THEN 'absent'
		           ELSE 'not_marked'
		       END AS driver_status
		FROM assignments a
		JOIN shifts s ON a.shift_id = s.id
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
		ORDER BY a.start_date DESC, a.id DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.Assignment
	for rows.Next() {
		var a models.Assignment
		var isTemp int
		var originalDriverID sql.NullInt64
		err := rows.Scan(&a.ID, &a.ShiftID, &a.VehicleID, &a.DriverID,
			&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
			&isTemp, &originalDriverID,
			&a.ShiftName, &a.StartTime, &a.EndTime,
			&a.VehicleNumber, &a.VehicleType,
			&a.DriverName, &a.OriginalDriverName, &a.DriverStatus)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		a.IsTemporaryReplacement = isTemp == 1
		if originalDriverID.Valid {
			id := int(originalDriverID.Int64)
			a.OriginalDriverID = &id
		}
		log.Printf("Assignment %d: start_date=%s, end_date=%s", a.ID, a.StartDate, a.EndDate)
		list = append(list, a)
	}

	// Get Temporary Assignments and append to list
	tempRows, err := config.DB.Query(`
		SELECT ta.id, ta.shift_id, ta.vehicle_id, ta.replacement_driver_id, 
		       DATE_FORMAT(ta.start_date, '%Y-%m-%d') as assigned_date,
		       DATE_FORMAT(ta.start_date, '%Y-%m-%d') as start_date,
		       DATE_FORMAT(ta.end_date, '%Y-%m-%d') as end_date,
		       ta.status,
		       ta.original_driver_id,
		       s.name AS shift_name, 
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time, 
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       v.vehicle_number, v.vehicle_type,
		       u.full_name AS driver_name,
		       COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		JOIN shifts s ON ta.shift_id = s.id
		JOIN vehicles v ON ta.vehicle_id = v.id
		JOIN drivers d ON ta.replacement_driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		WHERE ta.status = 'active'
		ORDER BY ta.start_date DESC, ta.id DESC
	`)

	if err == nil {
		defer tempRows.Close()
		for tempRows.Next() {
			var a models.Assignment
			var originalDriverID sql.NullInt64

			// Temporary assignment doesn't calculate driver_status the same way, assume 'assigned' or 'active' matches
			// We can default driver_status to 'active' for temporary
			a.DriverStatus = "active"
			a.IsTemporaryReplacement = true

			err := tempRows.Scan(&a.ID, &a.ShiftID, &a.VehicleID, &a.DriverID,
				&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
				&originalDriverID,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.VehicleNumber, &a.VehicleType,
				&a.DriverName, &a.OriginalDriverName)

			if err != nil {
				log.Printf("Scan error temp assignment: %v", err)
				continue
			}

			if originalDriverID.Valid {
				id := int(originalDriverID.Int64)
				a.OriginalDriverID = &id
			}
			list = append(list, a)
		}
	}

	c.JSON(http.StatusOK, list)
}

// POST /api/admin/assignments/create
func CreateAssignment(c *gin.Context) {
	var req models.CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// If this is a temporary assignment, redirect to temporary assignments handler
	if req.IsTemporaryReplacement && req.OriginalDriverID != nil {
		tempReq := models.CreateTemporaryAssignmentRequest{
			OriginalDriverID:    *req.OriginalDriverID,
			ReplacementDriverID: req.DriverID,
			ShiftID:             req.ShiftID,
			VehicleID:           req.VehicleID,
			StartDate:           req.StartDate,
			EndDate:             req.EndDate,
			Reason:              "Temporary replacement",
		}

		c.Set("tempReq", tempReq)
		CreateTemporaryAssignment(c)
		return
	}

	// Validate date range for regular assignment
	if req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start date and end date are required"})
		return
	}

	// Vehicle must be selected and exist
	if req.VehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle is required"})
		return
	}

	var vehicleType string
	if err := config.DB.QueryRow(`SELECT vehicle_type FROM vehicles WHERE id = ?`, req.VehicleID).Scan(&vehicleType); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vehicle"})
			return
		}
		log.Printf("Vehicle lookup error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate vehicle"})
		return
	}

	// Default to BUS if not specified
	category := req.VehicleCategory
	if category == "" {
		category = vehicleType
	}

	// Shared error variable for this handler
	var err error

	// Coarse date-range guard: block if driver already has any assignment on overlapping dates (assignments, temporary, EV)
	var coarseCount int
	_ = config.DB.QueryRow(`
		SELECT (
			SELECT COUNT(*) FROM assignments a
			WHERE a.driver_id = ?
			AND a.status IN ('assigned','active')
			AND a.start_date <= ? AND a.end_date >= ?
		) + (
			SELECT COUNT(*) FROM temporary_assignments ta
			WHERE ta.replacement_driver_id = ?
			AND ta.start_date <= ? AND ta.end_date >= ?
		) + (
			SELECT COUNT(*) FROM ev_assignments ev
			JOIN driver_clusters dc ON ev.cluster_id = dc.id
			JOIN drivers d ON d.cluster_id = dc.id
			WHERE d.id = ?
			AND ev.status IN ('active')
			AND ev.start_date <= ? AND ev.end_date >= ?
		)
	`, req.DriverID, req.EndDate, req.StartDate,
		req.DriverID, req.EndDate, req.StartDate,
		req.DriverID, req.EndDate, req.StartDate).
		Scan(&coarseCount)

	hasConflict := false
	if coarseCount > 0 {
		hasConflict = true
	}

	// Time-conflict validation using shift times (including multi-slot shifts)
	// Gather the time ranges to validate for the selected shift
	type timeRange struct{ start, end string }
	var ranges []timeRange

	// Try slots first (multi-slot shifts)
	slotRows, slotErr := config.DB.Query(`SELECT start_time, end_time FROM shift_slots WHERE shift_id = ?`, req.ShiftID)
	if slotErr == nil {
		defer slotRows.Close()
		for slotRows.Next() {
			var s, e sql.NullString
			slotRows.Scan(&s, &e)
			if s.Valid && e.Valid {
				ranges = append(ranges, timeRange{start: s.String, end: e.String})
			}
		}
	}
	// If no slots, fall back to the main shift times
	if len(ranges) == 0 {
		var s, e sql.NullString
		_ = config.DB.QueryRow(`SELECT start_time, end_time FROM shifts WHERE id = ?`, req.ShiftID).Scan(&s, &e)
		if s.Valid && e.Valid {
			ranges = append(ranges, timeRange{start: s.String, end: e.String})
		}
	}

	// Check for time conflicts across every day in the selected date range
	start, _ := time.Parse("2006-01-02", req.StartDate)
	end, _ := time.Parse("2006-01-02", req.EndDate)
	if end.Before(start) {
		end = start
	}
	for d := start; !d.After(end); d = d.Add(24 * time.Hour) {
		checkDate := d.Format("2006-01-02")
		for _, r := range ranges {
			hc, err := CheckDriverTimeConflict(req.DriverID, r.start, r.end, checkDate)
			if err != nil {
				log.Printf("Error during time conflict check: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking time conflict"})
				return
			}
			if hc {
				hasConflict = true
				break
			}
		}
		if hasConflict {
			break
		}
	}

	if hasConflict && !req.ForceAssign {
		// Build conflict details for UI notification
		checkRanges := make([]struct{ start, end string }, len(ranges))
		for i, r := range ranges {
			checkRanges[i] = struct{ start, end string }{start: r.start, end: r.end}
		}
		conflicts, _ := getDriverConflictsDetails(req.DriverID, req.StartDate, checkRanges)
		c.JSON(http.StatusConflict, gin.H{
			"error":     "time_conflict",
			"message":   "Driver is already assigned during this time range",
			"conflicts": conflicts,
		})
		return
	}

	// Create regular assignment
	_, err = config.DB.Exec(`
		INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, vehicle_category, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned')
	`, req.ShiftID, req.VehicleID, req.DriverID, req.StartDate, req.StartDate, req.EndDate, category)

	if err != nil {
		log.Printf("Create assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assignment created successfully"})
}

// POST /api/admin/assignments/update
func UpdateAssignment(c *gin.Context) {
	var a models.Assignment
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE assignments SET shift_id=?, vehicle_id=?, driver_id=?, assigned_date=?, status=?
		WHERE id=?
	`, a.ShiftID, a.VehicleID, a.DriverID, a.AssignedDate, a.Status, a.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assignment updated successfully"})
}

// DELETE /api/admin/assignments/delete?id=X
func DeleteAssignment(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec("DELETE FROM assignments WHERE id=?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assignment deleted successfully"})
}

/*
	=========================
	  POST /api/admin/assignments/reassign-for-leave
	  Reassign a driver's assignment to another driver during leave period

=========================
*/
type ReassignForLeaveRequest struct {
	AssignmentID int    `json:"assignment_id"`
	NewDriverID  int    `json:"new_driver_id"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
}

func ReassignForLeave(c *gin.Context) {
	var req ReassignForLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get the original assignment details
	var shiftID, vehicleID, originalDriverID int
	var originalStart, originalEnd, category string
	var err error
	err = config.DB.QueryRow(`
		SELECT shift_id, vehicle_id, driver_id, 
			DATE_FORMAT(start_date, '%Y-%m-%d'),
			DATE_FORMAT(end_date, '%Y-%m-%d'),
			vehicle_category
		FROM assignments WHERE id = ?
	`, req.AssignmentID).Scan(&shiftID, &vehicleID, &originalDriverID, &originalStart, &originalEnd, &category)

	if err != nil {
		log.Printf("Get assignment error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	// Update the original assignment end_date to before leave start
	// And create new assignments for before leave, during leave, and after leave

	// Check if there are assignments before the leave period
	if req.StartDate > originalStart {
		// Update original assignment to end before leave
		_, err = config.DB.Exec(`
			UPDATE assignments SET end_date = DATE_SUB(?, INTERVAL 1 DAY)
			WHERE id = ?
		`, req.StartDate, req.AssignmentID)
		if err != nil {
			log.Printf("Update assignment error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment"})
			return
		}
	} else if req.StartDate == originalStart {
		// If leave starts on assignment start, just update the assignment
		_, err = config.DB.Exec(`
			UPDATE assignments SET start_date = ?
			WHERE id = ?
		`, req.EndDate, req.AssignmentID)
		if err != nil {
			log.Printf("Update assignment start date error: %v", err)
		}
	}

	// Create temporary assignment for the replacement driver during leave
	_, err = config.DB.Exec(`
		INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, vehicle_category, status, is_temporary_replacement, original_driver_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', 1, ?)
	`, shiftID, vehicleID, req.NewDriverID, req.StartDate, req.StartDate, req.EndDate, category, originalDriverID)

	if err != nil {
		log.Printf("Create temporary assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temporary assignment"})
		return
	}

	// If there are assignments after the leave period, create new assignment
	if req.EndDate < originalEnd {
		_, err = config.DB.Exec(`
			INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, vehicle_category, status)
			VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 1 DAY), DATE_ADD(?, INTERVAL 1 DAY), ?, ?, 'assigned')
		`, shiftID, vehicleID, originalDriverID, req.EndDate, req.EndDate, originalEnd, category)
		if err != nil {
			log.Printf("Create post-leave assignment error: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assignment reassigned successfully"})
}

/* =========================
   TIME CONFLICT HELPER
========================= */

// CheckDriverTimeConflict checks if a driver has overlapping shift times on a given date
// Returns true if there's a conflict, false otherwise
func CheckDriverTimeConflict(driverID int, shiftStartTime, shiftEndTime, checkDate string) (bool, error) {
	// Query to get all active assignments for this driver on the given date
	// across all assignment types (bus, car, EV, temporary)
	query := `
		SELECT s.start_time, s.end_time, ss.start_time as slot_start, ss.end_time as slot_end
		FROM assignments a
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE a.driver_id = ?
		AND ? BETWEEN a.start_date AND a.end_date
		AND a.status IN ('assigned','active')
		
		UNION ALL
		
		SELECT s.start_time, s.end_time, ss.start_time as slot_start, ss.end_time as slot_end
		FROM temporary_assignments ta
		JOIN shifts s ON ta.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE ta.replacement_driver_id = ?
		AND ? BETWEEN ta.start_date AND ta.end_date

		UNION ALL

		-- EV cluster assignments impacting this driver via cluster membership
		SELECT 
			COALESCE(s.start_time, dc.start_time, '08:00:00') as start_time,
			COALESCE(s.end_time,   dc.end_time,   '17:00:00') as end_time,
			NULL as slot_start,
			NULL as slot_end
		FROM ev_assignments ev
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN drivers d ON d.cluster_id = dc.id
		LEFT JOIN shifts s ON s.id = dc.default_shift_id
		WHERE d.id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`

	rows, err := config.DB.Query(query, driverID, checkDate, driverID, checkDate, driverID, checkDate)
	if err != nil {
		log.Printf("Error checking time conflict: %v", err)
		return false, err
	}
	defer rows.Close()

	// Parse the shift times we're checking
	checkStart := shiftStartTime
	checkEnd := shiftEndTime

	for rows.Next() {
		var startTime, endTime sql.NullString
		var slotStart, slotEnd sql.NullString

		err := rows.Scan(&startTime, &endTime, &slotStart, &slotEnd)
		if err != nil {
			log.Printf("Error scanning time conflict row: %v", err)
			continue
		}

		// If shift has slots, check each slot for conflicts
		if slotStart.Valid && slotEnd.Valid {
			if timesOverlap(checkStart, checkEnd, slotStart.String, slotEnd.String) {
				log.Printf("Time conflict found for driver %d: slot %s-%s overlaps with %s-%s",
					driverID, slotStart.String, slotEnd.String, checkStart, checkEnd)
				return true, nil
			}
		} else if startTime.Valid && endTime.Valid {
			// Single time slot
			if timesOverlap(checkStart, checkEnd, startTime.String, endTime.String) {
				log.Printf("Time conflict found for driver %d: %s-%s overlaps with %s-%s",
					driverID, startTime.String, endTime.String, checkStart, checkEnd)
				return true, nil
			}
		}
	}

	return false, nil
}

// timesOverlap checks if two time ranges overlap
// Times are in HH:MM:SS format
func timesOverlap(start1, end1, start2, end2 string) bool {
	// Normalize to HH:MM:SS and compare as seconds
	toSec := func(s string) int {
		// Accept formats HH:MM or HH:MM:SS
		if len(s) == 5 { // HH:MM
			s = s + ":00"
		}
		// Parse
		t, err := time.Parse("15:04:05", s)
		if err != nil {
			// Fallback: naive lexicographic handling
			if len(s) < 8 {
				// pad to 8 chars
				s = s + ":00"
			}
			// HH:MM:SS -> seconds approximation
			h := (int(s[0]-'0')*10 + int(s[1]-'0'))
			m := (int(s[3]-'0')*10 + int(s[4]-'0'))
			sec := (int(s[6]-'0')*10 + int(s[7]-'0'))
			return h*3600 + m*60 + sec
		}
		return t.Hour()*3600 + t.Minute()*60 + t.Second()
	}
	s1, e1 := toSec(start1), toSec(end1)
	s2, e2 := toSec(start2), toSec(end2)
	return s1 < e2 && e1 > s2
}

// getDriverConflictsDetails returns a list of overlapping assignments for a driver
// on a specific date, comparing provided time ranges against existing assignment
// shift times (including multi-slot shifts)
func getDriverConflictsDetails(driverID int, checkDate string, checkRanges []struct{ start, end string }) ([]map[string]interface{}, error) {
	// Query assignments for the given driver and date
	rows, err := config.DB.Query(`
		SELECT a.id, v.vehicle_number, v.vehicle_type, s.name as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       a.start_date, a.end_date, 'REGULAR' as assignment_type
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE a.driver_id = ?
		AND ? BETWEEN a.start_date AND a.end_date
		AND a.status IN ('assigned','active')
		
		UNION ALL
		
		SELECT ev.id, v.vehicle_number, v.vehicle_type, COALESCE(s.name, 'EV Duty') as shift_name,
		       COALESCE(s.start_time, dc.start_time, '08:00:00') as start_time,
		       COALESCE(s.end_time,   dc.end_time,   '17:00:00') as end_time,
		       NULL as slot_start,
		       NULL as slot_end,
		       ev.start_date, ev.end_date, 'EV_CLUSTER' as assignment_type
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN drivers d ON d.cluster_id = dc.id
		LEFT JOIN shifts s ON s.id = dc.default_shift_id
		WHERE d.id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`, driverID, checkDate, driverID, checkDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var id int
		var vehicleNumber, vehicleType, shiftName string
		var startTime, endTime sql.NullString
		var slotStart, slotEnd sql.NullString
		var startDate, endDate, assignmentType string

		if err := rows.Scan(&id, &vehicleNumber, &vehicleType, &shiftName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate, &assignmentType); err != nil {
			continue
		}

		// Determine the effective time range(s) of the existing assignment
		candidateRanges := []struct{ start, end string }{}
		if slotStart.Valid && slotEnd.Valid {
			candidateRanges = append(candidateRanges, struct{ start, end string }{start: slotStart.String, end: slotEnd.String})
		} else if startTime.Valid && endTime.Valid {
			candidateRanges = append(candidateRanges, struct{ start, end string }{start: startTime.String, end: endTime.String})
		}

		// Compare against all provided check ranges
		conflicted := false
		for _, cr := range checkRanges {
			for _, er := range candidateRanges {
				if timesOverlap(cr.start, cr.end, er.start, er.end) {
					conflicted = true
					break
				}
			}
			if conflicted {
				break
			}
		}

		if conflicted {
			item := map[string]interface{}{
				"assignment_id":   id,
				"vehicle_number":  vehicleNumber,
				"vehicle_type":    vehicleType,
				"shift_name":      shiftName,
				"start_date":      startDate,
				"end_date":        endDate,
				"assignment_type": assignmentType,
			}
			// Prefer slot times if present, else base shift times
			if slotStart.Valid && slotEnd.Valid {
				item["start_time"] = slotStart.String
				item["end_time"] = slotEnd.String
			} else if startTime.Valid && endTime.Valid {
				item["start_time"] = startTime.String
				item["end_time"] = endTime.String
			}
			out = append(out, item)
		}
	}

	return out, nil
}
