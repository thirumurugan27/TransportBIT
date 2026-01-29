package admin

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// GetKmFilterMeta provides dropdown data for admin KM filters
func GetKmFilterMeta(c *gin.Context) {
    driverRows, err := config.DB.Query(`
        SELECT d.id, u.full_name, COALESCE(c.name, 'Unassigned') as cluster_name
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN driver_clusters c ON d.cluster_id = c.id
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
               COALESCE(NULLIF(v.name, ''), v.vehicle_number) as bus_name
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
        BusName       string `json:"bus_name"`
    }

    var vehicles []filterVehicle
    for vehicleRows.Next() {
        var v filterVehicle
        if err := vehicleRows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.BusName); err != nil {
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
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if req.AdminUserID == 0 || req.DriverID == 0 || req.Date == "" {
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
        c.JSON(http.StatusForbidden, gin.H{"error": "Admin not found"})
        return
    }

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

    result, err := config.DB.Exec(`
        INSERT INTO km_logs (
            driver_id, date, start_km, end_km, total_km, remarks,
            vehicle_type, vehicle_id, assignment_id,
            recorded_by_user_id, recorded_by_role, recorded_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN', ?)
    `, req.DriverID, req.Date, req.StartKm, req.EndKm, req.TotalKm, req.Remarks,
        req.VehicleType, vehicleID, assignmentID, req.AdminUserID, adminName)

    if err != nil {
        log.Printf("Admin add km log error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding KM log"})
        return
    }

    id, _ := result.LastInsertId()
    c.JSON(http.StatusOK, gin.H{"message": "KM log recorded", "id": id})
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

    logArgs := append(cloneArgs(args), limit)
    rows, err := config.DB.Query(`
        SELECT
            kl.id,
            DATE_FORMAT(kl.date, '%Y-%m-%d') as date,
            kl.start_km,
            kl.end_km,
            kl.total_km,
            kl.remarks,
            COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
            COALESCE(v.vehicle_type, 'UNKNOWN') as vehicle_type,
            u.full_name as driver_name,
            COALESCE(c.name, 'Unassigned') as cluster_name,
            COALESCE(s.name, 'N/A') as shift,
            COALESCE(a.route_name, 'N/A') as route_name,
            kl.recorded_by_name,
            kl.recorded_by_role
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        JOIN users u ON d.user_id = u.id
        LEFT JOIN driver_clusters c ON d.cluster_id = c.id
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        LEFT JOIN assignments a ON kl.assignment_id = a.id
        LEFT JOIN shifts s ON a.shift_id = s.id
        `+whereClause+`
        ORDER BY kl.date DESC, kl.id DESC
        LIMIT ?
    `, logArgs...)

    if err != nil {
        log.Printf("Get admin KM logs error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to fetch KM logs"})
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
        RecordedRole  *string  `json:"recorded_by_role"`
    }

    var logs []adminKmLog
    for rows.Next() {
        var l adminKmLog
        if err := rows.Scan(&l.ID, &l.Date, &l.StartKm, &l.EndKm, &l.TotalKm, &l.Remarks,
            &l.VehicleNumber, &l.VehicleType, &l.DriverName, &l.ClusterName,
            &l.Shift, &l.RouteName, &l.RecordedBy, &l.RecordedRole); err == nil {
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
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        ` + whereClause + ` AND kl.vehicle_id IS NOT NULL
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
        "selected_driver":   selectedDriver,
        "selected_vehicle":  selectedVehicle,
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
