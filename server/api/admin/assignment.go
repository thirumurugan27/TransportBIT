package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
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
		       DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
		       DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
		       a.status,
		       a.is_temporary_replacement,
		       a.original_driver_id,
		       a.created_by,
		       s.name AS shift_name, 
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time, 
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       v.vehicle_number, v.vehicle_type,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
		       u.full_name AS driver_name,
		       COALESCE(u_orig.full_name, '') as original_driver_name,
		       COALESCE(u_created.full_name, '') as created_by_name,
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
		LEFT JOIN buses b ON v.id = b.vehicle_id
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		LEFT JOIN users u_created ON a.created_by = u_created.id
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
		var createdByID sql.NullInt64
		var createdByName sql.NullString
		err := rows.Scan(&a.ID, &a.ShiftID, &a.VehicleID, &a.DriverID,
			&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
			&isTemp, &originalDriverID, &createdByID,
			&a.ShiftName, &a.StartTime, &a.EndTime,
			&a.VehicleNumber, &a.VehicleType, &a.VehicleName,
			&a.DriverName, &a.OriginalDriverName, &createdByName, &a.DriverStatus)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		a.IsTemporaryReplacement = isTemp == 1
		if originalDriverID.Valid {
			id := int(originalDriverID.Int64)
			a.OriginalDriverID = &id
		}
		if createdByID.Valid {
			id := int(createdByID.Int64)
			a.CreatedBy = &id
		}
		if createdByName.Valid {
			a.CreatedByName = createdByName.String
		}
		log.Printf("Assignment %d: start_date=%s, end_date=%s", a.ID, a.StartDate, a.EndDate)
		list = append(list, a)
	}

	// Get Temporary Assignments and append to list
	tempRows, err := config.DB.Query(`
		SELECT ta.id, COALESCE(ta.shift_id, 0) as shift_id, ta.vehicle_id, ta.replacement_driver_id, 
		       DATE_FORMAT(ta.start_date, '%d-%m-%Y') as assigned_date,
		       DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
		       ta.status,
		       ta.original_driver_id,
		       COALESCE(s.name, 'EV Cluster') AS shift_name, 
		       COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time, 
		       COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
		       v.vehicle_number, v.vehicle_type,
		       COALESCE(v.vehicle_name, ''),
		       u.full_name AS driver_name,
		       COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		LEFT JOIN shifts s ON ta.shift_id = s.id
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
				&a.VehicleNumber, &a.VehicleType, &a.VehicleName,
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

	// Prefer creator from auth token/cookie; fall back to request body if provided.
	createdBy := getUserIDFromRequest(c)
	if createdBy == nil && req.CreatedBy != nil {
		createdBy = req.CreatedBy
	}

	// If this is a temporary assignment, redirect to temporary assignments handler
	if req.IsTemporaryReplacement && req.OriginalDriverID != nil {
		shiftID := req.ShiftID
		tempReq := models.CreateTemporaryAssignmentRequest{
			OriginalDriverID:    *req.OriginalDriverID,
			ReplacementDriverID: req.DriverID,
			ShiftID:             &shiftID,
			VehicleID:           req.VehicleID,
			StartDate:           req.StartDate,
			EndDate:             req.EndDate,
			Reason:              "Temporary replacement",
			CreatedBy:           createdBy,
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
			JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
			JOIN drivers d ON d.id = dcm.driver_id
			WHERE d.id = ?
			AND ev.status IN ('active')
			AND ev.start_date <= ? AND ev.end_date >= ?
			AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		)
	`, req.DriverID, req.EndDate, req.StartDate,
		req.DriverID, req.EndDate, req.StartDate,
		req.DriverID, req.EndDate, req.StartDate, req.StartDate).
		Scan(&coarseCount)

	hasConflict := false
	// Only proceed to detailed time checks if we have potential conflicts, or just rely on the time check loop.
	// Previously: if coarseCount > 0 { hasConflict = true } caused false positives for non-overlapping shifts on same day.

	// Time-conflict validation using shift times (including multi-slot shifts)
	// Gather the time ranges to validate for the selected shift
	type timeRange struct{ start, end string }
	var ranges []timeRange

	// Try slots first (multi-slot shifts)
	slotRows, slotErr := config.DB.Query(`SELECT start_time, end_time FROM shift_slots WHERE shift_id = ? ORDER BY slot_order ASC`, req.ShiftID)
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
	conflictDate := "" // Track which date has the conflict
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
				conflictDate = checkDate
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
		conflicts, err := getDriverConflictsDetails(req.DriverID, conflictDate, checkRanges)
		if err != nil {
			log.Printf("Error getting conflict details: %v", err)
		}
		log.Printf("Conflict detected for driver %d on %s, found %d conflict details", req.DriverID, conflictDate, len(conflicts))
		c.JSON(http.StatusConflict, gin.H{
			"error":     "time_conflict",
			"message":   fmt.Sprintf("Driver is already assigned during this time range (conflict on %s)", conflictDate),
			"conflicts": conflicts,
		})
		return
	}

	// Create assignment with description
	_, err = config.DB.Exec(`
		INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, created_by, description)
		VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?)
	`, req.ShiftID, req.VehicleID, req.DriverID, req.StartDate, req.StartDate, req.EndDate, createdBy, req.Description)

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

	createdBy := getUserIDFromRequest(c)

	// Get the original assignment details
	var shiftID, vehicleID, originalDriverID int
	var originalStart, originalEnd string
	var err error
	err = config.DB.QueryRow(`
		SELECT shift_id, vehicle_id, driver_id, 
			DATE_FORMAT(start_date, '%d-%m-%Y'),
			DATE_FORMAT(end_date, '%d-%m-%Y')
		FROM assignments WHERE id = ?
	`, req.AssignmentID).Scan(&shiftID, &vehicleID, &originalDriverID, &originalStart, &originalEnd)

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
		INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, is_temporary_replacement, original_driver_id, created_by)
		VALUES (?, ?, ?, ?, ?, ?, 'assigned', 1, ?, ?)
	`, shiftID, vehicleID, req.NewDriverID, req.StartDate, req.StartDate, req.EndDate, originalDriverID, createdBy)

	if err != nil {
		log.Printf("Create temporary assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temporary assignment"})
		return
	}

	// If there are assignments after the leave period, create new assignment
	if req.EndDate < originalEnd {
		_, err = config.DB.Exec(`
			INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, created_by)
			VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 1 DAY), DATE_ADD(?, INTERVAL 1 DAY), ?, 'assigned', ?)
		`, shiftID, vehicleID, originalDriverID, req.EndDate, req.EndDate, originalEnd, createdBy)
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

		SELECT 
			s.start_time,
			s.end_time,
			ss.start_time as slot_start,
			ss.end_time as slot_end
		FROM ev_assignments ev
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN shifts s ON ev.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE d.id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`

	rows, err := config.DB.Query(query, driverID, checkDate, driverID, checkDate, checkDate, driverID, checkDate)
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

	// Also check vehicle requests (faculty car/bus bookings)
	vrRows, err := config.DB.Query(`
		SELECT vr.OnwardFromDateTime, 
		       COALESCE(NULLIF(vr.ReturnTodateTime,''), NULLIF(vr.ReturnFromDateTime,''), 
		                NULLIF(vr.OnwardTodateTime,''), vr.OnwardFromDateTime) as end_dt
		FROM vehiclerequests vr
		WHERE vr.driver_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND vr.OnwardFromDateTime IS NOT NULL
		AND TRIM(vr.OnwardFromDateTime) != ''
		AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
		AND DATE(TRIM(vr.OnwardFromDateTime)) <= ?
		AND DATE(COALESCE(NULLIF(TRIM(vr.ReturnTodateTime),''), NULLIF(TRIM(vr.ReturnFromDateTime),''), 
		         NULLIF(TRIM(vr.OnwardTodateTime),''), TRIM(vr.OnwardFromDateTime))) >= ?
	`, driverID, checkDate, checkDate)
	if err != nil {
		log.Printf("Error checking vehicle request time conflict: %v", err)
	} else {
		defer vrRows.Close()
		for vrRows.Next() {
			var onFrom, endDT string
			vrRows.Scan(&onFrom, &endDT)

			// Extract time from datetime
			vrStartTime := "00:00"
			vrEndTime := "23:59"
			if len(onFrom) > 11 {
				vrStartTime = onFrom[11:16]
			}
			if len(endDT) > 11 {
				vrEndTime = endDT[11:16]
			}

			if timesOverlap(checkStart, checkEnd, vrStartTime, vrEndTime) {
				log.Printf("Time conflict found for driver %d: VR %s-%s overlaps with %s-%s",
					driverID, vrStartTime, vrEndTime, checkStart, checkEnd)
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
	var out []map[string]interface{}
	seen := make(map[string]bool) // Track already added assignments to avoid duplicates

	// Query assignments for the given driver and date (regular + temp + EV)
	// Join ALL shift slots (not just slot 1) to check all time ranges
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
		
		SELECT ta.id, v.vehicle_number, v.vehicle_type, CONCAT(s.name, ' (Temp)') as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       ta.start_date, ta.end_date, 'TEMP_REPLACEMENT' as assignment_type
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		JOIN shifts s ON ta.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE ta.replacement_driver_id = ?
		AND ? BETWEEN ta.start_date AND ta.end_date
		
		UNION ALL
		
		SELECT ev.id, COALESCE(vg.name, 'EV Group') as vehicle_number, 'EV' as vehicle_type, CONCAT('EV: ', dc.name) as shift_name,
		       s.start_time, s.end_time,
		       ss.start_time as slot_start, ss.end_time as slot_end,
		       ev.start_date, ev.end_date, 'EV_CLUSTER' as assignment_type
		FROM ev_assignments ev
		LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN shifts s ON ev.shift_id = s.id
		LEFT JOIN shift_slots ss ON s.id = ss.shift_id
		WHERE d.id = ?
		AND ? BETWEEN ev.start_date AND ev.end_date
		AND ev.status IN ('active')
	`, driverID, checkDate, driverID, checkDate, checkDate, driverID, checkDate)
	if err != nil {
		log.Printf("Error querying conflict details: %v", err)
		return nil, err
	}
	defer rows.Close()

	log.Printf("getDriverConflictsDetails: Checking driver %d on date %s with %d time ranges", driverID, checkDate, len(checkRanges))
	for _, cr := range checkRanges {
		log.Printf("  - Range: %s to %s", cr.start, cr.end)
	}

	for rows.Next() {
		var id int
		var vehicleNumber, vehicleType, shiftName string
		var startTime, endTime sql.NullString
		var slotStart, slotEnd sql.NullString
		var startDate, endDate, assignmentType string

		if err := rows.Scan(&id, &vehicleNumber, &vehicleType, &shiftName, &startTime, &endTime, &slotStart, &slotEnd, &startDate, &endDate, &assignmentType); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		log.Printf("Found existing assignment: ID=%d type=%s shift=%s vehicle=%s dates=%s to %s times=%v-%v slot=%v-%v",
			id, assignmentType, shiftName, vehicleNumber, startDate, endDate,
			startTime, endTime, slotStart, slotEnd)

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
					log.Printf("  -> CONFLICT: %s-%s overlaps with %s-%s", cr.start, cr.end, er.start, er.end)
					break
				}
			}
			if conflicted {
				break
			}
		}

		if conflicted {
			// Use a unique key to avoid duplicate entries for same assignment
			key := fmt.Sprintf("%s_%d", assignmentType, id)
			if seen[key] {
				continue
			}
			seen[key] = true

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

	// Also check vehicle requests (faculty car/bus bookings)
	vrRows, err := config.DB.Query(`
		SELECT vr.id, COALESCE(v.vehicle_number,'N/A') as vehicle_number, 
		       COALESCE(v.vehicle_type,'') as vehicle_type,
		       vr.OnwardFromDateTime, COALESCE(vr.OnwardTodateTime,'') as onward_to,
		       COALESCE(vr.ReturnFromDateTime,'') as return_from, COALESCE(vr.ReturnTodateTime,'') as return_to,
		       COALESCE(u.full_name,'') as faculty_name, COALESCE(vr.Purpose,'') as purpose
		FROM vehiclerequests vr
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN faculty f ON vr.faculty_id = f.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE vr.driver_id = ?
		AND vr.status IN ('assigned','trip_started')
		AND vr.OnwardFromDateTime IS NOT NULL
		AND TRIM(vr.OnwardFromDateTime) != ''
		AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
		AND DATE(TRIM(vr.OnwardFromDateTime)) <= ?
		AND DATE(COALESCE(NULLIF(TRIM(vr.ReturnTodateTime),''), NULLIF(TRIM(vr.ReturnFromDateTime),''), 
		         NULLIF(TRIM(vr.OnwardTodateTime),''), TRIM(vr.OnwardFromDateTime))) >= ?
	`, driverID, checkDate, checkDate)
	if err != nil {
		log.Printf("Error checking vehicle request conflicts: %v", err)
	} else {
		defer vrRows.Close()
		for vrRows.Next() {
			var vrID int
			var vehNum, vehType, onFrom, onTo, retFrom, retTo, facName, purpose string
			vrRows.Scan(&vrID, &vehNum, &vehType, &onFrom, &onTo, &retFrom, &retTo, &facName, &purpose)

			// Extract time from datetime for overlap check
			vrStartTime := "00:00"
			vrEndTime := "23:59"
			if len(onFrom) > 11 {
				vrStartTime = onFrom[11:16]
			}
			endDT := onTo
			if retTo != "" {
				endDT = retTo
			} else if retFrom != "" {
				endDT = retFrom
			}
			if len(endDT) > 11 {
				vrEndTime = endDT[11:16]
			}

			// Check if overlaps with any of the check ranges
			conflicted := false
			for _, cr := range checkRanges {
				if timesOverlap(cr.start, cr.end, vrStartTime, vrEndTime) {
					conflicted = true
					break
				}
			}

			if conflicted {
				shiftName := fmt.Sprintf("Vehicle Request #%d", vrID)
				if purpose != "" {
					shiftName = fmt.Sprintf("VR #%d: %s", vrID, purpose)
					if len(shiftName) > 40 {
						shiftName = shiftName[:37] + "..."
					}
				}
				out = append(out, map[string]interface{}{
					"assignment_id":   vrID,
					"vehicle_number":  vehNum,
					"vehicle_type":    vehType,
					"shift_name":      shiftName,
					"start_time":      vrStartTime,
					"end_time":        vrEndTime,
					"start_date":      onFrom[:10],
					"end_date":        endDT[:10],
					"assignment_type": "VEHICLE_REQUEST",
					"faculty_name":    facName,
				})
			}
		}
	}

	return out, nil
}

/*
	=========================
	  GET /api/admin/assignments/check-driver-conflict
	  Check if a specific driver has conflicts for a given shift and date

=========================
*/
func CheckDriverConflictAPI(c *gin.Context) {
	driverIDStr := c.Query("driver_id")
	shiftIDStr := c.Query("shift_id")
	checkDate := c.Query("date")

	if driverIDStr == "" || shiftIDStr == "" || checkDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id, shift_id, and date are required"})
		return
	}

	driverID, err := strconv.Atoi(driverIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver_id"})
		return
	}

	shiftID, err := strconv.Atoi(shiftIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid shift_id"})
		return
	}

	// Get shift time ranges (including slots)
	type timeRange struct{ start, end string }
	var ranges []timeRange

	// Try slots first (multi-slot shifts)
	slotRows, slotErr := config.DB.Query(`SELECT start_time, end_time FROM shift_slots WHERE shift_id = ? ORDER BY slot_order ASC`, shiftID)
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
		_ = config.DB.QueryRow(`SELECT start_time, end_time FROM shifts WHERE id = ?`, shiftID).Scan(&s, &e)
		if s.Valid && e.Valid {
			ranges = append(ranges, timeRange{start: s.String, end: e.String})
		}
	}

	if len(ranges) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not determine shift times"})
		return
	}

	// Check for conflicts
	hasConflict := false
	for _, r := range ranges {
		conflict, err := CheckDriverTimeConflict(driverID, r.start, r.end, checkDate)
		if err != nil {
			log.Printf("Error checking driver conflict: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking conflict"})
			return
		}
		if conflict {
			hasConflict = true
			break
		}
	}

	// Get conflict details if there are conflicts
	var conflicts []map[string]interface{}
	if hasConflict {
		checkRanges := make([]struct{ start, end string }, len(ranges))
		for i, r := range ranges {
			checkRanges[i] = struct{ start, end string }{start: r.start, end: r.end}
		}
		conflicts, _ = getDriverConflictsDetails(driverID, checkDate, checkRanges)
	}

	c.JSON(http.StatusOK, gin.H{
		"conflict":  hasConflict,
		"conflicts": conflicts,
	})
}

/*
	=========================
	  GET /api/admin/assignments/check-vehicle-conflict
	  Check if a specific vehicle has conflicts for a given shift and date

=========================
*/
func CheckVehicleConflictAPI(c *gin.Context) {
	vehicleIDStr := c.Query("vehicle_id")
	shiftIDStr := c.Query("shift_id")
	checkDate := c.Query("date")

	if vehicleIDStr == "" || shiftIDStr == "" || checkDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id, shift_id, and date are required"})
		return
	}

	vehicleID, err := strconv.Atoi(vehicleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vehicle_id"})
		return
	}

	shiftID, err := strconv.Atoi(shiftIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid shift_id"})
		return
	}

	// Get shift time ranges (including slots)
	type timeRange struct{ start, end string }
	var ranges []timeRange

	// Try slots first (multi-slot shifts)
	slotRows, slotErr := config.DB.Query(`SELECT start_time, end_time FROM shift_slots WHERE shift_id = ? ORDER BY slot_order ASC`, shiftID)
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
		_ = config.DB.QueryRow(`SELECT start_time, end_time FROM shifts WHERE id = ?`, shiftID).Scan(&s, &e)
		if s.Valid && e.Valid {
			ranges = append(ranges, timeRange{start: s.String, end: e.String})
		}
	}

	if len(ranges) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not determine shift times"})
		return
	}

	// Check for conflicts - vehicle already assigned during the same time range
	hasConflict := false
	var conflicts []map[string]interface{}

	for _, r := range ranges {
		// Check regular assignments
		rows, err := config.DB.Query(`
			SELECT a.id, s.name as shift_name, s.start_time, s.end_time, 
			       a.start_date, a.end_date, u.full_name as driver_name,
			       'assignment' as assignment_type
			FROM assignments a
			JOIN shifts s ON a.shift_id = s.id
			JOIN drivers d ON a.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			WHERE a.vehicle_id = ?
			  AND a.status IN ('active', 'assigned')
			  AND ? BETWEEN a.start_date AND a.end_date
			  AND (
			    (s.start_time < ? AND s.end_time > ?) OR
			    (s.start_time < ? AND s.end_time > ?) OR
			    (s.start_time >= ? AND s.end_time <= ?)
			  )
		`, vehicleID, checkDate, r.end, r.start, r.end, r.start, r.start, r.end)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var conflict struct {
					ID             int
					ShiftName      string
					StartTime      string
					EndTime        string
					StartDate      string
					EndDate        string
					DriverName     string
					AssignmentType string
				}
				rows.Scan(&conflict.ID, &conflict.ShiftName, &conflict.StartTime, &conflict.EndTime,
					&conflict.StartDate, &conflict.EndDate, &conflict.DriverName, &conflict.AssignmentType)
				hasConflict = true
				conflicts = append(conflicts, map[string]interface{}{
					"id":              conflict.ID,
					"shift_name":      conflict.ShiftName,
					"start_time":      conflict.StartTime,
					"end_time":        conflict.EndTime,
					"start_date":      conflict.StartDate,
					"end_date":        conflict.EndDate,
					"driver_name":     conflict.DriverName,
					"assignment_type": conflict.AssignmentType,
				})
			}
		}

		// Check temporary assignments
		tempRows, err := config.DB.Query(`
			SELECT ta.id, s.name as shift_name, s.start_time, s.end_time,
			       ta.start_date, ta.end_date, u.full_name as driver_name,
			       'temporary' as assignment_type
			FROM temporary_assignments ta
			JOIN shifts s ON ta.shift_id = s.id
			JOIN drivers d ON ta.replacement_driver_id = d.id
			JOIN users u ON d.user_id = u.id
			WHERE ta.vehicle_id = ?
			  AND ta.status = 'active'
			  AND ? BETWEEN ta.start_date AND ta.end_date
			  AND (
			    (s.start_time < ? AND s.end_time > ?) OR
			    (s.start_time < ? AND s.end_time > ?) OR
			    (s.start_time >= ? AND s.end_time <= ?)
			  )
		`, vehicleID, checkDate, r.end, r.start, r.end, r.start, r.start, r.end)

		if err == nil {
			defer tempRows.Close()
			for tempRows.Next() {
				var conflict struct {
					ID             int
					ShiftName      string
					StartTime      string
					EndTime        string
					StartDate      string
					EndDate        string
					DriverName     string
					AssignmentType string
				}
				tempRows.Scan(&conflict.ID, &conflict.ShiftName, &conflict.StartTime, &conflict.EndTime,
					&conflict.StartDate, &conflict.EndDate, &conflict.DriverName, &conflict.AssignmentType)
				hasConflict = true
				conflicts = append(conflicts, map[string]interface{}{
					"id":              conflict.ID,
					"shift_name":      conflict.ShiftName,
					"start_time":      conflict.StartTime,
					"end_time":        conflict.EndTime,
					"start_date":      conflict.StartDate,
					"end_date":        conflict.EndDate,
					"driver_name":     conflict.DriverName,
					"assignment_type": conflict.AssignmentType,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"conflict":  hasConflict,
		"conflicts": conflicts,
	})
}

/*
	=========================
	  GET /api/admin/assignments/:id
	  Get detailed view of a single assignment

=========================
*/
func GetAssignmentDetails(c *gin.Context) {
	idStr := c.Param("id")
	assignmentID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment ID"})
		return
	}

	// Check if it's a temporary assignment first
	isTemp := c.Query("is_temp")

	if isTemp == "true" {
		// Fetch temporary assignment details
		var a struct {
			ID                    int    `json:"id"`
			ShiftID               int    `json:"shift_id"`
			VehicleID             int    `json:"vehicle_id"`
			OriginalDriverID      int    `json:"original_driver_id"`
			ReplacementDriverID   int    `json:"replacement_driver_id"`
			StartDate             string `json:"start_date"`
			EndDate               string `json:"end_date"`
			Reason                string `json:"reason"`
			Status                string `json:"status"`
			CreatedBy             *int   `json:"created_by"`
			ShiftName             string `json:"shift_name"`
			StartTime             string `json:"start_time"`
			EndTime               string `json:"end_time"`
			VehicleNumber         string `json:"vehicle_number"`
			VehicleType           string `json:"vehicle_type"`
			VehicleName           string `json:"vehicle_name"`
			OriginalDriverName    string `json:"original_driver_name"`
			ReplacementDriverName string `json:"replacement_driver_name"`
			CreatedByName         string `json:"created_by_name"`
		}

		var createdBy sql.NullInt64
		var createdByName sql.NullString

		err := config.DB.QueryRow(`
			SELECT ta.id, ta.shift_id, ta.vehicle_id, ta.original_driver_id, ta.replacement_driver_id,
			       DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
			       DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
			       COALESCE(ta.reason, '') as reason,
			       ta.status,
			       ta.created_by,
			       s.name AS shift_name,
			       TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			       v.vehicle_number, v.vehicle_type,
			       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
			       u_orig.full_name as original_driver_name,
			       u_repl.full_name as replacement_driver_name,
			       COALESCE(u_created.full_name, '') as created_by_name
			FROM temporary_assignments ta
			JOIN shifts s ON ta.shift_id = s.id
			JOIN vehicles v ON ta.vehicle_id = v.id
			JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
			JOIN users u_orig ON d_orig.user_id = u_orig.id
			JOIN drivers d_repl ON ta.replacement_driver_id = d_repl.id
			JOIN users u_repl ON d_repl.user_id = u_repl.id
			LEFT JOIN users u_created ON ta.created_by = u_created.id
			WHERE ta.id = ?
		`, assignmentID).Scan(
			&a.ID, &a.ShiftID, &a.VehicleID, &a.OriginalDriverID, &a.ReplacementDriverID,
			&a.StartDate, &a.EndDate, &a.Reason, &a.Status,
			&createdBy, &a.ShiftName, &a.StartTime, &a.EndTime,
			&a.VehicleNumber, &a.VehicleType, &a.VehicleName,
			&a.OriginalDriverName, &a.ReplacementDriverName, &createdByName,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Temporary assignment not found"})
				return
			}
			log.Printf("Error fetching temp assignment details: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment details"})
			return
		}

		if createdBy.Valid {
			id := int(createdBy.Int64)
			a.CreatedBy = &id
		}
		if createdByName.Valid {
			a.CreatedByName = createdByName.String
		}

		// Fetch shift slots for this temporary assignment
		type ShiftSlot struct {
			StartTime string `json:"start_time"`
			EndTime   string `json:"end_time"`
		}
		slotRows, _ := config.DB.Query(`
			SELECT TIME_FORMAT(start_time, '%H:%i'), TIME_FORMAT(end_time, '%H:%i')
			FROM shift_slots
			WHERE shift_id = ?
			ORDER BY slot_order ASC
		`, a.ShiftID)

		var slots []ShiftSlot
		for slotRows.Next() {
			var slot ShiftSlot
			slotRows.Scan(&slot.StartTime, &slot.EndTime)
			slots = append(slots, slot)
		}
		slotRows.Close()

		c.JSON(http.StatusOK, gin.H{
			"assignment":      a,
			"slots":           slots,
			"is_temporary":    true,
			"assignment_type": "temporary",
		})
		return
	}

	// Fetch regular assignment details
	var a models.Assignment
	var createdBy sql.NullInt64
	// created_at intentionally omitted from assignment details
	var createdByName sql.NullString
	var originalDriverID sql.NullInt64
	var isTemporary int
	var description sql.NullString

	err = config.DB.QueryRow(`
		SELECT a.id, a.shift_id, a.vehicle_id, a.driver_id,
		       DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
		       DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
		       a.status,
		       a.is_temporary_replacement,
		       a.original_driver_id,
		       a.created_by,
		       s.name AS shift_name,
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time,
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       v.vehicle_number, v.vehicle_type,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
		       u.full_name AS driver_name,
		       COALESCE(u_orig.full_name, '') as original_driver_name,
		       COALESCE(u_created.full_name, '') as created_by_name,
		       COALESCE(a.description, '') as description
		FROM assignments a
		JOIN shifts s ON a.shift_id = s.id
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN buses b ON v.id = b.vehicle_id
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		LEFT JOIN users u_created ON a.created_by = u_created.id
		WHERE a.id = ?
	`, assignmentID).Scan(
		&a.ID, &a.ShiftID, &a.VehicleID, &a.DriverID,
		&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
		&isTemporary, &originalDriverID,
		&createdBy,
		&a.ShiftName, &a.StartTime, &a.EndTime,
		&a.VehicleNumber, &a.VehicleType, &a.VehicleName,
		&a.DriverName, &a.OriginalDriverName, &createdByName, &description,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
			return
		}
		log.Printf("Error fetching assignment details: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assignment details"})
		return
	}

	a.IsTemporaryReplacement = isTemporary == 1
	if createdBy.Valid {
		id := int(createdBy.Int64)
		a.CreatedBy = &id
	}
	if createdByName.Valid {
		a.CreatedByName = createdByName.String
	}
	if originalDriverID.Valid {
		id := int(originalDriverID.Int64)
		a.OriginalDriverID = &id
	}
	if description.Valid {
		a.Description = description.String
	}

	// Fetch shift slots for this assignment
	type ShiftSlot struct {
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
	}
	slotRows, _ := config.DB.Query(`
		SELECT TIME_FORMAT(start_time, '%H:%i'), TIME_FORMAT(end_time, '%H:%i')
		FROM shift_slots
		WHERE shift_id = ?
		ORDER BY slot_order ASC
	`, a.ShiftID)

	var slots []ShiftSlot
	for slotRows.Next() {
		var slot ShiftSlot
		slotRows.Scan(&slot.StartTime, &slot.EndTime)
		slots = append(slots, slot)
	}
	slotRows.Close()

	c.JSON(http.StatusOK, gin.H{
		"assignment":      a,
		"slots":           slots,
		"is_temporary":    a.IsTemporaryReplacement,
		"assignment_type": "regular",
	})
}
