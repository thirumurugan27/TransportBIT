package auth

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

/* =========================
   AUTH HANDLERS
========================= */

// UnifiedLoginResponse - unified response for all user types
type UnifiedLoginResponse struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Token    string `json:"token"`
	DriverID *int   `json:"driver_id,omitempty"`
	Message  string `json:"message"`
}

// 🔐 UNIFIED LOGIN - Single endpoint for all roles
func UnifiedLogin(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	log.Printf("Login attempt: username=%s", req.Username)

	// Get user details
	var userID int
	var dbPassword, role, fullName, email string
	err := config.DB.QueryRow(
		"SELECT id, password, role, full_name, COALESCE(email, '') FROM users WHERE username=?",
		req.Username,
	).Scan(&userID, &dbPassword, &role, &fullName, &email)

	if err == sql.ErrNoRows {
		log.Printf("User not found: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		log.Printf("Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	// Check password
	if dbPassword != req.Password {
		log.Printf("Password mismatch for user: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT
	token, err := utils.GenerateToken(userID, req.Username, role)
	if err != nil {
		log.Printf("Token generation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set HttpOnly cookie for security - token expires in 24 hours
	c.SetCookie("TRANSPORT_AUTH", token, 3600*24, "/", "", false, true)

	response := UnifiedLoginResponse{
		UserID:   userID,
		Username: req.Username,
		FullName: fullName,
		Email:    email,
		Role:     role,
		Token:    token,
		Message:  "Login successful",
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
		} else {
			log.Printf("Driver record not found for user %d: %v", userID, err)
		}
	}

	log.Printf("Login successful for user: %s, Role: %s", req.Username, role)
	c.JSON(http.StatusOK, response)
}

// SETUP ADMIN PASSWORD
func SetupAdminPassword(c *gin.Context) {
	var req models.SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	log.Printf("Setup: Setting password for admin...")

	result, err := config.DB.Exec(
		"UPDATE users SET password=? WHERE username='admin'",
		req.Password,
	)
	if err != nil {
		log.Printf("Update failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	rowsAffected, err := result.RowsAffected()
	log.Printf("Rows affected: %d", rowsAffected)

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Admin user not found"})
		return
	}

	log.Printf("Admin password updated successfully")
	c.JSON(http.StatusOK, gin.H{"message": "Admin password updated successfully"})
}

// 🚪 LOGOUT
func Logout(c *gin.Context) {
	// Clear the cookie by setting max age to -1
	c.SetCookie("TRANSPORT_AUTH", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
