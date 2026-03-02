package utils

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ─── JWT Secret ───────────────────────────────────────────────────────────────

func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		panic("JWT_SECRET environment variable is not set")
	}
	return []byte(secret)
}

// ─── GenerateToken ────────────────────────────────────────────────────────────
// Creates a signed HS256 JWT valid for 24 hours.
// Claims: user_id, username, role, iat (issued-at), exp (expiry)

func GenerateToken(userID int, username, role string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id":  userID,
		"username": username,
		"role":     role,
		"iat":      now.Unix(),
		"exp":      now.Add(24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(getJWTSecret())
}

// ─── ParseJWT ─────────────────────────────────────────────────────────────────
// Validates signature, expiry, and enforces HS256 to prevent alg:none attacks.

func ParseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		// Reject any algorithm that is not HMAC (prevents alg:none / RS256 confusion)
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing algorithm: %v", t.Header["alg"])
		}
		return getJWTSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("token is not valid")
	}
	return token.Claims.(jwt.MapClaims), nil
}
