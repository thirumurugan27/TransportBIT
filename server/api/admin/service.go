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
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(vt.type, ''),
			COALESCE(st.name, ''), COALESCE(reporter.full_name, ''), COALESCE(adm.full_name, '')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
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
			COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''), COALESCE(vt.type, ''),
			COALESCE(st.name, ''), COALESCE(reporter.full_name, ''), COALESCE(adm.full_name, '')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
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

	// Accept optional replacement vehicle
	var body struct {
		ReplacementVehicleID *int   `json:"replacement_vehicle_id"`
		ReplacementEndDate   string `json:"replacement_end_date"`
	}
	c.ShouldBindJSON(&body)

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

	// If a replacement vehicle was selected, create a vehicle replacement record
	if body.ReplacementVehicleID != nil && *body.ReplacementVehicleID > 0 {
		endDate := body.ReplacementEndDate
		if endDate == "" {
			// Default: 30 days from now
			endDate = time.Now().AddDate(0, 0, 30).Format("2006-01-02")
		}
		startDate := time.Now().Format("2006-01-02")

		// Find the driver assigned to this vehicle
		var driverID int
		err := config.DB.QueryRow(`
			SELECT d.id FROM assignments a 
			JOIN drivers d ON a.driver_id = d.id
			WHERE a.vehicle_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
			LIMIT 1
		`, vehicleID).Scan(&driverID)

		if err != nil {
			// Try EV cluster
			config.DB.QueryRow(`
				SELECT dcm.driver_id FROM ev_assignments ev
				JOIN driver_clusters dc ON ev.cluster_id = dc.id
				JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
				WHERE ev.vehicle_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date
				AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
				LIMIT 1
			`, vehicleID).Scan(&driverID)
		}

		if driverID > 0 {
			adminID, _ := c.Get("user_id")
			adminIDInt, _ := adminID.(int)

			result, _ := config.DB.Exec(`
				INSERT INTO vehicle_replacements 
				(vehicle_id, replacement_vehicle_id, driver_id, reason, service_record_id, start_date, end_date, status, requested_by_role, requested_by_id)
				VALUES (?, ?, ?, 'service_repair', ?, ?, ?, 'approved', 'admin', ?)
			`, vehicleID, *body.ReplacementVehicleID, driverID, idInt, startDate, endDate, adminIDInt)

			if result != nil {
				replacementID, _ := result.LastInsertId()
				// Activate the replacement (temp assignment, group updates, notifications)
				go activateVehicleReplacement(int(replacementID), VehicleReplacementRequest{
					VehicleID:            vehicleID,
					ReplacementVehicleID: body.ReplacementVehicleID,
					DriverID:             driverID,
					StartDate:            startDate,
					EndDate:              endDate,
					Reason:               "service_repair",
					ServiceRecordID:      &idInt,
				})
			}
		}
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

	// Set vehicle status back to available
	var vehicleID int
	tx.QueryRow(`SELECT vehicle_id FROM service_records WHERE id = ?`, idInt).Scan(&vehicleID)
	_, err = tx.Exec(`UPDATE vehicles SET status = 'available' WHERE id = ?`, vehicleID)
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

	// Auto-complete any linked vehicle replacements
	go func() {
		rows, err := config.DB.Query(`
			SELECT id FROM vehicle_replacements 
			WHERE service_record_id = ? AND status IN ('approved', 'pending')
		`, idInt)
		if err != nil {
			return
		}
		defer rows.Close()
		for rows.Next() {
			var vrID int
			rows.Scan(&vrID)
			// Reuse the complete logic
			var vID, dID int
			var rvID sql.NullInt64
			var reason string
			config.DB.QueryRow(`
				SELECT vehicle_id, driver_id, replacement_vehicle_id, reason 
				FROM vehicle_replacements WHERE id = ?
			`, vrID).Scan(&vID, &dID, &rvID, &reason)
			config.DB.Exec("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", vrID)
			if rvID.Valid {
				config.DB.Exec(`
					UPDATE temporary_assignments SET status = 'completed' 
					WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
				`, dID, rvID.Int64)
			}
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Service completed, vehicle status set to available"})
}

// CancelServiceRecord cancels a service record (from reported, approved, or in_progress)
func CancelServiceRecord(c *gin.Context) {
	id := c.Param("id")
	idInt, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service record ID"})
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)

	// Get current status and vehicle ID
	var currentStatus string
	var vehicleID int
	err = config.DB.QueryRow(`SELECT status, vehicle_id FROM service_records WHERE id = ?`, idInt).Scan(&currentStatus, &vehicleID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service record not found"})
		return
	}

	// Only allow cancel from certain states
	if currentStatus == "completed" || currentStatus == "cancelled" || currentStatus == "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel a service that is already " + currentStatus})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	// Cancel the service record
	_, err = tx.Exec(`
		UPDATE service_records SET status = 'cancelled', admin_remarks = ?
		WHERE id = ?
	`, body.Reason, idInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel service: " + err.Error()})
		return
	}

	// If it was in_progress, restore the vehicle to available
	if currentStatus == "in_progress" {
		_, err = tx.Exec(`UPDATE vehicles SET status = 'available' WHERE id = ?`, vehicleID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore vehicle status: " + err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit: " + err.Error()})
		return
	}

	// Cleanup linked vehicle replacements
	go func() {
		rows, err := config.DB.Query(`
			SELECT id, driver_id, replacement_vehicle_id FROM vehicle_replacements 
			WHERE service_record_id = ? AND status IN ('approved', 'pending')
		`, idInt)
		if err != nil {
			return
		}
		defer rows.Close()
		for rows.Next() {
			var vrID, dID int
			var rvID sql.NullInt64
			rows.Scan(&vrID, &dID, &rvID)
			config.DB.Exec("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", vrID)
			if rvID.Valid {
				config.DB.Exec(`
					UPDATE temporary_assignments SET status = 'completed' 
					WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
				`, dID, rvID.Int64)
			}
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Service cancelled successfully"})
}

// GetLinkedPurchases returns purchase orders linked to a service record
func GetLinkedPurchases(c *gin.Context) {
	id := c.Param("id")

	type LinkedOrder struct {
		ID            int     `json:"id"`
		InvoiceNumber string  `json:"invoice_number"`
		Total         float64 `json:"total"`
		ProductCount  int     `json:"product_count"`
	}

	rows, err := config.DB.Query(`
		SELECT po.id, COALESCE(po.invoice_number, ''),
		       COALESCE(SUM(p.total_price), 0), COUNT(p.id)
		FROM purchase_orders po
		LEFT JOIN parts_purchased p ON p.purchase_order_id = po.id
		WHERE po.service_record_id = ?
		GROUP BY po.id, po.invoice_number
	`, id)

	var orders []LinkedOrder
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var o LinkedOrder
			rows.Scan(&o.ID, &o.InvoiceNumber, &o.Total, &o.ProductCount)
			orders = append(orders, o)
		}
	}
	if orders == nil {
		orders = []LinkedOrder{}
	}

	c.JSON(http.StatusOK, gin.H{"count": len(orders), "orders": orders})
}

// DeleteServiceRecord deletes a service record
func DeleteServiceRecord(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Service record ID is required"})
		return
	}

	deletePurchases := c.Query("delete_purchases") == "true"

	// Check if vehicle needs status restore
	var status string
	var vehicleID int
	config.DB.QueryRow(`SELECT status, vehicle_id FROM service_records WHERE id = ?`, id).Scan(&status, &vehicleID)
	if status == "in_progress" {
		config.DB.Exec(`UPDATE vehicles SET status = 'available' WHERE id = ?`, vehicleID)
	}

	if deletePurchases {
		// Delete invoices for linked purchase orders
		config.DB.Exec(`
			DELETE pi FROM purchase_invoices pi
			INNER JOIN purchase_orders po ON pi.purchase_order_id = po.id
			WHERE po.service_record_id = ?
		`, id)
		// Delete parts linked to purchase orders for this service
		config.DB.Exec(`
			DELETE p FROM parts_purchased p
			INNER JOIN purchase_orders po ON p.purchase_order_id = po.id
			WHERE po.service_record_id = ?
		`, id)
		// Delete standalone parts linked directly to this service
		config.DB.Exec(`DELETE FROM parts_purchased WHERE service_record_id = ?`, id)
		// Delete purchase orders
		config.DB.Exec(`DELETE FROM purchase_orders WHERE service_record_id = ?`, id)
	} else {
		// Nullify — keep purchases but unlink them from this service record
		config.DB.Exec(`UPDATE purchase_orders SET service_record_id = NULL WHERE service_record_id = ?`, id)
		config.DB.Exec(`UPDATE parts_purchased SET service_record_id = NULL WHERE service_record_id = ?`, id)
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

	// Completed in last 30 days
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM service_records 
		WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
	`).Scan(&stats.CompletedMonth)

	// Total cost in last 30 days
	config.DB.QueryRow(`
		SELECT COALESCE(SUM(total_cost), 0) FROM service_records 
		WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
			COALESCE(vt.type, ''),
			CAST(COALESCE((SELECT MAX(k.end_km) FROM km_logs k WHERE k.vehicle_id = vst.vehicle_id), 0) AS SIGNED) as current_km
		FROM vehicle_service_tracking vst
		LEFT JOIN vehicles v ON vst.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		ORDER BY vt.type, v.vehicle_number
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
	if serviceRecordID <= 0 {
		return
	}

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
		messageText = fmt.Sprintf("Service '%s' for your vehicle has been completed. Vehicle is now available.", serviceTitle)
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
