package admin

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/*
	=========================
	  EV ASSIGNMENT HANDLERS
	=========================
*/

// EVAssignment - EV vehicle to cluster assignment
type EVAssignment struct {
	ID               int                 `json:"id"`
	VehicleGroupID   int                 `json:"vehicle_group_id"`
	VehicleGroupName string              `json:"vehicle_group_name"`
	ClusterID        int                 `json:"cluster_id"`
	ClusterName      string              `json:"cluster_name"`
	DriverCount      int                 `json:"driver_count"`
	StartDate        string              `json:"start_date"`
	EndDate          string              `json:"end_date"`
	Status           string              `json:"status"`
	ShiftID          *int                `json:"shift_id"`
	ShiftName        string              `json:"shift_name"`
	ShiftStartTime   string              `json:"shift_start_time"`
	ShiftEndTime     string              `json:"shift_end_time"`
	CreatedAt        string              `json:"created_at"`
	Drivers          []ClusterDriverInfo `json:"drivers"`
	Vehicles         []GroupVehicle      `json:"vehicles"`
}

type ClusterDriverInfo struct {
	DriverID   int    `json:"driver_id"`
	DriverName string `json:"driver_name"`
	Status     string `json:"status"`
	OnLeave    bool   `json:"on_leave"`
}

/*
=========================

	GET /api/admin/ev-vehicles
	Get all EV vehicles for assignment

=========================
*/
func GetEVVehicles(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       COALESCE(v.name, b.bus_name, v.vehicle_number) as bus_name
		FROM vehicles v
		LEFT JOIN buses b ON b.vehicle_id = v.id
		WHERE v.fuel_type = 'EV'
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("Get EV vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching EV vehicles"})
		return
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status, &v.BusName)
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, vehicles)
}

/*
=========================

	GET /api/admin/ev-assignments
	Get all EV assignments

=========================
*/
/*
=========================

	GET /api/admin/ev-assignments
	Get all EV assignments (grouped by vehicle group if applicable)

=========================
*/
func GetEVAssignments(c *gin.Context) {
	// We group by unique assignment sets (Cluster + Dates + VehicleGroup)
	// If vehicle_group_id is NULL, each vehicle is its own row (or grouped by null group?)
	// Actually, for list view, we want to see "Group A" as one item.
	// Individual assignments (no group) should be shown individually.

	query := `
		SELECT 
			ea.id, 
			ea.vehicle_group_id,
			COALESCE(vg.name, 'Unknown Group') as vehicle_group_name,
			ea.cluster_id, 
			c.name as cluster_name,
			DATE_FORMAT(ea.start_date, '%d-%m-%Y') as start_date, 
			DATE_FORMAT(ea.end_date, '%d-%m-%Y') as end_date, 
			ea.status,
			ea.shift_id,
			COALESCE(s.name, 'Default') as shift_name,
			TIME_FORMAT(s.start_time, '%H:%i') as start_time,
			TIME_FORMAT(s.end_time, '%H:%i') as end_time,
			DATE_FORMAT(ea.created_at, '%d-%m-%Y %H:%i') as created_at
		FROM ev_assignments ea
		LEFT JOIN vehicle_groups vg ON ea.vehicle_group_id = vg.id
		JOIN driver_clusters c ON ea.cluster_id = c.id
		LEFT JOIN shifts s ON ea.shift_id = s.id
		ORDER BY ea.start_date DESC, ea.id DESC
	`

	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("Get EV assignments error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching EV assignments"})
		return
	}
	defer rows.Close()

	var assignments []EVAssignment
	for rows.Next() {
		var a EVAssignment
		var shiftID sql.NullInt64
		var shiftName sql.NullString
		var shiftStart sql.NullString
		var shiftEnd sql.NullString

		err := rows.Scan(
			&a.ID, 
			&a.VehicleGroupID,
			&a.VehicleGroupName, 
			&a.ClusterID, 
			&a.ClusterName,
			&a.StartDate, 
			&a.EndDate, 
			&a.Status,
			&shiftID,
			&shiftName,
			&shiftStart,
			&shiftEnd,
			&a.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		if shiftID.Valid {
			sid := int(shiftID.Int64)
			a.ShiftID = &sid
			a.ShiftName = shiftName.String
			a.ShiftStartTime = shiftStart.String
			a.ShiftEndTime = shiftEnd.String
		}

		// Fetch vehicles in this group
		vRows, vErr := config.DB.Query(`
			SELECT v.id, v.vehicle_number, v.vehicle_type 
			FROM vehicle_group_members vgm
			JOIN vehicles v ON v.id = vgm.vehicle_id
			WHERE vgm.group_id = ? AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
		`, a.VehicleGroupID)
		if vErr == nil {
			defer vRows.Close()
			for vRows.Next() {
				var gv GroupVehicle
				vRows.Scan(&gv.ID, &gv.VehicleNumber, &gv.VehicleType)
				groupID := a.VehicleGroupID
				gv.GroupID = &groupID
				a.Vehicles = append(a.Vehicles, gv)
			}
		}

		// Calculate driver count (which is actually drivers in the cluster, confusingly named in struct)
		// We'll keep the struct field semantics: drivers in the cluster
		var driverCount int
		config.DB.QueryRow("SELECT COUNT(DISTINCT dcm.driver_id) FROM driver_cluster_members dcm WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to", a.ClusterID).Scan(&driverCount)
		a.DriverCount = driverCount


		// We can reuse the drivers field or add a vehicles field.
		// The frontend expects 'drivers' for the bubbles.
		// Use cluster drivers logic
		driverRows, _ := config.DB.Query(`
			SELECT d.id, u.full_name, u.status,
			       EXISTS(SELECT 1 FROM leave_requests lr 
			              WHERE lr.driver_id = d.id 
			              AND lr.status = 'admin_approved'
			              AND CURDATE() BETWEEN lr.start_date AND lr.end_date) as on_leave
			FROM driver_cluster_members dcm
			JOIN drivers d ON d.id = dcm.driver_id
			JOIN users u ON d.user_id = u.id
			WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		`, a.ClusterID)

		if driverRows != nil {
			for driverRows.Next() {
				var di ClusterDriverInfo
				var onLeave int
				driverRows.Scan(&di.DriverID, &di.DriverName, &di.Status, &onLeave)
				di.OnLeave = onLeave == 1
				a.Drivers = append(a.Drivers, di)
			}
			driverRows.Close()
		}

		assignments = append(assignments, a)
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	POST /api/admin/ev-assignments/create
	Create EV assignment (cluster to EV vehicle for date range)

=========================
*/
func CreateEVAssignment(c *gin.Context) {
	var req struct {
		VehicleGroupID int    `json:"vehicle_group_id"`
		ClusterID      int    `json:"cluster_id"`
		ShiftID        int    `json:"shift_id"`
		StartDate      string `json:"start_date"`
		EndDate        string `json:"end_date"`
		ForceAssign    bool   `json:"force_assign"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate required fields
	if req.VehicleGroupID == 0 || req.ClusterID == 0 || req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle Group, Cluster, and Dates are required"})
		return
	}

	// Verify cluster exists
	var clusterExists int
	err := config.DB.QueryRow(`SELECT 1 FROM driver_clusters WHERE id = ?`, req.ClusterID).Scan(&clusterExists)
	if err != nil {
		log.Printf("Get cluster error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cluster"})
		return
	}

	// Get all drivers in the cluster
	driverRows, err := config.DB.Query(`
		SELECT d.id, u.full_name 
		FROM driver_cluster_members dcm
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN users u ON d.user_id = u.id 
		WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
	`, req.ClusterID)

	if err != nil {
		log.Printf("Get cluster drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching cluster drivers"})
		return
	}
	defer driverRows.Close()

	type driverInfo struct {
		id   int
		name string
	}
	var drivers []driverInfo
	for driverRows.Next() {
		var d driverInfo
		driverRows.Scan(&d.id, &d.name)
		drivers = append(drivers, d)
	}

	if len(drivers) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cluster has no drivers"})
		return
	}

	// Gather time ranges to check (from provided shift or cluster default)
	type timeRange struct{ start, end string }
	var ranges []timeRange

	// Use provided shift or cluster default
	targetShiftID := 0
	if req.ShiftID > 0 {
		targetShiftID = req.ShiftID
	}

	if targetShiftID > 0 {
		// Get main shift times
		if len(ranges) == 0 {
			var s, e sql.NullString
			_ = config.DB.QueryRow(`SELECT start_time, end_time FROM shifts WHERE id = ?`, targetShiftID).Scan(&s, &e)
			if s.Valid && e.Valid {
				ranges = append(ranges, timeRange{start: s.String, end: e.String})
			}
		}
	}

	// Priority 2: Use cluster's own start/end times if no shift times found
	// Removed cluster timing default as per requirement

	// Priority 3: If no valid time range found
	if len(ranges) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "cluster_configuration_error",
			"message": "A shift or time range is required. Please select a shift or configure the Driver Group.",
		})
		return
	}

	// Check for conflicts across all drivers in the cluster
	var conflictingDrivers []map[string]interface{}
	hasConflict := false

	start, _ := time.Parse("2006-01-02", req.StartDate)
	end, _ := time.Parse("2006-01-02", req.EndDate)
	if end.Before(start) {
		end = start
	}

	// CHECK VEHICLE GROUP CONFLICTS
	var vehicleIDs []int
	// Get all vehicles in the group
	vRows, vErr := config.DB.Query(`
		SELECT v.id FROM vehicle_group_members vgm
		JOIN vehicles v ON v.id = vgm.vehicle_id
		WHERE vgm.group_id = ? AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
	`, req.VehicleGroupID)
	if vErr == nil {
		defer vRows.Close()
		for vRows.Next() {
			var vid int
			vRows.Scan(&vid)
			vehicleIDs = append(vehicleIDs, vid)
		}
	}

	for _, vid := range vehicleIDs {
		// For each day in range
		for d := start; !d.After(end); d = d.Add(24 * time.Hour) {
			checkDate := d.Format("2006-01-02")
			
			// Query for overlapping assignments for this vehicle on this date
			// 1. Regular assignments (join shifts)
			// 2. EV assignments (join cluster -> shift)  <-- Modified to use GROUP CHECK logic if needed, but here checking existing active assignments
			// 3. Temp assignments (join shift)
			
			query := `
				SELECT s.start_time, s.end_time
				FROM assignments a
				JOIN shifts s ON a.shift_id = s.id
				WHERE a.vehicle_id = ?
				AND ? BETWEEN a.start_date AND a.end_date
				AND a.status IN ('assigned','active')
				
				UNION ALL
				
				SELECT COALESCE(s.start_time, dc.start_time, '08:00:00'), COALESCE(s.end_time, dc.end_time, '17:00:00')
				FROM ev_assignments ev
				JOIN driver_clusters dc ON ev.cluster_id = dc.id
				LEFT JOIN shifts s ON ev.shift_id = s.id
				WHERE ev.vehicle_group_id = (SELECT group_id FROM vehicles WHERE id = ?) -- Check if current vehicle is in a group that is assigned
				AND ? BETWEEN ev.start_date AND ev.end_date
				AND ev.status = 'active'
				
				UNION ALL

				SELECT s.start_time, s.end_time
				FROM temporary_assignments ta
				JOIN shifts s ON ta.shift_id = s.id
				WHERE ta.vehicle_id = ?
				AND ? BETWEEN ta.start_date AND ta.end_date
				AND ta.status = 'active'
			`
			
			// Parameters: 1) vehicle_id for assignments, 2) date, 3) vehicle_id for ev_assignments check (via group), 4) date, 5) vehicle_id for temp assignments, 6) date
			rows, err := config.DB.Query(query, vid, checkDate, vid, checkDate, vid, checkDate)
			if err != nil {
				log.Printf("Error checking vehicle conflict: %v", err)
				continue
			}
			
			vehicleConflicted := false
			for rows.Next() {
				var st, et sql.NullString
				rows.Scan(&st, &et)
				
				// Check overlap with ANY of our ranges
				for _, r := range ranges {
					// Helper to check overlap
					isOverlap := false
					
					parseToMin := func(t string) int {
						if len(t) > 5 { t = t[:5] }
						pt, _ := time.Parse("15:04", t)
						return pt.Hour()*60 + pt.Minute()
					}
					
					var cStart, cEnd string
					if st.Valid && et.Valid {
						cStart, cEnd = st.String, et.String
					} else {
						continue 
					}
					
					rStartMin := parseToMin(r.start)
					rEndMin := parseToMin(r.end)
					cStartMin := parseToMin(cStart)
					cEndMin := parseToMin(cEnd)
					
					if rStartMin < cEndMin && rEndMin > cStartMin {
						isOverlap = true
					}
					
					if isOverlap {
						vehicleConflicted = true
						break
					}
				}
				if vehicleConflicted {
					break
				}
			}
			rows.Close()
			
			if vehicleConflicted {
				c.JSON(http.StatusConflict, gin.H{
					"error": "vehicle_conflict",
					"message": "One or more vehicles in the group are already assigned during the selected time.",
					"vehicle_id": vid,
					"date": checkDate,
				})
				return
			}
		}
	}

	for _, driver := range drivers {
		driverHasConflict := false
		var driverConflicts []map[string]interface{}

		for d := start; !d.After(end); d = d.Add(24 * time.Hour) {
			checkDate := d.Format("2006-01-02")
			for _, r := range ranges {
				conflict, err := CheckDriverTimeConflict(driver.id, r.start, r.end, checkDate)
				if err != nil {
					log.Printf("Error checking time conflict for driver %d: %v", driver.id, err)
					continue
				}
				if conflict {
					driverHasConflict = true
					hasConflict = true
					checkRanges := []struct{ start, end string }{{start: r.start, end: r.end}}
					conflicts, _ := getDriverConflictsDetails(driver.id, checkDate, checkRanges)
					driverConflicts = append(driverConflicts, conflicts...)
					break
				}
			}
			if driverHasConflict {
				break
			}
		}

		if driverHasConflict {
			conflictingDrivers = append(conflictingDrivers, map[string]interface{}{
				"driver_id":   driver.id,
				"driver_name": driver.name,
				"conflicts":   driverConflicts,
			})
		}
	}

	if hasConflict && !req.ForceAssign {
		c.JSON(http.StatusConflict, gin.H{
			"error":               "time_conflict",
			"message":             "One or more drivers in the cluster have time conflicts",
			"conflicting_drivers": conflictingDrivers,
		})
		return
	}

	// Create assignment for the group
	// Prepare insert query - removed shift_slot_id and vehicle_id
	query := `
		INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status, shift_id)
		VALUES (?, ?, ?, ?, 'active', ?)
	`

	// Handle ShiftID
	var shiftIDParam sql.NullInt64
	if req.ShiftID > 0 {
		shiftIDParam = sql.NullInt64{Int64: int64(req.ShiftID), Valid: true}
	}

	res, err := config.DB.Exec(query, req.VehicleGroupID, req.ClusterID, req.StartDate, req.EndDate, shiftIDParam)

	if err != nil {
		log.Printf("Create EV assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating EV assignment"})
		return
	}
	
	lastID, _ := res.LastInsertId()

	if req.ForceAssign {
		c.JSON(http.StatusOK, gin.H{
			"message":       "EV assignment created successfully (forced)",
			"id": lastID,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"message":       "EV assignment created successfully",
			"id": lastID,
		})
	}
}

/*
=========================

	DELETE /api/admin/ev-assignments/delete
	Delete an EV assignment

=========================
*/
func DeleteEVAssignment(c *gin.Context) {
	// Try query param first
	idStr := c.Query("id")
	if idStr == "" {
		// Fallback to JSON body
		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err == nil && req.ID > 0 {
			idStr = strconv.Itoa(req.ID)
		}
	}

	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Check if this is part of a group assignment
	var groupInfo struct {
		VehicleGroupID sql.NullInt64
		ClusterID      int
		StartDate      string
		EndDate        string
	}
	err = config.DB.QueryRow(`
		SELECT vehicle_group_id, cluster_id, start_date, end_date 
		FROM ev_assignments WHERE id = ?
	`, id).Scan(&groupInfo.VehicleGroupID, &groupInfo.ClusterID, &groupInfo.StartDate, &groupInfo.EndDate)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	// Delete only the specific assignment by ID
	_, err = config.DB.Exec("DELETE FROM ev_assignments WHERE id = ?", id)
	if err != nil {
		log.Printf("Delete EV assignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete EV assignment"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "EV assignment deleted"})
}

/*
=========================

	GET /api/admin/ev-assignments/:id/details
	Get detailed EV assignment info with drivers and KM logs

=========================
*/
func GetEVAssignmentDetails(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignment ID"})
		return
	}

	type DriverInfo struct {
		DriverID   int     `json:"driver_id"`
		DriverName string  `json:"driver_name"`
		Initials   string  `json:"initials"`
		Status     string  `json:"status"`
		OnLeave    bool    `json:"on_leave"`
		TotalKM    float64 `json:"total_km"`
	}

	type KMLog struct {
		ID         int     `json:"id"`
		Date       string  `json:"date"`
		DriverName string  `json:"driver_name"`
		StartKM    float64 `json:"start_km"`
		EndKM      float64 `json:"end_km"`
		TotalKM    float64 `json:"total_km"`
		VehicleNum string  `json:"vehicle_number"`
	}

	// Response structure - flat for clean frontend access
	type Response struct {
		ID               int            `json:"id"`
		VehicleGroupID   int            `json:"vehicle_group_id"`
		VehicleGroupName string         `json:"vehicle_group_name"`
		ClusterID        int            `json:"cluster_id"`
		ClusterName      string         `json:"cluster_name"`
		StartDate        string         `json:"start_date"`
		EndDate          string         `json:"end_date"`
		Status           string         `json:"status"`
		ShiftName        string         `json:"shift_name"`
		ShiftStartTime   string         `json:"shift_start_time"`
		ShiftEndTime     string         `json:"shift_end_time"`
		CreatedAt        string         `json:"created_at"`
		DaysTotal        int            `json:"days_total"`
		DaysRemaining    int            `json:"days_remaining"`
		DaysCompleted    int            `json:"days_completed"`
		Vehicles         []GroupVehicle `json:"vehicles"`
		Drivers          []DriverInfo   `json:"drivers"`
		KMLogs           []KMLog        `json:"km_logs"`
		TotalKM          float64        `json:"total_km"`
	}

	var response Response

	err = config.DB.QueryRow(`
		SELECT ea.id, ea.vehicle_group_id,
		       COALESCE(vg.name, 'Unknown Group') as vehicle_group_name,
		       ea.cluster_id, c.name as cluster_name,
		       DATE_FORMAT(ea.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(ea.end_date, '%d-%m-%Y') as end_date,
		       ea.status,
		       COALESCE(s.name, 'Default') as shift_name,
		       TIME_FORMAT(s.start_time, '%H:%i') as shift_start_time,
		       TIME_FORMAT(s.end_time, '%H:%i') as shift_end_time,
		       DATE_FORMAT(ea.created_at, '%d-%m-%Y %H:%i') as created_at
		FROM ev_assignments ea
		LEFT JOIN vehicle_groups vg ON ea.vehicle_group_id = vg.id
		JOIN driver_clusters c ON ea.cluster_id = c.id
		LEFT JOIN shifts s ON ea.shift_id = s.id
		WHERE ea.id = ?
	`, id).Scan(&response.ID, &response.VehicleGroupID, &response.VehicleGroupName,
		&response.ClusterID, &response.ClusterName,
		&response.StartDate, &response.EndDate, &response.Status,
		&response.ShiftName, &response.ShiftStartTime, &response.ShiftEndTime, &response.CreatedAt)

	if err != nil {
		log.Printf("Get EV assignment details error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}
	// Fetch vehicles in this group
	var vehicleIDs []int
	vRows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type 
		FROM vehicle_group_members vgm
		JOIN vehicles v ON v.id = vgm.vehicle_id
		WHERE vgm.group_id = ? AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
	`, response.VehicleGroupID)
	if err == nil {
		defer vRows.Close()
		for vRows.Next() {
			var gv GroupVehicle
			vRows.Scan(&gv.ID, &gv.VehicleNumber, &gv.VehicleType)
			gid := response.VehicleGroupID
			gv.GroupID = &gid
			response.Vehicles = append(response.Vehicles, gv)
			vehicleIDs = append(vehicleIDs, gv.ID)
		}
	}

	// Calculate days
	startDate, _ := time.Parse("2006-01-02", response.StartDate)
	endDate, _ := time.Parse("2006-01-02", response.EndDate)
	today := time.Now().Truncate(24 * time.Hour)

	response.DaysTotal = int(endDate.Sub(startDate).Hours()/24) + 1

	if today.Before(startDate) {
		response.DaysRemaining = response.DaysTotal
		response.DaysCompleted = 0
	} else if today.After(endDate) {
		response.DaysRemaining = 0
		response.DaysCompleted = response.DaysTotal
	} else {
		response.DaysCompleted = int(today.Sub(startDate).Hours()/24) + 1
		response.DaysRemaining = response.DaysTotal - response.DaysCompleted
	}

	// Fetch drivers and calculate KM based on ALL vehicles in the group
	driverRows, err := config.DB.Query(`
		SELECT d.id, u.full_name, u.status,
		       EXISTS(SELECT 1 FROM leave_requests lr 
		              WHERE lr.driver_id = d.id 
		              AND lr.status = 'admin_approved'
		              AND CURDATE() BETWEEN lr.start_date AND lr.end_date) as on_leave
		FROM driver_cluster_members dcm
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN users u ON d.user_id = u.id
		WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		ORDER BY u.full_name
	`, response.ClusterID)

	if err == nil {
		defer driverRows.Close()
		for driverRows.Next() {
			var di DriverInfo
			var onLeave int
			driverRows.Scan(&di.DriverID, &di.DriverName, &di.Status, &onLeave)
			di.OnLeave = onLeave == 1
			di.TotalKM = 0
			
			// Calculate KM for this driver across all assigned vehicles
			if len(vehicleIDs) > 0 {
				params := []interface{}{di.DriverID, response.StartDate, response.EndDate}
				ph := ""
				for i, v := range vehicleIDs {
					if i > 0 { ph += "," }
					ph += "?"
					params = append(params, v)
				}
				
				// Reorder params: driver_id, date, date, ...vehicles... (depends on query structure)
				// Query: WHERE driver_id = ? AND date BETWEEN ? AND ? AND vehicle_id IN (?,?,?)
				query := `SELECT COALESCE(SUM(total_km), 0) FROM km_logs 
		            WHERE driver_id = ? 
		            AND date BETWEEN ? AND ?
		            AND vehicle_id IN (` + ph + `)`
				
				config.DB.QueryRow(query, params...).Scan(&di.TotalKM)
			}

			// Generate Initials
			init := ""
			words := splitName(di.DriverName)
			for _, w := range words {
				if len(w) > 0 { init += string(w[0]) }
			}
			if len(init) > 2 { init = init[:2] }
			di.Initials = init
			
			response.Drivers = append(response.Drivers, di)
		}
	}

	// Get total KM for ALL vehicles in this assignment group
	if len(vehicleIDs) > 0 {
		params := []interface{}{response.StartDate, response.EndDate}
		ph := ""
		for i, v := range vehicleIDs {
			if i > 0 { ph += "," }
			ph += "?"
			params = append(params, v)
		}
		
		query := `
			SELECT COALESCE(SUM(total_km), 0) 
			FROM km_logs 
			WHERE date BETWEEN ? AND ?
			AND vehicle_id IN (` + ph + `)`
			
		config.DB.QueryRow(query, params...).Scan(&response.TotalKM)
	}

	// Get recent KM logs for all vehicles
	if len(vehicleIDs) > 0 {
		// Build IN clause
		ph := ""
		params := []interface{}{}
		for i, v := range vehicleIDs {
			if i > 0 { ph += "," }
			ph += "?"
			params = append(params, v)
		}
		params = append(params, response.StartDate, response.EndDate)
		
		q := `
			SELECT kl.id, DATE_FORMAT(kl.date, '%d-%m-%Y') as date, 
			       u.full_name as driver_name, kl.start_km, kl.end_km, kl.total_km, v.vehicle_number
			FROM km_logs kl
			JOIN drivers d ON kl.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			JOIN vehicles v ON kl.vehicle_id = v.id
			WHERE kl.vehicle_id IN (` + ph + `)
			AND kl.date BETWEEN ? AND ?
			ORDER BY kl.date DESC, kl.id DESC
			LIMIT 10
		`
		
		logRows, err := config.DB.Query(q, params...)
		if err == nil {
			defer logRows.Close()
			for logRows.Next() {
				var l KMLog
				logRows.Scan(&l.ID, &l.Date, &l.DriverName, &l.StartKM, &l.EndKM, &l.TotalKM, &l.VehicleNum)
				response.KMLogs = append(response.KMLogs, l)
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

// Helper function to split name into words
func splitName(name string) []string {
	var words []string
	var current string
	for _, c := range name {
		if c == ' ' {
			if current != "" {
				words = append(words, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		words = append(words, current)
	}
	return words
}

/*
=========================

	POST /api/admin/ev-assignments/reassign
	Reassign EV assignment to a different cluster for a specific period

=========================
*/
type ReassignEVRequest struct {
	AssignmentID  int    `json:"assignment_id"`
	NewClusterID  int    `json:"new_cluster_id"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	Reason        string `json:"reason"`
}

func ReassignEVAssignment(c *gin.Context) {
	var req ReassignEVRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate required fields
	if req.AssignmentID <= 0 || req.NewClusterID <= 0 || req.StartDate == "" || req.EndDate == "" || req.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "All fields are required"})
		return
	}

	// Validate date range
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date format"})
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date format"})
		return
	}
	if endDate.Before(startDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End date must be after start date"})
		return
	}

	// Get original assignment details
	var originalAssignment struct {
		VehicleGroupID    int
		OriginalClusterID int
		OriginalStart     string
		OriginalEnd       string
		Status            string
	}
	err = config.DB.QueryRow(`
		SELECT vehicle_group_id, cluster_id, 
		       DATE_FORMAT(start_date, '%d-%m-%Y'),
		       DATE_FORMAT(end_date, '%d-%m-%Y'),
		       status
		FROM ev_assignments 
		WHERE id = ?
	`, req.AssignmentID).Scan(
		&originalAssignment.VehicleGroupID,
		&originalAssignment.OriginalClusterID,
		&originalAssignment.OriginalStart,
		&originalAssignment.OriginalEnd,
		&originalAssignment.Status,
	)
	if err != nil {
		log.Printf("Get EV assignment error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	// Verify new cluster exists
	var clusterExists int
	err = config.DB.QueryRow(`SELECT COUNT(*) FROM driver_clusters WHERE id = ?`, req.NewClusterID).Scan(&clusterExists)
	if err != nil || clusterExists == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New cluster not found"})
		return
	}

	// Parse original dates
	origStart, _ := time.Parse("2006-01-02", originalAssignment.OriginalStart)
	origEnd, _ := time.Parse("2006-01-02", originalAssignment.OriginalEnd)

	// Validate reassignment dates are within original assignment period
	if startDate.Before(origStart) || endDate.After(origEnd) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reassignment dates must be within original assignment period"})
		return
	}

	// Begin transaction
	tx, err := config.DB.Begin()
	if err != nil {
		log.Printf("Begin transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback()

	// Strategy: Split the original assignment if necessary and insert new assignment
	// Case 1: Reassignment starts after original start
	if startDate.After(origStart) {
		// Update original assignment to end before reassignment
		dayBefore := startDate.Add(-24 * time.Hour).Format("2006-01-02")
		_, err = tx.Exec(`
			UPDATE ev_assignments 
			SET end_date = ? 
			WHERE id = ?
		`, dayBefore, req.AssignmentID)
		if err != nil {
			log.Printf("Update original assignment error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment"})
			return
		}
	} else {
		// Reassignment starts on same day as original - just update start date
		dayAfter := endDate.Add(24 * time.Hour).Format("2006-01-02")
		_, err = tx.Exec(`
			UPDATE ev_assignments 
			SET start_date = ? 
			WHERE id = ?
		`, dayAfter, req.AssignmentID)
		if err != nil {
			log.Printf("Update original assignment start error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignment"})
			return
		}
	}

	// Insert reassignment as new EV assignment
	_, err = tx.Exec(`
		INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status)
		VALUES (?, ?, ?, ?, 'active')
	`, originalAssignment.VehicleGroupID, req.NewClusterID, req.StartDate, req.EndDate)
	if err != nil {
		log.Printf("Create reassignment error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reassignment"})
		return
	}

	// If there's a period after reassignment, create another assignment for original cluster
	if endDate.Before(origEnd) {
		dayAfter := endDate.Add(24 * time.Hour).Format("2006-01-02")
		_, err = tx.Exec(`
			INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status)
			VALUES (?, ?, ?, ?, 'active')
		`, originalAssignment.VehicleGroupID, originalAssignment.OriginalClusterID, dayAfter, originalAssignment.OriginalEnd)
		if err != nil {
			log.Printf("Create post-reassignment error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post-reassignment"})
			return
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		log.Printf("Commit transaction error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete reassignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "EV assignment reassigned successfully"})
}
