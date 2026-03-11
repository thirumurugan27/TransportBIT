package driver

import (
	"database/sql"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// KmLog - kilometer log entry
type KmLog struct {
	ID            int      `json:"id"`
	DriverID      int      `json:"driver_id"`
	Date          string   `json:"date"`
	StartKm       float64  `json:"start_km"`
	EndKm         float64  `json:"end_km"`
	TotalKm       float64  `json:"total_km"`
	FuelConsumed  *float64 `json:"fuel_consumed"`
	Remarks       string   `json:"remarks"`
	VehicleType   string   `json:"vehicle_type"`
	VehicleID     *int     `json:"vehicle_id"`
	VehicleNumber *string  `json:"vehicle_number"`
	Status        string   `json:"status"`
}

// KmLogRequest - request to add km log
type KmLogRequest struct {
	DriverID     int      `json:"driver_id"`
	Date         string   `json:"date"`
	StartKm      float64  `json:"start_km"`
	EndKm        float64  `json:"end_km"`
	TotalKm      float64  `json:"total_km"`
	FuelConsumed *float64 `json:"fuel_consumed"`
	Remarks      string   `json:"remarks"`
	VehicleID    *int     `json:"vehicle_id"`
	AssignmentID *int     `json:"assignment_id"`
	ShiftID      *int     `json:"shift_id"`
	Force        bool     `json:"force"`
}
type KmLogAssignedVehicle struct {
	ID            int    `json:"id"`
	VehicleName   string `json:"vehicle_name"`
	VehicleNumber string `json:"vehicle_number"`
	VehicleType   string `json:"vehicle_type"`
	FuelType      string `json:"fuel_type"`
	AssignmentID  *int   `json:"assignment_id"`
	Source        string `json:"source"`
	SourceLabel   string `json:"source_label"`
}

func upsertKmAssignedVehicle(vehicleMap map[int]KmLogAssignedVehicle, v KmLogAssignedVehicle) {
	if v.ID == 0 {
		return
	}
	existing, exists := vehicleMap[v.ID]
	if !exists {
		vehicleMap[v.ID] = v
		return
	}
	if strings.TrimSpace(existing.VehicleName) == "" && strings.TrimSpace(v.VehicleName) != "" {
		existing.VehicleName = v.VehicleName
	}
	if strings.TrimSpace(existing.VehicleNumber) == "" && strings.TrimSpace(v.VehicleNumber) != "" {
		existing.VehicleNumber = v.VehicleNumber
	}
	if strings.TrimSpace(existing.VehicleType) == "" && strings.TrimSpace(v.VehicleType) != "" {
		existing.VehicleType = v.VehicleType
	}
	if strings.TrimSpace(existing.FuelType) == "" && strings.TrimSpace(v.FuelType) != "" {
		existing.FuelType = v.FuelType
	}
	if existing.AssignmentID == nil && v.AssignmentID != nil {
		existing.AssignmentID = v.AssignmentID
	}
	if strings.TrimSpace(existing.Source) == "" && strings.TrimSpace(v.Source) != "" {
		existing.Source = v.Source
	}
	if strings.TrimSpace(existing.SourceLabel) == "" && strings.TrimSpace(v.SourceLabel) != "" {
		existing.SourceLabel = v.SourceLabel
	}
	vehicleMap[v.ID] = existing
}
func toKmVehicleList(vehicleMap map[int]KmLogAssignedVehicle) []KmLogAssignedVehicle {
	vehicles := make([]KmLogAssignedVehicle, 0, len(vehicleMap))
	for _, v := range vehicleMap {
		if strings.TrimSpace(v.VehicleType) == "" {
			if strings.EqualFold(strings.TrimSpace(v.FuelType), "EV") {
				v.VehicleType = "EV"
			} else {
				v.VehicleType = "Vehicle"
			}
		}
		if strings.TrimSpace(v.SourceLabel) == "" {
			switch v.Source {
			case "assignment":
				v.SourceLabel = "Shift Assignment"
			case "temporary":
				v.SourceLabel = "Temporary Assignment"
			case "ev_group":
				v.SourceLabel = "EV Group Assignment"
			case "vehicle_request":
				v.SourceLabel = "Vehicle Request"
			default:
				v.SourceLabel = "Assigned"
			}
		}
		vehicles = append(vehicles, v)
	}

	sort.Slice(vehicles, func(i, j int) bool {
		left := strings.ToLower(strings.TrimSpace(vehicles[i].VehicleName))
		right := strings.ToLower(strings.TrimSpace(vehicles[j].VehicleName))
		if left == "" {
			left = strings.ToLower(strings.TrimSpace(vehicles[i].VehicleNumber))
		}
		if right == "" {
			right = strings.ToLower(strings.TrimSpace(vehicles[j].VehicleNumber))
		}
		if left == right {
			return vehicles[i].ID < vehicles[j].ID
		}
		return left < right
	})

	return vehicles
}

/*
=========================

	GET /api/driver/km-log/assigned-vehicles

=========================
*/
func GetDriverKmLogAssignedVehicles(c *gin.Context) {
	driverID := c.Query("driver_id")
	date := c.Query("date")

	if driverID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	driverIDInt, err := strconv.Atoi(driverID)
	if err != nil || driverIDInt <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid driver_id"})
		return
	}

	vehicleMap := make(map[int]KmLogAssignedVehicle)

	// 1) Regular assignments
	assignmentRows, err := config.DB.Query(`
		SELECT v.id,
		       COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
		       COALESCE(v.vehicle_number, '') as vehicle_number,
		       COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
		       COALESCE(v.fuel_type, '') as fuel_type,
		       a.id as assignment_id
		FROM assignments a
		JOIN vehicles v ON v.id = a.vehicle_id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE a.driver_id = ?
		  AND ? BETWEEN a.start_date AND a.end_date
	`, driverIDInt, date)
	if err != nil {
		log.Printf("GetDriverKmLogAssignedVehicles regular assignment query error: %v", err)
	} else {
		defer assignmentRows.Close()
		for assignmentRows.Next() {
			var v KmLogAssignedVehicle
			var assignmentID int
			if scanErr := assignmentRows.Scan(&v.ID, &v.VehicleName, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &assignmentID); scanErr == nil {
				v.AssignmentID = &assignmentID
				v.Source = "assignment"
				v.SourceLabel = "Shift Assignment"
				upsertKmAssignedVehicle(vehicleMap, v)
			}
		}
	}

	// 2) Temporary assignments
	tempRows, err := config.DB.Query(`
		SELECT v.id,
		       COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
		       COALESCE(v.vehicle_number, '') as vehicle_number,
		       COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
		       COALESCE(v.fuel_type, '') as fuel_type,
		       ta.id as temporary_assignment_id
		FROM temporary_assignments ta
		JOIN vehicles v ON v.id = ta.vehicle_id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE ta.replacement_driver_id = ?
		  AND ? BETWEEN ta.start_date AND ta.end_date
		  AND ta.status = 'active'
	`, driverIDInt, date)
	if err != nil {
		log.Printf("GetDriverKmLogAssignedVehicles temporary assignment query error: %v", err)
	} else {
		defer tempRows.Close()
		for tempRows.Next() {
			var v KmLogAssignedVehicle
			var tempAssignmentID int
			if scanErr := tempRows.Scan(&v.ID, &v.VehicleName, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &tempAssignmentID); scanErr == nil {
				v.Source = "temporary"
				v.SourceLabel = "Temporary Assignment"
				upsertKmAssignedVehicle(vehicleMap, v)
			}
		}
	}

	// 3) EV group assignments
	evRows, err := config.DB.Query(`
		SELECT DISTINCT v.id,
		       COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
		       COALESCE(v.vehicle_number, '') as vehicle_number,
		       COALESCE(vt.type, v.fuel_type, 'EV') as vehicle_type,
		       COALESCE(v.fuel_type, 'EV') as fuel_type
		FROM ev_assignments ev
		JOIN driver_cluster_members dcm ON dcm.cluster_id = ev.cluster_id
		JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
		JOIN vehicles v ON v.id = vgm.vehicle_id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE dcm.driver_id = ?
		  AND ? BETWEEN ev.start_date AND ev.end_date
		  AND ev.status = 'active'
		  AND (dcm.valid_from IS NULL OR ? >= dcm.valid_from)
		  AND (dcm.valid_to IS NULL OR ? <= dcm.valid_to)
		  AND (vgm.valid_from IS NULL OR ? >= vgm.valid_from)
		  AND (vgm.valid_to IS NULL OR ? <= vgm.valid_to)
	`, driverIDInt, date, date, date, date, date)
	if err != nil {
		log.Printf("GetDriverKmLogAssignedVehicles EV assignment query error: %v", err)
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var v KmLogAssignedVehicle
			if scanErr := evRows.Scan(&v.ID, &v.VehicleName, &v.VehicleNumber, &v.VehicleType, &v.FuelType); scanErr == nil {
				v.Source = "ev_group"
				v.SourceLabel = "EV Group Assignment"
				upsertKmAssignedVehicle(vehicleMap, v)
			}
		}
	}

	// 4) Vehicle requests assigned to driver
	// Include active request assignments always; include completed requests for the selected date.
	vrColumns, colErr := config.HasColumns("vehiclerequests", "driver_id", "vehicle_id", "status", "created_at", "assigned_at")
	if colErr != nil {
		log.Printf("GetDriverKmLogAssignedVehicles vehiclerequests column check error: %v", colErr)
	} else if vrColumns["driver_id"] && vrColumns["vehicle_id"] && vrColumns["status"] {
		scheduleExpr := "COALESCE(vrt.from_datetime"
		if vrColumns["assigned_at"] {
			scheduleExpr += ", vr.assigned_at"
		}
		if vrColumns["created_at"] {
			scheduleExpr += ", vr.created_at"
		}
		scheduleExpr += ")"

		query := `
			SELECT DISTINCT v.id,
			       COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
			       COALESCE(v.vehicle_number, '') as vehicle_number,
			       COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
			       COALESCE(v.fuel_type, '') as fuel_type
			FROM vehiclerequests vr
			JOIN vehicles v ON v.id = vr.vehicle_id
			LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
			LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id
			WHERE vr.driver_id = ?
			  AND vr.vehicle_id IS NOT NULL
			  AND (
			       vr.status IN ('assigned', 'trip_started')
			       OR (vr.status = 'completed' AND DATE(` + scheduleExpr + `) = ?)
			  )
		`

		requestRows, reqErr := config.DB.Query(query, driverIDInt, date)
		if reqErr != nil {
			log.Printf("GetDriverKmLogAssignedVehicles vehicle request query error: %v", reqErr)
		} else {
			defer requestRows.Close()
			for requestRows.Next() {
				var v KmLogAssignedVehicle
				if scanErr := requestRows.Scan(&v.ID, &v.VehicleName, &v.VehicleNumber, &v.VehicleType, &v.FuelType); scanErr == nil {
					v.Source = "vehicle_request"
					v.SourceLabel = "Vehicle Request"
					upsertKmAssignedVehicle(vehicleMap, v)
				}
			}
		}
	}

	c.JSON(http.StatusOK, toKmVehicleList(vehicleMap))
}

/*
=========================

	GET /api/driver/km-logs

=========================
*/
func GetDriverKmLogs(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT k.id, k.driver_id, DATE_FORMAT(k.date, '%d-%m-%Y') as date, 
		       k.start_km, k.end_km, k.total_km, k.fuel_consumed,
		       COALESCE(k.remarks, '') as remarks,
			   COALESCE(vt.type, '') as vehicle_type, k.vehicle_id, v.vehicle_number,
			   COALESCE(k.status, 'approved') as status
		FROM km_logs k
		LEFT JOIN vehicles v ON k.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE k.driver_id = ?
		ORDER BY k.date DESC
		LIMIT 30
	`, driverID)

	if err != nil {
		log.Printf("Get km logs error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching km logs"})
		return
	}
	defer rows.Close()

	var logs []KmLog
	for rows.Next() {
		var l KmLog
		var vehicleID *int
		var vehicleNumber *string
		rows.Scan(&l.ID, &l.DriverID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.FuelConsumed, &l.Remarks, &l.VehicleType, &vehicleID, &vehicleNumber, &l.Status)
		l.VehicleID = vehicleID
		l.VehicleNumber = vehicleNumber
		logs = append(logs, l)
	}

	c.JSON(http.StatusOK, logs)
}

/*
=========================

	POST /api/driver/km-log/add

=========================
*/
func AddDriverKmLog(c *gin.Context) {
	var req KmLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate
	if req.DriverID == 0 || req.Date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id and date required"})
		return
	}

	if req.VehicleID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	if req.EndKm < req.StartKm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End KM must be greater than Start KM"})
		return
	}

	// Calculate total if not provided or incorrect
	if req.TotalKm == 0 {
		req.TotalKm = req.EndKm - req.StartKm
	}

	// Check for duplicate entry unless force flag is set
	if !req.Force {
		var existingID int
		var dupErr error
		if req.ShiftID != nil {
			dupErr = config.DB.QueryRow(`SELECT id FROM km_logs WHERE driver_id = ? AND date = ? AND vehicle_id = ? AND shift_id = ?`,
				req.DriverID, req.Date, *req.VehicleID, *req.ShiftID).Scan(&existingID)
		} else {
			dupErr = config.DB.QueryRow(`SELECT id FROM km_logs WHERE driver_id = ? AND date = ? AND vehicle_id = ?`,
				req.DriverID, req.Date, *req.VehicleID).Scan(&existingID)
		}
		if dupErr == nil {
			c.JSON(http.StatusConflict, gin.H{
				"code":  "duplicate",
				"error": "You have already submitted a KM log for this date and vehicle. Do you want to add another log?",
			})
			return
		}
	}

	// Fetch driver user info for recorded_by metadata
	var recordedByUserID int
	err := config.DB.QueryRow(`
		SELECT u.id
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.id = ?
	`, req.DriverID).Scan(&recordedByUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	// Auto-detect assignment if not provided
	if req.AssignmentID == nil {
		var assignmentID sql.NullInt64
		err = config.DB.QueryRow(`
			SELECT id FROM assignments
			WHERE driver_id = ? AND vehicle_id = ? AND ? BETWEEN start_date AND end_date
			ORDER BY start_date DESC
			LIMIT 1
		`, req.DriverID, *req.VehicleID, req.Date).Scan(&assignmentID)
		if err == nil && assignmentID.Valid {
			val := int(assignmentID.Int64)
			req.AssignmentID = &val
		}
	}

	var vehicleID interface{}
	if req.VehicleID != nil {
		vehicleID = *req.VehicleID
	}

	var assignmentID interface{}
	if req.AssignmentID != nil {
		assignmentID = *req.AssignmentID
	}

	var shiftID interface{}
	if req.ShiftID != nil {
		shiftID = *req.ShiftID
	}

	// Insert into DB with status='pending' - requires admin approval
	var fuelConsumed interface{}
	if req.FuelConsumed != nil {
		fuelConsumed = *req.FuelConsumed
	}

	result, err := config.DB.Exec(`
		INSERT INTO km_logs (
			driver_id, date, start_km, end_km, total_km, fuel_consumed, remarks,
			vehicle_id, assignment_id, shift_id,
			recorded_by_user_id, status
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
	`, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, fuelConsumed, req.Remarks, vehicleID, assignmentID, shiftID, recordedByUserID)

	if err != nil {
		log.Printf("Add km log error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding km log"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "KM log submitted for approval",
		"id":      id,
		"status":  "pending",
	})
}

/*
=========================

	GET /api/driver/vehicle-last-log

=========================
*/
func GetLastLogForVehicle(c *gin.Context) {
	vehicleID := c.Query("vehicle_id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	var endKm float64
	err := config.DB.QueryRow(`
		SELECT end_km 
		FROM km_logs 
		WHERE vehicle_id = ? 
		ORDER BY date DESC, end_km DESC 
		LIMIT 1
	`, vehicleID).Scan(&endKm)

	if err != nil {
		endKm = 0
	}

	c.JSON(http.StatusOK, gin.H{"end_km": endKm})
}
