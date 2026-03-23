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
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}
	config.InitDB()
	r := gin.Default()
	r.Static("/uploads", "./uploads")
	r.Static("/documents", "./Documents")
	allowedOrigins := os.Getenv("CORS_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173"
	}
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE","PATCH","OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Tunnel-Skip-Efficiency-Check"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition", "Content-Type"},
		AllowCredentials: true,
		AllowOrigins:     strings.Split(allowedOrigins, ","),
	}
	r.Use(cors.New(corsConfig))
	routes.RegisterRoutes(r)
	c := cron.New(cron.WithSeconds())
	_, _ = c.AddFunc("0 0 0 * * *", admin.AutoCompleteExpiredVehicleReplacements)
	_, _ = c.AddFunc("0 0 0 * * *", admin.SyncAllVehicleStatuses)
	c.Start()
	go admin.AutoCompleteExpiredVehicleReplacements()
	go admin.SyncAllVehicleStatuses()
	port := os.Getenv("PORT")
	log.Printf("Server running on port %s", port)
	r.Run(":" + port)
}
