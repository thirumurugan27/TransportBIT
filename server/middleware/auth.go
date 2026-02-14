package middleware

import (
	"net/http"
	"strings"

	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware verifies JWT token from Authorization header or cookie.
// Sets "user_id" and "role" in the Gin context for downstream handlers.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		// Try Authorization header first
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Try cookie if no header
		if tokenStr == "" {
			cookie, err := c.Cookie("TRANSPORT_AUTH")
			if err == nil {
				tokenStr = cookie
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		claims, err := utils.ParseJWT(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		userID, ok := claims["user_id"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		role, _ := claims["role"].(string)

		c.Set("user_id", int(userID))
		c.Set("role", role)
		c.Next()
	}
}

// RoleMiddleware restricts access to specific roles.
// Must be used after AuthMiddleware.
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			c.Abort()
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			c.Abort()
			return
		}

		for _, allowed := range allowedRoles {
			if strings.EqualFold(roleStr, allowed) {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}
