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

	// 2. Fix users status
	_, err = config.DB.Exec("ALTER TABLE users MODIFY COLUMN status VARCHAR(50) DEFAULT 'active'")
	if err != nil {
		log.Printf("Schema Fix (users): %v", err)
	} else {
		log.Println("Schema Fix: users.status updated to VARCHAR")
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

	// 6. Fix leave_requests status - needs to accept 'pending', 'approved', 'rejected', 'admin_approved', 'incharge_approved'
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

	// 9. Create user_notifications table for faculty and other user notifications
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS user_notifications (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			title VARCHAR(255) NOT NULL,
			message TEXT,
			type VARCHAR(50) DEFAULT 'general',
			related_id INT NULL,
			is_read BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		log.Printf("Schema Fix (user_notifications table): %v", err)
	} else {
		log.Println("Schema Fix: user_notifications table created/verified")
	}

	// 10. Mark attendance as absent for all approved leaves that haven't been marked yet
	fixApprovedLeaveAttendance()
}

// fixApprovedLeaveAttendance marks attendance as absent for all approved leaves
func fixApprovedLeaveAttendance() {
	log.Println("Checking for approved leaves that need attendance marked...")

	// Get all approved leaves (admin_approved or approved)
	rows, err := config.DB.Query(`
		SELECT lr.id, lr.driver_id, d.user_id,
		       DATE_FORMAT(lr.start_date, '%Y-%m-%d') as start_date,
		       DATE_FORMAT(lr.end_date, '%Y-%m-%d') as end_date
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
