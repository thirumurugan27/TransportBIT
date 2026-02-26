package admin

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/* =========================
   ENHANCED DASHBOARD STATS
========================= */

type DayAttendance struct {
	Date    string `json:"date"`
	Day     string `json:"day"`
	Present int    `json:"present"`
	Absent  int    `json:"absent"`
	OnLeave int    `json:"on_leave"`
}

type TypeCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type PendingAction struct {
	Label string `json:"label"`
	Count int    `json:"count"`
	Route string `json:"route"`
	Color string `json:"color"`
	Icon  string `json:"icon"`
}

type EnhancedDashboardStats struct {
	// Driver metrics
	TotalDrivers   int `json:"total_drivers"`
	PresentDrivers int `json:"present_drivers"`
	AbsentDrivers  int `json:"absent_drivers"`
	OnLeaveDrivers int `json:"on_leave_drivers"`
	NotMarked      int `json:"not_marked"`

	// Vehicle metrics
	TotalVehicles  int `json:"total_vehicles"`
	ActiveVehicles int `json:"active_vehicles"`
	InServiceCount int `json:"in_service_count"`

	// Operations
	ActiveDuties     int `json:"active_duties"`
	TotalAssignments int `json:"total_assignments"`

	// Pending items
	PendingLeaves          int `json:"pending_leaves"`
	PendingVehicleRequests int `json:"pending_vehicle_requests"`
	ActiveServices         int `json:"active_services"`
	DocumentAlerts         int `json:"document_alerts"`
	ExpiredDocuments       int `json:"expired_documents"`

	// Student transport
	TotalStudents int `json:"total_students"`

	// Monthly financials
	FuelConsumedMonth float64 `json:"fuel_consumed_month"`
	TotalKmMonth      float64 `json:"total_km_month"`
	ServiceCostMonth  float64 `json:"service_cost_month"`
	PartsCostMonth    float64 `json:"parts_cost_month"`

	// Breakdowns
	VehiclesByType []TypeCount `json:"vehicles_by_type"`
	VehiclesByFuel []TypeCount `json:"vehicles_by_fuel"`

	// Weekly attendance trend (last 7 days)
	WeeklyAttendance []DayAttendance `json:"weekly_attendance"`

	// Pending actions summary
	PendingActions []PendingAction `json:"pending_actions"`

	// License alerts
	ExpiringLicenses int `json:"expiring_licenses"`
	ExpiredLicenses  int `json:"expired_licenses"`
}

// GET /api/admin/dashboard/stats
func GetDashboardStats(c *gin.Context) {
	var s EnhancedDashboardStats

	// ── Driver Metrics ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.id`).Scan(&s.TotalDrivers)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM attendance a
		JOIN drivers d ON a.user_id = d.user_id
		WHERE a.date = CURDATE() AND a.status = 'present'
	`).Scan(&s.PresentDrivers)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM attendance a
		JOIN drivers d ON a.user_id = d.user_id
		WHERE a.date = CURDATE() AND a.status = 'absent'
	`).Scan(&s.AbsentDrivers)

	config.DB.QueryRow(`
		SELECT COUNT(DISTINCT d.id) FROM drivers d
		JOIN leave_requests lr ON d.id = lr.driver_id
		WHERE lr.status = 'approved'
		AND CURDATE() BETWEEN lr.start_date AND lr.end_date
	`).Scan(&s.OnLeaveDrivers)

	s.NotMarked = s.TotalDrivers - s.PresentDrivers - s.AbsentDrivers - s.OnLeaveDrivers
	if s.NotMarked < 0 {
		s.NotMarked = 0
	}

	// ── Vehicle Metrics ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehicles`).Scan(&s.TotalVehicles)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehicles WHERE status IN ('active','available')`).Scan(&s.ActiveVehicles)
	config.DB.QueryRow(`SELECT COUNT(*) FROM service_records WHERE status IN ('reported','scheduled','in_progress')`).Scan(&s.InServiceCount)

	// ── Operations ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM duties WHERE status IN ('planned','ongoing')`).Scan(&s.ActiveDuties)
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM assignments WHERE status IN ('assigned','active')
		AND CURDATE() BETWEEN start_date AND end_date
	`).Scan(&s.TotalAssignments)

	// ── Pending Items ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'`).Scan(&s.PendingLeaves)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE status = 'pending'`).Scan(&s.PendingVehicleRequests)
	config.DB.QueryRow(`SELECT COUNT(*) FROM service_records WHERE status IN ('reported','scheduled','in_progress')`).Scan(&s.ActiveServices)

	// Document alerts
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicles
		WHERE status IN ('active','available')
		AND (
			(insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10)
			OR (fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10)
			OR (permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10)
		)
	`).Scan(&s.DocumentAlerts)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicles
		WHERE status IN ('active','available')
		AND (
			(insurance_expire_date IS NOT NULL AND insurance_expire_date < CURDATE())
			OR (fc_expire_date IS NOT NULL AND fc_expire_date < CURDATE())
			OR (permit_expire_date IS NOT NULL AND permit_expire_date < CURDATE())
		)
	`).Scan(&s.ExpiredDocuments)

	// ── Student Transport ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM student_transport WHERE status = 'active'`).Scan(&s.TotalStudents)

	// ── Monthly Financials ──
	var fuelFromIndents, fuelFromKmLogs float64
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(fuel_filled), 0) FROM fuel_indents
		WHERE status = 'completed'
		AND MONTH(completed_at) = MONTH(CURDATE()) AND YEAR(completed_at) = YEAR(CURDATE())
	`).Scan(&fuelFromIndents)
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(fuel_consumed), 0) FROM km_logs
		WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())
		AND status = 'approved'
	`).Scan(&fuelFromKmLogs)
	if fuelFromKmLogs > fuelFromIndents {
		s.FuelConsumedMonth = fuelFromKmLogs
	} else {
		s.FuelConsumedMonth = fuelFromIndents
	}

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_km), 0) FROM km_logs
		WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())
	`).Scan(&s.TotalKmMonth)

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_cost), 0) FROM service_records
		WHERE status = 'completed'
		AND MONTH(completed_at) = MONTH(CURDATE()) AND YEAR(completed_at) = YEAR(CURDATE())
	`).Scan(&s.ServiceCostMonth)

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(quantity * unit_price), 0) FROM parts_purchased
		WHERE status = 'received'
		AND MONTH(purchased_date) = MONTH(CURDATE()) AND YEAR(purchased_date) = YEAR(CURDATE())
	`).Scan(&s.PartsCostMonth)

	// ── Vehicles by Type ──
	s.VehiclesByType = queryTypeCount(`SELECT COALESCE(vehicle_type,'Other'), COUNT(*) FROM vehicles GROUP BY vehicle_type ORDER BY COUNT(*) DESC`)

	// ── Vehicles by Fuel ──
	s.VehiclesByFuel = queryTypeCount(`SELECT COALESCE(fuel_type,'Other'), COUNT(*) FROM vehicles GROUP BY fuel_type ORDER BY COUNT(*) DESC`)

	// ── Weekly Attendance Trend (last 7 days) ──
	s.WeeklyAttendance = queryWeeklyAttendance()

	// ── Driver License Alerts ──
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.id
		WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
		AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') < CURDATE()
	`).Scan(&s.ExpiredLicenses)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.id
		WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
		AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
	`).Scan(&s.ExpiringLicenses)

	// ── Build Pending Actions list ──
	s.PendingActions = []PendingAction{}
	if s.PendingLeaves > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Leave Requests", Count: s.PendingLeaves,
			Route: "/admin-dashboard/leave-approvals", Color: "pending", Icon: "calendar",
		})
	}
	if s.PendingVehicleRequests > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Vehicle Requests", Count: s.PendingVehicleRequests,
			Route: "/admin-dashboard/vehicle-requests", Color: "customblue", Icon: "truck",
		})
	}
	if s.ActiveServices > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Active Services", Count: s.ActiveServices,
			Route: "/admin-dashboard/service-records", Color: "primary", Icon: "wrench",
		})
	}
	if s.DocumentAlerts > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Document Alerts", Count: s.DocumentAlerts,
			Route: "/admin-dashboard/vehicle-replacements", Color: "red", Icon: "shield",
		})
	}
	if s.ExpiringLicenses > 0 || s.ExpiredLicenses > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "License Alerts", Count: s.ExpiringLicenses + s.ExpiredLicenses,
			Route: "/admin-dashboard/drivers", Color: "red", Icon: "id-card",
		})
	}

	c.JSON(http.StatusOK, s)
}

// queryTypeCount runs a "SELECT label, count" query and returns []TypeCount
func queryTypeCount(query string) []TypeCount {
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("queryTypeCount error: %v", err)
		return []TypeCount{}
	}
	defer rows.Close()

	var result []TypeCount
	for rows.Next() {
		var tc TypeCount
		if err := rows.Scan(&tc.Label, &tc.Count); err == nil {
			result = append(result, tc)
		}
	}
	if result == nil {
		return []TypeCount{}
	}
	return result
}

// queryWeeklyAttendance returns attendance data for last 7 days
func queryWeeklyAttendance() []DayAttendance {
	rows, err := config.DB.Query(`
		SELECT
			DATE_FORMAT(a.date, '%d %b') as formatted_date,
			LEFT(DAYNAME(a.date), 3) as day_name,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
		FROM attendance a
		JOIN drivers d ON a.user_id = d.user_id
		WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND a.date <= CURDATE()
		GROUP BY a.date
		ORDER BY a.date ASC
	`)
	if err != nil {
		log.Printf("weekly attendance error: %v", err)
		return []DayAttendance{}
	}
	defer rows.Close()

	var result []DayAttendance
	for rows.Next() {
		var d DayAttendance
		if err := rows.Scan(&d.Date, &d.Day, &d.Present, &d.Absent); err == nil {
			result = append(result, d)
		}
	}

	// Also query on-leave counts per day
	leaveRows, err := config.DB.Query(`
		SELECT DATE_FORMAT(dates.d, '%d %b') as formatted_date,
		       COUNT(DISTINCT lr.driver_id) as on_leave
		FROM (
			SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as d
			FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums
		) dates
		LEFT JOIN leave_requests lr ON dates.d BETWEEN lr.start_date AND lr.end_date AND lr.status = 'approved'
		WHERE dates.d >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
		GROUP BY dates.d
		ORDER BY dates.d ASC
	`)
	if err == nil {
		defer leaveRows.Close()
		leaveMap := make(map[string]int)
		for leaveRows.Next() {
			var date string
			var count int
			if leaveRows.Scan(&date, &count) == nil {
				leaveMap[date] = count
			}
		}
		for i := range result {
			if cnt, ok := leaveMap[result[i].Date]; ok {
				result[i].OnLeave = cnt
			}
		}
	}

	if result == nil {
		return []DayAttendance{}
	}
	return result
}

// scanNullable safely scans nullable string
func scanNullable(dest *sql.NullString) *string {
	if dest.Valid {
		return &dest.String
	}
	return nil
}
