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
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found")
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

	// 1. Vehicles
	fmt.Println("--- VEHICLES ---")
	rows, err := db.Query("SELECT id, vehicle_number, vehicle_type FROM vehicles LIMIT 5")
	if err != nil {
		log.Println("Error fetching vehicles:", err)
	} else {
		for rows.Next() {
			var id int
			var num, vType string
			rows.Scan(&id, &num, &vType)
			fmt.Printf("ID: %d, Num: %s, Type: %s\n", id, num, vType)
		}
		rows.Close()
	}

	// 2. Drivers
	fmt.Println("\n--- DRIVERS ---")
	rows, err = db.Query(`
		SELECT d.id, u.username, u.full_name 
		FROM drivers d 
		JOIN users u ON d.user_id = u.id 
		LIMIT 5
	`)
	if err != nil {
		log.Println("Error fetching drivers:", err)
	} else {
		for rows.Next() {
			var id int
			var u, n string
			rows.Scan(&id, &u, &n)
			fmt.Printf("ID: %d, User: %s, Name: %s\n", id, u, n)
		}
		rows.Close()
	}

	// 3. KM Logs
	fmt.Println("\n--- KM LOGS ---")
	rows, err = db.Query(`
		SELECT 
			k.id, 
			k.date, 
			k.driver_id, 
			u.username, 
			k.vehicle_id, 
			v.vehicle_number, 
			k.start_km, 
			k.end_km, 
			k.total_km 
		FROM km_logs k 
		LEFT JOIN drivers d ON k.driver_id = d.id 
		LEFT JOIN users u ON d.user_id = u.id 
		LEFT JOIN vehicles v ON k.vehicle_id = v.id 
		ORDER BY k.id DESC LIMIT 10
	`)
	if err != nil {
		log.Println("Error fetching logs:", err)
	} else {
		for rows.Next() {
			var id int
			var date string
			var dID sql.NullInt64
			var dName sql.NullString
			var vID sql.NullInt64
			var vNum sql.NullString
			var s, e, t float64
			
			err := rows.Scan(&id, &date, &dID, &dName, &vID, &vNum, &s, &e, &t)
			if err != nil {
				log.Println("Scan error:", err)
				continue
			}
			
			dStr := "N/A"
			if dName.Valid { dStr = dName.String }
			
			vStr := "N/A"
			if vNum.Valid { vStr = vNum.String }

			fmt.Printf("Log %d | Date: %s | Driver: %s | Vehicle: %s | %.0f -> %.0f (%.0f km)\n", 
				id, date, dStr, vStr, s, e, t)
		}
		rows.Close()
	}
}
