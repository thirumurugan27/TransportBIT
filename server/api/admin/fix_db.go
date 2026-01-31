package admin

import (
	"log"
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
}
