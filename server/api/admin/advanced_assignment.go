package admin

import (
	"log"
	"net/http"
	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
=========================

	GET /api/admin/available-drivers
	Get drivers available for a specific date (not on leave, not assigned)

=========================
*/
func GetAvailableDrivers(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = "CURDATE()"
	} else {
		date = "'" + date + "'"
	}

	shiftID := c.Query("shift_id")

	query := `
		SELECT d.id, u.full_name, d.license_type, d.experience_years, u.status,
		       COALESCE(km.total_km, 0) as total_km_driven,
		       CASE 
		           WHEN EXISTS(SELECT 1 FROM leave_requests lr 
		                       WHERE lr.driver_id = d.id 
		                       AND lr.status = 'admin_approved'
		                       AND ` + date + ` BETWEEN lr.start_date AND lr.end_date) 
		           THEN 1 ELSE 0 
		       END as on_leave,
		       CASE 
		           WHEN EXISTS(SELECT 1 FROM assignments a 
		                       WHERE a.driver_id = d.id 
		                       AND a.assigned_date = ` + date + `
		                       AND a.status != 'cancelled'`

	if shiftID != "" {
		query += ` AND a.shift_id = ` + shiftID
	}

	query += `)
		           THEN 1 ELSE 0 
		       END as already_assigned
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN (
			SELECT driver_id, SUM(total_km) as total_km
			FROM km_logs
			WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())
			GROUP BY driver_id
		) km ON km.driver_id = d.id
		WHERE u.status = 'present'
		ORDER BY on_leave ASC, already_assigned ASC, total_km_driven ASC, d.experience_years DESC
	`

	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("Get available drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching available drivers"})
		return
	}
	defer rows.Close()

	type AvailableDriver struct {
		DriverID        int     `json:"driver_id"`
		DriverName      string  `json:"driver_name"`
		LicenseType     string  `json:"license_type"`
		ExperienceYears int     `json:"experience_years"`
		Status          string  `json:"status"`
		TotalKMDriven   float64 `json:"total_km_driven"`
		OnLeave         bool    `json:"on_leave"`
		AlreadyAssigned bool    `json:"already_assigned"`
		Available       bool    `json:"available"`
	}

	var drivers []AvailableDriver
	for rows.Next() {
		var d AvailableDriver
		var onLeave, alreadyAssigned int
		rows.Scan(&d.DriverID, &d.DriverName, &d.LicenseType, &d.ExperienceYears,
			&d.Status, &d.TotalKMDriven, &onLeave, &alreadyAssigned)
		d.OnLeave = onLeave == 1
		d.AlreadyAssigned = alreadyAssigned == 1
		d.Available = !d.OnLeave && !d.AlreadyAssigned
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}

/*
=========================

	GET /api/admin/assignments/by-category
	Get assignments filtered by vehicle category (BUS, CAR)

=========================
*/
func GetAssignmentsByCategory(c *gin.Context) {
	category := c.Query("category")
	if category == "" {
		category = "BUS"
	}
	rows, err := config.DB.Query(`
		SELECT a.id, DATE_FORMAT(a.assigned_date, '%Y-%m-%d') as assigned_date, a.status,
		       d.id as driver_id, u.full_name as driver_name, 
		       CASE 
		           WHEN a.assigned_date > CURDATE() THEN 'scheduled'
		           WHEN EXISTS(SELECT 1 FROM leave_requests lr 
		                       WHERE lr.driver_id = a.driver_id 
		                       AND lr.status = 'admin_approved'
		                       AND a.assigned_date BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
		           WHEN att.status = 'present' THEN 'present'
		           WHEN att.status = 'absent' THEN 'absent'
		           ELSE 'not_marked'
		       END as driver_status,
		       v.id as vehicle_id, v.vehicle_number, v.vehicle_type, v.fuel_type,
		       s.id as shift_id, s.name as shift_name, 
		       TIME_FORMAT(s.start_time, '%H:%i') as start_time, 
		       TIME_FORMAT(s.end_time, '%H:%i') as end_time,
		       a.original_driver_id, a.is_temporary_replacement,
		       CASE WHEN a.original_driver_id IS NOT NULL THEN 
		           (SELECT u2.full_name FROM drivers d2 JOIN users u2 ON d2.user_id = u2.id WHERE d2.id = a.original_driver_id)
		       ELSE NULL END as original_driver_name
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = a.assigned_date
		WHERE v.vehicle_type = ?
		ORDER BY a.assigned_date DESC, s.start_time
	`, category)

	if err != nil {
		log.Printf("Get assignments by category error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching assignments"})
		return
	}
	defer rows.Close()

	type CategoryAssignment struct {
		ID                     int     `json:"id"`
		AssignedDate           string  `json:"assigned_date"`
		Status                 string  `json:"status"`
		DriverID               int     `json:"driver_id"`
		DriverName             string  `json:"driver_name"`
		DriverStatus           string  `json:"driver_status"`
		VehicleID              int     `json:"vehicle_id"`
		VehicleNumber          string  `json:"vehicle_number"`
		VehicleType            string  `json:"vehicle_type"`
		FuelType               string  `json:"fuel_type"`
		ShiftID                int     `json:"shift_id"`
		ShiftName              string  `json:"shift_name"`
		StartTime              string  `json:"start_time"`
		EndTime                string  `json:"end_time"`
		OriginalDriverID       *int    `json:"original_driver_id"`
		IsTemporaryReplacement bool    `json:"is_temporary_replacement"`
		OriginalDriverName     *string `json:"original_driver_name"`
	}

	var assignments []CategoryAssignment
	for rows.Next() {
		var a CategoryAssignment
		rows.Scan(&a.ID, &a.AssignedDate, &a.Status, &a.DriverID, &a.DriverName, &a.DriverStatus,
			&a.VehicleID, &a.VehicleNumber, &a.VehicleType, &a.FuelType,
			&a.ShiftID, &a.ShiftName, &a.StartTime, &a.EndTime,
			&a.OriginalDriverID, &a.IsTemporaryReplacement, &a.OriginalDriverName)
		assignments = append(assignments, a)
	}

	c.JSON(http.StatusOK, assignments)
}

/*
=========================

	GET /api/admin/km-summary
	Get KM summary by vehicle type for dashboard

=========================
*/
func GetKMSummary(c *gin.Context) {
	period := c.Query("period") // today, week, month
	if period == "" {
		period = "month"
	}

	var dateFilter string
	switch period {
	case "today":
		dateFilter = "date = CURDATE()"
	case "week":
		dateFilter = "YEARWEEK(date) = YEARWEEK(CURDATE())"
	default:
		dateFilter = "MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())"
	}

	// Summary by vehicle type
	rows, err := config.DB.Query(`
		SELECT COALESCE(vehicle_type, 'UNKNOWN') as vehicle_type,
		       COUNT(*) as total_trips,
		       SUM(total_km) as total_km,
		       AVG(total_km) as avg_km_per_trip
		FROM km_logs
		WHERE ` + dateFilter + `
		GROUP BY vehicle_type
	`)
	if err != nil {
		log.Printf("Get KM summary error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching KM summary"})
		return
	}
	defer rows.Close()

	type KMSummaryItem struct {
		VehicleType  string  `json:"vehicle_type"`
		TotalTrips   int     `json:"total_trips"`
		TotalKM      float64 `json:"total_km"`
		AvgKMPerTrip float64 `json:"avg_km_per_trip"`
	}

	var summary []KMSummaryItem
	var grandTotalKM float64
	var grandTotalTrips int

	for rows.Next() {
		var s KMSummaryItem
		rows.Scan(&s.VehicleType, &s.TotalTrips, &s.TotalKM, &s.AvgKMPerTrip)
		summary = append(summary, s)
		grandTotalKM += s.TotalKM
		grandTotalTrips += s.TotalTrips
	}

	// Top drivers by KM
	driverRows, _ := config.DB.Query(`
		SELECT d.id, u.full_name, SUM(k.total_km) as total_km, COUNT(*) as trips
		FROM km_logs k
		JOIN drivers d ON k.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE ` + dateFilter + `
		GROUP BY d.id, u.full_name
		ORDER BY total_km DESC
		LIMIT 10
	`)
	defer driverRows.Close()

	type TopDriver struct {
		DriverID   int     `json:"driver_id"`
		DriverName string  `json:"driver_name"`
		TotalKM    float64 `json:"total_km"`
		Trips      int     `json:"trips"`
	}

	var topDrivers []TopDriver
	for driverRows.Next() {
		var td TopDriver
		driverRows.Scan(&td.DriverID, &td.DriverName, &td.TotalKM, &td.Trips)
		topDrivers = append(topDrivers, td)
	}

	// KM by individual vehicles - using vehicle_id from km_logs directly
	vehicleRows, _ := config.DB.Query(`
		SELECT 
			v.id,
			v.vehicle_number,
			v.vehicle_type,
			v.model,
			COALESCE(SUM(k.total_km), 0) as total_km,
			COUNT(k.id) as total_trips,
			COALESCE(AVG(k.total_km), 0) as avg_km_per_trip
		FROM km_logs k
		JOIN vehicles v ON k.vehicle_id = v.id
		WHERE k.vehicle_id IS NOT NULL AND ` + dateFilter + `
		GROUP BY v.id, v.vehicle_number, v.vehicle_type, v.model
		ORDER BY total_km DESC
		LIMIT 20
	`)
	if vehicleRows != nil {
		defer vehicleRows.Close()
	}

	type VehicleKM struct {
		VehicleID     int     `json:"vehicle_id"`
		VehicleNumber string  `json:"vehicle_number"`
		VehicleType   string  `json:"vehicle_type"`
		Model         *string `json:"model"`
		TotalKM       float64 `json:"total_km"`
		TotalTrips    int     `json:"total_trips"`
		AvgKMPerTrip  float64 `json:"avg_km_per_trip"`
	}

	var vehicleKMs []VehicleKM
	if vehicleRows != nil {
		for vehicleRows.Next() {
			var vk VehicleKM
			vehicleRows.Scan(&vk.VehicleID, &vk.VehicleNumber, &vk.VehicleType, &vk.Model, &vk.TotalKM, &vk.TotalTrips, &vk.AvgKMPerTrip)
			vehicleKMs = append(vehicleKMs, vk)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"period":            period,
		"by_vehicle_type":   summary,
		"grand_total_km":    grandTotalKM,
		"grand_total_trips": grandTotalTrips,
		"top_drivers":       topDrivers,
		"by_vehicle":        vehicleKMs,
	})
}
