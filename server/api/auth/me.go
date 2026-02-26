package auth

import (
	"net/http"

	"transport-server/config"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// 🔐 ME - Get current user from cookie/token
func Me(c *gin.Context) {
	// Try to get token from header first
	tokenStr := c.GetHeader("Authorization")
	if tokenStr == "" {
		// Try cookie
		var err error
		tokenStr, err = c.Cookie("TRANSPORT_AUTH")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
	} else {
		// Remove Bearer prefix if present
		if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
			tokenStr = tokenStr[7:]
		}
	}

	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// Safely get claims
	userID := int(claims["user_id"].(float64)) // JWT numbers are float64
	username := claims["username"].(string)
	role := claims["role"].(string)

	// Fetch fresh details from DB
	response := UnifiedLoginResponse{
		UserID:   userID,
		Username: username,
		Role:     role,
		Token:    tokenStr,
		Message:  "User authenticated",
	}

	// Get basic user info
	err = config.DB.QueryRow(
		"SELECT full_name, COALESCE(email, '') FROM users WHERE id = ?",
		userID,
	).Scan(&response.FullName, &response.Email)

	if err != nil {
		// Fallback if user deleted but token valid? unlikely
		response.FullName = username
	}

	// If role is DRIVER, get driver details
	if role == "DRIVER" {
		var driverID int
		err = config.DB.QueryRow(
			"SELECT id FROM drivers WHERE user_id = ?",
			userID,
		).Scan(&driverID)

		if err == nil {
			response.DriverID = &driverID
		}
	}

	c.JSON(http.StatusOK, response)
}
