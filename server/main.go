package main

import (
	"log"
	"os"
	"transport-server/api/admin"
	"transport-server/api/bus"
	"transport-server/api/student"
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

	// Fix database schema issues (ENUM truncation)
	admin.FixDatabaseSchema()

	// Initialize member tables for groups/clusters
	admin.InitClusterMemberTables()
	admin.InitVehicleGroupMemberTables()

	bus.InitBusStopsTable()
	student.InitStudentTransportTables()
	admin.EnsureVehicleRequestOTPColumns()

	// 3. Initialize Gin Router
	r := gin.Default()
	r.Static("/uploads", "./uploads")

	// 4. Configure CORS
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Tunnel-Skip-Efficiency-Check"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOrigins:     []string{"http://localhost:5173", "https://d410t8rp-5173.inc1.devtunnels.ms"},
	}
	r.Use(cors.New(corsConfig))

	// 5. Register Routes
	routes.RegisterRoutes(r)
	// 6. Initialize Cron Jobs
	c := cron.New(cron.WithSeconds())
	// Run auto-complete for expired FC replacements daily at midnight
	_, _ = c.AddFunc("0 0 0 * * *", admin.AutoCompleteExpiredFCReplacements)
	c.Start()

	// Run auto-complete check on startup
	go admin.AutoCompleteExpiredFCReplacements()

	// 7. Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on port %s", port)
	r.Run(":" + port)
}
