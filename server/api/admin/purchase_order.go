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
// PURCHASE ORDER HANDLERS
// ==========================================

// purchaseOrderSelectColumns is the shared SELECT clause for purchase order queries
const purchaseOrderSelectColumns = `
	po.id, po.category, po.vehicle_id, po.service_record_id,
	po.vendor_id,
	COALESCE(vdr.name, ''),
	COALESCE(vdr.contact, ''),
	COALESCE(vdr.address, ''),
	COALESCE(vdr.gst_number, ''),
	COALESCE(po.invoice_number, ''),
	COALESCE(DATE_FORMAT(po.purchased_date, '%d-%m-%Y'), ''),
	po.status,
	COALESCE(DATE_FORMAT(po.ordered_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(po.received_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(po.returned_date, '%d-%m-%Y'), ''),
	COALESCE(DATE_FORMAT(po.cancelled_date, '%d-%m-%Y'), ''),
	COALESCE(po.notes, ''),
	po.added_by,
	COALESCE(u.full_name, ''),
	DATE_FORMAT(po.created_at, '%d-%m-%Y %h:%i %p'),
	COALESCE(DATE_FORMAT(po.updated_at, '%d-%m-%Y %h:%i %p'), ''),
	COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), ''),
	COALESCE(COALESCE(v.vehicle_name, dv.vehicle_name), ''),
	COALESCE(sr.title, ''),
	COALESCE(SUM(p.total_price), 0),
	COUNT(p.id)
`

const purchaseOrderFromJoins = `
	FROM purchase_orders po
	LEFT JOIN service_records sr ON po.service_record_id = sr.id
	LEFT JOIN vehicles v ON sr.vehicle_id = v.id
	LEFT JOIN vehicles dv ON po.vehicle_id = dv.id
	LEFT JOIN users u ON po.added_by = u.id
	LEFT JOIN vendors vdr ON po.vendor_id = vdr.id
	LEFT JOIN parts_purchased p ON p.purchase_order_id = po.id
`

const purchaseOrderGroupBy = `
	GROUP BY po.id, po.category, po.vehicle_id, po.service_record_id,
		po.vendor_id, vdr.name, vdr.contact, vdr.address, vdr.gst_number,
		po.invoice_number, po.purchased_date, po.status, po.ordered_date, po.received_date,
		po.returned_date, po.cancelled_date, po.notes, po.added_by, u.full_name,
		po.created_at, po.updated_at, v.vehicle_number, v.vehicle_name, dv.vehicle_number, dv.vehicle_name, sr.title
`

// GetAllPurchaseOrders returns all purchase orders with aggregated totals and nested products
func GetAllPurchaseOrders(c *gin.Context) {
	vendorFilter := c.Query("vendor_id")
	vehicleFilter := c.Query("vehicle_id")
	statusFilter := c.Query("status")
	categoryFilter := c.Query("category")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	search := c.Query("search")

	query := "SELECT " + purchaseOrderSelectColumns + purchaseOrderFromJoins + " WHERE 1=1"
	var args []interface{}

	if categoryFilter != "" {
		query += " AND po.category = ?"
		args = append(args, categoryFilter)
	}
	if vendorFilter != "" {
		query += " AND po.vendor_id = ?"
		args = append(args, vendorFilter)
	}
	if vehicleFilter != "" {
		query += " AND (sr.vehicle_id = ? OR po.vehicle_id = ?)"
		args = append(args, vehicleFilter, vehicleFilter)
	}
	if statusFilter != "" {
		query += " AND po.status = ?"
		args = append(args, statusFilter)
	}
	if dateFrom != "" {
		query += " AND po.purchased_date >= ?"
		args = append(args, dateFrom)
	}
	if dateTo != "" {
		query += " AND po.purchased_date <= ?"
		args = append(args, dateTo)
	}
	if search != "" {
		query += " AND (po.invoice_number LIKE ? OR vdr.name LIKE ? OR COALESCE(v.vehicle_number, dv.vehicle_number, '') LIKE ? OR EXISTS(SELECT 1 FROM parts_purchased pp WHERE pp.purchase_order_id = po.id AND pp.part_name LIKE ?))"
		searchTerm := "%" + search + "%"
		args = append(args, searchTerm, searchTerm, searchTerm, searchTerm)
	}

	query += purchaseOrderGroupBy + " ORDER BY po.created_at DESC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, []models.PurchaseOrder{})
		return
	}
	defer rows.Close()

	orders := scanPurchaseOrders(rows)

	// Load products for each order
	for i := range orders {
		orders[i].Products = getProductsForOrder(orders[i].ID)
	}

	// Load invoice data for all orders
	getInvoiceForOrders(orders)

	c.JSON(http.StatusOK, orders)
}

// GetPurchaseOrderByID returns a single purchase order with full product list
func GetPurchaseOrderByID(c *gin.Context) {
	orderID := c.Param("id")

	query := "SELECT " + purchaseOrderSelectColumns + purchaseOrderFromJoins + " WHERE po.id = ?" + purchaseOrderGroupBy
	rows, err := config.DB.Query(query, orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	defer rows.Close()

	orders := scanPurchaseOrders(rows)
	if len(orders) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	order := orders[0]
	order.Products = getProductsForOrder(order.ID)

	// Load invoice data
	inv, err := getPurchaseInvoiceByOrderID(orderID)
	if err == nil {
		order.InvoiceFile = inv
	}

	c.JSON(http.StatusOK, order)
}

// CreatePurchaseOrder creates a new purchase order with products
func CreatePurchaseOrder(c *gin.Context) {
	var req models.CreatePurchaseOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Default category
	if req.Category == "" {
		req.Category = models.PurchaseCategoryRepairService
	}
	if !models.IsValidPurchaseCategory(req.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category. Must be: general, vehicle, or repair_service"})
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
	case models.PurchaseCategoryGeneral:
		// no extra context needed
	}

	if len(req.Parts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one product is required"})
		return
	}

	if req.Status == "" {
		req.Status = models.ProductStatusPending
	} else if !models.IsValidProductStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
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

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Create the purchase order
	orderResult, err := tx.Exec(`
		INSERT INTO purchase_orders 
		(category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, notes, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.Category, req.VehicleID, req.ServiceRecordID, req.VendorID, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
		req.Status, nilIfEmpty(req.PurchasedDate), nilIfEmpty(req.Notes), adminID)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order: " + err.Error()})
		return
	}

	orderID, _ := orderResult.LastInsertId()

	// Insert all products linked to this order
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
			part.Quantity, part.UnitPrice, totalPrice, part.WarrantyMonths,
			req.InvoiceNumber, nilIfEmpty(req.PurchasedDate),
			req.Status, nilIfEmpty(req.PurchasedDate), adminID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add product '" + part.PartName + "': " + err.Error()})
			return
		}
		id, _ := result.LastInsertId()
		insertedIDs = append(insertedIDs, id)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	// Only recalc service cost for repair_service orders
	if req.Category == models.PurchaseCategoryRepairService && req.ServiceRecordID != nil {
		recalcServiceCost(*req.ServiceRecordID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("Order created with %d products", len(insertedIDs)),
		"order_id": orderID,
		"ids":      insertedIDs,
	})
}

// UpdatePurchaseOrder updates order-level fields
func UpdatePurchaseOrder(c *gin.Context) {
	var req models.UpdatePurchaseOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	// Update order-level fields
	_, err := config.DB.Exec(`
		UPDATE purchase_orders SET
			vendor_id = ?, invoice_number = ?, purchased_date = ?, notes = ?
		WHERE id = ?
	`, req.VendorID, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate), nilIfEmpty(req.Notes), req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order: " + err.Error()})
		return
	}

	// Also update vendor_id, invoice_number, purchased_date on all child parts
	_, err = config.DB.Exec(`
		UPDATE parts_purchased SET
			vendor_id = ?, invoice_number = ?, purchased_date = ?
		WHERE purchase_order_id = ?
	`, req.VendorID, req.InvoiceNumber, nilIfEmpty(req.PurchasedDate), req.ID)
	if err != nil {
		// Non-critical, log but don't fail
		fmt.Printf("Warning: failed to sync parts with order update: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order updated successfully"})
}

// UpdatePurchaseOrderStatus updates the order status and optionally cascades to products
func UpdatePurchaseOrderStatus(c *gin.Context) {
	var req struct {
		ID      int    `json:"id"`
		Status  string `json:"status"`
		Cascade bool   `json:"cascade"`
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	// Determine date column
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

	// Update order status
	_, err := config.DB.Exec(
		"UPDATE purchase_orders SET status = ?, "+dateCol+" = CURDATE() WHERE id = ?",
		req.Status, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status: " + err.Error()})
		return
	}

	// Cascade to all products if requested
	if req.Cascade {
		_, err = config.DB.Exec(
			"UPDATE parts_purchased SET status = ?, "+dateCol+" = CURDATE() WHERE purchase_order_id = ?",
			req.Status, req.ID)
		if err != nil {
			fmt.Printf("Warning: failed to cascade status to products: %v\n", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order status updated to " + req.Status})
}

// DeletePurchaseOrder deletes an order and all its products
func DeletePurchaseOrder(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID is required"})
		return
	}

	// Get service record ID before deleting
	var serviceRecordID sql.NullInt64
	config.DB.QueryRow(`SELECT service_record_id FROM purchase_orders WHERE id = ?`, id).Scan(&serviceRecordID)

	// Products will be cascade-deleted due to FK constraint
	_, err := config.DB.Exec(`DELETE FROM purchase_orders WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete order: " + err.Error()})
		return
	}

	if serviceRecordID.Valid && serviceRecordID.Int64 > 0 {
		recalcServiceCost(int(serviceRecordID.Int64))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order and all products deleted successfully"})
}

// AddProductToOrder adds a single product to an existing order
func AddProductToOrder(c *gin.Context) {
	var req models.AddProductToOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.PurchaseOrderID == 0 || req.PartName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order ID and product name are required"})
		return
	}

	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	// Get order details to inherit shared fields
	var category string
	var serviceRecordID sql.NullInt64
	var vehicleID sql.NullInt64
	var vendorID sql.NullInt64
	var invoiceNumber, status string
	var purchasedDate sql.NullString
	err := config.DB.QueryRow(`
		SELECT category, service_record_id, vehicle_id, vendor_id, COALESCE(invoice_number, ''), 
			   purchased_date, status
		FROM purchase_orders WHERE id = ?
	`, req.PurchaseOrderID).Scan(&category, &serviceRecordID, &vehicleID, &vendorID, &invoiceNumber, &purchasedDate, &status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	totalPrice := float64(req.Quantity) * req.UnitPrice
	adminID, _ := c.Get("user_id")

	var vendorIDVal interface{}
	if vendorID.Valid {
		vendorIDVal = vendorID.Int64
	}

	var vehicleIDVal interface{}
	if vehicleID.Valid {
		vehicleIDVal = vehicleID.Int64
	}

	var serviceRecordIDVal interface{}
	if serviceRecordID.Valid {
		serviceRecordIDVal = serviceRecordID.Int64
	}

	var purchasedDateVal interface{}
	if purchasedDate.Valid && purchasedDate.String != "" {
		purchasedDateVal = purchasedDate.String
	}

	result, err := config.DB.Exec(`
		INSERT INTO parts_purchased 
		(purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
		 quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
		 status, ordered_date, added_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.PurchaseOrderID, category, vehicleIDVal, serviceRecordIDVal, req.PartName, vendorIDVal,
		req.Quantity, req.UnitPrice, totalPrice, req.WarrantyMonths,
		invoiceNumber, purchasedDateVal,
		status, purchasedDateVal, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add product: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	if serviceRecordID.Valid && serviceRecordID.Int64 > 0 {
		recalcServiceCost(int(serviceRecordID.Int64))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product added to order", "id": id})
}

// RemoveProductFromOrder removes a single product from an order
func RemoveProductFromOrder(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required"})
		return
	}

	// Get service record ID and order ID before deleting
	var serviceRecordID sql.NullInt64
	var orderID int
	config.DB.QueryRow(`SELECT service_record_id, COALESCE(purchase_order_id, 0) FROM parts_purchased WHERE id = ?`, id).Scan(&serviceRecordID, &orderID)

	_, err := config.DB.Exec(`DELETE FROM parts_purchased WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete product: " + err.Error()})
		return
	}

	// If order has no more products, delete the empty order too
	if orderID > 0 {
		var remaining int
		config.DB.QueryRow(`SELECT COUNT(*) FROM parts_purchased WHERE purchase_order_id = ?`, orderID).Scan(&remaining)
		if remaining == 0 {
			config.DB.Exec(`DELETE FROM purchase_orders WHERE id = ?`, orderID)
		}
	}

	if serviceRecordID.Valid && serviceRecordID.Int64 > 0 {
		recalcServiceCost(int(serviceRecordID.Int64))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product removed from order"})
}

// scanPurchaseOrders is a helper to scan purchase order rows
func scanPurchaseOrders(rows *sql.Rows) []models.PurchaseOrder {
	var orders []models.PurchaseOrder
	for rows.Next() {
		var po models.PurchaseOrder
		var addedBy sql.NullInt64
		var vendorID sql.NullInt64
		var vehicleID sql.NullInt64
		var serviceRecordID sql.NullInt64

		if err := rows.Scan(
			&po.ID, &po.Category, &vehicleID, &serviceRecordID,
			&vendorID,
			&po.VendorName, &po.VendorContact, &po.VendorAddress, &po.VendorGST,
			&po.InvoiceNumber, &po.PurchasedDate,
			&po.Status,
			&po.OrderedDate, &po.ReceivedDate, &po.ReturnedDate, &po.CancelledDate,
			&po.Notes,
			&addedBy, &po.AddedByName,
			&po.CreatedAt, &po.UpdatedAt,
			&po.VehicleNumber, &po.VehicleName, &po.ServiceTitle,
			&po.TotalAmount, &po.ProductCount,
		); err != nil {
			continue
		}

		if vehicleID.Valid {
			v := int(vehicleID.Int64)
			po.VehicleID = &v
		}
		if serviceRecordID.Valid {
			v := int(serviceRecordID.Int64)
			po.ServiceRecordID = &v
		}
		if vendorID.Valid {
			v := int(vendorID.Int64)
			po.VendorID = &v
		}
		if addedBy.Valid {
			v := int(addedBy.Int64)
			po.AddedBy = &v
		}

		if po.Category == "" {
			po.Category = models.PurchaseCategoryRepairService
		}

		po.Products = []models.PartPurchased{}
		orders = append(orders, po)
	}

	if orders == nil {
		orders = []models.PurchaseOrder{}
	}
	return orders
}

// getProductsForOrder returns all products for a given purchase order
func getProductsForOrder(orderID int) []models.PartPurchased {
	query := "SELECT " + partsSelectColumns + partsFromJoins + " WHERE p.purchase_order_id = ? ORDER BY p.id ASC"
	rows, err := config.DB.Query(query, orderID)
	if err != nil {
		return []models.PartPurchased{}
	}
	defer rows.Close()
	return scanParts(rows)
}
