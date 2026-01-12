//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	db, err := sql.Open("mysql", "root:Thiru+2007@tcp(127.0.0.1:3306)/transport_bit")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("🌱 Seeding database with sample data...")

	// Default password for all users
	hashStr := "pass123"

	// ============ STOPS ============
	fmt.Println("📍 Creating stops...")
	stops := []string{
		"INSERT INTO stops (stop_name, location) VALUES ('Main Gate', 'College Main Entrance') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Bus Stand', 'Central Bus Station') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Railway Station', 'City Railway Junction') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Hostel Block A', 'Boys Hostel Area') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Hostel Block B', 'Girls Hostel Area') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Market Square', 'City Center Market') ON DUPLICATE KEY UPDATE stop_name=stop_name",
		"INSERT INTO stops (stop_name, location) VALUES ('Hospital Junction', 'Near City Hospital') ON DUPLICATE KEY UPDATE stop_name=stop_name",
	}
	for _, q := range stops {
		db.Exec(q)
	}

	// ============ VEHICLES ============
	fmt.Println("🚌 Creating vehicles...")
	vehicles := []string{
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33AB1234', 'BUS', 'DIESEL', 45, 'available') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33CD5678', 'BUS', 'DIESEL', 52, 'available') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33EF9012', 'VAN', 'PETROL', 12, 'available') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33GH3456', 'BUS', 'CNG', 40, 'in_service') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33IJ7890', 'CAR', 'PETROL', 4, 'available') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
		"INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) VALUES ('TN33KL1122', 'EV', 'EV', 35, 'available') ON DUPLICATE KEY UPDATE vehicle_number=vehicle_number",
	}
	for _, q := range vehicles {
		db.Exec(q)
	}

	// ============ SHIFTS ============
	fmt.Println("⏰ Creating shifts...")
	shifts := []string{
		"INSERT INTO shifts (name, start_time, end_time, description) VALUES ('Morning Shift', '06:00:00', '10:00:00', 'Early morning college route') ON DUPLICATE KEY UPDATE name=name",
		"INSERT INTO shifts (name, start_time, end_time, description) VALUES ('Afternoon Shift', '12:00:00', '14:00:00', 'Lunch break shuttle') ON DUPLICATE KEY UPDATE name=name",
		"INSERT INTO shifts (name, start_time, end_time, description) VALUES ('Evening Shift', '16:00:00', '20:00:00', 'Evening return route') ON DUPLICATE KEY UPDATE name=name",
		"INSERT INTO shifts (name, start_time, end_time, description) VALUES ('Night Shift', '20:00:00', '23:00:00', 'Late night hostel service') ON DUPLICATE KEY UPDATE name=name",
		"INSERT INTO shifts (name, start_time, end_time, description) VALUES ('Special Event', '08:00:00', '18:00:00', 'For special college events') ON DUPLICATE KEY UPDATE name=name",
	}
	for _, q := range shifts {
		db.Exec(q)
	}

	// ============ DRIVER USERS ============
	fmt.Println("👨‍💼 Creating driver users...")
	driverUsers := []struct {
		username, fullName, phone, email string
	}{
		{"ravi_kumar", "Ravi Kumar", "9876543210", "ravi@transport.com"},
		{"suresh_m", "Suresh Murugan", "9876543211", "suresh@transport.com"},
		{"ganesh_p", "Ganesh Pandian", "9876543212", "ganesh@transport.com"},
		{"kumar_s", "Kumar Selvam", "9876543213", "kumar@transport.com"},
		{"vijay_r", "Vijay Rajan", "9876543214", "vijay@transport.com"},
	}

	for _, u := range driverUsers {
		db.Exec(`INSERT INTO users (username, password, full_name, role, phone, email, status) 
			VALUES (?, ?, ?, 'DRIVER', ?, ?, 'present') 
			ON DUPLICATE KEY UPDATE username=username`,
			u.username, hashStr, u.fullName, u.phone, u.email)
	}

	// ============ DRIVERS ============
	fmt.Println("🚗 Creating driver profiles...")
	// Get user IDs for drivers
	rows, _ := db.Query("SELECT id, username FROM users WHERE role='DRIVER'")
	var userIDs []int
	for rows.Next() {
		var id int
		var username string
		rows.Scan(&id, &username)
		userIDs = append(userIDs, id)
	}
	rows.Close()

	driverProfiles := []struct {
		licenseNo, licenseType string
		expYears               int
		isIncharge             bool
	}{
		{"TN-DL-2020-001234", "HEAVY", 8, true},
		{"TN-DL-2019-005678", "HEAVY", 5, false},
		{"TN-DL-2021-009012", "HEAVY", 3, false},
		{"TN-DL-2018-003456", "LIGHT", 10, true},
		{"TN-DL-2022-007890", "HEAVY", 2, false},
	}

	for i, p := range driverProfiles {
		if i < len(userIDs) {
			db.Exec(`INSERT INTO drivers (user_id, license_number, license_type, license_expiry, experience_years, is_incharge) 
				VALUES (?, ?, ?, '2027-12-31', ?, ?) 
				ON DUPLICATE KEY UPDATE license_number=license_number`,
				userIDs[i], p.licenseNo, p.licenseType, p.expYears, p.isIncharge)
		}
	}

	// ============ ASSIGNMENTS ============
	fmt.Println("📋 Creating assignments...")
	// Get IDs
	var shiftIDs, vehicleIDs, driverIDs []int

	rows, _ = db.Query("SELECT id FROM shifts LIMIT 5")
	for rows.Next() {
		var id int
		rows.Scan(&id)
		shiftIDs = append(shiftIDs, id)
	}
	rows.Close()

	rows, _ = db.Query("SELECT id FROM vehicles LIMIT 5")
	for rows.Next() {
		var id int
		rows.Scan(&id)
		vehicleIDs = append(vehicleIDs, id)
	}
	rows.Close()

	rows, _ = db.Query("SELECT id FROM drivers LIMIT 5")
	for rows.Next() {
		var id int
		rows.Scan(&id)
		driverIDs = append(driverIDs, id)
	}
	rows.Close()

	// Create assignments for today and next few days
	dates := []string{"2026-01-05", "2026-01-06", "2026-01-07"}
	for i := 0; i < len(driverIDs) && i < len(shiftIDs) && i < len(vehicleIDs); i++ {
		for _, date := range dates {
			db.Exec(`INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, status) 
				VALUES (?, ?, ?, ?, 'assigned') 
				ON DUPLICATE KEY UPDATE status=status`,
				shiftIDs[i], vehicleIDs[i], driverIDs[i], date)
		}
	}

	// ============ DUTIES ============
	fmt.Println("🚗 Creating duties...")
	rows, _ = db.Query("SELECT id FROM assignments LIMIT 8")
	var assignmentIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		assignmentIDs = append(assignmentIDs, id)
	}
	rows.Close()

	dutyData := []struct {
		routeFrom, routeTo, status string
	}{
		{"Main Gate", "Railway Station", "completed"},
		{"Bus Stand", "Hostel Block A", "completed"},
		{"Railway Station", "Main Gate", "ongoing"},
		{"Market Square", "College Campus", "planned"},
		{"Hospital Junction", "Bus Stand", "planned"},
	}

	for i, d := range dutyData {
		if i < len(assignmentIDs) {
			db.Exec(`INSERT INTO duties (assignment_id, route_from, route_to, status) 
				VALUES (?, ?, ?, ?)`,
				assignmentIDs[i], d.routeFrom, d.routeTo, d.status)
		}
	}

	// ============ ATTENDANCE ============
	fmt.Println("📅 Creating attendance records...")
	for _, uid := range userIDs {
		db.Exec(`INSERT INTO attendance (user_id, date, status, checkin_time) 
			VALUES (?, CURDATE(), 'present', '08:30:00') 
			ON DUPLICATE KEY UPDATE status=status`, uid)
	}
	// Mark one driver as absent
	if len(userIDs) > 2 {
		db.Exec("UPDATE attendance SET status='absent', checkin_time=NULL WHERE user_id=? AND date=CURDATE()", userIDs[2])
		db.Exec("UPDATE users SET status='absent' WHERE id=?", userIDs[2])
	}

	// ============ SUMMARY ============
	fmt.Println("\n✅ Database seeded successfully!")
	fmt.Println("─────────────────────────────────")

	var count int
	db.QueryRow("SELECT COUNT(*) FROM stops").Scan(&count)
	fmt.Printf("📍 Stops:       %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM vehicles").Scan(&count)
	fmt.Printf("🚌 Vehicles:    %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM shifts").Scan(&count)
	fmt.Printf("⏰ Shifts:      %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM drivers").Scan(&count)
	fmt.Printf("👨‍💼 Drivers:     %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM assignments").Scan(&count)
	fmt.Printf("📋 Assignments: %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM duties").Scan(&count)
	fmt.Printf("🚗 Duties:      %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM attendance").Scan(&count)
	fmt.Printf("📅 Attendance:  %d\n", count)

	fmt.Println("─────────────────────────────────")
	fmt.Println("🔑 Driver login password: pass123")
}
