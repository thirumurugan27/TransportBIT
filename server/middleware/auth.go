package middleware
import (
	"net/http"
	"strings"
	"transport-server/utils"
	"github.com/gin-gonic/gin"
)
// ─── AuthMiddleware ────────────────────────────────────────────────────────────
// Reads the JWT from the HttpOnly cookie (primary) or Authorization header
// (fallback for programmatic clients). Validates the token and injects
// user_id, username, and role into the Gin context for downstream handlers.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractToken(c)
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		claims, err := utils.ParseJWT(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
			return
		}
		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Malformed token"})
			return
		}
		// Inject identity into the request context — handlers use c.GetInt("user_id") etc.
		c.Set("user_id", int(userIDFloat))
		c.Set("username", claims["username"])
		c.Set("role", claims["role"])
		c.Next()
	}
}
// ─── RoleMiddleware ────────────────────────────────────────────────────────────
// Restricts a route group to one or more roles. Must follow AuthMiddleware.
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleStr := c.GetString("role")
		for _, allowed := range allowedRoles {
			if strings.EqualFold(roleStr, allowed) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied"})
	}
}
// ─── extractToken ─────────────────────────────────────────────────────────────
// Cookie is the primary source (HttpOnly, not readable by JS).
// Authorization header is the fallback for server-to-server or CLI clients.
func extractToken(c *gin.Context) string {
	if cookie, err := c.Cookie("TRANSPORT_AUTH"); err == nil && cookie != "" {
		return cookie
	}
	if header := c.GetHeader("Authorization"); strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}
	return ""
}
