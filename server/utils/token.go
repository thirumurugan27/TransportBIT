package utils

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func getJWTSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func GenerateToken(userID int, username string, role string) (string, error) {
	// Include issued_at (iat) to make each token unique
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id":  userID,
		"username": username,
		"role":     role,
		"iat":      now.Unix(),                     // Issued at - makes token unique per login
		"exp":      now.Add(time.Hour * 24).Unix(), // 24 hours expiry
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func ParseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return getJWTSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, jwt.ErrTokenSignatureInvalid // Or appropriate error
	}
	return token.Claims.(jwt.MapClaims), nil
}

// GetUserIDFromToken extracts user ID from JWT token in Authorization header or cookie
func GetUserIDFromToken(c *gin.Context) (int, error) {
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
		return 0, errors.New("no token found")
	}

	claims, err := ParseJWT(tokenStr)
	if err != nil {
		return 0, err
	}

	userID, ok := claims["user_id"].(float64)
	if !ok {
		return 0, errors.New("invalid user_id in token")
	}

	return int(userID), nil
}

// GetRoleFromToken extracts role from JWT token
func GetRoleFromToken(c *gin.Context) (string, error) {
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
		return "", errors.New("no token found")
	}

	claims, err := ParseJWT(tokenStr)
	if err != nil {
		return "", err
	}

	role, ok := claims["role"].(string)
	if !ok {
		return "", errors.New("invalid role in token")
	}

	return role, nil
}
