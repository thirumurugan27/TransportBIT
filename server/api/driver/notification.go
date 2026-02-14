package driver

import (
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/* =========================
   DRIVER NOTIFICATIONS
========================= */

type Notification struct {
	ID          int    `json:"id"`
	DriverID    int    `json:"driver_id"`
	Title       string `json:"title"`
	Message     string `json:"message"`
	Type        string `json:"type"`
	ReferenceID *int   `json:"related_id"`
	IsRead      bool   `json:"is_read"`
	CreatedAt   string `json:"created_at"`
}

// GET /api/driver/notifications - Get driver's notifications
func GetDriverNotifications(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, recipient_id, title, message, type, reference_id, is_read, 
		       DATE_FORMAT(created_at, '%d-%m-%Y %H:%i') as created_at
		FROM notifications
		WHERE recipient_role = 'DRIVER' AND recipient_id = ?
		ORDER BY created_at DESC
		LIMIT 50
	`, driverID)

	if err != nil {
		log.Printf("Get notifications error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		rows.Scan(&n.ID, &n.DriverID, &n.Title, &n.Message, &n.Type, &n.ReferenceID, &n.IsRead, &n.CreatedAt)
		notifications = append(notifications, n)
	}

	c.JSON(http.StatusOK, notifications)
}

// GET /api/driver/notifications/unread-count - Get unread notification count
func GetUnreadNotificationCount(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	var count int
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM notifications 
		WHERE recipient_role = 'DRIVER' AND recipient_id = ? AND is_read = FALSE
	`, driverID).Scan(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// POST /api/driver/notifications/:id/mark-read - Mark notification as read
func MarkNotificationRead(c *gin.Context) {
	notificationID := c.Param("id")
	if notificationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notification id required"})
		return
	}

	_, err := config.DB.Exec("UPDATE notifications SET is_read = TRUE WHERE id = ?", notificationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// POST /api/driver/notifications/mark-all-read - Mark all notifications as read
func MarkAllNotificationsRead(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	_, err := config.DB.Exec("UPDATE notifications SET is_read = TRUE WHERE recipient_role = 'DRIVER' AND recipient_id = ?", driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}
