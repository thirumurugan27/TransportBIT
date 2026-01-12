package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

var DB *sql.DB

func InitDB() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: Error loading .env file, using defaults or env vars")
	}

	dbUser := os.Getenv("DB_USER")	
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", dbUser, dbPassword, dbHost, dbPort, dbName)

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
}
