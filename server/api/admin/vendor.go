package admin

import (
	"database/sql"
	"net/http"
	"strings"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// ==========================================
// VENDOR HANDLERS
// ==========================================

// GetVendors returns all active vendors with optional search
func GetVendors(c *gin.Context) {
	search := c.Query("search")
	includeInactive := c.Query("include_inactive")

	query := `
		SELECT v.id, v.name, COALESCE(v.address, ''), COALESCE(v.contact, ''),
			   COALESCE(v.gst_number, ''), COALESCE(v.email, ''), v.is_active,
			   DATE_FORMAT(v.created_at, '%d-%m-%Y %h:%i %p'),
			   DATE_FORMAT(v.updated_at, '%d-%m-%Y %h:%i %p'),
			   COALESCE(stats.total_spent, 0), COALESCE(stats.parts_count, 0)
		FROM vendors v
		LEFT JOIN (
			SELECT vendor_id, SUM(total_price) as total_spent, COUNT(*) as parts_count
			FROM parts_purchased
			WHERE vendor_id IS NOT NULL
			GROUP BY vendor_id
		) stats ON v.id = stats.vendor_id
		WHERE 1=1
	`
	var args []interface{}

	if includeInactive != "true" {
		query += " AND v.is_active = 1"
	}
	if search != "" {
		query += " AND (v.name LIKE ? OR v.contact LIKE ? OR v.email LIKE ? OR v.gst_number LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s, s, s)
	}

	query += " ORDER BY v.name ASC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, []models.Vendor{})
		return
	}
	defer rows.Close()

	var vendors []models.Vendor
	for rows.Next() {
		var v models.Vendor
		if err := rows.Scan(
			&v.ID, &v.Name, &v.Address, &v.Contact,
			&v.GSTNumber, &v.Email, &v.IsActive,
			&v.CreatedAt, &v.UpdatedAt,
			&v.TotalSpent, &v.PartsCount,
		); err != nil {
			continue
		}
		vendors = append(vendors, v)
	}

	if vendors == nil {
		vendors = []models.Vendor{}
	}

	c.JSON(http.StatusOK, vendors)
}

// GetVendorByID returns a single vendor by ID
func GetVendorByID(c *gin.Context) {
	id := c.Param("id")

	var v models.Vendor
	err := config.DB.QueryRow(`
		SELECT v.id, v.name, COALESCE(v.address, ''), COALESCE(v.contact, ''),
			   COALESCE(v.gst_number, ''), COALESCE(v.email, ''), v.is_active,
			   DATE_FORMAT(v.created_at, '%d-%m-%Y %h:%i %p'),
			   DATE_FORMAT(v.updated_at, '%d-%m-%Y %h:%i %p'),
			   COALESCE(stats.total_spent, 0), COALESCE(stats.parts_count, 0)
		FROM vendors v
		LEFT JOIN (
			SELECT vendor_id, SUM(total_price) as total_spent, COUNT(*) as parts_count
			FROM parts_purchased
			WHERE vendor_id IS NOT NULL
			GROUP BY vendor_id
		) stats ON v.id = stats.vendor_id
		WHERE v.id = ?
	`, id).Scan(
		&v.ID, &v.Name, &v.Address, &v.Contact,
		&v.GSTNumber, &v.Email, &v.IsActive,
		&v.CreatedAt, &v.UpdatedAt,
		&v.TotalSpent, &v.PartsCount,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Vendor not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch vendor"})
		return
	}

	c.JSON(http.StatusOK, v)
}

// CreateVendor creates a new vendor
func CreateVendor(c *gin.Context) {
	var req models.CreateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vendor name is required"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO vendors (name, address, contact, gst_number, email)
		VALUES (?, ?, ?, ?, ?)
	`, req.Name, req.Address, req.Contact, req.GSTNumber, req.Email)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate") || strings.Contains(err.Error(), "uk_vendor_name") {
			c.JSON(http.StatusConflict, gin.H{"error": "A vendor with this name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create vendor: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"message": "Vendor created successfully", "id": id})
}

// UpdateVendor updates an existing vendor
func UpdateVendor(c *gin.Context) {
	var req models.UpdateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vendor ID and name are required"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE vendors SET name = ?, address = ?, contact = ?, gst_number = ?, email = ?
		WHERE id = ?
	`, req.Name, req.Address, req.Contact, req.GSTNumber, req.Email, req.ID)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate") || strings.Contains(err.Error(), "uk_vendor_name") {
			c.JSON(http.StatusConflict, gin.H{"error": "A vendor with this name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vendor: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vendor updated successfully"})
}

// DeleteVendor soft-deletes a vendor (sets is_active = 0)
func DeleteVendor(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vendor ID is required"})
		return
	}

	_, err := config.DB.Exec(`UPDATE vendors SET is_active = 0 WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete vendor: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vendor deleted successfully"})
}
