package driver

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// DriverAssignment - assignment details for driver view
type DriverAssignment struct {
	ID                     int    `json:"id"`
	VehicleID              int    `json:"vehicle_id"`
	VehicleNumber          string `json:"vehicle_number"`
	VehicleType            string `json:"vehicle_type"`
	ShiftName              string `json:"shift_name"`
	StartTime              string `json:"start_time"`
	EndTime                string `json:"end_time"`
	AssignedDate           string `json:"assigned_date"`
	StartDate              string `json:"start_date"`
	EndDate                string `json:"end_date"`
	Status                 string `json:"status"`
	IsTemporaryReplacement bool   `json:"is_temporary_replacement"`
	OriginalDriverID       *int   `json:"original_driver_id"`
	OriginalDriverName     string `json:"original_driver_name"`
}

/*
=========================

	GET /api/driver/assignment/today

=========================
*/
func GetDriverTodayAssignment(c *gin.Context) {
	driverID := c.Query("driver_id")
	date := c.Query("date")

	if driverID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	var assignment DriverAssignment
	err := config.DB.QueryRow(`
		SELECT 
			a.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
			a.status
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		WHERE a.driver_id = ? AND ? BETWEEN a.start_date AND a.end_date
		LIMIT 1
	`, driverID, date).Scan(
		&assignment.ID, &assignment.VehicleID, &assignment.VehicleNumber, &assignment.VehicleType,
		&assignment.ShiftName, &assignment.StartTime, &assignment.EndTime,
		&assignment.AssignedDate, &assignment.Status,
	)

	if err == sql.ErrNoRows {
		// Try temporary assignments
		err = config.DB.QueryRow(`
			SELECT 
				ta.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
				s.name as shift_name, 
				TIME_FORMAT(s.start_time, '%H:%i') as start_time,
				TIME_FORMAT(s.end_time, '%H:%i') as end_time,
				DATE_FORMAT(?, '%Y-%m-%d') as assigned_date,
				ta.status
			FROM temporary_assignments ta
			JOIN vehicles v ON ta.vehicle_id = v.id
			JOIN shifts s ON ta.shift_id = s.id
			WHERE ta.replacement_driver_id = ? 
			  AND ? BETWEEN ta.start_date AND ta.end_date
			  AND ta.status = 'active'
			LIMIT 1
		`, date, driverID, date).Scan(
			&assignment.ID, &assignment.VehicleID, &assignment.VehicleNumber, &assignment.VehicleType,
			&assignment.ShiftName, &assignment.StartTime, &assignment.EndTime,
			&assignment.AssignedDate, &assignment.Status,
		)
		if err == nil {
			assignment.IsTemporaryReplacement = true
		} else {
			c.JSON(http.StatusOK, nil) // no assignment found
			return
		}
	} else if err != nil {
		log.Printf("Get today assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignment"})
		return
	}

	c.JSON(http.StatusOK, assignment)
}

/*
=========================

	GET /api/driver/assignments/today
	Returns ALL assignments for today (driver might have multiple - bus morning, EV afternoon)
	Includes both individual assignments AND EV cluster assignments

=========================
*/
func GetDriverTodayAssignments(c *gin.Context) {
	driverID := c.Query("driver_id")
	date := c.Query("date")

	if driverID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	var assignments []DriverAssignment

	// 1. Get individual assignments (Bus, Car, etc.)
	// Check if today falls within the assignment date range (start_date to end_date)
	rows, err := config.DB.Query(`
		SELECT 
			a.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
			DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
			a.status,
			a.is_temporary_replacement,
			a.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		WHERE a.driver_id = ? 
		  AND ? BETWEEN a.start_date AND a.end_date
		ORDER BY s.start_time ASC
	`, driverID, date)

	if err != nil {
		log.Printf("Get today assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a DriverAssignment
		var originalDriverID sql.NullInt64
		err := rows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
			&a.ShiftName, &a.StartTime, &a.EndTime,
			&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
			&a.IsTemporaryReplacement, &originalDriverID, &a.OriginalDriverName)

		if err == nil {
			if originalDriverID.Valid {
				id := int(originalDriverID.Int64)
				a.OriginalDriverID = &id
			}
			assignments = append(assignments, a)
		} else {
			log.Printf("Scan error driver assignment: %v", err)
		}
	}
	// 2. Get EV cluster assignments (driver belongs to a cluster assigned to EV)
	evRows, err := config.DB.Query(`
		SELECT 
			ev.id, v.id as vehicle_id, v.vehicle_number, 'EV' as vehicle_type,
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
			? as assigned_date,
			ev.status
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN drivers d ON d.cluster_id = dc.id
		LEFT JOIN shifts s ON s.id = dc.default_shift_id
		WHERE d.id = ? 
		  AND ? BETWEEN ev.start_date AND ev.end_date
		  AND ev.status = 'active'
	`, date, driverID, date)

	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		// Don't fail, just skip EV assignments
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var a DriverAssignment
			if err := evRows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignedDate, &a.Status); err == nil {
				assignments = append(assignments, a)
			}
		}
	}

	// 3. Get TEMPORARY assignments (where this driver is the REPLACEMENT)
	tempRows, err := config.DB.Query(`
		SELECT 
			ta.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			? as assigned_date,
			DATE_FORMAT(ta.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(ta.end_date, '%Y-%m-%d') as end_date,
			ta.status,
			ta.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		JOIN shifts s ON ta.shift_id = s.id
		LEFT JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		WHERE ta.replacement_driver_id = ? 
		  AND ? BETWEEN ta.start_date AND ta.end_date
		  AND ta.status = 'active'
		ORDER BY s.start_time ASC
	`, date, driverID, date)

	if err != nil {
		log.Printf("Get temporary assignments error: %v", err)
	} else {
		defer tempRows.Close()
		for tempRows.Next() {
			var a DriverAssignment
			var originalDriverID int
			// Scan fields: ID, VehicleID, VehicleNumber, VehicleType, ShiftName, Start/End time, Assigned/Start/End date, Status, OriginalDriverID, OriginalDriverName
			err := tempRows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
				&originalDriverID, &a.OriginalDriverName)

			if err == nil {
				a.Status = "Temporary"
				a.IsTemporaryReplacement = true
				a.OriginalDriverID = &originalDriverID
				assignments = append(assignments, a)
			} else {
				log.Printf("Scan error temporary assignment: %v", err)
			}
		}
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	GET /api/driver/assignments
	Returns ALL assignments for a driver (including EV cluster assignments)

=========================
*/
func GetDriverAssignments(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	var assignments []DriverAssignment

	// 1. Get individual assignments (Bus, Car, etc.)
	rows, err := config.DB.Query(`
		SELECT 
			a.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date,
			DATE_FORMAT(a.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(a.end_date, '%Y-%m-%d') as end_date,
			a.status,
			a.is_temporary_replacement,
			a.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		WHERE a.driver_id = ?
		ORDER BY a.start_date DESC
	`, driverID)

	if err != nil {
		log.Printf("Get driver assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a DriverAssignment
		var originalDriverID sql.NullInt64
		err := rows.Scan(
			&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
			&a.ShiftName, &a.StartTime, &a.EndTime,
			&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
			&a.IsTemporaryReplacement, &originalDriverID, &a.OriginalDriverName)
		if err == nil {
			if originalDriverID.Valid {
				id := int(originalDriverID.Int64)
				a.OriginalDriverID = &id
			}
			assignments = append(assignments, a)
		}
	}

	// 2. Get EV cluster assignments (driver belongs to a cluster assigned to EV)
	// This generates one row per day in the date range
	evRows, err := config.DB.Query(`
		SELECT 
			ev.id, v.id as vehicle_id, v.vehicle_number, 'EV' as vehicle_type,
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), TIME_FORMAT(dc.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), TIME_FORMAT(dc.end_time, '%H:%i'), '17:00') as end_time,
			DATE_FORMAT(ev.start_date, '%Y-%m-%d') as assigned_date,
			DATE_FORMAT(ev.end_date, '%Y-%m-%d') as end_date,
			ev.status
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN drivers d ON d.cluster_id = dc.id
		LEFT JOIN shifts s ON s.id = dc.default_shift_id
		WHERE d.id = ?
		ORDER BY ev.start_date DESC
	`, driverID)

	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		// Don't fail, just skip EV assignments
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var a DriverAssignment
			var endDate string
			evRows.Scan(
				&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignedDate, &endDate, &a.Status,
			)
			// For display, show the date range in a combined format
			if endDate != "" && endDate != a.AssignedDate {
				a.EndDate = endDate
				a.StartDate = a.AssignedDate
			}
			assignments = append(assignments, a)
		}
	}

	// 3. Get temporary assignments
	tempRows, err := config.DB.Query(`
		SELECT 
			ta.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			DATE_FORMAT(ta.start_date, '%Y-%m-%d') as start_date,
			DATE_FORMAT(ta.end_date, '%Y-%m-%d') as end_date,
			ta.status,
			ta.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		JOIN shifts s ON ta.shift_id = s.id
		LEFT JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
		LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
		WHERE ta.replacement_driver_id = ?
		ORDER BY ta.start_date DESC
	`, driverID)

	if err != nil {
		log.Printf("Get temporary assignments error: %v", err)
	} else {
		defer tempRows.Close()
		for tempRows.Next() {
			var a DriverAssignment
			var originalDriverID int
			err := tempRows.Scan(
				&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.StartDate, &a.EndDate, &a.Status,
				&originalDriverID, &a.OriginalDriverName)
			if err == nil {
				a.IsTemporaryReplacement = true
				a.OriginalDriverID = &originalDriverID
				// Use start date as assigned date for sorting/display
				a.AssignedDate = a.StartDate
				assignments = append(assignments, a)
			}
		}
	}

	c.JSON(http.StatusOK, assignments)
}

// GET /api/driver/vehicles/alerts - Get alerts for vehicles assigned to this driver
func GetDriverVehicleAlerts(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	// Get vehicles assigned to this driver with expiring documents
	rows, err := config.DB.Query(`
		SELECT DISTINCT v.id, v.vehicle_number, v.vehicle_type, v.status,
		       v.insurance_expire_date, v.fc_expire_date, v.permit_expire_date,
		       DATEDIFF(v.insurance_expire_date, CURDATE()) as insurance_days,
		       DATEDIFF(v.fc_expire_date, CURDATE()) as fc_days,
		       DATEDIFF(v.permit_expire_date, CURDATE()) as permit_days
		FROM vehicles v
		INNER JOIN assignments a ON a.vehicle_id = v.id
		WHERE a.driver_id = ?
		  AND CURDATE() BETWEEN a.start_date AND a.end_date
		  AND v.status = 'active'
		  AND (
		    (v.insurance_expire_date IS NOT NULL AND DATEDIFF(v.insurance_expire_date, CURDATE()) <= 10)
		    OR (v.fc_expire_date IS NOT NULL AND DATEDIFF(v.fc_expire_date, CURDATE()) <= 10)
		    OR (v.permit_expire_date IS NOT NULL AND DATEDIFF(v.permit_expire_date, CURDATE()) <= 10)
		  )
		ORDER BY 
		  LEAST(
		    COALESCE(DATEDIFF(v.insurance_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.fc_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.permit_expire_date, CURDATE()), 999)
		  ) ASC
	`, driverID)

	if err != nil {
		log.Printf("Driver vehicle alerts error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type VehicleAlert struct {
		ID              int     `json:"id"`
		VehicleNumber   string  `json:"vehicle_number"`
		VehicleType     string  `json:"vehicle_type"`
		Status          string  `json:"status"`
		InsuranceExpire *string `json:"insurance_expire_date"`
		FCExpire        *string `json:"fc_expire_date"`
		PermitExpire    *string `json:"permit_expire_date"`
		InsuranceDays   *int    `json:"insurance_days"`
		FCDays          *int    `json:"fc_days"`
		PermitDays      *int    `json:"permit_days"`
	}

	var alerts []VehicleAlert
	for rows.Next() {
		var a VehicleAlert
		rows.Scan(&a.ID, &a.VehicleNumber, &a.VehicleType, &a.Status,
			&a.InsuranceExpire, &a.FCExpire, &a.PermitExpire,
			&a.InsuranceDays, &a.FCDays, &a.PermitDays)
		alerts = append(alerts, a)
	}

	// Count expired (< 0 days) and critical (0-10 days)
	expired := 0
	critical := 0
	for _, a := range alerts {
		hasExpired := false
		hasCritical := false

		if a.InsuranceDays != nil && *a.InsuranceDays < 0 {
			hasExpired = true
		} else if a.InsuranceDays != nil && *a.InsuranceDays <= 10 {
			hasCritical = true
		}

		if a.FCDays != nil && *a.FCDays < 0 {
			hasExpired = true
		} else if a.FCDays != nil && *a.FCDays <= 10 {
			hasCritical = true
		}

		if a.PermitDays != nil && *a.PermitDays < 0 {
			hasExpired = true
		} else if a.PermitDays != nil && *a.PermitDays <= 10 {
			hasCritical = true
		}

		if hasExpired {
			expired++
		} else if hasCritical {
			critical++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts":   alerts,
		"expired":  expired,
		"critical": critical,
		"total":    len(alerts),
	})
}
