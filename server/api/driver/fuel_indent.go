package driver

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// GetDriverFuelIndents returns fuel indents for the logged-in driver
func GetDriverFuelIndents(c *gin.Context) {
	userID, _ := c.Get("user_id")

	// Get driver_id from user_id
	var driverID int
	err := config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	query := `
		SELECT 
			fi.id, fi.vehicle_id, fi.driver_id, fi.fuel_requested,
			COALESCE(fi.fuel_filled, 0), COALESCE(fi.fuel_amount, 0), fi.odometer_reading, fi.status,
			COALESCE(DATE_FORMAT(fi.requested_at, '%d-%m-%Y %h:%i %p'), ''),
			COALESCE(DATE_FORMAT(fi.completed_at, '%d-%m-%Y %h:%i %p'), ''),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(u.full_name, ''),
			COALESCE(fi.fuel_indent_number, ''), COALESCE(fi.vehicle_type, ''), COALESCE(fi.fuel_type, ''),
			COALESCE(DATE_FORMAT(fi.filled_date, '%d-%m-%Y'), ''),
			COALESCE(
				CASE
					WHEN fi.filled_time IS NULL OR fi.filled_time = '' THEN ''
					ELSE DATE_FORMAT(STR_TO_DATE(fi.filled_time, '%H:%i'), '%h:%i %p')
				END,
			''),
			COALESCE(fi.bill_file_name, ''), COALESCE(fi.bill_original_name, ''), COALESCE(fi.bill_file_type, ''),
			COALESCE(fi.bill_file_size, 0), COALESCE(DATE_FORMAT(fi.bill_uploaded_at, '%d-%m-%Y %h:%i %p'), '')
		FROM fuel_indents fi
		LEFT JOIN vehicles v ON fi.vehicle_id = v.id
		LEFT JOIN drivers dr ON fi.driver_id = dr.id
		LEFT JOIN users u ON dr.user_id = u.id
		WHERE fi.driver_id = ?
		ORDER BY fi.requested_at DESC
	`

	rows, err := config.DB.Query(query, driverID)
	if err != nil {
		c.JSON(http.StatusOK, []models.FuelIndent{})
		return
	}
	defer rows.Close()

	var indents []models.FuelIndent
	for rows.Next() {
		var fi models.FuelIndent
		var completedAt sql.NullString
		var billUploadedAt sql.NullString
		if err := rows.Scan(
			&fi.ID, &fi.VehicleID, &fi.DriverID, &fi.FuelRequested,
			&fi.FuelFilled, &fi.FuelAmount, &fi.OdometerReading, &fi.Status, &fi.RequestedAt,
			&completedAt, &fi.VehicleNumber, &fi.VehicleName, &fi.DriverName,
			&fi.FuelIndentNumber, &fi.VehicleType, &fi.FuelType,
			&fi.FilledDate, &fi.FilledTime,
			&fi.BillFileName, &fi.BillOriginalName, &fi.BillFileType,
			&fi.BillFileSize, &billUploadedAt,
		); err != nil {
			continue
		}
		if completedAt.Valid {
			fi.CompletedAt = &completedAt.String
		}
		if strings.TrimSpace(fi.BillFileName) != "" {
			fi.BillFileURL = "/documents/FuelIndents/" + fi.BillFileName
		}
		if billUploadedAt.Valid {
			fi.BillUploadedAt = &billUploadedAt.String
		}
		indents = append(indents, fi)
	}

	if indents == nil {
		indents = []models.FuelIndent{}
	}
	c.JSON(http.StatusOK, indents)
}

// CreateDriverFuelIndent allows a driver to raise a fuel indent
func CreateDriverFuelIndent(c *gin.Context) {
	var req models.DriverCreateFuelIndentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.VehicleID == 0 || req.DriverID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle and driver are required"})
		return
	}
	if req.FilledDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled date is required"})
		return
	}
	if req.FilledLiters <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled liters must be greater than 0"})
		return
	}
	if req.FuelAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel amount must be greater than 0"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	query := `
		INSERT INTO fuel_indents 
			(vehicle_id, driver_id, fuel_requested, fuel_filled, fuel_amount, odometer_reading, status, requested_at,
			 fuel_indent_number, vehicle_type, fuel_type, filled_date, filled_time)
		VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
	`
	result, err := config.DB.Exec(query,
		req.VehicleID, req.DriverID, req.FilledLiters, req.FilledLiters, req.FuelAmount,
		req.OdometerReading, now,
		req.FuelIndentNumber, req.VehicleType, req.FuelType,
		req.FilledDate, req.FilledTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create fuel indent: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{
		"message": "Fuel indent raised successfully",
		"id":      id,
	})
}

// GetDriversDropdown returns all drivers for dropdown selection
func GetDriversDropdown(c *gin.Context) {
	query := `
		SELECT d.id, u.full_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE u.status != 'inactive'
		ORDER BY u.full_name
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusOK, []gin.H{})
		return
	}
	defer rows.Close()

	var drivers []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		drivers = append(drivers, gin.H{"id": id, "full_name": name})
	}
	if drivers == nil {
		drivers = []gin.H{}
	}
	c.JSON(http.StatusOK, drivers)
}

// UploadDriverFuelIndentBill uploads/replaces bill for driver's own fuel indent
func UploadDriverFuelIndentBill(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var driverID int
	err := config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	idStr := c.Param("id")
	indentID, err := strconv.Atoi(idStr)
	if err != nil || indentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	var ownerDriverID int
	if err := config.DB.QueryRow(`SELECT driver_id FROM fuel_indents WHERE id = ?`, indentID).Scan(&ownerDriverID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Fuel indent not found"})
		return
	}
	if ownerDriverID != driverID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can upload bills only for your own indents"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	const maxSize = 10 << 20 // 10MB
	if fileHeader.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 10MB limit"})
		return
	}

	contentType := fileHeader.Header.Get("Content-Type")
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

	uploadDir := filepath.Join("Documents", "FuelIndents")
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		if fileType == "pdf" {
			ext = ".pdf"
		} else {
			ext = ".jpg"
		}
	}
	uniqueName := fmt.Sprintf("fuel_indent_%d_%d%s", indentID, time.Now().UnixNano(), ext)
	savePath := filepath.Join(uploadDir, uniqueName)

	var oldPath sql.NullString
	_ = config.DB.QueryRow(`SELECT bill_file_path FROM fuel_indents WHERE id = ?`, indentID).Scan(&oldPath)
	if oldPath.Valid && strings.TrimSpace(oldPath.String) != "" {
		_ = os.Remove(oldPath.String)
	}

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save bill file"})
		return
	}

	_, err = config.DB.Exec(`
		UPDATE fuel_indents
		SET bill_file_name = ?,
			bill_original_name = ?,
			bill_file_type = ?,
			bill_file_size = ?,
			bill_file_path = ?,
			bill_uploaded_at = NOW()
		WHERE id = ?
	`, uniqueName, fileHeader.Filename, fileType, fileHeader.Size, savePath, indentID)
	if err != nil {
		_ = os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save bill metadata"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Fuel bill uploaded successfully",
		"bill": gin.H{
			"file_name":     uniqueName,
			"original_name": fileHeader.Filename,
			"file_type":     fileType,
			"file_size":     fileHeader.Size,
			"file_url":      "/documents/FuelIndents/" + uniqueName,
		},
	})
}

// UpdateDriverFuelIndent updates editable fields for driver's own pending fuel indent
func UpdateDriverFuelIndent(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var driverID int
	if err := config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	idStr := c.Param("id")
	indentID, err := strconv.Atoi(idStr)
	if err != nil || indentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	var req struct {
		FilledDate      string  `json:"filled_date"`
		FilledTime      string  `json:"filled_time"`
		OdometerReading int     `json:"odometer_reading"`
		FilledLiters    float64 `json:"filled_liters"`
		FuelAmount      float64 `json:"fuel_amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if strings.TrimSpace(req.FilledDate) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled date is required"})
		return
	}
	if req.FilledLiters <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filled liters must be greater than 0"})
		return
	}
	if req.FuelAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel amount must be greater than 0"})
		return
	}

	result, err := config.DB.Exec(`
		UPDATE fuel_indents
		SET filled_date = ?,
			filled_time = ?,
			odometer_reading = ?,
			fuel_requested = ?,
			fuel_filled = ?,
			fuel_amount = ?
		WHERE id = ? AND driver_id = ?
	`, req.FilledDate, req.FilledTime, req.OdometerReading, req.FilledLiters, req.FilledLiters, req.FuelAmount, indentID, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fuel indent"})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel indent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fuel indent updated successfully"})
}

// DeleteDriverFuelIndent deletes driver's own pending fuel indent
func DeleteDriverFuelIndent(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var driverID int
	if err := config.DB.QueryRow("SELECT id FROM drivers WHERE user_id = ?", userID).Scan(&driverID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	idStr := c.Param("id")
	indentID, err := strconv.Atoi(idStr)
	if err != nil || indentID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid indent ID"})
		return
	}

	var billPath sql.NullString
	_ = config.DB.QueryRow(`SELECT bill_file_path FROM fuel_indents WHERE id = ? AND driver_id = ?`, indentID, driverID).Scan(&billPath)

	result, err := config.DB.Exec(`DELETE FROM fuel_indents WHERE id = ? AND driver_id = ?`, indentID, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete fuel indent"})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel indent not found"})
		return
	}

	if billPath.Valid && strings.TrimSpace(billPath.String) != "" {
		_ = os.Remove(billPath.String)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fuel indent deleted successfully"})
}
