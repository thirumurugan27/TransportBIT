package admin

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   ADMIN PROFILE & PASSWORD HANDLERS
========================= */

// 👤 GET ADMIN PROFILE
func GetAdminProfile(c *gin.Context) {
	row := config.DB.QueryRow(`
		SELECT username, full_name, COALESCE(phone,''), COALESCE(email,''), COALESCE(profile_image,'')
		FROM users WHERE username='admin'
	`)

	var a models.AdminProfile
	err := row.Scan(
		&a.Username,
		&a.FullName,
		&a.Phone,
		&a.Email,
		&a.ProfileImage,
	)

	if err != nil {
		log.Printf("Error fetching profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, a)
}

// ✏️ UPDATE ADMIN PROFILE
func UpdateAdminProfile(c *gin.Context) {
	var a models.AdminProfile
	if err := c.ShouldBindJSON(&a); err != nil {
		log.Printf("Error decoding request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	log.Printf("Updating profile: full_name=%s, phone=%s, email=%s", a.FullName, a.Phone, a.Email)

	result, err := config.DB.Exec(`
		UPDATE users
		SET full_name=?, phone=?, email=?, profile_image=?
		WHERE username='admin'
	`,
		a.FullName,
		a.Phone,
		a.Email,
		a.ProfileImage,
	)

	if err != nil {
		log.Printf("Update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Rows affected: %d", rowsAffected)

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// 📷 UPLOAD ADMIN PROFILE IMAGE
func UploadAdminProfileImage(c *gin.Context) {
	// Standard library ParseMultipartForm call is done automatically by Gin for Request.FormFile 
	// typically, although for large files MaxMultipartMemory can be set on engine.
	
	// Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		log.Printf("Error retrieving file: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}

	// Validate file type
	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only image files are allowed"})
		return
	}

	// Create uploads directory if it doesn't exist
	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		log.Printf("Error creating upload directory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	// Generate filename
	ext := filepath.Ext(file.Filename)
	filename := "admin" + ext
	filePath := filepath.Join(uploadDir, filename)

	// Save the file
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		log.Printf("Error saving file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Get other form values
	fullName := c.PostForm("full_name")
	phone := c.PostForm("phone")
	email := c.PostForm("email")

	log.Printf("Updating profile with image: %s", filename)

	// Update database
	result, err := config.DB.Exec(`
		UPDATE users
		SET full_name=?, phone=?, email=?, profile_image=?
		WHERE username='admin'
	`,
		fullName,
		phone,
		email,
		filename,
	)

	if err != nil {
		log.Printf("Update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Rows affected: %d", rowsAffected)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Profile updated successfully",
		"profile_image": filename,
	})
}

// 🔑 CHANGE ADMIN PASSWORD
func ChangeAdminPassword(c *gin.Context) {
	var p models.PasswordChange
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	log.Printf("Changing password for admin")

	result, err := config.DB.Exec(
		"UPDATE users SET password=? WHERE username='admin'",
		p.NewPassword,
	)
	if err != nil {
		log.Printf("Update failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Password updated, rows affected: %d", rowsAffected)

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}
