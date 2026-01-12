package utils

import (
	"os"
	"time"

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
		"iat":      now.Unix(),                        // Issued at - makes token unique per login
		"exp":      now.Add(time.Hour * 24).Unix(),    // 24 hours expiry
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
