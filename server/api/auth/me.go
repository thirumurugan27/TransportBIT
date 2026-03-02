package auth

import (
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

// Me returns the currently authenticated user.
//
// This handler sits behind AuthMiddleware, which has already validated the JWT
// and injected user_id, username, and role into the Gin context.
// There is no need to re-parse the token here.
func Me(c *gin.Context) {
	userID := c.GetInt("user_id")
	username := c.GetString("username")
	role := c.GetString("role")

	response := UserResponse{
		UserID:   userID,
		Username: username,
		Role:     role,
	}

	// Fetch fresh name + email from DB on every /me call so the client always
	// has up-to-date profile data without needing a separate profile request.
	_ = config.DB.QueryRow(
		"SELECT full_name, COALESCE(email, '') FROM users WHERE id = ?",
		userID,
	).Scan(&response.FullName, &response.Email)

	if response.FullName == "" {
		response.FullName = username
	}

	if role == "DRIVER" {
		var driverID int
		if err := config.DB.QueryRow(
			"SELECT id FROM drivers WHERE user_id = ?", userID,
		).Scan(&driverID); err == nil {
			response.DriverID = &driverID
		}
	}

	c.JSON(http.StatusOK, response)
}
