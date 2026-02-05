package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// GetDriverAssignedVehicles returns all vehicles currently assigned to a driver
// across regular assignments, temporary assignments, and EV cluster assignments
func GetDriverAssignedVehicles(c *gin.Context) {
	driverIDStr := c.Query("driver_id")
	dateParam := c.DefaultQuery("date", "")

	if driverIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	driverID, err := strconv.Atoi(driverIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver_id"})
		return
	}

	log.Printf("[GetDriverAssignedVehicles] Looking for driver_id=%d, date=%s", driverID, dateParam)

	// Default to today if no date provided
	dateFilter := "CURDATE()"
	var args []interface{}
	if dateParam != "" {
		dateFilter = "?"
		args = append(args, dateParam)
	}

	type assignedVehicle struct {
		VehicleID      int     `json:"vehicle_id"`
		VehicleNumber  string  `json:"vehicle_number"`
		VehicleType    string  `json:"vehicle_type"`
		VehicleName    *string `json:"vehicle_name"`
		AssignmentID   *int    `json:"assignment_id"`
		AssignmentType string  `json:"assignment_type"`
		ShiftName      *string `json:"shift_name"`
		StartTime      *string `json:"start_time"`
		EndTime        *string `json:"end_time"`
		StartDate      string  `json:"start_date"`
		EndDate        string  `json:"end_date"`
	}

	var vehicles []assignedVehicle

	// Query regular assignments
	regQuery := `
		SELECT v.id, v.vehicle_number, COALESCE(v.vehicle_type, 'BUS') as vehicle_type,
		       NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
		       a.id as assignment_id, 'REGULAR' as assignment_type,
		       s.name as shift_name,
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time,
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.driver_id = ?
		AND a.status IN ('assigned', 'active')
		AND ` + dateFilter + ` BETWEEN a.start_date AND a.end_date
	`

	regArgs := []interface{}{driverID}
	if dateParam != "" {
		regArgs = append(regArgs, dateParam)
	}

	rows, err := config.DB.Query(regQuery, regArgs...)
	if err != nil {
		log.Printf("Get driver assigned vehicles (regular) error: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var v assignedVehicle
			if err := rows.Scan(&v.VehicleID, &v.VehicleNumber, &v.VehicleType, &v.VehicleName,
				&v.AssignmentID, &v.AssignmentType, &v.ShiftName, &v.StartTime, &v.EndTime,
				&v.StartDate, &v.EndDate); err == nil {
				log.Printf("[GetDriverAssignedVehicles] Found regular assignment: vehicle_id=%d, vehicle_number=%s", v.VehicleID, v.VehicleNumber)
				vehicles = append(vehicles, v)
			}
		}
	}

	log.Printf("[GetDriverAssignedVehicles] Total regular assignments found: %d", len(vehicles))

	// Query temporary assignments
	tempQuery := `
		SELECT v.id, v.vehicle_number, COALESCE(v.vehicle_type, 'BUS') as vehicle_type,
		       NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
		       ta.id as assignment_id, 'TEMPORARY' as assignment_type,
		       s.name as shift_name,
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time,
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date
		FROM temporary_assignments ta
		JOIN vehicles v ON ta.vehicle_id = v.id
		LEFT JOIN shifts s ON ta.shift_id = s.id
		WHERE ta.replacement_driver_id = ?
		AND ` + dateFilter + ` BETWEEN ta.start_date AND ta.end_date
	`

	tempArgs := []interface{}{driverID}
	if dateParam != "" {
		tempArgs = append(tempArgs, dateParam)
	}

	tempRows, err := config.DB.Query(tempQuery, tempArgs...)
	if err != nil {
		log.Printf("Get driver assigned vehicles (temp) error: %v", err)
	} else {
		defer tempRows.Close()
		for tempRows.Next() {
			var v assignedVehicle
			if err := tempRows.Scan(&v.VehicleID, &v.VehicleNumber, &v.VehicleType, &v.VehicleName,
				&v.AssignmentID, &v.AssignmentType, &v.ShiftName, &v.StartTime, &v.EndTime,
				&v.StartDate, &v.EndDate); err == nil {
				vehicles = append(vehicles, v)
			}
		}
	}

	// Query EV assignments via cluster
	evQuery := `
		SELECT v.id, v.vehicle_number, COALESCE(v.vehicle_type, 'EV') as vehicle_type,
		       NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
		       ev.id as assignment_id, 'EV_CLUSTER' as assignment_type,
		       COALESCE(s.name, 'EV Duty') as shift_name,
		       COALESCE(TIME_FORMAT(s.start_time, '%H:%i'), TIME_FORMAT(dc.start_time, '%H:%i'), '08:00') as start_time,
		       COALESCE(TIME_FORMAT(s.end_time, '%H:%i'), TIME_FORMAT(dc.end_time, '%H:%i'), '17:00') as end_time,
		       DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
		JOIN drivers d ON d.id = dcm.driver_id
		LEFT JOIN shifts s ON s.id = ev.shift_id
		WHERE d.id = ?
		AND ev.status = 'active'
		AND ` + dateFilter + ` BETWEEN ev.start_date AND ev.end_date
	`

	evArgs := []interface{}{driverID}
	if dateParam != "" {
		evArgs = append(evArgs, dateParam)
	}

	evRows, err := config.DB.Query(evQuery, evArgs...)
	if err != nil {
		log.Printf("Get driver assigned vehicles (EV) error: %v", err)
	} else {
		defer evRows.Close()
		for evRows.Next() {
			var v assignedVehicle
			if err := evRows.Scan(&v.VehicleID, &v.VehicleNumber, &v.VehicleType, &v.VehicleName,
				&v.AssignmentID, &v.AssignmentType, &v.ShiftName, &v.StartTime, &v.EndTime,
				&v.StartDate, &v.EndDate); err == nil {
				vehicles = append(vehicles, v)
			}
		}
	}

	// Get driver info
	var driverName, clusterName sql.NullString
	config.DB.QueryRow(`
		SELECT u.full_name, c.name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
		WHERE d.id = ?
	`, driverID).Scan(&driverName, &clusterName)

	log.Printf("[GetDriverAssignedVehicles] Returning %d total vehicles for driver %s", len(vehicles), driverName.String)

	c.JSON(http.StatusOK, gin.H{
		"driver_id":    driverID,
		"driver_name":  driverName.String,
		"cluster_name": clusterName.String,
		"vehicles":     vehicles,
		"date":         dateParam,
	})
}

// GetKmFilterMeta provides dropdown data for admin KM filters
func GetKmFilterMeta(c *gin.Context) {
    driverRows, err := config.DB.Query(`
        SELECT d.id, u.full_name, COALESCE(c.name, 'Unassigned') as cluster_name
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
        LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
        WHERE d.is_incharge = 0
        ORDER BY u.full_name
    `)
    if err != nil {
        log.Printf("Get KM filter drivers error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to load driver filters"})
        return
    }
    defer driverRows.Close()

    type filterDriver struct {
        ID      int     `json:"id"`
        Name    string  `json:"name"`
        Cluster *string `json:"cluster"`
    }

    var drivers []filterDriver
    for driverRows.Next() {
        var d filterDriver
        if err := driverRows.Scan(&d.ID, &d.Name, &d.Cluster); err == nil {
            drivers = append(drivers, d)
        }
    }

    vehicleRows, err := config.DB.Query(`
        SELECT v.id, v.vehicle_number, 
               COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
               COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number) as vehicle_name
        FROM vehicles v
        WHERE v.status IN ('active', 'available')
        ORDER BY v.vehicle_number
    `)
    if err != nil {
        log.Printf("Get KM filter vehicles error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to load vehicle filters"})
        return
    }
    defer vehicleRows.Close()

    type filterVehicle struct {
        ID            int    `json:"id"`
        VehicleNumber string `json:"vehicle_number"`
        VehicleType   string `json:"vehicle_type"`
        VehicleName   string `json:"vehicle_name"`
    }

    var vehicles []filterVehicle
    for vehicleRows.Next() {
        var v filterVehicle
        if err := vehicleRows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.VehicleName); err != nil {
            log.Printf("Error scanning vehicle row: %v", err)
            continue
        }
        vehicles = append(vehicles, v)
    }

    c.JSON(http.StatusOK, gin.H{
        "drivers":  drivers,
        "vehicles": vehicles,
    })
}

// AdminAddKmLog allows admins to record KM entries with driver + vehicle context
func AdminAddKmLog(c *gin.Context) {
    var req struct {
        AdminUserID  int     `json:"admin_user_id"`
        DriverID     int     `json:"driver_id"`
        VehicleID    *int    `json:"vehicle_id"`
        AssignmentID *int    `json:"assignment_id"`
        Date         string  `json:"date"`
        StartKm      float64 `json:"start_km"`
        EndKm        float64 `json:"end_km"`
        TotalKm      float64 `json:"total_km"`
        Remarks      string  `json:"remarks"`
        VehicleType  string  `json:"vehicle_type"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        log.Printf("AdminAddKmLog: Failed to bind JSON: %v", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    log.Printf("AdminAddKmLog: Received request - AdminUserID=%d, DriverID=%d, VehicleID=%v, Date=%s", 
        req.AdminUserID, req.DriverID, req.VehicleID, req.Date)

    if req.AdminUserID == 0 || req.DriverID == 0 || req.Date == "" {
        log.Printf("AdminAddKmLog: Missing required fields")
        c.JSON(http.StatusBadRequest, gin.H{"error": "admin_user_id, driver_id and date required"})
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

    if req.TotalKm == 0 {
        req.TotalKm = req.EndKm - req.StartKm
    }

    var adminName string
    err := config.DB.QueryRow(`SELECT full_name FROM users WHERE id = ? AND role = 'ADMIN'`, req.AdminUserID).Scan(&adminName)
    if err != nil {
        log.Printf("AdminAddKmLog: Admin user not found or not admin role: user_id=%d, error=%v", req.AdminUserID, err)
        c.JSON(http.StatusForbidden, gin.H{"error": "Admin not found"})
        return
    }

    log.Printf("AdminAddKmLog: Admin verified: %s (ID: %d)", adminName, req.AdminUserID)

    if req.VehicleType == "" {
        config.DB.QueryRow(`SELECT vehicle_type FROM vehicles WHERE id = ?`, *req.VehicleID).Scan(&req.VehicleType)
        if req.VehicleType == "" {
            req.VehicleType = "BUS"
        }
    }

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

    vehicleID := interface{}(nil)
    if req.VehicleID != nil {
        vehicleID = *req.VehicleID
    }

    assignmentID := interface{}(nil)
    if req.AssignmentID != nil {
        assignmentID = *req.AssignmentID
    }

    // Check if entry already exists for this driver and date
    var existingID int
    err = config.DB.QueryRow(`SELECT id FROM km_logs WHERE driver_id = ? AND date = ?`, req.DriverID, req.Date).Scan(&existingID)
    
    var result sql.Result
    if err == sql.ErrNoRows {
        // No existing entry, insert new one
        result, err = config.DB.Exec(`
            INSERT INTO km_logs (
                driver_id, date, start_km, end_km, total_km, remarks,
                vehicle_type, vehicle_id, assignment_id,
                recorded_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, req.Remarks,
            req.VehicleType, vehicleID, assignmentID, req.AdminUserID)

        if err != nil {
            log.Printf("AdminAddKmLog: Database insert error: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error adding KM log: %v", err)})
            return
        }
        
        id, _ := result.LastInsertId()
        log.Printf("AdminAddKmLog: Successfully inserted km_log with ID: %d", id)
        c.JSON(http.StatusOK, gin.H{"message": "KM log recorded successfully", "id": id})
    } else if err == nil {
        // Entry exists, update it
        result, err = config.DB.Exec(`
            UPDATE km_logs SET
                start_km = ?, end_km = ?, total_km = ?, remarks = ?,
                vehicle_type = ?, vehicle_id = ?, assignment_id = ?,
                recorded_by_user_id = ?
            WHERE id = ?
        `, req.StartKm, req.EndKm, req.TotalKm, req.Remarks,
            req.VehicleType, vehicleID, assignmentID, req.AdminUserID, existingID)

        if err != nil {
            log.Printf("AdminAddKmLog: Database update error: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error updating KM log: %v", err)})
            return
        }
        
        log.Printf("AdminAddKmLog: Successfully updated km_log with ID: %d", existingID)
        c.JSON(http.StatusOK, gin.H{"message": "KM log updated successfully", "id": existingID})
    } else {
        // Database error
        log.Printf("AdminAddKmLog: Database query error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
        return
    }
}

// GetAdminKmLogs returns filtered list of km logs for auditing
func GetAdminKmLogs(c *gin.Context) {
    period := c.DefaultQuery("period", "month")
    startDate := c.Query("start_date")
    endDate := c.Query("end_date")
    driverParam := c.Query("driver_id")
    vehicleParam := c.Query("vehicle_id")
    search := c.Query("search")
    limitParam := c.DefaultQuery("limit", "200")

    limit, err := strconv.Atoi(limitParam)
    if err != nil || limit <= 0 {
        limit = 200
    } else if limit > 500 {
        limit = 500
    }

    filters := adminKmFilters{Period: period, StartDate: startDate, EndDate: endDate}

    if driverParam != "" {
        if id, err := strconv.Atoi(driverParam); err == nil {
            filters.DriverID = &id
        } else {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid driver_id"})
            return
        }
    }

    if vehicleParam != "" {
        if id, err := strconv.Atoi(vehicleParam); err == nil {
            filters.VehicleID = &id
        } else {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_id"})
            return
        }
    }

    whereClause, args := buildAdminKmWhereClause(filters)
    if whereClause == "" {
        whereClause = "WHERE 1=1"
    }

    if search != "" {
        whereClause += " AND (u.full_name LIKE ? OR v.vehicle_number LIKE ?)"
        like := "%" + search + "%"
        args = append(args, like, like)
    }

    args = append(args, limit)
    
    queryStr := `
        SELECT
            kl.id,
            DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
            kl.start_km,
            kl.end_km,
            kl.total_km,
            kl.remarks,
            COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
            COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
            u.full_name as driver_name,
            COALESCE(c.name, 'Unassigned') as cluster_name,
            COALESCE(s.name, 'N/A') as shift,
            'N/A' as route_name,
            COALESCE(recorder.full_name, 'Unknown') as recorded_by_name
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        JOIN users u ON d.user_id = u.id
        LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND kl.date BETWEEN dcm.valid_from AND dcm.valid_to
        LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        LEFT JOIN assignments a ON kl.assignment_id = a.id
        LEFT JOIN shifts s ON a.shift_id = s.id
        LEFT JOIN users recorder ON kl.recorded_by_user_id = recorder.id
        ` + whereClause + `
        ORDER BY kl.date DESC, kl.id DESC
        LIMIT ?
    `
    
    log.Printf("GetAdminKmLogs query: %s", queryStr)
    log.Printf("GetAdminKmLogs args: %v", args)
    
    rows, err := config.DB.Query(queryStr, args...)

    if err != nil {
        log.Printf("Get admin KM logs error: %v", err)
        log.Printf("Query: %s", queryStr)
        log.Printf("Args: %v", args)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Unable to fetch KM logs: %v", err)})
        return
    }
    defer rows.Close()

    type adminKmLog struct {
        ID            int      `json:"id"`
        Date          string   `json:"date"`
        StartKm       float64  `json:"start_km"`
        EndKm         float64  `json:"end_km"`
        TotalKm       float64  `json:"total_km"`
        Remarks       *string  `json:"remarks"`
        VehicleNumber string   `json:"vehicle_number"`
        VehicleType   string   `json:"vehicle_type"`
        DriverName    string   `json:"driver_name"`
        ClusterName   string   `json:"cluster_name"`
        Shift         string   `json:"shift"`
        RouteName     string   `json:"route_name"`
        RecordedBy    *string  `json:"recorded_by_name"`
    }

    var logs []adminKmLog
    for rows.Next() {
        var l adminKmLog
        if err := rows.Scan(&l.ID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.Remarks,
            &l.VehicleNumber, &l.VehicleType, &l.DriverName, &l.ClusterName,
            &l.Shift, &l.RouteName, &l.RecordedBy); err == nil {
            logs = append(logs, l)
        }
    }

    var totalKm float64
    var totalTrips int
    summaryRow := config.DB.QueryRow(`
        SELECT COALESCE(SUM(kl.total_km), 0), COUNT(*)
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        ` + whereClause + `
    `, args...)
    summaryRow.Scan(&totalKm, &totalTrips)

    c.JSON(http.StatusOK, gin.H{
        "logs": logs,
        "summary": gin.H{
            "total_km":    totalKm,
            "total_trips": totalTrips,
        },
    })
}

// GetKMSummary powers admin analytics dashboard with optional filters
func GetKMSummary(c *gin.Context) {
    period := c.DefaultQuery("period", "month")
    startDate := c.Query("start_date")
    endDate := c.Query("end_date")
    driverParam := c.Query("driver_id")
    vehicleParam := c.Query("vehicle_id")

    filters := adminKmFilters{Period: period, StartDate: startDate, EndDate: endDate}

    if driverParam != "" {
        if id, err := strconv.Atoi(driverParam); err == nil {
            filters.DriverID = &id
        } else {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid driver_id"})
            return
        }
    }
    if vehicleParam != "" {
        if id, err := strconv.Atoi(vehicleParam); err == nil {
            filters.VehicleID = &id
        } else {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_id"})
            return
        }
    }
    whereClause, args := buildAdminKmWhereClause(filters)
    if whereClause == "" {
        whereClause = "WHERE 1=1"
    }
    var grandTotalKm float64
    var grandTotalTrips int
    summaryRow := config.DB.QueryRow(`
        SELECT COALESCE(SUM(kl.total_km), 0), COUNT(*)
        FROM km_logs kl
        ` + whereClause + `
    `, args...)
    summaryRow.Scan(&grandTotalKm, &grandTotalTrips)
    avgPerTrip := 0.0
    if grandTotalTrips > 0 {
        avgPerTrip = grandTotalKm / float64(grandTotalTrips)
    }
    type vehicleTypeBreakdown struct {
        VehicleType  string  `json:"vehicle_type"`
        TotalTrips   int     `json:"total_trips"`
        TotalKM      float64 `json:"total_km"`
        AvgKMPerTrip float64 `json:"avg_km_per_trip"`
    }
    rows, _ := config.DB.Query(`
        SELECT COALESCE(kl.vehicle_type, 'UNKNOWN') as vehicle_type,
               COUNT(*) as trips,
               SUM(kl.total_km) as total_km,
               AVG(kl.total_km) as avg_trip
        FROM km_logs kl
        ` + whereClause + `
        GROUP BY COALESCE(kl.vehicle_type, 'UNKNOWN')
    `, args...)
    var byVehicleType []vehicleTypeBreakdown
    if rows != nil {
        defer rows.Close()
        for rows.Next() {
            var item vehicleTypeBreakdown
            rows.Scan(&item.VehicleType, &item.TotalTrips, &item.TotalKM, &item.AvgKMPerTrip)
            byVehicleType = append(byVehicleType, item)
        }
    }
    driverRows, _ := config.DB.Query(`
        SELECT kl.driver_id, u.full_name, SUM(kl.total_km) as total_km, COUNT(*) as trips
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        JOIN users u ON d.user_id = u.id
        ` + whereClause + `
        GROUP BY kl.driver_id, u.full_name
        ORDER BY total_km DESC
        LIMIT 10
    `, args...)
    type topDriver struct {
        DriverID   int     `json:"driver_id"`
        DriverName string  `json:"driver_name"`
        TotalKM    float64 `json:"total_km"`
        Trips      int     `json:"trips"`
    }
    var topDrivers []topDriver
    if driverRows != nil {
        defer driverRows.Close()
        for driverRows.Next() {
            var td topDriver
            driverRows.Scan(&td.DriverID, &td.DriverName, &td.TotalKM, &td.Trips)
            topDrivers = append(topDrivers, td)
        }
    }
    vehicleRows, _ := config.DB.Query(`
        SELECT v.id, v.vehicle_number, COALESCE(v.vehicle_type, 'UNKNOWN'),
               v.model, SUM(kl.total_km) as total_km, COUNT(*) as trips,
               AVG(kl.total_km) as avg_trip
        FROM km_logs kl
        LEFT JOIN assignments a ON kl.assignment_id = a.id
        LEFT JOIN vehicles v ON COALESCE(kl.vehicle_id, a.vehicle_id) = v.id
        ` + whereClause + ` AND COALESCE(kl.vehicle_id, a.vehicle_id) IS NOT NULL
        GROUP BY v.id, v.vehicle_number, v.vehicle_type, v.model
        ORDER BY total_km DESC
        LIMIT 20
    `, args...)
    type vehicleKm struct {
        VehicleID     int      `json:"vehicle_id"`
        VehicleNumber string   `json:"vehicle_number"`
        VehicleType   string   `json:"vehicle_type"`
        Model         *string  `json:"model"`
        TotalKM       float64  `json:"total_km"`
        TotalTrips    int      `json:"total_trips"`
        AvgKMPerTrip  float64  `json:"avg_km_per_trip"`
    }
    var byVehicle []vehicleKm
    if vehicleRows != nil {
        defer vehicleRows.Close()
        for vehicleRows.Next() {
            var vk vehicleKm
            vehicleRows.Scan(&vk.VehicleID, &vk.VehicleNumber, &vk.VehicleType, &vk.Model, &vk.TotalKM, &vk.TotalTrips, &vk.AvgKMPerTrip)
            byVehicle = append(byVehicle, vk)
        }
    }
    tripRows, _ := config.DB.Query(`
        SELECT kl.id, kl.driver_id, u.full_name, 
               COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
               COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
               DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
               kl.start_km, kl.end_km, kl.total_km
        FROM km_logs kl
        LEFT JOIN drivers d ON kl.driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        `+whereClause+`
        ORDER BY kl.date DESC, kl.id DESC
        LIMIT 200
    `, args...)
    type tripWise struct {
        ID            int     `json:"id"`
        DriverID      int     `json:"driver_id"`
        DriverName    string  `json:"driver_name"`
        VehicleNumber string  `json:"vehicle_number"`
        VehicleType   string  `json:"vehicle_type"`
        Date          string  `json:"date"`
        StartKm       float64 `json:"start_km"`
        EndKm         float64 `json:"end_km"`
        TotalKm       float64 `json:"total_km"`
    }
    var tripWiseList []tripWise
    if tripRows != nil {
        defer tripRows.Close()
        for tripRows.Next() {
            var t tripWise
            if err := tripRows.Scan(&t.ID, &t.DriverID, &t.DriverName, &t.VehicleNumber, &t.VehicleType, &t.Date, &t.StartKm, &t.EndKm, &t.TotalKm); err == nil {
                tripWiseList = append(tripWiseList, t)
            }
        }
    }
    var selectedDriver interface{}
    if filters.DriverID != nil {
        row := config.DB.QueryRow(`
            SELECT u.full_name, SUM(kl.total_km), COUNT(*), MIN(kl.date), MAX(kl.date)
            FROM km_logs kl
            JOIN drivers d ON kl.driver_id = d.id
            JOIN users u ON d.user_id = u.id
            `+whereClause+`
        `, args...)
        var name string
        var total float64
        var trips int
        var firstDate, lastDate sql.NullString
        if err := row.Scan(&name, &total, &trips, &firstDate, &lastDate); err == nil {
            var firstPtr, lastPtr *string
            if firstDate.Valid {
                firstPtr = &firstDate.String
            }
            if lastDate.Valid {
                lastPtr = &lastDate.String
            }
            selectedDriver = gin.H{
                "driver_id":  *filters.DriverID,
                "driver_name": name,
                "total_km":   total,
                "trips":      trips,
                "first_date": firstPtr,
                "last_date":  lastPtr,
            }
        }
    }
    var selectedVehicle interface{}
    if filters.VehicleID != nil {
        row := config.DB.QueryRow(`
            SELECT COALESCE(v.vehicle_number, 'N/A'), COALESCE(v.vehicle_type, 'UNKNOWN'),
                   SUM(kl.total_km), COUNT(*), MIN(kl.date), MAX(kl.date)
            FROM km_logs kl
            LEFT JOIN vehicles v ON kl.vehicle_id = v.id
            `+whereClause+`
        `, args...)
        var number, vtype string
        var total float64
        var trips int
        var firstDate, lastDate sql.NullString
        if err := row.Scan(&number, &vtype, &total, &trips, &firstDate, &lastDate); err == nil {
            var firstPtr, lastPtr *string
            if firstDate.Valid {
                firstPtr = &firstDate.String
            }
            if lastDate.Valid {
                lastPtr = &lastDate.String
            }
            selectedVehicle = gin.H{
                "vehicle_id":     *filters.VehicleID,
                "vehicle_number": number,
                "vehicle_type":   vtype,
                "total_km":       total,
                "trips":          trips,
                "first_date":     firstPtr,
                "last_date":      lastPtr,
            }
        }
    }
    c.JSON(http.StatusOK, gin.H{
        "period":            period,
        "filters": gin.H{
            "start_date": startDate,
            "end_date":   endDate,
            "driver_id":  driverParam,
            "vehicle_id": vehicleParam,
        },
        "grand_total_km":    grandTotalKm,
        "grand_total_trips": grandTotalTrips,
        "avg_km_per_trip":   avgPerTrip,
        "by_vehicle_type":   byVehicleType,
        "top_drivers":       topDrivers,
        "by_vehicle":        byVehicle,
        "trip_wise":         tripWiseList,
        "selected_driver":   selectedDriver,
        "selected_vehicle":  selectedVehicle,
    })
}
func GetVehicleKmSummary(c *gin.Context) {
    period := c.DefaultQuery("period", "month")
    startDate := c.Query("start_date")
    endDate := c.Query("end_date")
    driverParam := c.Query("driver_id")
    vehicleIDParam := c.Query("vehicle_id")
    vehicleNumberParam := c.Query("vehicle_number")

    filters := adminKmFilters{
        Period:    period,
        StartDate: startDate,
        EndDate:   endDate,
    }

    if driverParam != "" {
        id, err := strconv.Atoi(driverParam)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid driver_id"})
            return
        }
        filters.DriverID = &id
    }

    if vehicleIDParam != "" {
        id, err := strconv.Atoi(vehicleIDParam)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_id"})
            return
        }
        filters.VehicleID = &id
    }

    whereClause, args := buildAdminKmWhereClause(filters)
    if whereClause == "" {
        whereClause = "WHERE 1=1"
    }

    // Vehicle number filter
    if vehicleNumberParam != "" {
        whereClause += " AND v.vehicle_number = ?"
        args = append(args, vehicleNumberParam)
    }

    type vehicleKm struct {
        VehicleID     int     `json:"vehicle_id"`
        VehicleNumber string  `json:"vehicle_number"`
        VehicleName   string  `json:"vehicle_name"`
        VehicleType   string  `json:"vehicle_type"`
        FuelType      string  `json:"fuel_type"`
        TotalKM       float64 `json:"total_km"`
        TotalTrips    int     `json:"total_trips"`
        AvgKMPerTrip  float64 `json:"avg_km_per_trip"`
    }

    // Align vehicle_id filter with COALESCE
    vehicleWhere := whereClause
    if filters.VehicleID != nil {
        vehicleWhere = strings.ReplaceAll(
            vehicleWhere,
            "kl.vehicle_id = ?",
            "COALESCE(kl.vehicle_id, a.vehicle_id) = ?",
        )
    }

    query := `
        SELECT 
            v.id,
            v.vehicle_number,
            COALESCE(v.vehicle_name, '') AS vehicle_name,
            COALESCE(v.vehicle_type, 'UNKNOWN') AS vehicle_type,
            COALESCE(v.fuel_type, '') AS fuel_type,
            SUM(kl.total_km) AS total_km,
            COUNT(kl.id) AS total_trips,
            AVG(kl.total_km) AS avg_km_per_trip
        FROM km_logs kl
        LEFT JOIN assignments a ON kl.assignment_id = a.id
        LEFT JOIN vehicles v ON COALESCE(kl.vehicle_id, a.vehicle_id) = v.id
        ` + vehicleWhere + `
        AND COALESCE(kl.vehicle_id, a.vehicle_id) IS NOT NULL
        GROUP BY 
            v.id, v.vehicle_number, v.vehicle_name, v.vehicle_type, v.fuel_type
        ORDER BY total_km DESC
    `

    rows, err := config.DB.Query(query, args...)
    if err != nil {
        log.Printf("GetVehicleKmSummary error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to fetch vehicle summary"})
        return
    }
    defer rows.Close()

    result := []vehicleKm{}
    for rows.Next() {
        var vk vehicleKm
        if err := rows.Scan(
            &vk.VehicleID,
            &vk.VehicleNumber,
            &vk.VehicleName,
            &vk.VehicleType,
            &vk.FuelType,
            &vk.TotalKM,
            &vk.TotalTrips,
            &vk.AvgKMPerTrip,
        ); err != nil {
            log.Println("scan error:", err)
            continue
        }
        result = append(result, vk)
    }

    c.JSON(http.StatusOK, gin.H{
        "period":   period,
        "vehicles": result,
    })
}
type adminKmFilters struct {
    Period    string
    StartDate string
    EndDate   string
    DriverID  *int
    VehicleID *int
}
func buildAdminKmWhereClause(f adminKmFilters) (string, []interface{}) {
    clauses := []string{}
    args := []interface{}{}

    if f.StartDate != "" {
        end := f.EndDate
        if end == "" {
            end = f.StartDate
        }
        clauses = append(clauses, "kl.date BETWEEN ? AND ?")
        args = append(args, f.StartDate, end)
    } else {
        switch f.Period {
        case "all":
            // No date filter for all-time queries
        case "today":
            clauses = append(clauses, "kl.date = CURDATE()")
        case "week":
            clauses = append(clauses, "YEARWEEK(kl.date) = YEARWEEK(CURDATE())")
        default:
            clauses = append(clauses, "MONTH(kl.date) = MONTH(CURDATE()) AND YEAR(kl.date) = YEAR(CURDATE())")
        }
    }

    if f.DriverID != nil {
        clauses = append(clauses, "kl.driver_id = ?")
        args = append(args, *f.DriverID)
    }

    if f.VehicleID != nil {
        clauses = append(clauses, "kl.vehicle_id = ?")
        args = append(args, *f.VehicleID)
    }

    if len(clauses) == 0 {
        return "", args
    }

    return "WHERE " + strings.Join(clauses, " AND "), args
}

func cloneArgs(args []interface{}) []interface{} {
    dup := make([]interface{}, len(args))
    copy(dup, args)
    return dup
}

// GetDriverKmHistory returns detailed KM history for a specific driver
// including all vehicles they've driven with stats
func GetDriverKmHistory(c *gin.Context) {
    driverIDStr := c.Query("driver_id")
    if driverIDStr == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
        return
    }

    driverID, err := strconv.Atoi(driverIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver_id"})
        return
    }

    period := c.DefaultQuery("period", "all")
    startDate := c.Query("start_date")
    endDate := c.Query("end_date")

    // Get driver info
    var driverName, clusterName sql.NullString
    var driverUserID int
    err = config.DB.QueryRow(`
        SELECT u.id, u.full_name, c.name
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
        LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
        WHERE d.id = ?
    `, driverID).Scan(&driverUserID, &driverName, &clusterName)
    if err != nil {
        log.Printf("Get driver info error: %v", err)
        c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
        return
    }

    // Build date filter
    dateClause := ""
    var args []interface{}
    args = append(args, driverID)

    if startDate != "" {
        end := endDate
        if end == "" {
            end = startDate
        }
        dateClause = " AND kl.date BETWEEN ? AND ?"
        args = append(args, startDate, end)
    } else {
        switch period {
        case "today":
            dateClause = " AND kl.date = CURDATE()"
        case "week":
            dateClause = " AND YEARWEEK(kl.date) = YEARWEEK(CURDATE())"
        case "month":
            dateClause = " AND MONTH(kl.date) = MONTH(CURDATE()) AND YEAR(kl.date) = YEAR(CURDATE())"
        case "year":
            dateClause = " AND YEAR(kl.date) = YEAR(CURDATE())"
        // "all" - no date filter
        }
    }

    // Overall stats
    var totalKm float64
    var totalTrips int
    var firstDate, lastDate sql.NullString
    statsQuery := `
        SELECT COALESCE(SUM(kl.total_km), 0), COUNT(*),
               MIN(kl.date), MAX(kl.date)
        FROM km_logs kl
        WHERE kl.driver_id = ?` + dateClause
    config.DB.QueryRow(statsQuery, args...).Scan(&totalKm, &totalTrips, &firstDate, &lastDate)

    // KM by vehicle
    type vehicleKm struct {
        VehicleID     int      `json:"vehicle_id"`
        VehicleNumber string   `json:"vehicle_number"`
        VehicleType   string   `json:"vehicle_type"`
        VehicleName   *string  `json:"vehicle_name"`
        TotalKM       float64  `json:"total_km"`
        TotalTrips    int      `json:"total_trips"`
        AvgKMPerTrip  float64  `json:"avg_km_per_trip"`
        FirstDate     *string  `json:"first_date"`
        LastDate      *string  `json:"last_date"`
    }

    vehicleArgs := make([]interface{}, len(args))
    copy(vehicleArgs, args)

    vehicleRows, err := config.DB.Query(`
        SELECT v.id, v.vehicle_number, COALESCE(v.vehicle_type, 'UNKNOWN'),
               NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
               SUM(kl.total_km) as total_km, COUNT(*) as trips,
               AVG(kl.total_km) as avg_trip,
               MIN(kl.date) as first_date, MAX(kl.date) as last_date
        FROM km_logs kl
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        WHERE kl.driver_id = ?`+dateClause+` AND kl.vehicle_id IS NOT NULL
        GROUP BY v.id, v.vehicle_number, v.vehicle_type, v.name
        ORDER BY total_km DESC
    `, vehicleArgs...)

    var byVehicle []vehicleKm
    if err == nil {
        defer vehicleRows.Close()
        for vehicleRows.Next() {
            var vk vehicleKm
            vehicleRows.Scan(&vk.VehicleID, &vk.VehicleNumber, &vk.VehicleType, &vk.VehicleName,
                &vk.TotalKM, &vk.TotalTrips, &vk.AvgKMPerTrip, &vk.FirstDate, &vk.LastDate)
            byVehicle = append(byVehicle, vk)
        }
    }

    // KM by vehicle type
    type vehicleTypeBreakdown struct {
        VehicleType string  `json:"vehicle_type"`
        TotalKM     float64 `json:"total_km"`
        TotalTrips  int     `json:"total_trips"`
    }

    typeArgs := make([]interface{}, len(args))
    copy(typeArgs, args)

    typeRows, err := config.DB.Query(`
        SELECT COALESCE(kl.vehicle_type, 'UNKNOWN') as vehicle_type,
               SUM(kl.total_km) as total_km, COUNT(*) as trips
        FROM km_logs kl
        WHERE kl.driver_id = ?`+dateClause+`
        GROUP BY COALESCE(kl.vehicle_type, 'UNKNOWN')
        ORDER BY total_km DESC
    `, typeArgs...)

    var byVehicleType []vehicleTypeBreakdown
    if err == nil {
        defer typeRows.Close()
        for typeRows.Next() {
            var vt vehicleTypeBreakdown
            typeRows.Scan(&vt.VehicleType, &vt.TotalKM, &vt.TotalTrips)
            byVehicleType = append(byVehicleType, vt)
        }
    }

    // Recent logs (last 20)
    logArgs := make([]interface{}, len(args))
    copy(logArgs, args)
    logArgs = append(logArgs, 20)

    type kmLogEntry struct {
        ID            int     `json:"id"`
        Date          string  `json:"date"`
        VehicleNumber string  `json:"vehicle_number"`
        VehicleType   string  `json:"vehicle_type"`
        StartKm       float64 `json:"start_km"`
        EndKm         float64 `json:"end_km"`
        TotalKm       float64 `json:"total_km"`
        Remarks       *string `json:"remarks"`
    }

    logRows, err := config.DB.Query(`
        SELECT kl.id, DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
               COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
               COALESCE(kl.vehicle_type, 'UNKNOWN') as vehicle_type,
               kl.start_km, kl.end_km, kl.total_km, kl.remarks
        FROM km_logs kl
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        WHERE kl.driver_id = ?`+dateClause+`
        ORDER BY kl.date DESC, kl.id DESC
        LIMIT ?
    `, logArgs...)

    var recentLogs []kmLogEntry
    if err == nil {
        defer logRows.Close()
        for logRows.Next() {
            var log kmLogEntry
            logRows.Scan(&log.ID, &log.Date, &log.VehicleNumber, &log.VehicleType,
                &log.StartKm, &log.EndKm, &log.TotalKm, &log.Remarks)
            recentLogs = append(recentLogs, log)
        }
    }

    // Monthly trend (last 6 months)
    type monthlyTrend struct {
        Month    string  `json:"month"`
        TotalKM  float64 `json:"total_km"`
        Trips    int     `json:"trips"`
    }

    trendRows, err := config.DB.Query(`
        SELECT DATE_FORMAT(kl.date, '%Y-%m') as month,
               SUM(kl.total_km) as total_km, COUNT(*) as trips
        FROM km_logs kl
        WHERE kl.driver_id = ?
        AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(kl.date, '%Y-%m')
        ORDER BY month DESC
    `, driverID)

    var monthlyTrends []monthlyTrend
    if err == nil {
        defer trendRows.Close()
        for trendRows.Next() {
            var mt monthlyTrend
            trendRows.Scan(&mt.Month, &mt.TotalKM, &mt.Trips)
            monthlyTrends = append(monthlyTrends, mt)
        }
    }

    // Calculate average per trip
    avgPerTrip := 0.0
    if totalTrips > 0 {
        avgPerTrip = totalKm / float64(totalTrips)
    }

    c.JSON(http.StatusOK, gin.H{
        "driver_id":       driverID,
        "driver_name":     driverName.String,
        "cluster_name":    clusterName.String,
        "total_km":        totalKm,
        "total_trips":     totalTrips,
        "avg_km_per_trip": avgPerTrip,
        "first_date":      firstDate.String,
        "last_date":       lastDate.String,
        "by_vehicle":      byVehicle,
        "by_vehicle_type": byVehicleType,
        "recent_logs":     recentLogs,
        "monthly_trends":  monthlyTrends,
    })
}
