package admin

import (
	"database/sql"
	"fmt"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// ==========================================
// PARTS PURCHASED HANDLERS
// ==========================================

// partsSelectColumns is the shared SELECT clause for parts queries (with vendor JOIN)
const partsSelectColumns = `
	p.id, p.purchase_order_id, p.category, p.vehicle_id, p.service_record_id, p.part_name,
	p.vendor_id,
	COALESCE(vdr.name, ''),
	COALESCE(vdr.contact, ''),
	COALESCE(vdr.address, ''),
	COALESCE(vdr.gst_number, ''),
	p.quantity, p.unit_price, p.total_price, p.warranty_months,
	COALESCE(p.invoice_number, ''), COALESCE(DATE_FORMAT(p.purchased_date, '%d-%m-%Y'), ''),
	p.status,
	COALESCE(DATE_FORMAT(p.ordered_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(p.received_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(p.returned_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(p.cancelled_date, '%d-%m-%Y'), ''),
	p.added_by, DATE_FORMAT(p.created_at, '%d-%m-%Y %h:%i %p'),
	COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), ''),
	COALESCE(COALESCE(v.vehicle_name, dv.vehicle_name), ''),
	COALESCE(sr.title, ''),
	COALESCE(u.full_name, '')
`

const partsFromJoins = `
	FROM parts_purchased p
	LEFT JOIN service_records sr ON p.service_record_id = sr.id
	LEFT JOIN vehicles v ON sr.vehicle_id = v.id
	LEFT JOIN vehicles dv ON p.vehicle_id = dv.id
	LEFT JOIN users u ON p.added_by = u.id
	LEFT JOIN vendors vdr ON p.vendor_id = vdr.id
`

// GetPartsByServiceRecord returns all parts for a specific service record
func GetPartsByServiceRecord(c *gin.Context) {
	serviceID := c.Param("id")

	query := "SELECT " + partsSelectColumns + partsFromJoins + " WHERE p.service_record_id = ? ORDER BY p.created_at DESC"
	rows, err := config.DB.Query(query, serviceID)
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
	vendorIDFilter := c.Query("vendor_id")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	query := "SELECT " + partsSelectColumns + partsFromJoins + " WHERE 1=1"
	var args []interface{}

	if vehicleFilter != "" {
		query += " AND sr.vehicle_id = ?"
		args = append(args, vehicleFilter)
	}
	if vendorIDFilter != "" {
		query += " AND p.vendor_id = ?"
		args = append(args, vendorIDFilter)
	} else if vendorFilter != "" {
		query += " AND vdr.name LIKE ?"
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

	// Default category
	if req.Category == "" {
		req.Category = models.PurchaseCategoryRepairService
	}
	if !models.IsValidPurchaseCategory(req.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}

	if req.PartName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product name is required"})
		return
	}

	// Validate per category
	switch req.Category {
	case models.PurchaseCategoryRepairService:
		if req.ServiceRecordID == nil || *req.ServiceRecordID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Service record is required for repair & service purchases"})
			return
		}
	case models.PurchaseCategoryVehicle:
		// vehicle_id is optional
	}

	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	// Validate status
	if req.Status == "" {
		req.Status = models.ProductStatusPending
	} else if !models.IsValidProductStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: pending, received, returned, or cancelled"})
		return
	}

	totalPrice := float64(req.Quantity) * req.UnitPrice
	adminID, _ := c.Get("user_id")

	// Default ordered_date to purchased_date if not provided
	if req.OrderedDate == "" {
		req.OrderedDate = req.PurchasedDate
	}

	// For repair_service, auto-resolve vehicle_id from service record
	if req.Category == models.PurchaseCategoryRepairService && req.ServiceRecordID != nil {
		var srvVehicleID sql.NullInt64
		config.DB.QueryRow(`SELECT vehicle_id FROM service_records WHERE id = ?`, *req.ServiceRecordID).Scan(&srvVehicleID)
		if srvVehicleID.Valid {
			v := int(srvVehicleID.Int64)
			req.VehicleID = &v
		}
	}

	// Create a purchase order for this single part
	orderResult, err := config.DB.Exec(`
		INSERT INTO purchase_orders 
		(category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.Category, req.VehicleID, req.ServiceRecordID, req.VendorID, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
		req.Status, nilIfEmpty(req.OrderedDate), adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order: " + err.Error()})
		return
	}
	orderID, _ := orderResult.LastInsertId()

	result, err := config.DB.Exec(`
		INSERT INTO parts_purchased 
		(purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
		 quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
		 status, ordered_date, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, orderID, req.Category, req.VehicleID, req.ServiceRecordID, req.PartName, req.VendorID,
		req.Quantity, req.UnitPrice, totalPrice, req.WarrantyMonths, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
		req.Status, nilIfEmpty(req.OrderedDate), adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add part: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	// Only recalculate service cost for repair_service
	if req.Category == models.PurchaseCategoryRepairService && req.ServiceRecordID != nil {
		recalcServiceCost(*req.ServiceRecordID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Part added successfully", "id": id})
}

// AddBulkParts adds multiple parts from the same vendor in a single transaction
func AddBulkParts(c *gin.Context) {
	var req models.BulkCreatePartsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Default category
	if req.Category == "" {
		req.Category = models.PurchaseCategoryRepairService
	}
	if !models.IsValidPurchaseCategory(req.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}

	// Validate per category
	switch req.Category {
	case models.PurchaseCategoryRepairService:
		if req.ServiceRecordID == nil || *req.ServiceRecordID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Service record is required for repair & service purchases"})
			return
		}
	case models.PurchaseCategoryVehicle:
		// vehicle_id is optional
	}

	if len(req.Parts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one product is required"})
		return
	}

	// Validate status
	if req.Status == "" {
		req.Status = models.ProductStatusPending
	} else if !models.IsValidProductStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: pending, received, returned, or cancelled"})
		return
	}

	// For repair_service, auto-resolve vehicle_id from service record
	if req.Category == models.PurchaseCategoryRepairService && req.ServiceRecordID != nil {
		var srvVehicleID sql.NullInt64
		config.DB.QueryRow(`SELECT vehicle_id FROM service_records WHERE id = ?`, *req.ServiceRecordID).Scan(&srvVehicleID)
		if srvVehicleID.Valid {
			v := int(srvVehicleID.Int64)
			req.VehicleID = &v
		}
	}

	adminID, _ := c.Get("user_id")

	// Use a transaction for bulk insert
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Create a purchase order first
	orderResult, err := tx.Exec(`
		INSERT INTO purchase_orders 
		(category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.Category, req.VehicleID, req.ServiceRecordID, req.VendorID, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
		req.Status, nilIfEmpty(req.PurchasedDate), adminID)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order: " + err.Error()})
		return
	}
	orderID, _ := orderResult.LastInsertId()

	var insertedIDs []int64
	for _, part := range req.Parts {
		if part.PartName == "" {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "All products must have a name"})
			return
		}
		if part.Quantity <= 0 {
			part.Quantity = 1
		}
		totalPrice := float64(part.Quantity) * part.UnitPrice

		result, err := tx.Exec(`
			INSERT INTO parts_purchased 
			(purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
			 quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
			 status, ordered_date, added_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, orderID, req.Category, req.VehicleID, req.ServiceRecordID, part.PartName, req.VendorID,
			part.Quantity, part.UnitPrice, totalPrice, part.WarrantyMonths, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
			req.Status, nilIfEmpty(req.PurchasedDate), adminID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add part '" + part.PartName + "': " + err.Error()})
			return
		}
		id, _ := result.LastInsertId()
		insertedIDs = append(insertedIDs, id)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	// Only recalculate service cost for repair_service
	if req.Category == models.PurchaseCategoryRepairService && req.ServiceRecordID != nil {
		recalcServiceCost(*req.ServiceRecordID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("%d parts added successfully", len(insertedIDs)),
		"order_id": orderID,
		"ids":      insertedIDs,
	})
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

	// Validate status
	if req.Status != "" && !models.IsValidProductStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: pending, received, returned, or cancelled"})
		return
	}

	totalPrice := float64(req.Quantity) * req.UnitPrice

	_, err := config.DB.Exec(`
		UPDATE parts_purchased SET
			part_name = ?, vendor_id = ?,
			quantity = ?, unit_price = ?, total_price = ?,
			warranty_months = ?, invoice_number = ?, purchased_date = COALESCE(?, purchased_date), status = ?,
			ordered_date = ?, received_date = ?, returned_date = ?, cancelled_date = ?
		WHERE id = ?
	`, req.PartName, req.VendorID,
		req.Quantity, req.UnitPrice, totalPrice,
		req.WarrantyMonths, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate), req.Status,
		nilIfEmpty(req.OrderedDate), nilIfEmpty(req.ReceivedDate), nilIfEmpty(req.ReturnedDate), nilIfEmpty(req.CancelledDate),
		req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update part: " + err.Error()})
		return
	}

	// Recalculate service record costs
	var serviceRecordID sql.NullInt64
	config.DB.QueryRow(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, req.ID).Scan(&serviceRecordID)
	if serviceRecordID.Valid && serviceRecordID.Int64 > 0 {
		recalcServiceCost(int(serviceRecordID.Int64))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Part updated successfully"})
}

// UpdatePartStatus updates only the status and corresponding date
func UpdatePartStatus(c *gin.Context) {
	var req struct {
		ID     int    `json:"id"`
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.ID == 0 || req.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID and status are required"})
		return
	}

	if !models.IsValidProductStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: pending, received, returned, or cancelled"})
		return
	}

	// Update status and set the corresponding date to today
	dateCol := ""
	switch req.Status {
	case models.ProductStatusPending:
		dateCol = "ordered_date"
	case models.ProductStatusReceived:
		dateCol = "received_date"
	case models.ProductStatusReturned:
		dateCol = "returned_date"
	case models.ProductStatusCancelled:
		dateCol = "cancelled_date"
	}

	_, err := config.DB.Exec(
		"UPDATE parts_purchased SET status = ?, "+dateCol+" = CURDATE() WHERE id = ?",
		req.Status, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated to " + req.Status})
}

// DeletePart deletes a part purchase
func DeletePart(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Part ID is required"})
		return
	}

	// Get service record ID before deleting
	var serviceRecordID sql.NullInt64
	config.DB.QueryRow(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, id).Scan(&serviceRecordID)

	_, err := config.DB.Exec(`DELETE FROM parts_purchased WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete part: " + err.Error()})
		return
	}

	// Recalculate service record costs
	if serviceRecordID.Valid && serviceRecordID.Int64 > 0 {
		recalcServiceCost(int(serviceRecordID.Int64))
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

	type VendorSpend struct {
		VendorID   int     `json:"vendor_id"`
		VendorName string  `json:"vendor_name"`
		TotalSpent float64 `json:"total_spent"`
		PartsCount int     `json:"parts_count"`
	}

	// True grand total from ALL parts_purchased (regardless of vehicle)
	var grandTotal float64
	var grandParts int
	config.DB.QueryRow(`SELECT COALESCE(SUM(total_price), 0), COUNT(id) FROM parts_purchased`).Scan(&grandTotal, &grandParts)

	// By vehicle - using purchase_orders vehicle reference
	rows, err := config.DB.Query(`
		SELECT COALESCE(COALESCE(v.id, dv.id), 0),
			   COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), ''), 
			   COALESCE(SUM(p.total_price), 0), COUNT(p.id)
		FROM parts_purchased p
		LEFT JOIN purchase_orders po ON p.purchase_order_id = po.id
		LEFT JOIN service_records sr ON COALESCE(po.service_record_id, p.service_record_id) = sr.id
		LEFT JOIN vehicles v ON COALESCE(po.vehicle_id, sr.vehicle_id) = v.id
		LEFT JOIN vehicles dv ON p.vehicle_id = dv.id
		WHERE COALESCE(po.vehicle_id, sr.vehicle_id, p.vehicle_id) IS NOT NULL
		GROUP BY COALESCE(v.id, dv.id), COALESCE(v.vehicle_number, dv.vehicle_number)
		ORDER BY SUM(p.total_price) DESC
	`)

	var vehicles []VehicleSpend

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var vs VehicleSpend
			rows.Scan(&vs.VehicleID, &vs.VehicleNumber, &vs.TotalSpent, &vs.PartsCount)
			vehicles = append(vehicles, vs)
		}
	}
	if vehicles == nil {
		vehicles = []VehicleSpend{}
	}

	// By vendor
	vendorRows, err := config.DB.Query(`
		SELECT COALESCE(p.vendor_id, 0), COALESCE(vdr.name, 'Unknown'),
			   COALESCE(SUM(p.total_price), 0), COUNT(p.id)
		FROM parts_purchased p
		LEFT JOIN vendors vdr ON p.vendor_id = vdr.id
		WHERE p.vendor_id IS NOT NULL
		GROUP BY p.vendor_id, vdr.name
		ORDER BY SUM(p.total_price) DESC
	`)

	var vendorSpends []VendorSpend
	if err == nil {
		defer vendorRows.Close()
		for vendorRows.Next() {
			var vs VendorSpend
			vendorRows.Scan(&vs.VendorID, &vs.VendorName, &vs.TotalSpent, &vs.PartsCount)
			vendorSpends = append(vendorSpends, vs)
		}
	}
	if vendorSpends == nil {
		vendorSpends = []VendorSpend{}
	}

	// Count active vendors
	var activeVendors int
	config.DB.QueryRow(`SELECT COUNT(*) FROM vendors WHERE is_active = 1`).Scan(&activeVendors)

	// Count total orders
	var totalOrders int
	config.DB.QueryRow(`SELECT COUNT(*) FROM purchase_orders`).Scan(&totalOrders)

	// By category
	type CategorySpend struct {
		Category   string  `json:"category"`
		TotalSpent float64 `json:"total_spent"`
		PartsCount int     `json:"parts_count"`
		OrderCount int     `json:"order_count"`
	}
	catRows, err := config.DB.Query(`
		SELECT COALESCE(po.category, 'repair_service'), 
			   COALESCE(SUM(p.total_price), 0), COUNT(p.id), COUNT(DISTINCT po.id)
		FROM parts_purchased p
		LEFT JOIN purchase_orders po ON p.purchase_order_id = po.id
		GROUP BY COALESCE(po.category, 'repair_service')
		ORDER BY SUM(p.total_price) DESC
	`)
	var categorySpends []CategorySpend
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cs CategorySpend
			catRows.Scan(&cs.Category, &cs.TotalSpent, &cs.PartsCount, &cs.OrderCount)
			categorySpends = append(categorySpends, cs)
		}
	}
	if categorySpends == nil {
		categorySpends = []CategorySpend{}
	}

	c.JSON(http.StatusOK, gin.H{
		"by_vehicle":     vehicles,
		"by_vendor":      vendorSpends,
		"by_category":    categorySpends,
		"total_spent":    grandTotal,
		"total_parts":    grandParts,
		"total_orders":   totalOrders,
		"active_vendors": activeVendors,
	})
}

// scanParts is a helper to scan parts rows (with vendor fields)
func scanParts(rows *sql.Rows) []models.PartPurchased {
	var parts []models.PartPurchased
	for rows.Next() {
		var p models.PartPurchased
		var addedBy sql.NullInt64
		var vendorID sql.NullInt64
		var purchaseOrderID sql.NullInt64
		var vehicleID sql.NullInt64
		var serviceRecordID sql.NullInt64

		if err := rows.Scan(
			&p.ID, &purchaseOrderID, &p.Category, &vehicleID, &serviceRecordID, &p.PartName,
			&vendorID,
			&p.VendorName, &p.VendorContact, &p.VendorAddress, &p.VendorGST,
			&p.Quantity, &p.UnitPrice, &p.TotalPrice, &p.WarrantyMonths,
			&p.InvoiceNumber, &p.PurchasedDate,
			&p.Status,
			&p.OrderedDate, &p.ReceivedDate, &p.ReturnedDate, &p.CancelledDate,
			&addedBy, &p.CreatedAt,
			&p.VehicleNumber, &p.VehicleName, &p.ServiceTitle, &p.AddedByName,
		); err != nil {
			continue
		}

		if purchaseOrderID.Valid {
			v := int(purchaseOrderID.Int64)
			p.PurchaseOrderID = &v
		}
		if vehicleID.Valid {
			v := int(vehicleID.Int64)
			p.VehicleID = &v
		}
		if serviceRecordID.Valid {
			v := int(serviceRecordID.Int64)
			p.ServiceRecordID = &v
		}
		if vendorID.Valid {
			v := int(vendorID.Int64)
			p.VendorID = &v
		}
		if addedBy.Valid {
			v := int(addedBy.Int64)
			p.AddedBy = &v
		}

		if p.Category == "" {
			p.Category = models.PurchaseCategoryRepairService
		}

		parts = append(parts, p)
	}

	if parts == nil {
		parts = []models.PartPurchased{}
	}
	return parts
}

// nilIfEmpty returns nil for empty strings (for nullable date columns)
func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
