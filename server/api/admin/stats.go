package admin

import (
	"database/sql"
	"log"
	"net/http"
	"sort"
	"time"

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

type RecentVehicleRequest struct {
	ID          int    `json:"id"`
	FacultyName string `json:"faculty_name"`
	Department  string `json:"department"`
	Purpose     string `json:"purpose"`
	Status      string `json:"status"`
	TripDate    string `json:"trip_date"`
	CreatedAt   string `json:"created_at"`
}

type ActivityItem struct {
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Color     string    `json:"color"`
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

	// NEW: Additional pending items
	PendingKmLogs            int `json:"pending_km_logs"`
	PendingStopChanges       int `json:"pending_stop_changes"`
	PendingTransportRequests int `json:"pending_transport_requests"`
	ActiveReplacements       int `json:"active_replacements"`

	// Student transport
	TotalStudents     int     `json:"total_students"`
	OutstandingFees   float64 `json:"outstanding_fees"`
	TotalFeeCollected float64 `json:"total_fee_collected"`

	// Monthly financials
	FuelConsumedMonth float64 `json:"fuel_consumed_month"`
	TotalKmMonth      float64 `json:"total_km_month"`
	ServiceCostMonth  float64 `json:"service_cost_month"`
	PartsCostMonth    float64 `json:"parts_cost_month"`
	AvgMileageMonth   float64 `json:"avg_mileage_month"`

	// Vehicle request breakdown
	VehicleRequestsTotal     int `json:"vehicle_requests_total"`
	VehicleRequestsPending   int `json:"vehicle_requests_pending"`
	VehicleRequestsApproved  int `json:"vehicle_requests_approved"`
	VehicleRequestsCompleted int `json:"vehicle_requests_completed"`

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

	// Group expiry alerts
	ExpiringDriverGroups  int `json:"expiring_driver_groups"`
	ExpiredDriverGroups   int `json:"expired_driver_groups"`
	ExpiringVehicleGroups int `json:"expiring_vehicle_groups"`
	ExpiredVehicleGroups  int `json:"expired_vehicle_groups"`

	// Recent vehicle requests (last 5)
	RecentVehicleRequests []RecentVehicleRequest `json:"recent_vehicle_requests"`

	// Recent activity feed (last 10)
	RecentActivity []ActivityItem `json:"recent_activity"`
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

	// NEW: Additional pending items
	config.DB.QueryRow(`SELECT COUNT(*) FROM km_logs WHERE status = 'pending'`).Scan(&s.PendingKmLogs)
	config.DB.QueryRow(`SELECT COUNT(*) FROM stop_change_requests WHERE status = 'pending'`).Scan(&s.PendingStopChanges)
	config.DB.QueryRow(`SELECT COUNT(*) FROM transport_requests WHERE status = 'pending'`).Scan(&s.PendingTransportRequests)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehicle_replacements WHERE status IN ('pending','approved','active')`).Scan(&s.ActiveReplacements)

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
	config.DB.QueryRow(`SELECT COALESCE(SUM(balance), 0) FROM student_transport WHERE status = 'active' AND balance > 0`).Scan(&s.OutstandingFees)
	config.DB.QueryRow(`SELECT COALESCE(SUM(paid_amount), 0) FROM student_transport WHERE status = 'active'`).Scan(&s.TotalFeeCollected)

	// ── Monthly Financials ──
	var fuelFromIndents, fuelFromKmLogs float64
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(fuel_filled), 0) FROM fuel_indents
		WHERE status = 'completed'
		AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
	`).Scan(&fuelFromIndents)
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(fuel_consumed), 0) FROM km_logs
		WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
		AND status = 'approved'
	`).Scan(&fuelFromKmLogs)
	if fuelFromKmLogs > fuelFromIndents {
		s.FuelConsumedMonth = fuelFromKmLogs
	} else {
		s.FuelConsumedMonth = fuelFromIndents
	}

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_km), 0) FROM km_logs
		WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
		AND status IN ('pending','approved')
	`).Scan(&s.TotalKmMonth)

	// Average mileage
	if s.FuelConsumedMonth > 0 {
		s.AvgMileageMonth = s.TotalKmMonth / s.FuelConsumedMonth
	}

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_cost), 0) FROM service_records
		WHERE status = 'completed'
		AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
	`).Scan(&s.ServiceCostMonth)

	config.DB.QueryRow(`
		SELECT COALESCE(SUM(quantity * unit_price), 0) FROM parts_purchased
		WHERE status = 'received'
		AND purchased_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
	`).Scan(&s.PartsCostMonth)

	// ── Vehicle Requests Breakdown ──
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`).Scan(&s.VehicleRequestsTotal)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE status = 'pending'`).Scan(&s.VehicleRequestsPending)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE status IN ('approved','assigned')`).Scan(&s.VehicleRequestsApproved)
	config.DB.QueryRow(`SELECT COUNT(*) FROM vehiclerequests WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`).Scan(&s.VehicleRequestsCompleted)

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

	// ── Group Expiry Alerts ──
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM driver_clusters
		WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
	`).Scan(&s.ExpiredDriverGroups)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM driver_clusters
		WHERE valid_to IS NOT NULL AND valid_to >= CURDATE()
		AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
	`).Scan(&s.ExpiringDriverGroups)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicle_groups
		WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
	`).Scan(&s.ExpiredVehicleGroups)

	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicle_groups
		WHERE valid_to IS NOT NULL AND valid_to >= CURDATE()
		AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
	`).Scan(&s.ExpiringVehicleGroups)

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
	if s.PendingKmLogs > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "KM Log Approvals", Count: s.PendingKmLogs,
			Route: "/admin-dashboard/km-management", Color: "green", Icon: "gauge",
		})
	}
	if s.PendingStopChanges > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Stop Change Requests", Count: s.PendingStopChanges,
			Route: "/admin-dashboard/student-transport", Color: "primary", Icon: "bus",
		})
	}
	if s.PendingTransportRequests > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Transport Requests", Count: s.PendingTransportRequests,
			Route: "/admin-dashboard/student-transport", Color: "primarydull", Icon: "graduation",
		})
	}
	if s.ActiveServices > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Active Services", Count: s.ActiveServices,
			Route: "/admin-dashboard/service-records", Color: "primary", Icon: "wrench",
		})
	}
	if s.ActiveReplacements > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Vehicle Replacements", Count: s.ActiveReplacements,
			Route: "/admin-dashboard/vehicle-replacements", Color: "pending", Icon: "replace",
		})
	}
	if s.DocumentAlerts > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Document Expiring", Count: s.DocumentAlerts,
			Route: "/admin-dashboard/vehicles?view=expiry", Color: "red", Icon: "shield",
		})
	}
	if s.ExpiringLicenses > 0 || s.ExpiredLicenses > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "License Expiring", Count: s.ExpiringLicenses + s.ExpiredLicenses,
			Route: "/admin-dashboard/drivers", Color: "red", Icon: "id-card",
		})
	}
	if s.ExpiringDriverGroups > 0 || s.ExpiredDriverGroups > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Driver Group Expiring", Count: s.ExpiringDriverGroups + s.ExpiredDriverGroups,
			Route: "/admin-dashboard/schedule-management", Color: "red", Icon: "users",
		})
	}
	if s.ExpiringVehicleGroups > 0 || s.ExpiredVehicleGroups > 0 {
		s.PendingActions = append(s.PendingActions, PendingAction{
			Label: "Vehicle Group Expiring", Count: s.ExpiringVehicleGroups + s.ExpiredVehicleGroups,
			Route: "/admin-dashboard/schedule-management", Color: "red", Icon: "layers",
		})
	}

	// ── Recent Vehicle Requests (last 5) ──
	s.RecentVehicleRequests = queryRecentVehicleRequests()

	// ── Recent Activity Feed ──
	s.RecentActivity = queryRecentActivity()

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

// queryRecentVehicleRequests returns the 5 most recent vehicle requests
func queryRecentVehicleRequests() []RecentVehicleRequest {
	rows, err := config.DB.Query(`
		SELECT vr.id,
			COALESCE(u.full_name, 'Unknown') AS faculty_name,
			COALESCE(vr.department, '') AS department,
			COALESCE(vr.purpose, '') AS purpose,
			COALESCE(vr.status, 'pending') AS status,
			COALESCE(DATE_FORMAT(vr.trip_date, '%Y-%m-%d'), '') AS trip_date,
			vr.created_at
		FROM vehiclerequests vr
		LEFT JOIN users u ON vr.user_id = u.id
		ORDER BY vr.created_at DESC
		LIMIT 5
	`)
	if err != nil {
		log.Printf("queryRecentVehicleRequests error: %v", err)
		return []RecentVehicleRequest{}
	}
	defer rows.Close()

	var result []RecentVehicleRequest
	for rows.Next() {
		var r RecentVehicleRequest
		if err := rows.Scan(&r.ID, &r.FacultyName, &r.Department, &r.Purpose, &r.Status, &r.TripDate, &r.CreatedAt); err == nil {
			result = append(result, r)
		}
	}
	if result == nil {
		return []RecentVehicleRequest{}
	}
	return result
}

// queryRecentActivity returns a feed of recent important events
func queryRecentActivity() []ActivityItem {
	var items []ActivityItem

	// Recent leave requests
	lRows, _ := config.DB.Query(`
		SELECT CONCAT(COALESCE(u.full_name,'Driver'), ' requested leave (', lr.status, ')') AS message,
			lr.created_at
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		ORDER BY lr.created_at DESC LIMIT 3
	`)
	if lRows != nil {
		defer lRows.Close()
		for lRows.Next() {
			var a ActivityItem
			a.Type = "leave"
			a.Color = "pending"
			if lRows.Scan(&a.Message, &a.Timestamp) == nil {
				items = append(items, a)
			}
		}
	}

	// Recent service records
	sRows, _ := config.DB.Query(`
		SELECT CONCAT('Service: ', COALESCE(sr.description,''), ' [', sr.status, ']') AS message,
			sr.created_at
		FROM service_records sr
		ORDER BY sr.created_at DESC LIMIT 3
	`)
	if sRows != nil {
		defer sRows.Close()
		for sRows.Next() {
			var a ActivityItem
			a.Type = "service"
			a.Color = "primary"
			if sRows.Scan(&a.Message, &a.Timestamp) == nil {
				items = append(items, a)
			}
		}
	}

	// Recent vehicle requests
	vRows, _ := config.DB.Query(`
		SELECT CONCAT(COALESCE(u.full_name,'Faculty'), ' - vehicle request (', vr.status, ')') AS message,
			vr.created_at
		FROM vehiclerequests vr
		LEFT JOIN users u ON vr.user_id = u.id
		ORDER BY vr.created_at DESC LIMIT 3
	`)
	if vRows != nil {
		defer vRows.Close()
		for vRows.Next() {
			var a ActivityItem
			a.Type = "vehicle_request"
			a.Color = "customblue"
			if vRows.Scan(&a.Message, &a.Timestamp) == nil {
				items = append(items, a)
			}
		}
	}

	// Recent KM log submissions
	kRows, _ := config.DB.Query(`
		SELECT CONCAT(COALESCE(u.full_name,'Driver'), ' submitted KM log (', kl.status, ')') AS message,
			kl.created_at
		FROM km_logs kl
		JOIN drivers d ON kl.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		ORDER BY kl.created_at DESC LIMIT 3
	`)
	if kRows != nil {
		defer kRows.Close()
		for kRows.Next() {
			var a ActivityItem
			a.Type = "km_log"
			a.Color = "green"
			if kRows.Scan(&a.Message, &a.Timestamp) == nil {
				items = append(items, a)
			}
		}
	}

	// Sort by timestamp descending and limit to 8
	sort.Slice(items, func(i, j int) bool {
		return items[i].Timestamp.After(items[j].Timestamp)
	})
	if len(items) > 8 {
		items = items[:8]
	}
	if items == nil {
		return []ActivityItem{}
	}
	return items
}

// scanNullable safely scans nullable string
func scanNullable(dest *sql.NullString) *string {
	if dest.Valid {
		return &dest.String
	}
	return nil
}

/* ==========================
   DRIVER WORKLOAD ENDPOINT
========================== */

type DriverVehicleInfo struct {
	VehicleID     int    `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	VehicleType   string `json:"vehicle_type"`
	ShiftName     string `json:"shift_name"`
}

type DriverWorkload struct {
	DriverID          int                 `json:"driver_id"`
	DriverName        string              `json:"driver_name"`
	ActiveAssignments int                 `json:"active_assignments"`
	TotalDutiesMonth  int                 `json:"total_duties_month"`
	TotalKmMonth      float64             `json:"total_km_month"`
	PendingKmLogs     int                 `json:"pending_km_logs"`
	AttendanceStatus  string              `json:"attendance_status"`
	VehicleCount      int                 `json:"vehicle_count"`
	LeavesTaken       int                 `json:"leaves_taken"`
	WorkloadScore     int                 `json:"workload_score"`
	Vehicles          []DriverVehicleInfo `json:"vehicles"`
}

type UpcomingTask struct {
	ID          int    `json:"id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"due_date"`
	Priority    string `json:"priority"`
	Route       string `json:"route"`
	Color       string `json:"color"`
}

type DriverWorkloadResponse struct {
	Drivers       []DriverWorkload `json:"drivers"`
	UpcomingTasks []UpcomingTask   `json:"upcoming_tasks"`
}

// GET /api/admin/dashboard/driver-workload
func GetDriverWorkload(c *gin.Context) {
	var resp DriverWorkloadResponse

	// Per-driver workload data
	rows, err := config.DB.Query(`
		SELECT
			d.id AS driver_id,
			COALESCE(u.full_name, u.username) AS driver_name,
			COALESCE(active_asgn.cnt, 0) AS active_assignments,
			COALESCE(duties_month.cnt, 0) AS total_duties_month,
			COALESCE(km_month.total_km, 0) AS total_km_month,
			COALESCE(pending_km.cnt, 0) AS pending_km_logs,
			COALESCE(att.status, 'not_marked') AS attendance_status,
			COALESCE(veh_cnt.cnt, 0) AS vehicle_count,
			COALESCE(leaves.cnt, 0) AS leaves_taken
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN (
			SELECT a.driver_id, COUNT(*) AS cnt
			FROM assignments a
			WHERE a.status IN ('assigned','active') AND CURDATE() BETWEEN a.start_date AND a.end_date
			GROUP BY a.driver_id
		) active_asgn ON active_asgn.driver_id = d.id
		LEFT JOIN (
			SELECT a.driver_id, COUNT(*) AS cnt
			FROM assignments a
			WHERE a.start_date <= LAST_DAY(CURDATE())
			  AND a.end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
			GROUP BY a.driver_id
		) duties_month ON duties_month.driver_id = d.id
		LEFT JOIN (
			SELECT kl.driver_id, SUM(kl.total_km) AS total_km
			FROM km_logs kl
			WHERE kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
			  AND kl.status IN ('pending','approved')
			GROUP BY kl.driver_id
		) km_month ON km_month.driver_id = d.id
		LEFT JOIN (
			SELECT
				asgn.driver_id,
				GREATEST(0, asgn.cnt - COALESCE(logs.cnt, 0)) AS cnt
			FROM (
				SELECT a.driver_id, COUNT(*) AS cnt
				FROM assignments a
				WHERE a.status IN ('assigned','active')
				  AND CURDATE() BETWEEN a.start_date AND a.end_date
				GROUP BY a.driver_id
			) asgn
			LEFT JOIN (
				SELECT driver_id, COUNT(*) AS cnt
				FROM km_logs
				WHERE date = CURDATE()
				  AND status IN ('pending','approved')
				GROUP BY driver_id
			) logs ON logs.driver_id = asgn.driver_id
		) pending_km ON pending_km.driver_id = d.id
		LEFT JOIN (
			SELECT a.user_id, a.status
			FROM attendance a
			WHERE a.date = CURDATE()
		) att ON att.user_id = d.user_id
		LEFT JOIN (
			SELECT a.driver_id, COUNT(DISTINCT a.vehicle_id) AS cnt
			FROM assignments a
			WHERE a.status IN ('assigned','active') AND CURDATE() BETWEEN a.start_date AND a.end_date
			GROUP BY a.driver_id
		) veh_cnt ON veh_cnt.driver_id = d.id
		LEFT JOIN (
			SELECT lr.driver_id, COUNT(*) AS cnt
			FROM leave_requests lr
			WHERE lr.status = 'approved'
			  AND lr.start_date <= LAST_DAY(CURDATE())
			  AND lr.end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
			GROUP BY lr.driver_id
		) leaves ON leaves.driver_id = d.id
		ORDER BY active_asgn.cnt DESC, duties_month.cnt DESC
	`)
	if err != nil {
		log.Printf("driver workload query error: %v", err)
		resp.Drivers = []DriverWorkload{}
	} else {
		defer rows.Close()
		for rows.Next() {
			var dw DriverWorkload
			if err := rows.Scan(
				&dw.DriverID, &dw.DriverName,
				&dw.ActiveAssignments, &dw.TotalDutiesMonth,
				&dw.TotalKmMonth, &dw.PendingKmLogs,
				&dw.AttendanceStatus, &dw.VehicleCount, &dw.LeavesTaken,
			); err == nil {
				// Calculate workload score (0-100)
				score := dw.ActiveAssignments * 25
				score += dw.TotalDutiesMonth * 5
				if dw.TotalKmMonth > 1000 {
					score += 15
				} else if dw.TotalKmMonth > 500 {
					score += 10
				}
				if score > 100 {
					score = 100
				}
				dw.WorkloadScore = score
				dw.Vehicles = []DriverVehicleInfo{}
				resp.Drivers = append(resp.Drivers, dw)
			}
		}
	}
	if resp.Drivers == nil {
		resp.Drivers = []DriverWorkload{}
	}

	// Fetch assigned vehicles for each driver
	for i, dw := range resp.Drivers {
		vRows, vErr := config.DB.Query(`
			SELECT v.id, COALESCE(v.vehicle_number,''), COALESCE(v.vehicle_type,''), COALESCE(s.name,'')
			FROM assignments a
			JOIN vehicles v ON a.vehicle_id = v.id
			LEFT JOIN shifts s ON a.shift_id = s.id
			WHERE a.driver_id = ? AND a.status IN ('assigned','active') AND CURDATE() BETWEEN a.start_date AND a.end_date
		`, dw.DriverID)
		if vErr != nil {
			log.Printf("vehicle query error for driver %d: %v", dw.DriverID, vErr)
			continue
		}
		for vRows.Next() {
			var vi DriverVehicleInfo
			if vRows.Scan(&vi.VehicleID, &vi.VehicleNumber, &vi.VehicleType, &vi.ShiftName) == nil {
				resp.Drivers[i].Vehicles = append(resp.Drivers[i].Vehicles, vi)
			}
		}
		vRows.Close()
		if resp.Drivers[i].Vehicles == nil {
			resp.Drivers[i].Vehicles = []DriverVehicleInfo{}
		}
	}

	// Upcoming tasks: gather important upcoming items
	resp.UpcomingTasks = []UpcomingTask{}

	// Upcoming vehicle requests (next 7 days)
	vrRows, _ := config.DB.Query(`
		SELECT vr.id, CONCAT(COALESCE(u.full_name,'Faculty'), ' - ', COALESCE(vr.purpose,'Trip')),
			COALESCE(DATE_FORMAT(vr.trip_date, '%Y-%m-%d'), ''),
			vr.status
		FROM vehiclerequests vr
		LEFT JOIN users u ON vr.user_id = u.id
		WHERE vr.status IN ('approved','assigned')
		AND vr.trip_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
		ORDER BY vr.trip_date ASC LIMIT 5
	`)
	if vrRows != nil {
		defer vrRows.Close()
		for vrRows.Next() {
			var t UpcomingTask
			var status string
			if vrRows.Scan(&t.ID, &t.Title, &t.DueDate, &status) == nil {
				t.Type = "vehicle_request"
				t.Description = "Upcoming vehicle request - " + status
				t.Priority = "medium"
				t.Route = "/admin-dashboard/vehicle-requests"
				t.Color = "customblue"
				resp.UpcomingTasks = append(resp.UpcomingTasks, t)
			}
		}
	}

	// Expiring vehicle documents (next 10 days)
	docRows, _ := config.DB.Query(`
		SELECT v.id, COALESCE(v.vehicle_number, 'Unknown Vehicle'),
			CASE
				WHEN insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(insurance_expire_date, '%Y-%m-%d')
				WHEN fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(fc_expire_date, '%Y-%m-%d')
				WHEN permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(permit_expire_date, '%Y-%m-%d')
			END as exp_date,
			CASE
				WHEN insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10 THEN 'Insurance'
				WHEN fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10 THEN 'FC Certificate'
				WHEN permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10 THEN 'Permit'
			END as doc_type
		FROM vehicles v
		WHERE v.status IN ('active','available')
		AND (
			(insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) BETWEEN 0 AND 10)
			OR (fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) BETWEEN 0 AND 10)
			OR (permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) BETWEEN 0 AND 10)
		)
		LIMIT 5
	`)
	if docRows != nil {
		defer docRows.Close()
		for docRows.Next() {
			var t UpcomingTask
			var docType string
			if docRows.Scan(&t.ID, &t.Title, &t.DueDate, &docType) == nil {
				t.Type = "document_expiry"
				t.Description = docType + " expiring soon"
				t.Priority = "high"
				t.Route = "/admin-dashboard/vehicles"
				t.Color = "red"
				resp.UpcomingTasks = append(resp.UpcomingTasks, t)
			}
		}
	}

	// Expiring driver licenses (next 30 days)
	licRows, _ := config.DB.Query(`
		SELECT d.id, COALESCE(u.full_name, u.username),
			d.license_expiry
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
		AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
		LIMIT 5
	`)
	if licRows != nil {
		defer licRows.Close()
		for licRows.Next() {
			var t UpcomingTask
			if licRows.Scan(&t.ID, &t.Title, &t.DueDate) == nil {
				t.Type = "license_expiry"
				t.Description = "Driver license expiring soon"
				t.Priority = "high"
				t.Route = "/admin-dashboard/drivers"
				t.Color = "pending"
				resp.UpcomingTasks = append(resp.UpcomingTasks, t)
			}
		}
	}

	c.JSON(http.StatusOK, resp)
}
