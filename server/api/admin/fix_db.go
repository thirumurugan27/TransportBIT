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
}
