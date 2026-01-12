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
	// Adjust connection string if needed (root:pass@tcp...)
	db, err := sql.Open("mysql", "root:Thiru+2007@tcp(127.0.0.1:3306)/transport_bit")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("🎓 Seeding Student data...")

	hashStr := "student123" // Plain text for demo, in real app use hash

	// Create a Student User
	studentUser := "student_demo"
	
	_, err = db.Exec(`INSERT INTO users (username, password, full_name, role, phone, email, status) 
		VALUES (?, ?, ?, 'STUDENT', ?, ?, 'active') 
		ON DUPLICATE KEY UPDATE full_name=full_name`,
		studentUser, hashStr, "Student Demo", "9988776655", "student@bit.edu")

	if err != nil {
		log.Printf("Error creating student: %v", err)
	} else {
		fmt.Printf("✅ Student created: %s / %s\n", studentUser, hashStr)
	}
}
