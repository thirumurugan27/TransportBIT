package admin

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// InitPurchaseInvoiceTable creates the purchase_invoices table if it doesn't exist
func InitPurchaseInvoiceTable() {
	_, err := config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS purchase_invoices (
			id INT AUTO_INCREMENT PRIMARY KEY,
			purchase_order_id INT NOT NULL,
			file_name VARCHAR(255) NOT NULL,
			original_name VARCHAR(255) NOT NULL,
			file_type ENUM('pdf', 'image') NOT NULL DEFAULT 'pdf',
			file_size BIGINT NOT NULL DEFAULT 0,
			file_path VARCHAR(500) NOT NULL,
			uploaded_by INT DEFAULT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY uq_purchase_order_invoice (purchase_order_id),
			CONSTRAINT fk_pi_purchase_order FOREIGN KEY (purchase_order_id) 
				REFERENCES purchase_orders(id) ON DELETE CASCADE,
			CONSTRAINT fk_pi_uploaded_by FOREIGN KEY (uploaded_by) 
				REFERENCES users(id) ON DELETE SET NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
	if err != nil {
		fmt.Printf("Warning: Could not create purchase_invoices table: %v\n", err)
	}
}

// UploadPurchaseInvoice handles uploading an invoice document (PDF or image) for a purchase order
func UploadPurchaseInvoice(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	// Verify purchase order exists
	var exists int
	err := config.DB.QueryRow("SELECT COUNT(*) FROM purchase_orders WHERE id = ?", orderID).Scan(&exists)
	if err != nil || exists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase order not found"})
		return
	}

	// Get uploaded file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Validate file size (max 10MB)
	const maxSize = 10 << 20 // 10MB
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 10MB limit"})
		return
	}

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	var fileType string
	allowedTypes := map[string]string{
		"application/pdf": "pdf",
		"image/jpeg":      "image",
		"image/jpg":       "image",
		"image/png":       "image",
		"image/webp":      "image",
	}

	fileType, ok := allowedTypes[contentType]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only PDF and image files (JPEG, PNG, WebP) are allowed"})
		return
	}

	// Create upload directory
	uploadDir := filepath.Join("Documents", "Purchase")
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		if fileType == "pdf" {
			ext = ".pdf"
		} else {
			ext = ".jpg"
		}
	}
	uniqueName := fmt.Sprintf("invoice_%s_%d%s", orderID, time.Now().UnixNano(), ext)
	savePath := filepath.Join(uploadDir, uniqueName)

	// Check if an invoice already exists for this order — if so, delete old file
	var oldFilePath string
	var oldID int
	err = config.DB.QueryRow(
		"SELECT id, file_path FROM purchase_invoices WHERE purchase_order_id = ?", orderID,
	).Scan(&oldID, &oldFilePath)
	if err == nil {
		// Old invoice exists — remove old file from disk
		if oldFilePath != "" {
			os.Remove(oldFilePath)
		}
		// Delete old DB record (will be replaced)
		config.DB.Exec("DELETE FROM purchase_invoices WHERE id = ?", oldID)
	}

	// Save file to disk
	if err := c.SaveUploadedFile(header, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Insert into database
	adminID, _ := c.Get("user_id")
	result, err := config.DB.Exec(`
		INSERT INTO purchase_invoices 
		(purchase_order_id, file_name, original_name, file_type, file_size, file_path, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, orderID, uniqueName, header.Filename, fileType, header.Size, savePath, adminID)
	if err != nil {
		// Clean up saved file on DB error
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save invoice record: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"message": "Invoice uploaded successfully",
		"invoice": models.PurchaseInvoice{
			ID:              int(id),
			PurchaseOrderID: intFromString(orderID),
			FileName:        uniqueName,
			OriginalName:    header.Filename,
			FileType:        fileType,
			FileSize:        header.Size,
			FilePath:        savePath,
			FileURL:         "/documents/Purchase/" + uniqueName,
		},
	})
}

// GetPurchaseInvoice returns the invoice metadata for a purchase order
func GetPurchaseInvoice(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	invoice, err := getPurchaseInvoiceByOrderID(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No invoice found for this order"})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// DeletePurchaseInvoice deletes the invoice document for a purchase order
func DeletePurchaseInvoice(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	// Find the existing invoice
	var filePath string
	var id int
	err := config.DB.QueryRow(
		"SELECT id, file_path FROM purchase_invoices WHERE purchase_order_id = ?", orderID,
	).Scan(&id, &filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No invoice found for this order"})
		return
	}

	// Delete file from disk
	if filePath != "" {
		os.Remove(filePath)
	}

	// Delete DB record
	_, err = config.DB.Exec("DELETE FROM purchase_invoices WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete invoice record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invoice deleted successfully"})
}

// getPurchaseInvoiceByOrderID is a helper to fetch invoice data for a given order
func getPurchaseInvoiceByOrderID(orderID string) (*models.PurchaseInvoice, error) {
	var inv models.PurchaseInvoice
	var uploadedBy sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT id, purchase_order_id, file_name, original_name, file_type, file_size, file_path,
			   uploaded_by, 
			   DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p'),
			   COALESCE(DATE_FORMAT(updated_at, '%d-%m-%Y %h:%i %p'), '')
		FROM purchase_invoices WHERE purchase_order_id = ?
	`, orderID).Scan(
		&inv.ID, &inv.PurchaseOrderID, &inv.FileName, &inv.OriginalName,
		&inv.FileType, &inv.FileSize, &inv.FilePath,
		&uploadedBy, &inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if uploadedBy.Valid {
		v := int(uploadedBy.Int64)
		inv.UploadedBy = &v
	}

	// Construct public URL using forward slashes
	inv.FileURL = "/documents/Purchase/" + inv.FileName

	return &inv, nil
}

// getInvoiceForOrders loads invoice data for a list of purchase orders (batch)
func getInvoiceForOrders(orders []models.PurchaseOrder) {
	if len(orders) == 0 {
		return
	}

	// Build ID list
	ids := make([]interface{}, len(orders))
	placeholders := make([]string, len(orders))
	idMap := make(map[int]int) // order_id -> index in orders
	for i, o := range orders {
		ids[i] = o.ID
		placeholders[i] = "?"
		idMap[o.ID] = i
	}

	query := fmt.Sprintf(`
		SELECT id, purchase_order_id, file_name, original_name, file_type, file_size, file_path,
			   uploaded_by,
			   DATE_FORMAT(created_at, '%%d-%%m-%%Y %%h:%%i %%p'),
			   COALESCE(DATE_FORMAT(updated_at, '%%d-%%m-%%Y %%h:%%i %%p'), '')
		FROM purchase_invoices WHERE purchase_order_id IN (%s)
	`, strings.Join(placeholders, ","))

	rows, err := config.DB.Query(query, ids...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var inv models.PurchaseInvoice
		var uploadedBy sql.NullInt64
		if err := rows.Scan(
			&inv.ID, &inv.PurchaseOrderID, &inv.FileName, &inv.OriginalName,
			&inv.FileType, &inv.FileSize, &inv.FilePath,
			&uploadedBy, &inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			continue
		}
		if uploadedBy.Valid {
			v := int(uploadedBy.Int64)
			inv.UploadedBy = &v
		}
		inv.FileURL = "/documents/Purchase/" + inv.FileName

		if idx, ok := idMap[inv.PurchaseOrderID]; ok {
			invCopy := inv
			orders[idx].InvoiceFile = &invCopy
		}
	}
}

// intFromString converts a string to int, returning 0 on failure
func intFromString(s string) int {
	var v int
	fmt.Sscanf(s, "%d", &v)
	return v
}
