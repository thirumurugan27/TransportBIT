package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

func InitDB() {
	// .env is already loaded in main.go via godotenv.Load()
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", dbUser, dbPassword, dbHost, dbPort, dbName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	DB = db

	// Test the connection
	err = DB.Ping()
	if err != nil {
		panic("Database connection failed: " + err.Error())
	}
	log.Println("Database connected successfully")

	// Run migrations for new columns
	runMigrations()
}

func runMigrations() {
	// Add new fuel indent columns if they don't exist (MySQL compatible)
	columns := []struct {
		name string
		ddl  string
	}{
		{"fuel_indent_number", "ALTER TABLE fuel_indents ADD COLUMN fuel_indent_number VARCHAR(100) DEFAULT ''"},
		{"vehicle_type", "ALTER TABLE fuel_indents ADD COLUMN vehicle_type VARCHAR(100) DEFAULT ''"},
		{"fuel_type", "ALTER TABLE fuel_indents ADD COLUMN fuel_type VARCHAR(100) DEFAULT ''"},
		{"filled_date", "ALTER TABLE fuel_indents ADD COLUMN filled_date VARCHAR(20) DEFAULT ''"},
		{"filled_time", "ALTER TABLE fuel_indents ADD COLUMN filled_time VARCHAR(20) DEFAULT ''"},
	}
	for _, col := range columns {
		var count int
		err := DB.QueryRow(
			"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuel_indents' AND COLUMN_NAME = ?",
			col.name,
		).Scan(&count)
		if err != nil || count > 0 {
			continue
		}
		if _, err := DB.Exec(col.ddl); err != nil {
			log.Printf("Migration warning (%s): %v", col.name, err)
		} else {
			log.Printf("Migration: added column %s to fuel_indents", col.name)
		}
	}

	// Drop unique constraint on km_logs(driver_id, date) to allow multiple logs per day
	var uniqueCount int
	err := DB.QueryRow(
		"SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'km_logs' AND INDEX_NAME = 'unique_driver_date'",
	).Scan(&uniqueCount)
	if err == nil && uniqueCount > 0 {
		if _, err := DB.Exec("ALTER TABLE km_logs DROP INDEX unique_driver_date"); err != nil {
			log.Printf("Migration warning (drop unique_driver_date): %v", err)
		} else {
			log.Println("Migration: dropped unique_driver_date constraint from km_logs")
		}
	}

	// Add payment_type column to transport_payments if not present
	var ptCount int
	err = DB.QueryRow(
		"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transport_payments' AND COLUMN_NAME = 'payment_type'",
	).Scan(&ptCount)
	if err == nil && ptCount == 0 {
		if _, err := DB.Exec("ALTER TABLE transport_payments ADD COLUMN payment_type VARCHAR(20) NOT NULL DEFAULT 'payment'"); err != nil {
			log.Printf("Migration warning (payment_type): %v", err)
		} else {
			log.Println("Migration: added payment_type column to transport_payments")
		}
	}
}
