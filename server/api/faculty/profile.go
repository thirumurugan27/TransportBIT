package faculty

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"transport-server/config"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GetFacultyProfile - Get current faculty profile
func GetFacultyProfile(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var faculty struct {
		ID          int    `json:"id"`
		UserID      int    `json:"user_id"`
		FullName    string `json:"full_name"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		Department  string `json:"department"`
		Designation string `json:"designation"`
	}

	err = config.DB.QueryRow(`
		SELECT f.id, f.user_id, u.full_name, COALESCE(u.email, '') as email, 
		       COALESCE(u.phone, '') as phone, COALESCE(f.department, '') as department,
		       COALESCE(f.designation, '') as designation
		FROM faculty f
		JOIN users u ON f.user_id = u.id
		WHERE f.user_id = ?
	`, userID).Scan(&faculty.ID, &faculty.UserID, &faculty.FullName, &faculty.Email,
		&faculty.Phone, &faculty.Department, &faculty.Designation)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faculty profile not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching faculty profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, faculty)
}

// UpdateFacultyProfile - Update faculty profile
func UpdateFacultyProfile(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		FullName    string `json:"full_name"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		Department  string `json:"department"`
		Designation string `json:"designation"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.FullName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Full name is required"})
		return
	}

	// Start transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback()

	// Update user table
	_, err = tx.Exec(`
		UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?
	`, req.FullName, req.Email, req.Phone, userID)
	if err != nil {
		log.Printf("Error updating user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Update faculty table
	_, err = tx.Exec(`
		UPDATE faculty SET department = ?, designation = ? WHERE user_id = ?
	`, req.Department, req.Designation, userID)
	if err != nil {
		log.Printf("Error updating faculty: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save changes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}
