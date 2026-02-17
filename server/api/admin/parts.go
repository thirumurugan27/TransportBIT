package admin

import (
	"database/sql"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// ==========================================
// PARTS PURCHASED HANDLERS
// ==========================================

// GetPartsByServiceRecord returns all parts for a specific service record
func GetPartsByServiceRecord(c *gin.Context) {
	serviceID := c.Param("id")

	rows, err := config.DB.Query(`
		SELECT 
			p.id, p.service_record_id, p.part_name, COALESCE(p.part_number, ''),
			COALESCE(p.vendor_name, ''), COALESCE(p.vendor_contact, ''),
			p.quantity, p.unit_price, p.total_price, p.warranty_months,
			COALESCE(p.invoice_number, ''), COALESCE(DATE_FORMAT(p.purchased_date, '%d-%m-%Y'), ''),
			p.added_by, DATE_FORMAT(p.created_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(sr.title, ''), COALESCE(u.full_name, '')
		FROM parts_purchased p
		LEFT JOIN service_records sr ON p.service_record_id = sr.id
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN users u ON p.added_by = u.id
		WHERE p.service_record_id = ?
		ORDER BY p.created_at DESC
	`, serviceID)
	if err != nil {
		c.JSON(http.StatusOK, []models.PartPurchased{})
		return
	}
	defer rows.Close()

	parts := scanParts(rows)
	c.JSON(http.StatusOK, parts)
}

// GetAllParts returns all parts purchased with optional filters
func GetAllParts(c *gin.Context) {
	vehicleFilter := c.Query("vehicle_id")
	vendorFilter := c.Query("vendor")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	query := `
		SELECT 
			p.id, p.service_record_id, p.part_name, COALESCE(p.part_number, ''),
			COALESCE(p.vendor_name, ''), COALESCE(p.vendor_contact, ''),
			p.quantity, p.unit_price, p.total_price, p.warranty_months,
			COALESCE(p.invoice_number, ''), COALESCE(DATE_FORMAT(p.purchased_date, '%d-%m-%Y'), ''),
			p.added_by, DATE_FORMAT(p.created_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(sr.title, ''), COALESCE(u.full_name, '')
		FROM parts_purchased p
		LEFT JOIN service_records sr ON p.service_record_id = sr.id
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN users u ON p.added_by = u.id
		WHERE 1=1
	`
	var args []interface{}

	if vehicleFilter != "" {
		query += " AND sr.vehicle_id = ?"
		args = append(args, vehicleFilter)
	}
	if vendorFilter != "" {
		query += " AND p.vendor_name LIKE ?"
		args = append(args, "%"+vendorFilter+"%")
	}
	if dateFrom != "" {
		query += " AND p.purchased_date >= ?"
		args = append(args, dateFrom)
	}
	if dateTo != "" {
		query += " AND p.purchased_date <= ?"
		args = append(args, dateTo)
	}

	query += " ORDER BY p.created_at DESC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, []models.PartPurchased{})
		return
	}
	defer rows.Close()

	parts := scanParts(rows)
	c.JSON(http.StatusOK, parts)
}

// AddPart adds a new part purchase to a service record
func AddPart(c *gin.Context) {
	var req models.CreatePartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.ServiceRecordID == 0 || req.PartName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service record and part name are required"})
		return
	}

	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	totalPrice := float64(req.Quantity) * req.UnitPrice
	adminID, _ := c.Get("user_id")

	result, err := config.DB.Exec(`
		INSERT INTO parts_purchased 
		(service_record_id, part_name, part_number, vendor_name, vendor_contact, 
		 quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.ServiceRecordID, req.PartName, req.PartNumber, req.VendorName, req.VendorContact,
		req.Quantity, req.UnitPrice, totalPrice, req.WarrantyMonths, req.InvoiceNumber, req.PurchasedDate, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add part: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	// Recalculate service record costs
	recalcServiceCost(req.ServiceRecordID)

	c.JSON(http.StatusOK, gin.H{"message": "Part added successfully", "id": id})
}

// UpdatePart updates an existing part purchase
func UpdatePart(c *gin.Context) {
	var req models.UpdatePartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	totalPrice := float64(req.Quantity) * req.UnitPrice

	_, err := config.DB.Exec(`
		UPDATE parts_purchased SET
			part_name = ?, part_number = ?, vendor_name = ?, vendor_contact = ?,
			quantity = ?, unit_price = ?, total_price = ?,
			warranty_months = ?, invoice_number = ?, purchased_date = ?
		WHERE id = ?
	`, req.PartName, req.PartNumber, req.VendorName, req.VendorContact,
		req.Quantity, req.UnitPrice, totalPrice,
		req.WarrantyMonths, req.InvoiceNumber, req.PurchasedDate, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update part: " + err.Error()})
		return
	}

	// Recalculate service record costs
	var serviceRecordID int
	config.DB.QueryRow(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, req.ID).Scan(&serviceRecordID)
	recalcServiceCost(serviceRecordID)

	c.JSON(http.StatusOK, gin.H{"message": "Part updated successfully"})
}

// DeletePart deletes a part purchase
func DeletePart(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Part ID is required"})
		return
	}

	// Get service record ID before deleting
	var serviceRecordID int
	config.DB.QueryRow(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, id).Scan(&serviceRecordID)

	_, err := config.DB.Exec(`DELETE FROM parts_purchased WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete part: " + err.Error()})
		return
	}

	// Recalculate service record costs
	if serviceRecordID > 0 {
		recalcServiceCost(serviceRecordID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Part deleted successfully"})
}

// GetPartsExpenditure returns parts expenditure summary
func GetPartsExpenditure(c *gin.Context) {
	type VehicleSpend struct {
		VehicleID     int     `json:"vehicle_id"`
		VehicleNumber string  `json:"vehicle_number"`
		TotalSpent    float64 `json:"total_spent"`
		PartsCount    int     `json:"parts_count"`
	}

	rows, err := config.DB.Query(`
		SELECT sr.vehicle_id, COALESCE(v.vehicle_number, ''), 
			   COALESCE(SUM(p.total_price), 0), COUNT(p.id)
		FROM parts_purchased p
		JOIN service_records sr ON p.service_record_id = sr.id
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		GROUP BY sr.vehicle_id, v.vehicle_number
		ORDER BY SUM(p.total_price) DESC
	`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"by_vehicle":  []VehicleSpend{},
			"total_spent": 0,
			"total_parts": 0,
		})
		return
	}
	defer rows.Close()

	var vehicles []VehicleSpend
	var grandTotal float64
	var grandParts int
	for rows.Next() {
		var vs VehicleSpend
		rows.Scan(&vs.VehicleID, &vs.VehicleNumber, &vs.TotalSpent, &vs.PartsCount)
		grandTotal += vs.TotalSpent
		grandParts += vs.PartsCount
		vehicles = append(vehicles, vs)
	}

	if vehicles == nil {
		vehicles = []VehicleSpend{}
	}

	c.JSON(http.StatusOK, gin.H{
		"by_vehicle":  vehicles,
		"total_spent": grandTotal,
		"total_parts": grandParts,
	})
}

// scanParts is a helper to scan parts rows
func scanParts(rows *sql.Rows) []models.PartPurchased {
	var parts []models.PartPurchased
	for rows.Next() {
		var p models.PartPurchased
		var addedBy sql.NullInt64

		if err := rows.Scan(
			&p.ID, &p.ServiceRecordID, &p.PartName, &p.PartNumber,
			&p.VendorName, &p.VendorContact,
			&p.Quantity, &p.UnitPrice, &p.TotalPrice, &p.WarrantyMonths,
			&p.InvoiceNumber, &p.PurchasedDate,
			&addedBy, &p.CreatedAt,
			&p.VehicleNumber, &p.VehicleName, &p.ServiceTitle, &p.AddedByName,
		); err != nil {
			continue
		}

		if addedBy.Valid {
			v := int(addedBy.Int64)
			p.AddedBy = &v
		}

		parts = append(parts, p)
	}

	if parts == nil {
		parts = []models.PartPurchased{}
	}
	return parts
}
