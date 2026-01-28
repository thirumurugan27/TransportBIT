//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file in parent directory
	err := godotenv.Load("../.env")
	if err != nil {
		// Try current directory as fallback
		godotenv.Load(".env")
	}

	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", dbUser, dbPassword, dbHost, dbPort, dbName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("🎓 Seeding Student data...")

	// First, ensure the required columns exist in users table
	fmt.Println("📌 Adding student columns to users table if not exists...")

	// Check and add columns one by one
	columns := []struct {
		name string
		def  string
	}{
		{"department", "VARCHAR(100)"},
		{"year", "INT DEFAULT 0"},
		{"roll_number", "VARCHAR(50)"},
	}

	for _, col := range columns {
		// Check if column exists
		var count int
		err := db.QueryRow(`
			SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
			WHERE TABLE_SCHEMA = DATABASE() 
			AND TABLE_NAME = 'users' 
			AND COLUMN_NAME = ?`, col.name).Scan(&count)

		if err != nil {
			log.Printf("Error checking column %s: %v", col.name, err)
			continue
		}

		if count == 0 {
			_, err := db.Exec(fmt.Sprintf("ALTER TABLE users ADD COLUMN %s %s", col.name, col.def))
			if err != nil {
				log.Printf("Error adding column %s: %v", col.name, err)
			} else {
				fmt.Printf("  ✅ Added column: %s\n", col.name)
			}
		} else {
			fmt.Printf("  ✓ Column exists: %s\n", col.name)
		}
	}

	// Password is "password" for all students
	password := "password"

	// Define students to create
	students := []struct {
		Username   string
		FullName   string
		Email      string
		Phone      string
		Department string
		Year       int
		RollNumber string
	}{
		{
			Username:   "john.doe",
			FullName:   "John Doe",
			Email:      "john.doe@bit.edu",
			Phone:      "9876543210",
			Department: "Computer Science",
			Year:       3,
			RollNumber: "CS2023001",
		},
		{
			Username:   "jane.smith",
			FullName:   "Jane Smith",
			Email:      "jane.smith@bit.edu",
			Phone:      "9876543211",
			Department: "Electronics",
			Year:       2,
			RollNumber: "EC2024015",
		},
		{
			Username:   "mike.wilson",
			FullName:   "Mike Wilson",
			Email:      "mike.wilson@bit.edu",
			Phone:      "9876543212",
			Department: "Mechanical",
			Year:       4,
			RollNumber: "ME2022042",
		},
	}

	for _, s := range students {
		_, err = db.Exec(`
			INSERT INTO users (username, password, full_name, role, phone, email, department, year, roll_number) 
			VALUES (?, ?, ?, 'STUDENT', ?, ?, ?, ?, ?) 
			ON DUPLICATE KEY UPDATE 
				full_name = VALUES(full_name),
				department = VALUES(department),
				year = VALUES(year),
				roll_number = VALUES(roll_number)`,
			s.Username, password, s.FullName, s.Phone, s.Email, s.Department, s.Year, s.RollNumber)

		if err != nil {
			log.Printf("❌ Error creating student %s: %v", s.Username, err)
		} else {
			fmt.Printf("✅ Student created: %s / %s (Dept: %s, Year: %d)\n", s.Username, password, s.Department, s.Year)
		}
	}

	fmt.Println("\n📋 Student Login Credentials:")
	fmt.Println("================================")
	for _, s := range students {
		fmt.Printf("  Username: %s | Password: %s\n", s.Username, password)
	}
	fmt.Println("================================")
}
