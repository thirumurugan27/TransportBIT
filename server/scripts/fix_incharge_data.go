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

	fmt.Println("🔧 Fixing Incharge Users Data...")

	// Find users with role INCHARGE who are NOT in drivers table
	rows, err := db.Query(`
		SELECT id, username, full_name, email, phone 
		FROM users 
		WHERE role = 'INCHARGE' 
		AND id NOT IN (SELECT user_id FROM drivers)
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	var usersToFix []struct {
		id       int
		username string
	}

	for rows.Next() {
		var u struct {
			id       int
			username string
			full     sql.NullString
			email    sql.NullString
			phone    sql.NullString
		}
		if err := rows.Scan(&u.id, &u.username, &u.full, &u.email, &u.phone); err != nil {
			log.Fatal(err)
		}
		usersToFix = append(usersToFix, struct{ id int; username string }{u.id, u.username})
	}
	rows.Close()

	if len(usersToFix) == 0 {
		fmt.Println("✅ All INCHARGE users already have driver records.")
		return
	}

	fmt.Printf("found %d broken incharge users. creating driver records...\n", len(usersToFix))

	for _, u := range usersToFix {
		// Insert generic driver record for the incharge
		// License info is dummy, experience is default
		res, err := db.Exec(`
			INSERT INTO drivers (user_id, license_number, license_type, license_expiry, experience_years, is_incharge)
			VALUES (?, CONCAT('INC-', ?), 'HEAVY', '2030-01-01', 5, TRUE)
		`, u.id, u.username)
		
		if err != nil {
			log.Printf("Failed to fix user %s: %v\n", u.username, err)
		} else {
			lid, _ := res.LastInsertId()
			fmt.Printf("✅ Fixed user %s (ID: %d) -> Created Driver ID: %d\n", u.username, u.id, lid)
		}
	}
}
