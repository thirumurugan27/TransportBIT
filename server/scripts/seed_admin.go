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

	// Password "admin123"
	password := "admin123"

	// Check if admin exists
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users WHERE username='admin'").Scan(&count)

	if count > 0 {
		// Update existing admin
		_, err = db.Exec("UPDATE users SET password=? WHERE username='admin'", password)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("✅ Admin password updated!")
	} else {
		// Insert new admin
		_, err = db.Exec(`
			INSERT INTO users (username, password, full_name, role, phone, email, status)
			VALUES ('admin', ?, 'System Administrator', 'ADMIN', '9999999999', 'admin@transport.com', 'present')
		`, password)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("✅ Admin user created!")
	}

	fmt.Println("📝 Login credentials:")
	fmt.Println("   Username: admin")
	fmt.Println("   Password: admin123")
}
