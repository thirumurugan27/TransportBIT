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
	db, err := sql.Open("mysql", "root:root@tcp(127.0.0.1:3306)/transport_system")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("🧹 Clearing old data...")
	db.Exec("SET FOREIGN_KEY_CHECKS=0")
	db.Exec("TRUNCATE TABLE duties")
	db.Exec("TRUNCATE TABLE assignments")
	db.Exec("TRUNCATE TABLE attendance")
	db.Exec("TRUNCATE TABLE drivers")
	db.Exec("DELETE FROM users WHERE role='DRIVER'")
	db.Exec("TRUNCATE TABLE vehicles")
	db.Exec("TRUNCATE TABLE shifts")
	db.Exec("TRUNCATE TABLE stops")
	db.Exec("SET FOREIGN_KEY_CHECKS=1")

	fmt.Println("🌱 Seeding database with realistic data...")

	// Default password for all drivers
	hashStr := "pass123"

	// ============ STOPS / ROUTES ============
	fmt.Println("📍 Creating bus stops/routes...")
	stops := []struct{ name, location string }{
		{"College Main Gate", "BIT Campus Entrance"},
		{"Sathyamangalam Bus Stand", "Central Bus Station"},
		{"Railway Station", "Sathy Railway Junction"},
		{"Gobichettipalayam", "Gobi Bus Stand"},
		{"Bhavani", "Bhavani Junction"},
		{"Erode Bus Stand", "Erode Central"},
		{"Boys Hostel", "BIT Boys Hostel Block"},
		{"Girls Hostel", "BIT Girls Hostel Block"},
		{"Staff Quarters", "Faculty Residence Area"},
		{"Library", "Central Library"},
	}
	for _, s := range stops {
		db.Exec("INSERT INTO stops (stop_name, location) VALUES (?, ?)", s.name, s.location)
	}

	// ============ VEHICLES - Realistic Fleet ============
	fmt.Println("🚌 Creating vehicle fleet...")
	vehicles := []struct {
		number, vtype, fuel string
		capacity            int
		status              string
	}{
		// College Buses with Route Numbers
		{"BUS-85", "BUS", "DIESEL", 52, "available"},  // Route 85 - Sathy route
		{"BUS-86", "BUS", "DIESEL", 52, "available"},  // Route 86 - Erode route
		{"BUS-87", "BUS", "DIESEL", 45, "available"},  // Route 87 - Gobi route
		{"BUS-88", "BUS", "DIESEL", 45, "in_service"}, // Route 88 - Under maintenance
		{"BUS-89", "BUS", "CNG", 40, "available"},     // Route 89 - CNG Bus

		// Battery Vehicles (Electric)
		{"EV-BATT-01", "BATTERY_VEHICLE", "EV", 12, "available"}, // Electric Battery Vehicle for staff
		{"EV-BATT-02", "BATTERY_VEHICLE", "EV", 12, "available"}, // Electric Battery Vehicle for hostel

		// Cars - 5 Seater
		{"CAR-5S-01", "CAR", "PETROL", 5, "available"}, // Principal's car
		{"CAR-5S-02", "CAR", "PETROL", 5, "available"}, // HOD transport
		{"CAR-5S-03", "CAR", "DIESEL", 5, "available"}, // Guest transport

		// Cars - 7 Seater
		{"CAR-7S-01", "CAR", "DIESEL", 7, "available"}, // Staff transport
		{"CAR-7S-02", "CAR", "DIESEL", 7, "available"}, // Emergency vehicle

		// Special Purpose Vehicles
		{"AMBULANCE-01", "OTHER", "DIESEL", 4, "available"}, // College ambulance
		{"UTILITY-01", "OTHER", "DIESEL", 3, "available"},   // Maintenance vehicle
	}
	for _, v := range vehicles {
		db.Exec(`INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, status) 
			VALUES (?, ?, ?, ?, ?)`, v.number, v.vtype, v.fuel, v.capacity, v.status)
	}

	// ============ SHIFTS ============
	fmt.Println("⏰ Creating shifts...")
	shifts := []struct{ name, start, end, desc string }{
		{"Morning College - 6AM", "06:00:00", "09:00:00", "Morning pickup from town to college"},
		{"Morning College - 7AM", "07:00:00", "09:30:00", "Second batch morning pickup"},
		{"Afternoon Return", "12:30:00", "14:00:00", "Lunch break - Hostel shuttle"},
		{"Evening Return - 4PM", "16:00:00", "18:30:00", "Evening drop to town"},
		{"Evening Return - 5PM", "17:00:00", "19:30:00", "Second batch evening drop"},
		{"Night Hostel", "20:00:00", "22:00:00", "Late night hostel service"},
		{"Staff Morning", "08:00:00", "09:00:00", "Staff pickup from quarters"},
		{"Staff Evening", "17:00:00", "18:00:00", "Staff drop to quarters"},
		{"On-Call Duty", "00:00:00", "23:59:00", "Emergency/On-demand service"},
	}
	for _, s := range shifts {
		db.Exec(`INSERT INTO shifts (name, start_time, end_time, description) VALUES (?, ?, ?, ?)`,
			s.name, s.start, s.end, s.desc)
	}

	// ============ DRIVERS ============
	fmt.Println("👨‍💼 Creating drivers...")
	drivers := []struct {
		username, fullName, phone, licNo, licType string
		expYears                                  int
		isIncharge                                bool
		status                                    string
	}{
		{"ravi_kumar", "Ravi Kumar", "9876543210", "TN-DL-2018-001234", "HEAVY", 10, true, "present"},
		{"suresh_m", "Suresh Murugan", "9876543211", "TN-DL-2019-002345", "HEAVY", 8, false, "present"},
		{"ganesh_p", "Ganesh Pandian", "9876543212", "TN-DL-2020-003456", "HEAVY", 6, false, "present"},
		{"murugan_k", "Murugan Krishnan", "9876543213", "TN-DL-2017-004567", "HEAVY", 12, true, "present"},
		{"vijay_r", "Vijay Rajan", "9876543214", "TN-DL-2021-005678", "HEAVY", 4, false, "present"},
		{"senthil_v", "Senthil Velan", "9876543215", "TN-DL-2019-006789", "HEAVY", 7, false, "absent"}, // On leave
		{"kumar_s", "Kumar Selvam", "9876543216", "TN-DL-2020-007890", "LIGHT", 5, false, "present"},
		{"raja_m", "Raja Manickam", "9876543217", "TN-DL-2018-008901", "LIGHT", 9, false, "present"},
		{"arun_p", "Arun Prakash", "9876543218", "TN-DL-2022-009012", "LIGHT", 3, false, "present"},
		{"bala_k", "Bala Kumaran", "9876543219", "TN-DL-2021-010123", "LIGHT", 4, false, "present"},
	}

	for _, d := range drivers {
		// Insert user
		result, err := db.Exec(`INSERT INTO users (username, password, full_name, role, phone, email, status) 
			VALUES (?, ?, ?, 'DRIVER', ?, ?, ?)`,
			d.username, hashStr, d.fullName, d.phone, d.username+"@transport.com", d.status)
		if err != nil {
			log.Printf("Error inserting user %s: %v", d.username, err)
			continue
		}
		userID, _ := result.LastInsertId()

		// Insert driver profile
		db.Exec(`INSERT INTO drivers (user_id, license_number, license_type, license_expiry, experience_years, is_incharge) 
			VALUES (?, ?, ?, '2027-12-31', ?, ?)`,
			userID, d.licNo, d.licType, d.expYears, d.isIncharge)
	}

	// ============ ASSIGNMENTS - Driver to Vehicle Mapping ============
	fmt.Println("📋 Creating driver-vehicle assignments...")

	// Get IDs
	type idName struct {
		id   int
		name string
	}
	var vehicleList []idName
	var driverList []idName
	var shiftList []idName

	rows, _ := db.Query("SELECT id, vehicle_number FROM vehicles WHERE status='available'")
	for rows.Next() {
		var i idName
		rows.Scan(&i.id, &i.name)
		vehicleList = append(vehicleList, i)
	}
	rows.Close()

	rows, _ = db.Query(`SELECT d.id, u.full_name FROM drivers d 
		JOIN users u ON d.user_id = u.id WHERE u.status='present'`)
	for rows.Next() {
		var i idName
		rows.Scan(&i.id, &i.name)
		driverList = append(driverList, i)
	}
	rows.Close()

	rows, _ = db.Query("SELECT id, name FROM shifts")
	for rows.Next() {
		var i idName
		rows.Scan(&i.id, &i.name)
		shiftList = append(shiftList, i)
	}
	rows.Close()

	// Create meaningful assignments
	assignments := []struct {
		vehicleIdx, driverIdx, shiftIdx int
		date, status                    string
	}{
		// Today's assignments
		{0, 0, 0, "2026-01-05", "assigned"},  // BUS-85 -> Ravi Kumar -> Morning 6AM
		{1, 1, 0, "2026-01-05", "assigned"},  // BUS-86 -> Suresh -> Morning 6AM
		{2, 2, 1, "2026-01-05", "assigned"},  // BUS-87 -> Ganesh -> Morning 7AM
		{4, 3, 1, "2026-01-05", "assigned"},  // BUS-89 -> Murugan -> Morning 7AM
		{5, 6, 6, "2026-01-05", "assigned"},  // EV-BATT-01 -> Kumar -> Staff Morning
		{6, 7, 2, "2026-01-05", "assigned"},  // EV-BATT-02 -> Raja -> Afternoon
		{7, 8, 8, "2026-01-05", "assigned"},  // CAR-5S-01 -> Arun -> On-Call
		{10, 9, 8, "2026-01-05", "assigned"}, // CAR-7S-01 -> Bala -> On-Call

		// Tomorrow's assignments (can reassign)
		{0, 1, 0, "2026-01-06", "assigned"}, // BUS-85 -> Suresh (different driver)
		{1, 0, 0, "2026-01-06", "assigned"}, // BUS-86 -> Ravi (swapped)
	}

	for _, a := range assignments {
		if a.vehicleIdx < len(vehicleList) && a.driverIdx < len(driverList) && a.shiftIdx < len(shiftList) {
			db.Exec(`INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, status) 
				VALUES (?, ?, ?, ?, ?)`,
				shiftList[a.shiftIdx].id, vehicleList[a.vehicleIdx].id,
				driverList[a.driverIdx].id, a.date, a.status)
		}
	}

	// ============ SUMMARY ============
	fmt.Println("\n✅ Database seeded successfully!")
	fmt.Println("═══════════════════════════════════════")

	var count int
	db.QueryRow("SELECT COUNT(*) FROM vehicles WHERE vehicle_type='BUS'").Scan(&count)
	fmt.Printf("🚌 Buses:          %d (BUS-85 to BUS-89)\n", count)

	db.QueryRow("SELECT COUNT(*) FROM vehicles WHERE vehicle_type='BATTERY_VEHICLE'").Scan(&count)
	fmt.Printf("⚡ Battery Vehicles: %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM vehicles WHERE vehicle_type='CAR' AND seating_capacity=5").Scan(&count)
	fmt.Printf("🚗 Cars (5-seater): %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM vehicles WHERE vehicle_type='CAR' AND seating_capacity=7").Scan(&count)
	fmt.Printf("🚙 Cars (7-seater): %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM vehicles WHERE vehicle_type='OTHER'").Scan(&count)
	fmt.Printf("🚐 Special Purpose: %d\n", count)

	fmt.Println("───────────────────────────────────────")

	db.QueryRow("SELECT COUNT(*) FROM drivers").Scan(&count)
	fmt.Printf("👨‍💼 Total Drivers:   %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM users WHERE role='DRIVER' AND status='present'").Scan(&count)
	fmt.Printf("✅ Available:       %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM users WHERE role='DRIVER' AND status='absent'").Scan(&count)
	fmt.Printf("❌ Unavailable:     %d\n", count)

	fmt.Println("───────────────────────────────────────")

	db.QueryRow("SELECT COUNT(*) FROM assignments WHERE assigned_date='2026-01-05'").Scan(&count)
	fmt.Printf("📋 Today's Assignments: %d\n", count)

	fmt.Println("═══════════════════════════════════════")
	fmt.Println("🔑 Admin: admin / admin123")
	fmt.Println("🔑 Drivers: any driver username / pass123")
}
