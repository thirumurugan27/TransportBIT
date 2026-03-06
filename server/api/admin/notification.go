package admin

import (
	"net/http"
	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// AdminNotification represents a notification for admin users
type AdminNotification struct {
	ID          int    `json:"id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Message     string `json:"message"`
	ReferenceID *int   `json:"reference_id"`
	IsRead      bool   `json:"is_read"`
	CreatedAt   string `json:"created_at"`
}

// GetAdminNotifications returns all notifications for admin
func GetAdminNotifications(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, type, title, message, reference_id, is_read, created_at
		FROM notifications
		WHERE recipient_role = 'ADMIN'
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
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &n.Message, &n.ReferenceID, &n.IsRead, &n.CreatedAt); err != nil {
			continue
		}
		notifications = append(notifications, n)
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkAdminNotificationRead marks a single notification as read
func MarkAdminNotificationRead(c *gin.Context) {
	id := c.Param("id")

	_, err := config.DB.Exec(`UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_role = 'ADMIN'`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllAdminNotificationsRead marks all admin notifications as read
func MarkAllAdminNotificationsRead(c *gin.Context) {
	_, err := config.DB.Exec(`UPDATE notifications SET is_read = TRUE WHERE recipient_role = 'ADMIN'`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// CreateAdminNotification creates a new notification for admin
func CreateAdminNotification(notifType, title, message string) error {
	_, err := config.DB.Exec(`
		INSERT INTO notifications (recipient_role, recipient_id, type, title, message, is_read)
		VALUES ('ADMIN', 0, ?, ?, ?, FALSE)
	`, notifType, title, message)
	return err
}

// CheckGroupExpiry checks for expiring/expired driver and vehicle groups
// and creates notifications for any that are expiring within 7 days or already expired.
// It avoids duplicates by checking if a notification with the same title was already created today.
func CheckGroupExpiry(c *gin.Context) {
	type expiryAlert struct {
		GroupType string `json:"group_type"`
		Name      string `json:"name"`
		ValidTo   string `json:"valid_to"`
		Status    string `json:"status"`
	}

	var alerts []expiryAlert
	created := 0

	// Driver groups expiring within 7 days
	rows, err := config.DB.Query(`
		SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y')
		FROM driver_clusters
		WHERE valid_to IS NOT NULL
		AND valid_to >= CURDATE()
		AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name, validTo string
			if rows.Scan(&name, &validTo) == nil {
				alerts = append(alerts, expiryAlert{GroupType: "Driver Group", Name: name, ValidTo: validTo, Status: "expiring"})
				title := "Driver Group Expiring: " + name
				if !notificationExistsToday(title) {
					CreateAdminNotification("group_expiry", title, "Driver group '"+name+"' validity expires on "+validTo+". Please review and renew.")
					created++
				}
			}
		}
	}

	// Driver groups already expired
	rows2, err := config.DB.Query(`
		SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y')
		FROM driver_clusters
		WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
		AND valid_to >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var name, validTo string
			if rows2.Scan(&name, &validTo) == nil {
				alerts = append(alerts, expiryAlert{GroupType: "Driver Group", Name: name, ValidTo: validTo, Status: "expired"})
				title := "Driver Group Expired: " + name
				if !notificationExistsToday(title) {
					CreateAdminNotification("group_expiry", title, "Driver group '"+name+"' validity expired on "+validTo+". Immediate attention required.")
					created++
				}
			}
		}
	}

	// Vehicle groups expiring within 7 days
	rows3, err := config.DB.Query(`
		SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y')
		FROM vehicle_groups
		WHERE valid_to IS NOT NULL
		AND valid_to >= CURDATE()
		AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var name, validTo string
			if rows3.Scan(&name, &validTo) == nil {
				alerts = append(alerts, expiryAlert{GroupType: "Vehicle Group", Name: name, ValidTo: validTo, Status: "expiring"})
				title := "Vehicle Group Expiring: " + name
				if !notificationExistsToday(title) {
					CreateAdminNotification("group_expiry", title, "Vehicle group '"+name+"' validity expires on "+validTo+". Please review and renew.")
					created++
				}
			}
		}
	}

	// Vehicle groups already expired
	rows4, err := config.DB.Query(`
		SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y')
		FROM vehicle_groups
		WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
		AND valid_to >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
	`)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var name, validTo string
			if rows4.Scan(&name, &validTo) == nil {
				alerts = append(alerts, expiryAlert{GroupType: "Vehicle Group", Name: name, ValidTo: validTo, Status: "expired"})
				title := "Vehicle Group Expired: " + name
				if !notificationExistsToday(title) {
					CreateAdminNotification("group_expiry", title, "Vehicle group '"+name+"' validity expired on "+validTo+". Immediate attention required.")
					created++
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts":                alerts,
		"total":                 len(alerts),
		"notifications_created": created,
	})
}

// notificationExistsToday checks if a notification with the given title was already created today
func notificationExistsToday(title string) bool {
	var count int
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM notifications
		WHERE recipient_role = 'ADMIN' AND title = ? AND DATE(created_at) = CURDATE()
	`, title).Scan(&count)
	return count > 0
}
