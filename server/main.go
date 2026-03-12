package main

import (
	"log"
	"os"
	"strings"
	"transport-server/api/admin"
	"transport-server/config"
	"transport-server/routes"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

func main() {
	// 1. Load Environment Variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}
	// 2. Initialize Database
	config.InitDB()
	// 3. Initialize Gin Router
	r := gin.Default()
	r.Static("/uploads", "./uploads")
	r.Static("/documents", "./Documents")
	// 4. Configure CORS
	allowedOrigins := os.Getenv("CORS_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173"
	}
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Tunnel-Skip-Efficiency-Check"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition", "Content-Type"},
		AllowCredentials: true,
		AllowOrigins:     strings.Split(allowedOrigins, ","),
	}
	r.Use(cors.New(corsConfig))

	// 5. Register Routes
	routes.RegisterRoutes(r)
	// 6. Initialize Cron Jobs
	c := cron.New(cron.WithSeconds())
	// Auto-complete expired vehicle replacements daily at midnight
	_, _ = c.AddFunc("0 0 0 * * *", admin.AutoCompleteExpiredVehicleReplacements)
	// Sync vehicle statuses daily at midnight (catches end_date expirations)
	_, _ = c.AddFunc("0 0 0 * * *", admin.SyncAllVehicleStatuses)
	c.Start()

	// Run startup checks in background
	go admin.AutoCompleteExpiredVehicleReplacements()
	go admin.SyncAllVehicleStatuses()

	// 7. Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on port %s", port)
	r.Run(":" + port)
}
