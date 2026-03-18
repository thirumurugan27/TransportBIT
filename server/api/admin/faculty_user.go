package admin

import (
	"database/sql"
	"log"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// POST /api/admin/users/faculty/create - Create a new faculty user and faculty profile
func CreateFacultyUser(c *gin.Context) {
	var req models.CreateFacultyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.FullName == "" || req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Full name and email are required"})
		return
	}

	if req.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username is required"})
		return
	}

	if req.Password == "" {
		req.Password = "password"
	}

	var existingID int
	err := config.DB.QueryRow(`SELECT id FROM users WHERE email = ? LIMIT 1`, req.Email).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("Error validating faculty email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate email"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	userResult, err := tx.Exec(`
		INSERT INTO users (username, password, full_name, phone, email, role, status)
		VALUES (?, ?, ?, ?, ?, 'FACULTY', 'active')
	`, req.Username, req.Password, req.FullName, req.Phone, req.Email)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("Error creating faculty user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create faculty user"})
		return
	}

	userID, err := userResult.LastInsertId()
	if err != nil {
		_ = tx.Rollback()
		log.Printf("Error reading created faculty user id: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve user id"})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO faculty (user_id, department, designation)
		VALUES (?, ?, ?)
	`, userID, req.Department, req.Designation)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("Error creating faculty profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create faculty profile"})
		return
	}

	if err := tx.Commit(); err != nil {
		_ = tx.Rollback()
		log.Printf("Error committing faculty create transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save faculty"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Faculty created successfully", "user_id": userID})
}
