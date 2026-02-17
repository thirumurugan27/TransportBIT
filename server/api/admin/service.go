package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// ==========================================
// SERVICE TYPE HANDLERS (Master Data)
// ==========================================

// GetServiceTypes returns all service types
func GetServiceTypes(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, name, COALESCE(description, ''), estimated_duration_hours, is_active, 
		       DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p')
		FROM service_types
		ORDER BY name ASC
	`)
	if err != nil {
		c.JSON(http.StatusOK, []models.ServiceType{})
		return
	}
	defer rows.Close()

	var types []models.ServiceType
	for rows.Next() {
		var st models.ServiceType
		if err := rows.Scan(&st.ID, &st.Name, &st.Description, &st.EstimatedDurationHours, &st.IsActive, &st.CreatedAt); err != nil {
			continue
		}
		types = append(types, st)
	}
	if types == nil {
		types = []models.ServiceType{}
	}
	c.JSON(http.StatusOK, types)
}

// CreateServiceType creates a new service type
func CreateServiceType(c *gin.Context) {
	var req models.CreateServiceTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service type name is required"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO service_types (name, description, estimated_duration_hours)
		VALUES (?, ?, ?)
	`, req.Name, req.Description, req.EstimatedDurationHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service type: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"message": "Service type created successfully", "id": id})
}

// UpdateServiceType updates an existing service type
func UpdateServiceType(c *gin.Context) {
	var req models.UpdateServiceTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE service_types SET name = ?, description = ?, estimated_duration_hours = ?, is_active = ?
		WHERE id = ?
	`, req.Name, req.Description, req.EstimatedDurationHours, req.IsActive, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service type: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service type updated successfully"})
}

// DeleteServiceType deletes a service type
func DeleteServiceType(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service type ID is required"})
		return
	}

	_, err := config.DB.Exec(`DELETE FROM service_types WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete service type: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service type deleted successfully"})
}

// ==========================================
// SERVICE RECORD HANDLERS
// ==========================================

// GetAllServiceRecords returns all service records with filters
func GetAllServiceRecords(c *gin.Context) {
	statusFilter := c.Query("status")
	vehicleFilter := c.Query("vehicle_id")
	severityFilter := c.Query("severity")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	query := `
		SELECT 
			sr.id, sr.vehicle_id, sr.service_type_id, sr.reported_by, sr.assigned_to_admin,
			sr.title, COALESCE(sr.description, ''), sr.severity, sr.status,
			sr.odometer_at_service, 
			DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), 
			DATE_FORMAT(sr.started_at, '%d-%m-%Y %h:%i %p'), 
			DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(sr.workshop_name, ''), COALESCE(sr.mechanic_name, ''), COALESCE(sr.mechanic_contact, ''),
			sr.labor_cost, sr.parts_cost, sr.total_cost,
			DATE_FORMAT(sr.next_service_date, '%d-%m-%Y'), sr.next_service_km,
			COALESCE(sr.admin_remarks, ''), COALESCE(sr.rejection_reason, ''),
			DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p'), 
			DATE_FORMAT(sr.updated_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(v.vehicle_type, ''),
			COALESCE(st.name, ''), COALESCE(reporter.full_name, ''), COALESCE(adm.full_name, '')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN service_types st ON sr.service_type_id = st.id
		LEFT JOIN users reporter ON sr.reported_by = reporter.id
		LEFT JOIN users adm ON sr.assigned_to_admin = adm.id
		WHERE 1=1
	`
	var args []interface{}

	if statusFilter != "" {
		query += " AND sr.status = ?"
		args = append(args, statusFilter)
	}
	if vehicleFilter != "" {
		query += " AND sr.vehicle_id = ?"
		args = append(args, vehicleFilter)
	}
	if severityFilter != "" {
		query += " AND sr.severity = ?"
		args = append(args, severityFilter)
	}
	if dateFrom != "" {
		query += " AND sr.created_at >= ?"
		args = append(args, dateFrom)
	}
	if dateTo != "" {
		query += " AND sr.created_at <= ?"
		args = append(args, dateTo+" 23:59:59")
	}

	query += " ORDER BY sr.created_at DESC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, []models.ServiceRecord{})
		return
	}
	defer rows.Close()

	var records []models.ServiceRecord
	for rows.Next() {
		var sr models.ServiceRecord
		var serviceTypeID, reportedBy, assignedToAdmin, odometerAtService, nextServiceKm sql.NullInt64
		var scheduledDate, startedAt, completedAt, nextServiceDate sql.NullString

		if err := rows.Scan(
			&sr.ID, &sr.VehicleID, &serviceTypeID, &reportedBy, &assignedToAdmin,
			&sr.Title, &sr.Description, &sr.Severity, &sr.Status,
			&odometerAtService, &scheduledDate, &startedAt, &completedAt,
			&sr.WorkshopName, &sr.MechanicName, &sr.MechanicContact,
			&sr.LaborCost, &sr.PartsCost, &sr.TotalCost,
			&nextServiceDate, &nextServiceKm,
			&sr.AdminRemarks, &sr.RejectionReason,
			&sr.CreatedAt, &sr.UpdatedAt,
			&sr.VehicleNumber, &sr.VehicleName, &sr.VehicleType,
			&sr.ServiceTypeName, &sr.ReportedByName, &sr.AdminName,
		); err != nil {
			continue
		}

		if serviceTypeID.Valid {
			id := int(serviceTypeID.Int64)
			sr.ServiceTypeID = &id
		}
		if reportedBy.Valid {
			id := int(reportedBy.Int64)
			sr.ReportedBy = &id
		}
		if assignedToAdmin.Valid {
			id := int(assignedToAdmin.Int64)
			sr.AssignedToAdmin = &id
		}
		if odometerAtService.Valid {
			val := int(odometerAtService.Int64)
			sr.OdometerAtService = &val
		}
		if scheduledDate.Valid {
			sr.ScheduledDate = &scheduledDate.String
		}
		if startedAt.Valid {
			sr.StartedAt = &startedAt.String
		}
		if completedAt.Valid {
			sr.CompletedAt = &completedAt.String
		}
		if nextServiceDate.Valid {
			sr.NextServiceDate = &nextServiceDate.String
		}
		if nextServiceKm.Valid {
			val := int(nextServiceKm.Int64)
			sr.NextServiceKm = &val
		}

		records = append(records, sr)
	}

	if records == nil {
		records = []models.ServiceRecord{}
	}
	c.JSON(http.StatusOK, records)
}

// GetServiceRecordByID returns a single service record with its parts
func GetServiceRecordByID(c *gin.Context) {
	id := c.Param("id")

	var sr models.ServiceRecord
	var serviceTypeID, reportedBy, assignedToAdmin, odometerAtService, nextServiceKm sql.NullInt64
	var scheduledDate, startedAt, completedAt, nextServiceDate sql.NullString

	err := config.DB.QueryRow(`
		SELECT 
			sr.id, sr.vehicle_id, sr.service_type_id, sr.reported_by, sr.assigned_to_admin,
			sr.title, COALESCE(sr.description, ''), sr.severity, sr.status,
			sr.odometer_at_service, 
			DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), 
			DATE_FORMAT(sr.started_at, '%d-%m-%Y %h:%i %p'), 
			DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(sr.workshop_name, ''), COALESCE(sr.mechanic_name, ''), COALESCE(sr.mechanic_contact, ''),
			sr.labor_cost, sr.parts_cost, sr.total_cost,
			DATE_FORMAT(sr.next_service_date, '%d-%m-%Y'), sr.next_service_km,
			COALESCE(sr.admin_remarks, ''), COALESCE(sr.rejection_reason, ''),
			DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p'), 
			DATE_FORMAT(sr.updated_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(v.vehicle_type, ''),
			COALESCE(st.name, ''), COALESCE(reporter.full_name, ''), COALESCE(adm.full_name, '')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN service_types st ON sr.service_type_id = st.id
		LEFT JOIN users reporter ON sr.reported_by = reporter.id
		LEFT JOIN users adm ON sr.assigned_to_admin = adm.id
		WHERE sr.id = ?
	`, id).Scan(
		&sr.ID, &sr.VehicleID, &serviceTypeID, &reportedBy, &assignedToAdmin,
		&sr.Title, &sr.Description, &sr.Severity, &sr.Status,
		&odometerAtService, &scheduledDate, &startedAt, &completedAt,
		&sr.WorkshopName, &sr.MechanicName, &sr.MechanicContact,
		&sr.LaborCost, &sr.PartsCost, &sr.TotalCost,
		&nextServiceDate, &nextServiceKm,
		&sr.AdminRemarks, &sr.RejectionReason,
		&sr.CreatedAt, &sr.UpdatedAt,
		&sr.VehicleNumber, &sr.VehicleName, &sr.VehicleType,
		&sr.ServiceTypeName, &sr.ReportedByName, &sr.AdminName,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service record not found"})
		return
	}

	if serviceTypeID.Valid {
		v := int(serviceTypeID.Int64)
		sr.ServiceTypeID = &v
	}
	if reportedBy.Valid {
		v := int(reportedBy.Int64)
		sr.ReportedBy = &v
	}
	if assignedToAdmin.Valid {
		v := int(assignedToAdmin.Int64)
		sr.AssignedToAdmin = &v
	}
	if odometerAtService.Valid {
		v := int(odometerAtService.Int64)
		sr.OdometerAtService = &v
	}
	if scheduledDate.Valid {
		sr.ScheduledDate = &scheduledDate.String
	}
	if startedAt.Valid {
		sr.StartedAt = &startedAt.String
	}
	if completedAt.Valid {
		sr.CompletedAt = &completedAt.String
	}
	if nextServiceDate.Valid {
		sr.NextServiceDate = &nextServiceDate.String
	}
	if nextServiceKm.Valid {
		v := int(nextServiceKm.Int64)
		sr.NextServiceKm = &v
	}

	c.JSON(http.StatusOK, sr)
}

// CreateServiceRecord creates a new service record (admin-initiated)
func CreateServiceRecord(c *gin.Context) {
	var req models.CreateServiceRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if req.VehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle is required"})
		return
	}

	severity := req.Severity
	if severity == "" {
		severity = "medium"
	}

	// Get admin user ID from context
	adminID, _ := c.Get("user_id")

	result, err := config.DB.Exec(`
		INSERT INTO service_records 
		(vehicle_id, service_type_id, assigned_to_admin, title, description, severity, status,
		 odometer_at_service, scheduled_date, workshop_name, mechanic_name, mechanic_contact, labor_cost)
		VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)
	`, req.VehicleID, req.ServiceTypeID, adminID, req.Title, req.Description, severity,
		req.OdometerAtService, req.ScheduledDate, req.WorkshopName, req.MechanicName, req.MechanicContact, req.LaborCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service record: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	// Notify drivers assigned to this vehicle
	go notifyDriversOfService(int(id), req.VehicleID, req.Title, "service_scheduled")

	c.JSON(http.StatusOK, gin.H{"message": "Service record created successfully", "id": id})
}

// UpdateServiceRecord updates an existing service record
func UpdateServiceRecord(c *gin.Context) {
	var req models.UpdateServiceRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE service_records SET
			service_type_id = ?, title = ?, description = ?, severity = ?,
			odometer_at_service = ?, scheduled_date = ?,
			workshop_name = ?, mechanic_name = ?, mechanic_contact = ?,
			labor_cost = ?, admin_remarks = ?
		WHERE id = ?
	`, req.ServiceTypeID, req.Title, req.Description, req.Severity,
		req.OdometerAtService, req.ScheduledDate,
		req.WorkshopName, req.MechanicName, req.MechanicContact,
		req.LaborCost, req.AdminRemarks, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service record: " + err.Error()})
		return
	}

	// Recalculate total cost
	recalcServiceCost(req.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Service record updated successfully"})
}

// ApproveServiceRequest approves a driver-reported service request
func ApproveServiceRequest(c *gin.Context) {
	id := c.Param("id")
	idInt, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service record ID"})
		return
	}

	var body struct {
		ScheduledDate string `json:"scheduled_date"`
		AdminRemarks  string `json:"admin_remarks"`
	}
	c.ShouldBindJSON(&body)

	adminID, _ := c.Get("user_id")

	_, err = config.DB.Exec(`
		UPDATE service_records SET status = 'approved', assigned_to_admin = ?, scheduled_date = ?, admin_remarks = ?
		WHERE id = ? AND status = 'reported'
	`, adminID, body.ScheduledDate, body.AdminRemarks, idInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve service request: " + err.Error()})
		return
	}

	// Get vehicle ID and title for notification
	var vehicleID int
	var title string
	config.DB.QueryRow(`SELECT vehicle_id, title FROM service_records WHERE id = ?`, idInt).Scan(&vehicleID, &title)

	go notifyDriversOfService(idInt, vehicleID, title, "service_approved")

	c.JSON(http.StatusOK, gin.H{"message": "Service request approved"})
}

// RejectServiceRequest rejects a driver-reported service request
func RejectServiceRequest(c *gin.Context) {
	id := c.Param("id")
	idInt, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service record ID"})
		return
	}

	var body struct {
		RejectionReason string `json:"rejection_reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rejection reason is required"})
		return
	}

	_, err = config.DB.Exec(`
		UPDATE service_records SET status = 'rejected', rejection_reason = ?
		WHERE id = ? AND status = 'reported'
	`, body.RejectionReason, idInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject service request: " + err.Error()})
		return
	}

	// Notify reporting driver
	var reportedBy sql.NullInt64
	var title string
	config.DB.QueryRow(`SELECT reported_by, title FROM service_records WHERE id = ?`, idInt).Scan(&reportedBy, &title)
	if reportedBy.Valid {
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, type, title, message, is_read)
			VALUES ('DRIVER', ?, 'service_rejected', ?, ?, FALSE)
		`, reportedBy.Int64, "Service Request Rejected", fmt.Sprintf("Your service request '%s' has been rejected. Reason: %s", title, body.RejectionReason))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service request rejected"})
}

// StartServiceRecord moves status to in_progress
func StartServiceRecord(c *gin.Context) {
	id := c.Param("id")
	idInt, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service record ID"})
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	// Start the service and set vehicle to under_maintenance
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE service_records SET status = 'in_progress', started_at = ?
		WHERE id = ? AND status = 'approved'
	`, now, idInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start service: " + err.Error()})
		return
	}

	// Set vehicle status to under_maintenance
	var vehicleID int
	tx.QueryRow(`SELECT vehicle_id FROM service_records WHERE id = ?`, idInt).Scan(&vehicleID)
	_, err = tx.Exec(`UPDATE vehicles SET status = 'under_maintenance' WHERE id = ?`, vehicleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vehicle status: " + err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service started, vehicle marked under maintenance"})
}

// CompleteServiceRecord completes a service record
func CompleteServiceRecord(c *gin.Context) {
	id := c.Param("id")
	idInt, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service record ID"})
		return
	}

	var body struct {
		AdminRemarks    string  `json:"admin_remarks"`
		NextServiceDate *string `json:"next_service_date"`
		NextServiceKm   *int    `json:"next_service_km"`
		LaborCost       float64 `json:"labor_cost"`
	}
	c.ShouldBindJSON(&body)

	now := time.Now().Format("2006-01-02 15:04:05")

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	// Update labor cost first if provided
	if body.LaborCost > 0 {
		tx.Exec(`UPDATE service_records SET labor_cost = ? WHERE id = ?`, body.LaborCost, idInt)
	}

	// Calculate total parts cost
	var partsCost float64
	tx.QueryRow(`SELECT COALESCE(SUM(total_price), 0) FROM parts_purchased WHERE service_record_id = ?`, idInt).Scan(&partsCost)

	// Get labor cost
	var laborCost float64
	tx.QueryRow(`SELECT labor_cost FROM service_records WHERE id = ?`, idInt).Scan(&laborCost)
	totalCost := laborCost + partsCost

	// Complete the service record
	_, err = tx.Exec(`
		UPDATE service_records SET 
			status = 'completed', completed_at = ?, admin_remarks = ?,
			next_service_date = ?, next_service_km = ?,
			parts_cost = ?, total_cost = ?
		WHERE id = ? AND (status = 'in_progress' OR status = 'approved')
	`, now, body.AdminRemarks, body.NextServiceDate, body.NextServiceKm, partsCost, totalCost, idInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete service: " + err.Error()})
		return
	}

	// Set vehicle status back to active
	var vehicleID int
	tx.QueryRow(`SELECT vehicle_id FROM service_records WHERE id = ?`, idInt).Scan(&vehicleID)
	_, err = tx.Exec(`UPDATE vehicles SET status = 'active' WHERE id = ?`, vehicleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore vehicle status: " + err.Error()})
		return
	}

	// Auto-reset service tracking KM for this vehicle
	var currentKm int
	tx.QueryRow(`SELECT COALESCE(MAX(end_km), 0) FROM km_logs WHERE vehicle_id = ?`, vehicleID).Scan(&currentKm)
	// Also check odometer_at_service if higher
	var odometerAtService sql.NullInt64
	tx.QueryRow(`SELECT odometer_at_service FROM service_records WHERE id = ?`, idInt).Scan(&odometerAtService)
	if odometerAtService.Valid && int(odometerAtService.Int64) > currentKm {
		currentKm = int(odometerAtService.Int64)
	}
	tx.Exec(`
		UPDATE vehicle_service_tracking SET last_serviced_km = ?, last_service_date = CURDATE(), updated_at = NOW()
		WHERE vehicle_id = ?
	`, currentKm, vehicleID)

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit: " + err.Error()})
		return
	}

	// Notify drivers
	var title string
	config.DB.QueryRow(`SELECT title FROM service_records WHERE id = ?`, idInt).Scan(&title)
	go notifyDriversOfService(idInt, vehicleID, title, "service_completed")

	c.JSON(http.StatusOK, gin.H{"message": "Service completed, vehicle restored to active"})
}

// DeleteServiceRecord deletes a service record
func DeleteServiceRecord(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service record ID is required"})
		return
	}

	// Check if vehicle needs status restore
	var status string
	var vehicleID int
	config.DB.QueryRow(`SELECT status, vehicle_id FROM service_records WHERE id = ?`, id).Scan(&status, &vehicleID)
	if status == "in_progress" {
		config.DB.Exec(`UPDATE vehicles SET status = 'active' WHERE id = ?`, vehicleID)
	}

	_, err := config.DB.Exec(`DELETE FROM service_records WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete service record: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service record deleted successfully"})
}

// GetServiceStats returns dashboard statistics
func GetServiceStats(c *gin.Context) {
	var stats models.ServiceStats

	// Total services
	config.DB.QueryRow(`SELECT COUNT(*) FROM service_records`).Scan(&stats.TotalServices)

	// Active services (approved + in_progress)
	config.DB.QueryRow(`SELECT COUNT(*) FROM service_records WHERE status IN ('approved', 'in_progress')`).Scan(&stats.ActiveServices)

	// Pending requests (reported)
	config.DB.QueryRow(`SELECT COUNT(*) FROM service_records WHERE status = 'reported'`).Scan(&stats.PendingRequests)

	// Completed this month
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM service_records 
		WHERE status = 'completed' AND MONTH(completed_at) = MONTH(NOW()) AND YEAR(completed_at) = YEAR(NOW())
	`).Scan(&stats.CompletedMonth)

	// Total cost this month
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_cost), 0) FROM service_records 
		WHERE status = 'completed' AND MONTH(completed_at) = MONTH(NOW()) AND YEAR(completed_at) = YEAR(NOW())
	`).Scan(&stats.TotalCostMonth)

	// Overdue reminders (KM-based: where current_km >= next_service_km)
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicle_service_tracking vst
		WHERE vst.next_service_km <= COALESCE((SELECT MAX(k.end_km) FROM km_logs k WHERE k.vehicle_id = vst.vehicle_id), 0)
	`).Scan(&stats.OverdueReminders)

	c.JSON(http.StatusOK, stats)
}

// ==========================================
// VEHICLE SERVICE TRACKING HANDLERS
// ==========================================

// GetServiceTracking returns all vehicles with their KM-based service status
func GetServiceTracking(c *gin.Context) {
	// Auto-initialize any vehicles that don't have a tracking entry
	config.DB.Exec(`
		INSERT IGNORE INTO vehicle_service_tracking (vehicle_id, last_serviced_km, next_service_km)
		SELECT v.id, 0, 10000
		FROM vehicles v
		WHERE v.id NOT IN (SELECT vehicle_id FROM vehicle_service_tracking)
	`)

	rows, err := config.DB.Query(`
		SELECT 
			vst.id, vst.vehicle_id, vst.last_serviced_km, vst.next_service_km,
			COALESCE(DATE_FORMAT(vst.last_service_date, '%d-%m-%Y'), ''),
			COALESCE(DATE_FORMAT(vst.next_service_date, '%d-%m-%Y'), ''),
			COALESCE(vst.notes, ''),
			DATE_FORMAT(vst.created_at, '%d-%m-%Y %h:%i %p'), 
			DATE_FORMAT(vst.updated_at, '%d-%m-%Y %h:%i %p'),
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''),
			COALESCE(v.vehicle_type, ''),
			CAST(COALESCE((SELECT MAX(k.end_km) FROM km_logs k WHERE k.vehicle_id = vst.vehicle_id), 0) AS SIGNED) as current_km
		FROM vehicle_service_tracking vst
		LEFT JOIN vehicles v ON vst.vehicle_id = v.id
		ORDER BY v.vehicle_type, v.vehicle_number
	`)
	if err != nil {
		log.Printf("[GetServiceTracking] Query error: %v", err)
		c.JSON(http.StatusOK, []models.VehicleServiceTracking{})
		return
	}
	defer rows.Close()

	var list []models.VehicleServiceTracking
	for rows.Next() {
		var r models.VehicleServiceTracking
		if err := rows.Scan(
			&r.ID, &r.VehicleID, &r.LastServicedKm, &r.NextServiceKm,
			&r.LastServiceDate, &r.NextServiceDate, &r.Notes,
			&r.CreatedAt, &r.UpdatedAt,
			&r.VehicleNumber, &r.VehicleName, &r.VehicleType, &r.CurrentKm,
		); err != nil {
			log.Printf("[GetServiceTracking] Scan error: %v", err)
			continue
		}

		// Compute remaining km
		r.RemainingKm = r.NextServiceKm - r.CurrentKm

		// Determine status
		if r.RemainingKm <= 0 {
			r.Status = "overdue"
		} else if r.RemainingKm <= 100 {
			r.Status = "danger"
		} else if r.RemainingKm <= 300 {
			r.Status = "warning"
		} else {
			r.Status = "on_track"
		}

		list = append(list, r)
	}

	if list == nil {
		list = []models.VehicleServiceTracking{}
	}
	c.JSON(http.StatusOK, list)
}

// UpdateServiceTracking updates service tracking data for a vehicle
func UpdateServiceTracking(c *gin.Context) {
	var req models.UpdateServiceTrackingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.VehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID is required"})
		return
	}

	if req.NextServiceKm <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Next service KM must be greater than 0"})
		return
	}

	// Build update with optional date fields
	var lastDateSQL, nextDateSQL interface{}
	if req.LastServiceDate != "" {
		lastDateSQL = req.LastServiceDate
	} else {
		lastDateSQL = nil
	}
	if req.NextServiceDate != "" {
		nextDateSQL = req.NextServiceDate
	} else {
		nextDateSQL = nil
	}

	result, err := config.DB.Exec(`
		UPDATE vehicle_service_tracking 
		SET last_serviced_km = ?, next_service_km = ?, 
		    last_service_date = ?, next_service_date = ?,
		    notes = ?, updated_at = NOW()
		WHERE vehicle_id = ?
	`, req.LastServicedKm, req.NextServiceKm, lastDateSQL, nextDateSQL, req.Notes, req.VehicleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update: " + err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// Insert if not exists
		_, err = config.DB.Exec(`
			INSERT INTO vehicle_service_tracking (vehicle_id, last_serviced_km, next_service_km, last_service_date, next_service_date, notes)
			VALUES (?, ?, ?, ?, ?, ?)
		`, req.VehicleID, req.LastServicedKm, req.NextServiceKm, lastDateSQL, nextDateSQL, req.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tracking: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service tracking updated successfully"})
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// recalcServiceCost recalculates parts_cost and total_cost for a service record
func recalcServiceCost(serviceRecordID int) {
	var partsCost float64
	config.DB.QueryRow(`SELECT COALESCE(SUM(total_price), 0) FROM parts_purchased WHERE service_record_id = ?`, serviceRecordID).Scan(&partsCost)

	var laborCost float64
	config.DB.QueryRow(`SELECT labor_cost FROM service_records WHERE id = ?`, serviceRecordID).Scan(&laborCost)

	totalCost := laborCost + partsCost
	config.DB.Exec(`UPDATE service_records SET parts_cost = ?, total_cost = ? WHERE id = ?`, partsCost, totalCost, serviceRecordID)
}

// notifyDriversOfService sends notifications to drivers assigned to a vehicle
func notifyDriversOfService(serviceID int, vehicleID int, serviceTitle string, notifType string) {
	// Find drivers currently assigned to this vehicle
	rows, err := config.DB.Query(`
		SELECT DISTINCT d.user_id FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		WHERE a.vehicle_id = ? AND a.status = 'active' AND (a.end_date IS NULL OR a.end_date >= CURDATE())
	`, vehicleID)
	if err != nil {
		return
	}
	defer rows.Close()

	var titleText, messageText string
	switch notifType {
	case "service_scheduled":
		titleText = "Vehicle Service Scheduled"
		messageText = fmt.Sprintf("Service '%s' has been scheduled for your assigned vehicle.", serviceTitle)
	case "service_approved":
		titleText = "Service Request Approved"
		messageText = fmt.Sprintf("Your service request '%s' has been approved.", serviceTitle)
	case "service_completed":
		titleText = "Service Completed"
		messageText = fmt.Sprintf("Service '%s' for your vehicle has been completed. Vehicle is now active.", serviceTitle)
	default:
		titleText = "Service Update"
		messageText = fmt.Sprintf("Update for service: %s", serviceTitle)
	}

	for rows.Next() {
		var userID int
		rows.Scan(&userID)
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, type, title, message, reference_id, is_read)
			VALUES ('DRIVER', ?, ?, ?, ?, ?, FALSE)
		`, userID, notifType, titleText, messageText, serviceID)
	}
}
