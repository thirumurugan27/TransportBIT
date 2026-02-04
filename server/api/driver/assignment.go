package driver

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

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
	// Car assignment specific fields
	Purpose     string `json:"purpose,omitempty"`
	Destination string `json:"destination,omitempty"`
	OTP         string `json:"otp,omitempty"`
	// Group information for EV assignments
	DriverGroupID    *int   `json:"driver_group_id"`
	DriverGroupName  string `json:"driver_group_name"`
	VehicleGroupID   *int   `json:"vehicle_group_id"`
	VehicleGroupName string `json:"vehicle_group_name"`
	IsEVAssignment   bool   `json:"is_ev_assignment"`
	// Group details (vehicles and drivers in the group)
	GroupVehicles []GroupVehicle `json:"group_vehicles,omitempty"`
	GroupDrivers  []GroupDriver  `json:"group_drivers,omitempty"`
}

// GroupVehicle - vehicle in a vehicle group
type GroupVehicle struct {
	ID            int    `json:"id"`
	VehicleNumber string `json:"vehicle_number"`
	FuelType      string `json:"fuel_type"`
}

// GroupDriver - driver in a driver group
type GroupDriver struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
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
			DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
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
				COALESCE(s.name, 'EV Duty') as shift_name, 
				COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
				COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
				DATE_FORMAT(?, '%d-%m-%Y') as assigned_date,
				ta.status
			FROM temporary_assignments ta
			JOIN vehicles v ON ta.vehicle_id = v.id
			LEFT JOIN shifts s ON ta.shift_id = s.id
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
			DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
			DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
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
	// 2. Get EV cluster assignments (driver belongs to a cluster assigned to EV vehicle group)
	// First get unique EV assignments for this driver
	evRows, err := config.DB.Query(`
		SELECT 
			ev.id, 
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
			? as assigned_date,
			DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date,
			ev.status,
			dc.id as driver_group_id,
			dc.name as driver_group_name,
			vg.id as vehicle_group_id,
			vg.name as vehicle_group_name
		FROM ev_assignments ev
		JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN shifts s ON s.id = ev.shift_id
		WHERE dcm.driver_id = ? 
		  AND ? BETWEEN ev.start_date AND ev.end_date
		  AND ev.status = 'active'
		GROUP BY ev.id
	`, date, date, driverID, date)

	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		// Don't fail, just skip EV assignments
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var a DriverAssignment
			var driverGroupID, vehicleGroupID sql.NullInt64
			var driverGroupName, vehicleGroupName sql.NullString
			if err := evRows.Scan(&a.ID,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
				&driverGroupID, &driverGroupName, &vehicleGroupID, &vehicleGroupName); err == nil {
				a.IsEVAssignment = true
				a.VehicleType = "EV"
				if driverGroupID.Valid {
					id := int(driverGroupID.Int64)
					a.DriverGroupID = &id
				}
				if driverGroupName.Valid {
					a.DriverGroupName = driverGroupName.String
				}
				if vehicleGroupID.Valid {
					id := int(vehicleGroupID.Int64)
					a.VehicleGroupID = &id
					// Get vehicles in this group
					a.GroupVehicles = getGroupVehicles(id, date)
				}
				if vehicleGroupName.Valid {
					a.VehicleGroupName = vehicleGroupName.String
					a.VehicleNumber = vehicleGroupName.String // Use group name as display
				}
				// Get drivers in the driver group
				if driverGroupID.Valid {
					a.GroupDrivers = getGroupDrivers(int(driverGroupID.Int64), date)
				}
				assignments = append(assignments, a)
			}
		}
	}

	// 3. Get TEMPORARY assignments (where this driver is the REPLACEMENT)
	tempRows, err := config.DB.Query(`
		SELECT 
			ta.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
			? as assigned_date,
			DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
			ta.status,
			ta.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		LEFT JOIN shifts s ON ta.shift_id = s.id
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
			var originalDriverID sql.NullInt64
			// Scan fields: ID, VehicleID, VehicleNumber, VehicleType, ShiftName, Start/End time, Assigned/Start/End date, Status, OriginalDriverID, OriginalDriverName
			err := tempRows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.AssignedDate, &a.StartDate, &a.EndDate, &a.Status,
				&originalDriverID, &a.OriginalDriverName)

			if err == nil {
				a.Status = "Temporary"
				a.IsTemporaryReplacement = true
				if originalDriverID.Valid {
					id := int(originalDriverID.Int64)
					a.OriginalDriverID = &id
				}
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
	
	// Convert to int for proper type handling
	driverIDInt, err := strconv.Atoi(driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver_id"})
		return
	}

	var assignments []DriverAssignment

	// 1. Get individual assignments (Bus, Car, etc.)
	rows, err := config.DB.Query(`
		SELECT 
			a.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			s.name as shift_name, 
			COALESCE(a.start_time, TIME_FORMAT(s.start_time, '%H:%i')) as start_time,
			COALESCE(a.end_time, TIME_FORMAT(s.end_time, '%H:%i')) as end_time,
			DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
			DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
			a.status,
			a.is_temporary_replacement,
			a.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name,
			COALESCE(a.purpose, '') as purpose,
			COALESCE(a.destination, '') as destination,
			CASE WHEN a.status = 'onhold' THEN COALESCE(a.otp, '') ELSE '' END as otp
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
			&a.IsTemporaryReplacement, &originalDriverID, &a.OriginalDriverName,
			&a.Purpose, &a.Destination, &a.OTP)
		if err == nil {
			if originalDriverID.Valid {
				id := int(originalDriverID.Int64)
				a.OriginalDriverID = &id
			}
			assignments = append(assignments, a)
		}
	}

	// 2. Get EV cluster assignments (driver belongs to a cluster assigned to EV vehicle group)
	// Get unique EV assignments for this driver (not per vehicle)
	log.Printf("Fetching EV assignments for driver ID: %d", driverIDInt)
	
	// First, check if driver is in any cluster
	var clusterCheck int
	err = config.DB.QueryRow(`SELECT COUNT(*) FROM driver_cluster_members WHERE driver_id = ?`, driverIDInt).Scan(&clusterCheck)
	log.Printf("Driver %d is in %d cluster memberships", driverIDInt, clusterCheck)
	
	evRows, err := config.DB.Query(`
		SELECT 
			ev.id, 
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
			DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date,
			ev.status,
			dc.id as driver_group_id,
			dc.name as driver_group_name,
			vg.id as vehicle_group_id,
			vg.name as vehicle_group_name
		FROM ev_assignments ev
		JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
		LEFT JOIN shifts s ON s.id = ev.shift_id
		WHERE dcm.driver_id = ?
		GROUP BY ev.id
		ORDER BY ev.start_date DESC
	`, driverIDInt)

	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		// Don't fail, just skip EV assignments
	} else {
		defer evRows.Close()
		evCount := 0
		for evRows.Next() {
			evCount++
			var a DriverAssignment
			var driverGroupID, vehicleGroupID sql.NullInt64
			var driverGroupName, vehicleGroupName sql.NullString
			if err := evRows.Scan(
				&a.ID,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.StartDate, &a.EndDate, &a.Status,
				&driverGroupID, &driverGroupName, &vehicleGroupID, &vehicleGroupName); err == nil {
				a.AssignedDate = a.StartDate
				a.IsEVAssignment = true
				a.VehicleType = "EV"
				if driverGroupID.Valid {
					id := int(driverGroupID.Int64)
					a.DriverGroupID = &id
					// Get drivers in the driver group (use empty date for all-time query)
					a.GroupDrivers = getGroupDrivers(id, "")
				}
				if driverGroupName.Valid {
					a.DriverGroupName = driverGroupName.String
				}
				if vehicleGroupID.Valid {
					id := int(vehicleGroupID.Int64)
					a.VehicleGroupID = &id
					// Get vehicles in this group (use empty date for all-time query)
					a.GroupVehicles = getGroupVehicles(id, "")
				}
				if vehicleGroupName.Valid {
					a.VehicleGroupName = vehicleGroupName.String
					a.VehicleNumber = vehicleGroupName.String // Use group name as display
				}
				assignments = append(assignments, a)
			} else {
				log.Printf("Scan EV assignment error: %v", err)
			}
		}
		log.Printf("Found %d EV assignments for driver %d", evCount, driverIDInt)
	}

	// 3. Get temporary assignments
	tempRows, err := config.DB.Query(`
		SELECT 
			ta.id, v.id as vehicle_id, v.vehicle_number, v.vehicle_type,
			COALESCE(s.name, 'EV Duty') as shift_name, 
			COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), '08:00') as start_time,
			COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), '17:00') as end_time,
			DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
			ta.status,
			ta.original_driver_id,
			COALESCE(u_orig.full_name, '') as original_driver_name
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		LEFT JOIN shifts s ON ta.shift_id = s.id
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
			var originalDriverID sql.NullInt64
			err := tempRows.Scan(
				&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
				&a.ShiftName, &a.StartTime, &a.EndTime,
				&a.StartDate, &a.EndDate, &a.Status,
				&originalDriverID, &a.OriginalDriverName)
			if err == nil {
				a.IsTemporaryReplacement = true
				if originalDriverID.Valid {
					id := int(originalDriverID.Int64)
					a.OriginalDriverID = &id
				}
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

// VerifyCarAssignmentOTPRequest - request body for verifying car assignment OTP
type VerifyCarAssignmentOTPRequest struct {
	AssignmentID int    `json:"assignment_id"`
	OTP          string `json:"otp"`
}

/*
=========================

	POST /api/driver/assignment/verify-otp

=========================
*/
func VerifyCarAssignmentOTP(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	var req VerifyCarAssignmentOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get assignment details
	var assignmentDriverID int
	var storedOTP sql.NullString
	var status, startDate, vehicleType string
	err := config.DB.QueryRow(`
		SELECT a.driver_id, a.otp, a.status, DATE_FORMAT(a.start_date, '%d-%m-%Y'), v.vehicle_type 
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		WHERE a.id = ?
	`, req.AssignmentID).Scan(&assignmentDriverID, &storedOTP, &status, &startDate, &vehicleType)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching assignment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Verify this is a CAR assignment
	if vehicleType != "CAR" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP verification is only for car assignments"})
		return
	}

	// Verify driver is assigned
	if driverID != "" {
		var dID int
		dID, _ = strconv.Atoi(driverID)
		if assignmentDriverID != dID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not assigned to this vehicle"})
			return
		}
	}

	// Check assignment status
	if status != "onhold" {
		if status == "assigned" || status == "active" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This assignment is already verified"})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This assignment cannot be verified"})
		}
		return
	}

	// Verify OTP
	if !storedOTP.Valid || req.OTP != storedOTP.String {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP"})
		return
	}

	// Update assignment status to 'assigned'
	_, err = config.DB.Exec(`
		UPDATE assignments SET status = 'assigned', otp_verified_at = NOW(), updated_at = NOW() WHERE id = ?
	`, req.AssignmentID)

	if err != nil {
		log.Printf("Error updating assignment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP verified successfully. Assignment confirmed!",
	})
}

/*
=========================

	GET /api/driver/assignment/car-assignments

=========================
*/
func GetDriverCarAssignments(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT a.id, a.vehicle_id, v.vehicle_number, v.vehicle_type,
		       COALESCE(s.name, 'Custom') as shift_name,
		       COALESCE(a.start_time, TIME_FORMAT(s.start_time, '%H:%i')) as start_time,
		       COALESCE(a.end_time, TIME_FORMAT(s.end_time, '%H:%i')) as end_time,
		       DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
		       DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
		       a.status, a.otp,
		       COALESCE(a.purpose, '') as purpose,
		       COALESCE(a.destination, '') as destination
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.driver_id = ? 
		AND v.vehicle_type = 'CAR'
		AND a.start_date >= CURDATE()
		ORDER BY a.start_date ASC
	`, driverID)

	if err != nil {
		log.Printf("Error fetching car assignments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type CarAssignment struct {
		ID            int            `json:"id"`
		VehicleID     int            `json:"vehicle_id"`
		VehicleNumber string         `json:"vehicle_number"`
		VehicleType   string         `json:"vehicle_type"`
		ShiftName     string         `json:"shift_name"`
		StartTime     string         `json:"start_time"`
		EndTime       string         `json:"end_time"`
		AssignedDate  string         `json:"assigned_date"`
		StartDate     string         `json:"start_date"`
		EndDate       string         `json:"end_date"`
		Status        string         `json:"status"`
		OTP           sql.NullString `json:"-"`
		OTPDisplay    string         `json:"otp,omitempty"`
		Purpose       string         `json:"purpose"`
		Destination   string         `json:"destination"`
	}

	var assignments []CarAssignment
	for rows.Next() {
		var a CarAssignment
		if err := rows.Scan(&a.ID, &a.VehicleID, &a.VehicleNumber, &a.VehicleType,
			&a.ShiftName, &a.StartTime, &a.EndTime, &a.AssignedDate,
			&a.StartDate, &a.EndDate, &a.Status, &a.OTP, &a.Purpose, &a.Destination); err != nil {
			log.Printf("Error scanning car assignment: %v", err)
			continue
		}
		// Only show OTP for onhold status
		if a.Status == "onhold" && a.OTP.Valid {
			a.OTPDisplay = a.OTP.String
		}
		assignments = append(assignments, a)
	}

	if assignments == nil {
		assignments = []CarAssignment{}
	}

	c.JSON(http.StatusOK, assignments)
}

// Helper function to get vehicles in a vehicle group
func getGroupVehicles(groupID int, date string) []GroupVehicle {
	var vehicles []GroupVehicle
	var query string
	var args []interface{}

	if date != "" {
		// Get vehicles valid on specific date
		query = `
			SELECT v.id, v.vehicle_number, COALESCE(v.fuel_type, 'EV') as fuel_type
			FROM vehicle_group_members vgm
			JOIN vehicles v ON v.id = vgm.vehicle_id
			WHERE vgm.group_id = ? AND ? BETWEEN vgm.valid_from AND vgm.valid_to
			ORDER BY v.vehicle_number
		`
		args = []interface{}{groupID, date}
	} else {
		// Get all vehicles in group (any time)
		query = `
			SELECT DISTINCT v.id, v.vehicle_number, COALESCE(v.fuel_type, 'EV') as fuel_type
			FROM vehicle_group_members vgm
			JOIN vehicles v ON v.id = vgm.vehicle_id
			WHERE vgm.group_id = ?
			ORDER BY v.vehicle_number
		`
		args = []interface{}{groupID}
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error getting group vehicles: %v", err)
		return vehicles
	}
	defer rows.Close()

	for rows.Next() {
		var v GroupVehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.FuelType); err == nil {
			vehicles = append(vehicles, v)
		}
	}
	return vehicles
}

// Helper function to get drivers in a driver group
func getGroupDrivers(groupID int, date string) []GroupDriver {
	var drivers []GroupDriver
	var query string
	var args []interface{}

	if date != "" {
		// Get drivers valid on specific date
		query = `
			SELECT d.id, u.full_name
			FROM driver_cluster_members dcm
			JOIN drivers d ON d.id = dcm.driver_id
			JOIN users u ON u.id = d.user_id
			WHERE dcm.cluster_id = ? AND ? BETWEEN dcm.valid_from AND dcm.valid_to
			ORDER BY u.full_name
		`
		args = []interface{}{groupID, date}
	} else {
		// Get all drivers in group (any time)
		query = `
			SELECT DISTINCT d.id, u.full_name
			FROM driver_cluster_members dcm
			JOIN drivers d ON d.id = dcm.driver_id
			JOIN users u ON u.id = d.user_id
			WHERE dcm.cluster_id = ?
			ORDER BY u.full_name
		`
		args = []interface{}{groupID}
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error getting group drivers: %v", err)
		return drivers
	}
	defer rows.Close()

	for rows.Next() {
		var d GroupDriver
		if err := rows.Scan(&d.ID, &d.Name); err == nil {
			drivers = append(drivers, d)
		}
	}
	return drivers
}
