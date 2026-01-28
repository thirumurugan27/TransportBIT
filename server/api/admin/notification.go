package admin

import (
	"net/http"
	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// AdminNotification represents a notification for admin users
type AdminNotification struct {
	ID        int    `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	IsRead    bool   `json:"is_read"`
	CreatedAt string `json:"created_at"`
}

// GetAdminNotifications returns all notifications for admin
func GetAdminNotifications(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, type, title, message, is_read, created_at
		FROM admin_notifications
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	notifications := []AdminNotification{}
	for rows.Next() {
		var n AdminNotification
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			continue
		}
		notifications = append(notifications, n)
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkAdminNotificationRead marks a single notification as read
func MarkAdminNotificationRead(c *gin.Context) {
	id := c.Param("id")

	_, err := config.DB.Exec(`UPDATE admin_notifications SET is_read = TRUE WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllAdminNotificationsRead marks all admin notifications as read
func MarkAllAdminNotificationsRead(c *gin.Context) {
	_, err := config.DB.Exec(`UPDATE admin_notifications SET is_read = TRUE`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// CreateAdminNotification creates a new notification for admin
func CreateAdminNotification(notifType, title, message string) error {
	_, err := config.DB.Exec(`
		INSERT INTO admin_notifications (type, title, message, is_read, created_at)
		VALUES (?, ?, ?, FALSE, NOW())
	`, notifType, title, message)
	return err
}
