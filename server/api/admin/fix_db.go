package admin

import (
	"log"
	"time"
	"transport-server/config"
)

// FixDatabaseSchema modifies columns that are causing truncation errors (often due to restrictive ENUMs)
func FixDatabaseSchema() {
	log.Println("Running database schema fixes...")

	// 1. Fix vehicles status - often truncates when updating to 'available' or 'in_service' if ENUM is restrictive
	_, err := config.DB.Exec("ALTER TABLE vehicles MODIFY COLUMN status VARCHAR(50) DEFAULT 'available'")
	if err != nil {
		log.Printf("Schema Fix (vehicles): %v", err)
	} else {
		log.Println("Schema Fix: vehicles.status updated to VARCHAR")
	}

	// 2. Fix users status – add if missing (ignore duplicate-column error), then normalise type
	config.DB.Exec("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active'") // no-op if already exists
	_, err = config.DB.Exec("ALTER TABLE users MODIFY COLUMN status VARCHAR(50) DEFAULT 'active'")
	if err != nil {
		log.Printf("Schema Fix (users): %v", err)
	} else {
		log.Println("Schema Fix: users.status ensured as VARCHAR")
	}

	// 3. Fix student_transport status
	_, err = config.DB.Exec("ALTER TABLE student_transport MODIFY COLUMN status VARCHAR(50) DEFAULT 'active'")
	if err != nil {
		log.Printf("Schema Fix (student_transport): %v", err)
	} else {
		log.Println("Schema Fix: student_transport.status updated to VARCHAR")
	}

	// 4. Fix transport_requests status
	_, err = config.DB.Exec("ALTER TABLE transport_requests MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'")
	if err != nil {
		log.Printf("Schema Fix (transport_requests): %v", err)
	} else {
		log.Println("Schema Fix: transport_requests.status updated to VARCHAR")
	}

	// 5. Fix temporary_assignments status - needs to accept 'active', 'completed', 'cancelled'
	_, err = config.DB.Exec("ALTER TABLE temporary_assignments MODIFY COLUMN status VARCHAR(50) DEFAULT 'active'")
	if err != nil {
		log.Printf("Schema Fix (temporary_assignments): %v", err)
	} else {
		log.Println("Schema Fix: temporary_assignments.status updated to VARCHAR")
	}

	// 6. Make shift_id nullable in temporary_assignments for EV cluster replacements
	_, err = config.DB.Exec("ALTER TABLE temporary_assignments MODIFY COLUMN shift_id INT NULL")
	if err != nil {
		log.Printf("Schema Fix (temporary_assignments shift_id): %v", err)
	} else {
		log.Println("Schema Fix: temporary_assignments.shift_id now nullable for EV clusters")
	}

	// 6. Fix leave_requests status - needs to accept 'pending', 'approved', 'rejected', 'admin_approved'
	_, err = config.DB.Exec("ALTER TABLE leave_requests MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'")
	if err != nil {
		log.Printf("Schema Fix (leave_requests): %v", err)
	} else {
		log.Println("Schema Fix: leave_requests.status updated to VARCHAR")
	}

	// 7. Add created_by and created_at columns to assignments table
	_, err = config.DB.Exec("ALTER TABLE assignments ADD COLUMN created_by INT NULL")
	if err != nil {
		log.Printf("Schema Fix (assignments.created_by): %v (may already exist)", err)
	} else {
		log.Println("Schema Fix: assignments.created_by added")
	}

	_, err = config.DB.Exec("ALTER TABLE assignments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
	if err != nil {
		log.Printf("Schema Fix (assignments.created_at): %v (may already exist)", err)
	} else {
		log.Println("Schema Fix: assignments.created_at added")
	}

	// 8. Add created_by column to temporary_assignments table
	_, err = config.DB.Exec("ALTER TABLE temporary_assignments ADD COLUMN created_by INT NULL")
	if err != nil {
		log.Printf("Schema Fix (temporary_assignments.created_by): %v (may already exist)", err)
	} else {
		log.Println("Schema Fix: temporary_assignments.created_by added")
	}

	// 9. Create unified notifications table for all roles
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS notifications (
			id INT AUTO_INCREMENT PRIMARY KEY,
			recipient_role ENUM('ADMIN','DRIVER','STUDENT','FACULTY') NOT NULL,
			recipient_id INT NOT NULL DEFAULT 0,
			type VARCHAR(50) DEFAULT 'general',
			title VARCHAR(255) NOT NULL,
			message TEXT,
			reference_id INT NULL,
			is_read TINYINT DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Printf("Schema Fix (notifications table): %v", err)
	} else {
		log.Println("Schema Fix: notifications table created/verified")
	}

	// 11. Fix vehiclerequests schema (add missing columns)
	vrColumns := []string{
		"ALTER TABLE vehiclerequests ADD COLUMN BookingType VARCHAR(50) DEFAULT 'faculty'",
		"ALTER TABLE vehiclerequests ADD COLUMN TripType VARCHAR(50) DEFAULT 'one_way'",
		"ALTER TABLE vehiclerequests ADD COLUMN TripMode VARCHAR(50) DEFAULT 'official'",
		"ALTER TABLE vehiclerequests ADD COLUMN RequestUnder VARCHAR(100) NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN Purpose TEXT",
		"ALTER TABLE vehiclerequests ADD COLUMN CountPerson INT DEFAULT 1",
		"ALTER TABLE vehiclerequests ADD COLUMN OnwardFromPlace VARCHAR(255)",
		"ALTER TABLE vehiclerequests ADD COLUMN OnwardToPlace VARCHAR(255)",
		"ALTER TABLE vehiclerequests ADD COLUMN OnwardFromDateTime DATETIME",
		"ALTER TABLE vehiclerequests ADD COLUMN OnwardTodateTime DATETIME",
		"ALTER TABLE vehiclerequests ADD COLUMN ReturnFromPlace VARCHAR(255)",
		"ALTER TABLE vehiclerequests ADD COLUMN ReturnToPlace VARCHAR(255)",
		"ALTER TABLE vehiclerequests ADD COLUMN ReturnFromDateTime DATETIME",
		"ALTER TABLE vehiclerequests ADD COLUMN ReturnTodateTime DATETIME",
		"ALTER TABLE vehiclerequests ADD COLUMN ContactName VARCHAR(100)",
		"ALTER TABLE vehiclerequests ADD COLUMN ContactPhone VARCHAR(20)",
		"ALTER TABLE vehiclerequests ADD COLUMN vehicle_id INT DEFAULT NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN driver_id INT DEFAULT NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN admin_remarks TEXT",
		"ALTER TABLE vehiclerequests ADD COLUMN status VARCHAR(50) DEFAULT 'pending'",
		"ALTER TABLE vehiclerequests ADD COLUMN approved_by INT NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN approved_at DATETIME NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN assigned_at DATETIME NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN faculty_id INT NOT NULL",
		// Travelling person details columns (TravellerName already exists in schema)
		"ALTER TABLE vehiclerequests ADD COLUMN TravellerName VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN MobileNumber VARCHAR(50) NULL",
		"ALTER TABLE vehiclerequests ADD COLUMN Address TEXT NULL",
		// Fix legacy/strict columns by making them nullable
		"ALTER TABLE vehiclerequests MODIFY COLUMN IndenterName VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN DeptName VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN IndenterDepartment VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN Designation VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN IndenterDesignation VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN IndenterMobileNo VARCHAR(50) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN MobileNumber VARCHAR(50) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN TravellerName VARCHAR(255) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN Address TEXT NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN PurposeOfVisit TEXT NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN TaskID VARCHAR(100) NULL",
		"ALTER TABLE vehiclerequests MODIFY COLUMN IndenterID VARCHAR(50) NULL",
	}

	for _, q := range vrColumns {
		_, err := config.DB.Exec(q)
		if err == nil {
			log.Println("Schema Fix: Added missing column to vehiclerequests")
		}
	}

	// 12. Add category and vehicle_id to purchase_orders and parts_purchased
	migratePurchaseCategories()

	// 13. Create unified vehicle_replacements table
	initVehicleReplacementsTable()

	// 14. Add marked_by column to attendance table
	_, err = config.DB.Exec("ALTER TABLE attendance ADD COLUMN marked_by INT NULL")
	if err == nil {
		log.Println("Schema Fix: Added marked_by column to attendance")
	}

	// 10. Mark attendance as absent for all approved leaves that haven't been marked yet
	fixApprovedLeaveAttendance()
}

// migratePurchaseCategories adds the category and vehicle_id columns to purchase tables
// and back-fills existing rows as 'repair_service'.
func migratePurchaseCategories() {
	log.Println("Running purchase category migration...")

	// -- purchase_orders --
	poAlters := []string{
		"ALTER TABLE purchase_orders ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'repair_service'",
		"ALTER TABLE purchase_orders ADD COLUMN vehicle_id INT NULL",
		"ALTER TABLE purchase_orders MODIFY COLUMN service_record_id INT NULL",
	}
	for _, q := range poAlters {
		_, err := config.DB.Exec(q)
		if err != nil {
			log.Printf("Purchase migration (purchase_orders): %v (may already exist)", err)
		}
	}

	// Back-fill vehicle_id from service_records for existing rows that have a service_record_id
	_, err := config.DB.Exec(`
		UPDATE purchase_orders po
		JOIN service_records sr ON po.service_record_id = sr.id
		SET po.vehicle_id = sr.vehicle_id
		WHERE po.vehicle_id IS NULL AND po.service_record_id IS NOT NULL
	`)
	if err != nil {
		log.Printf("Purchase migration (backfill po vehicle_id): %v", err)
	}

	// -- parts_purchased --
	ppAlters := []string{
		"ALTER TABLE parts_purchased ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'repair_service'",
		"ALTER TABLE parts_purchased ADD COLUMN vehicle_id INT NULL",
		"ALTER TABLE parts_purchased MODIFY COLUMN service_record_id INT NULL",
	}
	for _, q := range ppAlters {
		_, err := config.DB.Exec(q)
		if err != nil {
			log.Printf("Purchase migration (parts_purchased): %v (may already exist)", err)
		}
	}

	// Back-fill vehicle_id from service_records for existing parts
	_, err = config.DB.Exec(`
		UPDATE parts_purchased pp
		JOIN service_records sr ON pp.service_record_id = sr.id
		SET pp.vehicle_id = sr.vehicle_id
		WHERE pp.vehicle_id IS NULL AND pp.service_record_id IS NOT NULL
	`)
	if err != nil {
		log.Printf("Purchase migration (backfill pp vehicle_id): %v", err)
	}

	log.Println("Purchase category migration complete")
}

// fixApprovedLeaveAttendance marks attendance as absent for all approved leaves
func fixApprovedLeaveAttendance() {
	log.Println("Checking for approved leaves that need attendance marked...")

	// Get all approved leaves (admin_approved or approved)
	rows, err := config.DB.Query(`
		SELECT lr.id, lr.driver_id, d.user_id,
		       DATE_FORMAT(lr.start_date, '%d-%m-%Y') as start_date,
		       DATE_FORMAT(lr.end_date, '%d-%m-%Y') as end_date
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		WHERE lr.status IN ('approved', 'admin_approved')
	`)
	if err != nil {
		log.Printf("Error fetching approved leaves: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var leaveID, driverID, userID int
		var startDateStr, endDateStr string
		if err := rows.Scan(&leaveID, &driverID, &userID, &startDateStr, &endDateStr); err != nil {
			log.Printf("Error scanning leave: %v", err)
			continue
		}

		// Parse dates
		startDate, err1 := time.Parse("2006-01-02", startDateStr)
		endDate, err2 := time.Parse("2006-01-02", endDateStr)
		if err1 != nil || err2 != nil {
			log.Printf("Error parsing dates for leave %d: %v, %v", leaveID, err1, err2)
			continue
		}

		// Mark attendance for each day in the leave period
		for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
			dateStr := date.Format("2006-01-02")

			// Check if attendance needs to be marked
			var existingStatus string
			err := config.DB.QueryRow(`
				SELECT COALESCE(status, '') FROM attendance 
				WHERE user_id = ? AND date = ?
			`, userID, dateStr).Scan(&existingStatus)

			if err != nil && err.Error() != "sql: no rows in result set" {
				continue
			}

			if existingStatus == "" || existingStatus == "not_marked" {
				// Insert or update attendance to absent
				_, err = config.DB.Exec(`
					INSERT INTO attendance (user_id, date, status)
					VALUES (?, ?, 'absent')
					ON DUPLICATE KEY UPDATE status = 'absent'
				`, userID, dateStr)
				if err != nil {
					log.Printf("Error marking attendance for user %d on %s: %v", userID, dateStr, err)
				} else {
					log.Printf("Fixed: Marked attendance as absent for user %d (driver %d) on %s for leave %d",
						userID, driverID, dateStr, leaveID)
				}
			}
		}
	}

	log.Println("Approved leave attendance check complete")
}

// initVehicleReplacementsTable creates the unified vehicle_replacements table
// and migrates existing data from fc_replacement_requests.
func initVehicleReplacementsTable() {
	log.Println("Initializing vehicle_replacements table...")

	_, err := config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS vehicle_replacements (
			id INT AUTO_INCREMENT PRIMARY KEY,
			vehicle_id INT NOT NULL,
			replacement_vehicle_id INT NULL,
			driver_id INT NOT NULL,
			reason VARCHAR(100) NOT NULL DEFAULT 'maintenance',
			service_record_id INT NULL,
			start_date DATE NOT NULL,
			end_date DATE NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			notes TEXT,
			requested_by_role VARCHAR(50) DEFAULT 'admin',
			requested_by_id INT NULL,
			approved_by_id INT NULL,
			driver_notified TINYINT DEFAULT 0,
			replacement_type VARCHAR(50) NOT NULL DEFAULT 'vehicle',
			replacement_driver_id INT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_vr_vehicle (vehicle_id),
			INDEX idx_vr_replacement (replacement_vehicle_id),
			INDEX idx_vr_driver (driver_id),
			INDEX idx_vr_status (status),
			INDEX idx_vr_service (service_record_id),
			INDEX idx_vr_replacement_driver (replacement_driver_id)
		)
	`)
	if err != nil {
		log.Printf("Vehicle replacements table: %v", err)
	} else {
		log.Println("Vehicle replacements table created/verified")
	}

	// Add replacement_type and replacement_driver_id columns if they don't exist (migration for existing tables)
	config.DB.Exec("ALTER TABLE vehicle_replacements ADD COLUMN replacement_type VARCHAR(50) NOT NULL DEFAULT 'vehicle' AFTER driver_notified")
	config.DB.Exec("ALTER TABLE vehicle_replacements ADD COLUMN replacement_driver_id INT NULL AFTER replacement_type")
	config.DB.Exec("ALTER TABLE vehicle_replacements ADD INDEX idx_vr_replacement_driver (replacement_driver_id)")

	// ── KM Logs: Add fuel_consumed, status, approved_by, approved_at columns ──
	config.DB.Exec("ALTER TABLE km_logs ADD COLUMN fuel_consumed FLOAT DEFAULT NULL")
	config.DB.Exec("ALTER TABLE km_logs ADD COLUMN status VARCHAR(20) DEFAULT 'approved'")
	config.DB.Exec("ALTER TABLE km_logs ADD COLUMN approved_by INT DEFAULT NULL")
	config.DB.Exec("ALTER TABLE km_logs ADD COLUMN approved_at DATETIME DEFAULT NULL")
	config.DB.Exec("ALTER TABLE km_logs ADD INDEX idx_km_status (status)")
	log.Println("Schema Fix: km_logs fuel/status columns ensured")

	// Migrate existing fc_replacement_requests data if table exists and vehicle_replacements is empty
	var count int
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements").Scan(&count)
	if count == 0 {
		var fcExists int
		err := config.DB.QueryRow(`
			SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fc_replacement_requests'
		`).Scan(&fcExists)
		if err == nil && fcExists > 0 {
			_, err = config.DB.Exec(`
				INSERT INTO vehicle_replacements 
					(vehicle_id, replacement_vehicle_id, driver_id, reason, start_date, end_date, 
					 status, notes, requested_by_role, requested_by_id, approved_by_id, driver_notified, created_at, updated_at)
				SELECT 
					vehicle_id, replacement_vehicle_id, driver_id, reason, start_date, end_date,
					status, notes, requested_by_role, requested_by_id, approved_by_id, driver_notified, created_at, updated_at
				FROM fc_replacement_requests
			`)
			if err != nil {
				log.Printf("FC replacement migration: %v", err)
			} else {
				log.Println("Migrated fc_replacement_requests data to vehicle_replacements")
			}
		}
	}
}
