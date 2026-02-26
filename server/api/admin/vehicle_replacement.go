package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/* =========================
   VEHICLE REPLACEMENT HANDLERS
========================= */

// VehicleReplacementRequest - request body for creating a replacement
type VehicleReplacementRequest struct {
	VehicleID            int    `json:"vehicle_id"`
	ReplacementVehicleID *int   `json:"replacement_vehicle_id"`
	DriverID             int    `json:"driver_id"`
	StartDate            string `json:"start_date"`
	EndDate              string `json:"end_date"`
	Reason               string `json:"reason"`
	ServiceRecordID      *int   `json:"service_record_id"`
	Notes                string `json:"notes"`
	RequestedByRole      string `json:"requested_by_role"`
	RequestedByID        int    `json:"requested_by_id"`
	ReplacementType      string `json:"replacement_type"`
	ReplacementDriverID  *int   `json:"replacement_driver_id"`
}

// VehicleReplacementResponse - full response with joined details
type VehicleReplacementResponse struct {
	ID                    int     `json:"id"`
	VehicleID             int     `json:"vehicle_id"`
	VehicleNumber         string  `json:"vehicle_number"`
	VehicleType           string  `json:"vehicle_type"`
	VehicleName           string  `json:"vehicle_name"`
	ReplacementVehicleID  *int    `json:"replacement_vehicle_id"`
	ReplacementVehicleNum *string `json:"replacement_vehicle_number"`
	DriverID              *int    `json:"driver_id"`
	DriverName            *string `json:"driver_name"`
	Reason                string  `json:"reason"`
	ServiceRecordID       *int    `json:"service_record_id"`
	ServiceTitle          *string `json:"service_title"`
	StartDate             string  `json:"start_date"`
	EndDate               string  `json:"end_date"`
	Status                string  `json:"status"`
	Notes                 *string `json:"notes"`
	RequestedByRole       string  `json:"requested_by_role"`
	RequestedByID         int     `json:"requested_by_id"`
	ApprovedByID          *int    `json:"approved_by_id"`
	DriverNotified        bool    `json:"driver_notified"`
	CreatedAt             string  `json:"created_at"`
	DaysRemaining         int     `json:"days_remaining"`
	ReplacementType       string  `json:"replacement_type"`
	ReplacementDriverID   *int    `json:"replacement_driver_id"`
	ReplacementDriverName *string `json:"replacement_driver_name"`
}

// GET /api/admin/vehicle-replacements - Get all vehicle replacement requests
func GetVehicleReplacements(c *gin.Context) {
	status := c.Query("status")

	query := `
		SELECT 
			r.id, r.vehicle_id, v.vehicle_number, v.vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number),
			r.replacement_vehicle_id, rv.vehicle_number,
			r.driver_id, u.full_name,
			r.reason, r.service_record_id, sr.title,
			DATE_FORMAT(r.start_date, '%d-%m-%Y'),
			DATE_FORMAT(r.end_date, '%d-%m-%Y'),
			r.status, r.notes, r.requested_by_role, r.requested_by_id,
			r.approved_by_id, r.driver_notified,
			DATE_FORMAT(r.created_at, '%d-%m-%Y %h:%i %p'),
			DATEDIFF(r.end_date, CURDATE()),
			r.replacement_type, r.replacement_driver_id, ru.full_name
		FROM vehicle_replacements r
		JOIN vehicles v ON r.vehicle_id = v.id
		LEFT JOIN vehicles rv ON r.replacement_vehicle_id = rv.id
		LEFT JOIN drivers d ON r.driver_id = d.id
		LEFT JOIN users u ON d.user_id = u.id
		LEFT JOIN service_records sr ON r.service_record_id = sr.id
		LEFT JOIN drivers rd ON r.replacement_driver_id = rd.id
		LEFT JOIN users ru ON rd.user_id = ru.id
	`

	if status != "" && status != "all" {
		query += " WHERE r.status = '" + status + "'"
	}

	query += " ORDER BY r.created_at DESC"

	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("Get vehicle replacements error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var requests []VehicleReplacementResponse
	for rows.Next() {
		var r VehicleReplacementResponse
		err := rows.Scan(
			&r.ID, &r.VehicleID, &r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.ReplacementVehicleID, &r.ReplacementVehicleNum,
			&r.DriverID, &r.DriverName,
			&r.Reason, &r.ServiceRecordID, &r.ServiceTitle,
			&r.StartDate, &r.EndDate,
			&r.Status, &r.Notes, &r.RequestedByRole, &r.RequestedByID,
			&r.ApprovedByID, &r.DriverNotified,
			&r.CreatedAt, &r.DaysRemaining,
			&r.ReplacementType, &r.ReplacementDriverID, &r.ReplacementDriverName,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		requests = append(requests, r)
	}

	if requests == nil {
		requests = []VehicleReplacementResponse{}
	}
	c.JSON(http.StatusOK, requests)
}

// POST /api/admin/vehicle-replacements/create - Create vehicle replacement request
func CreateVehicleReplacement(c *gin.Context) {
	var req VehicleReplacementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate dates
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date"})
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date"})
		return
	}
	if endDate.Before(startDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End date must be after start date"})
		return
	}

	// Admin requests are auto-approved
	status := "pending"
	if req.RequestedByRole == "admin" {
		status = "approved"
	}

	// Default replacement_type to "vehicle" if empty
	if req.ReplacementType == "" {
		req.ReplacementType = "vehicle"
	}

	result, err := config.DB.Exec(`
		INSERT INTO vehicle_replacements 
		(vehicle_id, replacement_vehicle_id, driver_id, reason, service_record_id, start_date, end_date, status, notes, requested_by_role, requested_by_id, replacement_type, replacement_driver_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleID, req.ReplacementVehicleID, req.DriverID, req.Reason, req.ServiceRecordID,
		req.StartDate, req.EndDate, status, req.Notes, req.RequestedByRole, req.RequestedByID,
		req.ReplacementType, req.ReplacementDriverID)

	if err != nil {
		log.Printf("Create vehicle replacement error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	requestID, _ := result.LastInsertId()

	// If admin created, activate immediately based on replacement type
	if req.RequestedByRole == "admin" {
		if req.ReplacementType == "driver" && req.ReplacementDriverID != nil {
			activateDriverReplacement(int(requestID), req)
		} else if req.ReplacementType == "vehicle" && req.ReplacementVehicleID != nil {
			activateVehicleReplacement(int(requestID), req)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Vehicle replacement request created successfully",
		"id":      requestID,
		"status":  status,
	})
}

// POST /api/admin/vehicle-replacements/approve - Approve replacement request
func ApproveVehicleReplacement(c *gin.Context) {
	var req struct {
		RequestID            int  `json:"request_id"`
		ReplacementVehicleID int  `json:"replacement_vehicle_id"`
		ReplacementDriverID  *int `json:"replacement_driver_id"`
		ApprovedByID         int  `json:"approved_by_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var vehicleID, driverID int
	var startDate, endDate, reason, replacementType string
	var serviceRecordID sql.NullInt64
	err := config.DB.QueryRow(`
		SELECT vehicle_id, driver_id, start_date, end_date, reason, service_record_id, replacement_type
		FROM vehicle_replacements WHERE id = ?
	`, req.RequestID).Scan(&vehicleID, &driverID, &startDate, &endDate, &reason, &serviceRecordID, &replacementType)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	var srid *int
	if serviceRecordID.Valid {
		v := int(serviceRecordID.Int64)
		srid = &v
	}

	if replacementType == "driver" {
		// Driver replacement: update replacement_driver_id
		if req.ReplacementDriverID == nil || *req.ReplacementDriverID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Replacement driver is required"})
			return
		}
		_, err = config.DB.Exec(`
			UPDATE vehicle_replacements 
			SET status = 'approved', replacement_driver_id = ?, approved_by_id = ?
			WHERE id = ?
		`, *req.ReplacementDriverID, req.ApprovedByID, req.RequestID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		activateDriverReplacement(req.RequestID, VehicleReplacementRequest{
			VehicleID:           vehicleID,
			DriverID:            driverID,
			ReplacementDriverID: req.ReplacementDriverID,
			StartDate:           startDate,
			EndDate:             endDate,
			Reason:              reason,
			ServiceRecordID:     srid,
			ReplacementType:     "driver",
		})
	} else {
		// Vehicle replacement: update replacement_vehicle_id
		_, err = config.DB.Exec(`
			UPDATE vehicle_replacements 
			SET status = 'approved', replacement_vehicle_id = ?, approved_by_id = ?
			WHERE id = ?
		`, req.ReplacementVehicleID, req.ApprovedByID, req.RequestID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		activateVehicleReplacement(req.RequestID, VehicleReplacementRequest{
			VehicleID:            vehicleID,
			ReplacementVehicleID: &req.ReplacementVehicleID,
			DriverID:             driverID,
			StartDate:            startDate,
			EndDate:              endDate,
			Reason:               reason,
			ServiceRecordID:      srid,
			ReplacementType:      "vehicle",
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Replacement approved and activated"})
}

// activateVehicleReplacement - Internal: handles vehicle swap, temp assignment, group updates, notifications
func activateVehicleReplacement(requestID int, req VehicleReplacementRequest) {
	// 1. Set original vehicle to under_maintenance
	_, err := config.DB.Exec("UPDATE vehicles SET status = 'under_maintenance' WHERE id = ?", req.VehicleID)
	if err != nil {
		log.Printf("Error updating vehicle status: %v", err)
	}

	// 2. Find driver's shift (from regular or EV assignment)
	var shiftID int
	err = config.DB.QueryRow(`
		SELECT id FROM (
			SELECT a.shift_id as id FROM assignments a
			WHERE a.driver_id = ? AND a.vehicle_id = ?
			AND CURDATE() BETWEEN a.start_date AND a.end_date
			LIMIT 1
		) sub
	`, req.DriverID, req.VehicleID).Scan(&shiftID)

	if err == sql.ErrNoRows {
		// Check EV cluster assignment
		config.DB.QueryRow(`
			SELECT COALESCE(ev.shift_id, 0)
			FROM ev_assignments ev
			JOIN driver_clusters dc ON ev.cluster_id = dc.id
			JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
			WHERE ev.vehicle_id = ? AND dcm.driver_id = ?
			AND CURDATE() BETWEEN ev.start_date AND ev.end_date
			AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
			LIMIT 1
		`, req.VehicleID, req.DriverID).Scan(&shiftID)
	}

	if shiftID == 0 {
		config.DB.QueryRow("SELECT id FROM shifts LIMIT 1").Scan(&shiftID)
	}

	// 3. Create temporary assignment with replacement vehicle
	if req.ReplacementVehicleID != nil && shiftID > 0 {
		_, err = config.DB.Exec(`
			INSERT INTO temporary_assignments 
			(original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
		`, req.DriverID, req.DriverID, *req.ReplacementVehicleID, shiftID, req.StartDate, req.EndDate,
			"Replacement: "+req.Reason)
		if err != nil {
			log.Printf("Error creating temp assignment: %v", err)
		}
	}

	// 4. Auto-add replacement vehicle to same vehicle groups temporarily
	if req.ReplacementVehicleID != nil {
		rows, err := config.DB.Query(`
			SELECT group_id, valid_from, valid_to FROM vehicle_group_members 
			WHERE vehicle_id = ? AND CURDATE() BETWEEN valid_from AND valid_to
		`, req.VehicleID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var groupID int
				var validFrom, validTo string
				rows.Scan(&groupID, &validFrom, &validTo)
				// Add replacement vehicle to the same group for the replacement period
				config.DB.Exec(`
					INSERT IGNORE INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
					VALUES (?, ?, ?, ?)
				`, groupID, *req.ReplacementVehicleID, req.StartDate, req.EndDate)
			}
		}
	}

	// 5. Notifications
	var vehicleNumber, replacementVehicleNumber, driverName string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", req.VehicleID).Scan(&vehicleNumber)
	if req.ReplacementVehicleID != nil {
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", *req.ReplacementVehicleID).Scan(&replacementVehicleNumber)
	}
	config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
	`, req.DriverID).Scan(&driverName)

	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	endDate, _ := time.Parse("2006-01-02", req.EndDate)
	days := int(endDate.Sub(startDate).Hours()/24) + 1

	message := "Your vehicle " + vehicleNumber + " is going for " + req.Reason + " from " + req.StartDate + " to " + req.EndDate + ". "
	if replacementVehicleNumber != "" {
		message += "You have been assigned " + replacementVehicleNumber + " for " + strconv.Itoa(days) + " days. "
		message += "Your original vehicle will be reassigned after this period."
	}

	config.DB.Exec(`
		INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
		VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
	`, req.DriverID, "Vehicle Replacement", message, requestID)

	config.DB.Exec("UPDATE vehicle_replacements SET driver_notified = TRUE WHERE id = ?", requestID)
}

// activateDriverReplacement - Internal: handles driver swap on the same vehicle, temp assignment, notifications
func activateDriverReplacement(requestID int, req VehicleReplacementRequest) {
	// NOTE: Vehicle stays active - do NOT set to under_maintenance

	// 1. Find original driver's shift
	var shiftID int
	err := config.DB.QueryRow(`
		SELECT id FROM (
			SELECT a.shift_id as id FROM assignments a
			WHERE a.driver_id = ? AND a.vehicle_id = ?
			AND CURDATE() BETWEEN a.start_date AND a.end_date
			LIMIT 1
		) sub
	`, req.DriverID, req.VehicleID).Scan(&shiftID)

	if err == sql.ErrNoRows {
		config.DB.QueryRow(`
			SELECT COALESCE(ev.shift_id, 0)
			FROM ev_assignments ev
			JOIN driver_clusters dc ON ev.cluster_id = dc.id
			JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
			WHERE ev.vehicle_id = ? AND dcm.driver_id = ?
			AND CURDATE() BETWEEN ev.start_date AND ev.end_date
			AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
			LIMIT 1
		`, req.VehicleID, req.DriverID).Scan(&shiftID)
	}

	if shiftID == 0 {
		config.DB.QueryRow("SELECT id FROM shifts LIMIT 1").Scan(&shiftID)
	}

	// 2. Create temporary assignment: replacement driver takes over the vehicle
	if req.ReplacementDriverID != nil && shiftID > 0 {
		_, err = config.DB.Exec(`
			INSERT INTO temporary_assignments 
			(original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
		`, req.DriverID, *req.ReplacementDriverID, req.VehicleID, shiftID, req.StartDate, req.EndDate,
			"Driver Replacement: "+req.Reason)
		if err != nil {
			log.Printf("Error creating temp assignment for driver replacement: %v", err)
		}
	}

	// 3. Notifications
	var vehicleNumber, driverName, replacementDriverName string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", req.VehicleID).Scan(&vehicleNumber)
	config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
	`, req.DriverID).Scan(&driverName)
	if req.ReplacementDriverID != nil {
		config.DB.QueryRow(`
			SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
		`, *req.ReplacementDriverID).Scan(&replacementDriverName)
	}

	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	endDate, _ := time.Parse("2006-01-02", req.EndDate)
	days := int(endDate.Sub(startDate).Hours()/24) + 1

	// Notify original driver
	origMsg := fmt.Sprintf("You have been replaced by %s on vehicle %s for %d days (%s to %s). Reason: %s",
		replacementDriverName, vehicleNumber, days, req.StartDate, req.EndDate, req.Reason)
	config.DB.Exec(`
		INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
		VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
	`, req.DriverID, "Driver Replacement", origMsg, requestID)

	// Notify replacement driver
	if req.ReplacementDriverID != nil {
		replMsg := fmt.Sprintf("You have been assigned to vehicle %s replacing driver %s for %d days (%s to %s). Reason: %s",
			vehicleNumber, driverName, days, req.StartDate, req.EndDate, req.Reason)
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
			VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
		`, *req.ReplacementDriverID, "Driver Replacement Assignment", replMsg, requestID)
	}

	config.DB.Exec("UPDATE vehicle_replacements SET driver_notified = TRUE WHERE id = ?", requestID)
}

// POST /api/admin/vehicle-replacements/complete - Complete a replacement (return to original)
func CompleteVehicleReplacement(c *gin.Context) {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var vehicleID, driverID int
	var replacementVehicleID, replacementDriverID sql.NullInt64
	var reason, replacementType string
	err := config.DB.QueryRow(`
		SELECT vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id
		FROM vehicle_replacements WHERE id = ?
	`, req.RequestID).Scan(&vehicleID, &driverID, &replacementVehicleID, &reason, &replacementType, &replacementDriverID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Mark request as completed
	config.DB.Exec("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", req.RequestID)

	var vehicleNumber, driverName string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
	config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
	`, driverID).Scan(&driverName)

	if replacementType == "driver" {
		// Driver replacement: complete temp assignment on this vehicle (original driver comes back)
		config.DB.Exec(`
			UPDATE temporary_assignments SET status = 'completed' 
			WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
		`, driverID, vehicleID)

		driverMessage := "Your replacement period on vehicle " + vehicleNumber + " has ended. You are back on duty. Reason: " + reason
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
			VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
		`, driverID, "Driver Replacement Ended", driverMessage, req.RequestID)

		// Notify replacement driver too
		if replacementDriverID.Valid {
			var replDriverName string
			config.DB.QueryRow(`
				SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
			`, replacementDriverID.Int64).Scan(&replDriverName)

			replMsg := "Your temporary assignment on vehicle " + vehicleNumber + " has ended. Original driver " + driverName + " is back."
			config.DB.Exec(`
				INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
				VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
			`, replacementDriverID.Int64, "Temporary Assignment Ended", replMsg, req.RequestID)
		}

		adminMessage := fmt.Sprintf("Driver replacement completed. Driver %s is back on vehicle %s.", driverName, vehicleNumber)
		CreateAdminNotification("replacement_completed", "Driver Replacement Completed", adminMessage)

	} else {
		// Vehicle replacement: restore original vehicle status
		config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)

		// Complete temporary assignment
		if replacementVehicleID.Valid {
			config.DB.Exec(`
				UPDATE temporary_assignments SET status = 'completed' 
				WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
			`, driverID, replacementVehicleID.Int64)

			// Remove replacement vehicle from temp group memberships
			config.DB.Exec(`
				DELETE FROM vehicle_group_members 
				WHERE vehicle_id = ? AND valid_to <= CURDATE()
			`, replacementVehicleID.Int64)
		}

		driverMessage := "Your original vehicle " + vehicleNumber + " is back from " + reason + ". The temporary replacement has ended."
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
			VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
		`, driverID, "Vehicle Back - Replacement Ended", driverMessage, req.RequestID)

		adminMessage := fmt.Sprintf("Vehicle %s is back from %s. Driver %s reassigned to original vehicle.", vehicleNumber, reason, driverName)
		CreateAdminNotification("replacement_completed", "Vehicle Replacement Completed", adminMessage)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Replacement completed successfully"})
}

// AutoCompleteExpiredVehicleReplacements - Scheduled job to complete expired replacements
func AutoCompleteExpiredVehicleReplacements() {
	rows, err := config.DB.Query(`
		SELECT id, vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id
		FROM vehicle_replacements 
		WHERE status = 'approved' AND end_date < CURDATE()
	`)
	if err != nil {
		log.Printf("Auto-complete vehicle replacements error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, vehicleID, driverID int
		var replacementVehicleID, replacementDriverID sql.NullInt64
		var reason, replacementType string
		rows.Scan(&id, &vehicleID, &driverID, &replacementVehicleID, &reason, &replacementType, &replacementDriverID)

		config.DB.Exec("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", id)

		if replacementType == "driver" {
			// Driver replacement: complete temp assignment, vehicle stays active
			config.DB.Exec(`
				UPDATE temporary_assignments SET status = 'completed' 
				WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
			`, driverID, vehicleID)
		} else {
			// Vehicle replacement: restore original vehicle
			config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)
			if replacementVehicleID.Valid {
				config.DB.Exec(`
					UPDATE temporary_assignments SET status = 'completed' 
					WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
				`, driverID, replacementVehicleID.Int64)
			}
		}

		var vehicleNumber, driverName string
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
		config.DB.QueryRow(`
			SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
		`, driverID).Scan(&driverName)

		if replacementType == "driver" {
			driverMessage := "Your driver replacement period on vehicle " + vehicleNumber + " has ended."
			config.DB.Exec(`
				INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
				VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
			`, driverID, "Driver Replacement Ended", driverMessage, id)

			adminMessage := fmt.Sprintf("Driver replacement auto-completed. Driver %s back on vehicle %s.", driverName, vehicleNumber)
			CreateAdminNotification("replacement_completed", "Driver Replacement Auto-Completed", adminMessage)
		} else {
			driverMessage := "Your original vehicle " + vehicleNumber + " is back from " + reason + ". The temporary replacement has ended."
			config.DB.Exec(`
				INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
				VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
			`, driverID, "Vehicle Back - Replacement Ended", driverMessage, id)

			adminMessage := fmt.Sprintf("Vehicle %s auto-completed from %s. Driver %s reassigned.", vehicleNumber, reason, driverName)
			CreateAdminNotification("replacement_completed", "Replacement Auto-Completed", adminMessage)
		}

		log.Printf("Replacement Auto-Completed: type=%s, id=%d", replacementType, id)
	}
}

// GET /api/admin/vehicle-replacements/available-vehicles - Get vehicles available for replacement
func GetAvailableReplacementVehiclesNew(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	vehicleType := c.Query("vehicle_type")
	excludeVehicleID := c.Query("exclude_vehicle_id")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date required"})
		return
	}

	query := `
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.seating_capacity, v.fuel_type, v.status,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name
		FROM vehicles v
		WHERE v.status IN ('active', 'available')
		AND v.id NOT IN (
			SELECT DISTINCT vr.replacement_vehicle_id FROM vehicle_replacements vr
			WHERE vr.replacement_vehicle_id IS NOT NULL
			AND vr.status IN ('approved')
			AND vr.start_date <= ? AND vr.end_date >= ?
		)
		AND v.id NOT IN (
			SELECT DISTINCT vr.vehicle_id FROM vehicle_replacements vr
			WHERE vr.status IN ('pending', 'approved')
			AND vr.start_date <= ? AND vr.end_date >= ?
		)
	`

	args := []interface{}{endDate, startDate, endDate, startDate}

	if excludeVehicleID != "" {
		query += " AND v.id != ?"
		args = append(args, excludeVehicleID)
	}

	if vehicleType != "" {
		query += " AND v.vehicle_type = ?"
		args = append(args, vehicleType)
	}

	query += " ORDER BY v.vehicle_type, v.vehicle_number"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get available vehicles error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type AvailableVehicle struct {
		ID              int    `json:"id"`
		VehicleNumber   string `json:"vehicle_number"`
		VehicleType     string `json:"vehicle_type"`
		SeatingCapacity int    `json:"seating_capacity"`
		FuelType        string `json:"fuel_type"`
		Status          string `json:"status"`
		VehicleName     string `json:"vehicle_name"`
	}

	var vehicles []AvailableVehicle
	for rows.Next() {
		var v AvailableVehicle
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.SeatingCapacity, &v.FuelType, &v.Status, &v.VehicleName)
		vehicles = append(vehicles, v)
	}

	if vehicles == nil {
		vehicles = []AvailableVehicle{}
	}
	c.JSON(http.StatusOK, vehicles)
}

// GET /api/admin/vehicle-replacements/vehicle-drivers - Get drivers assigned to a vehicle
func GetVehicleDriversNew(c *gin.Context) {
	vehicleID := c.Query("vehicle_id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	type DriverInfo struct {
		ID        int    `json:"id"`
		FullName  string `json:"full_name"`
		ShiftID   *int   `json:"shift_id"`
		ShiftName string `json:"shift_name"`
		IsEV      bool   `json:"is_ev"`
	}

	var drivers []DriverInfo

	// Regular assignments
	rows, err := config.DB.Query(`
		SELECT DISTINCT d.id, u.full_name,
			   a.shift_id, COALESCE(s.name, ''), FALSE
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.vehicle_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
	`, vehicleID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d DriverInfo
			rows.Scan(&d.ID, &d.FullName, &d.ShiftID, &d.ShiftName, &d.IsEV)
			drivers = append(drivers, d)
		}
	}

	// EV cluster assignments
	evRows, err := config.DB.Query(`
		SELECT DISTINCT d.id, u.full_name,
			   ev.shift_id, COALESCE(s.name, 'EV Duty'), TRUE
		FROM ev_assignments ev
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN shifts s ON ev.shift_id = s.id
		WHERE ev.vehicle_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date AND ev.status = 'active'
	`, vehicleID)
	if err == nil {
		defer evRows.Close()
		for evRows.Next() {
			var d DriverInfo
			evRows.Scan(&d.ID, &d.FullName, &d.ShiftID, &d.ShiftName, &d.IsEV)
			d.IsEV = true
			drivers = append(drivers, d)
		}
	}

	if drivers == nil {
		drivers = []DriverInfo{}
	}
	c.JSON(http.StatusOK, drivers)
}

// POST /api/admin/vehicle-replacements/reject - Reject replacement request
func RejectVehicleReplacement(c *gin.Context) {
	var req struct {
		RequestID  int    `json:"request_id"`
		RejectedBy int    `json:"rejected_by"`
		Reason     string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE vehicle_replacements 
		SET status = 'rejected', notes = CONCAT(COALESCE(notes, ''), ' | Rejected: ', ?)
		WHERE id = ?
	`, req.Reason, req.RequestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle replacement request rejected"})
}

// POST /api/admin/vehicle-replacements/update - Update replacement request
func UpdateVehicleReplacement(c *gin.Context) {
	var req struct {
		RequestID int    `json:"request_id"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
		Reason    string `json:"reason"`
		Notes     string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status string
	err := config.DB.QueryRow("SELECT status FROM vehicle_replacements WHERE id = ?", req.RequestID).Scan(&status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if status != "pending" && status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot edit completed or rejected requests"})
		return
	}

	if req.StartDate != "" && req.EndDate != "" {
		start, e1 := time.Parse("2006-01-02", req.StartDate)
		end, e2 := time.Parse("2006-01-02", req.EndDate)
		if e1 != nil || e2 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format"})
			return
		}
		if end.Before(start) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "End date must be after start date"})
			return
		}
	}

	_, err = config.DB.Exec(`
		UPDATE vehicle_replacements SET start_date = ?, end_date = ?, reason = ?, notes = ? WHERE id = ?
	`, req.StartDate, req.EndDate, req.Reason, req.Notes, req.RequestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If approved, also update temp assignment dates
	if status == "approved" {
		config.DB.Exec(`
			UPDATE temporary_assignments ta
			JOIN vehicle_replacements vr ON ta.original_driver_id = vr.driver_id AND ta.status = 'active'
			SET ta.start_date = ?, ta.end_date = ?
			WHERE vr.id = ?
		`, req.StartDate, req.EndDate, req.RequestID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle replacement updated successfully"})
}

// POST /api/admin/vehicle-replacements/delete - Delete replacement request
func DeleteVehicleReplacement(c *gin.Context) {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var status, replacementType string
	var vehicleID int
	var replacementVehicleID sql.NullInt64
	var driverID int
	err := config.DB.QueryRow(`
		SELECT status, vehicle_id, replacement_vehicle_id, driver_id, replacement_type
		FROM vehicle_replacements WHERE id = ?
	`, req.RequestID).Scan(&status, &vehicleID, &replacementVehicleID, &driverID, &replacementType)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Cleanup if approved
	if status == "approved" {
		if replacementType == "driver" {
			// Driver replacement: remove temp assignment on same vehicle
			config.DB.Exec(`
				DELETE FROM temporary_assignments 
				WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
			`, driverID, vehicleID)
		} else {
			// Vehicle replacement: restore vehicle and remove temp assignment
			config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)
			if replacementVehicleID.Valid {
				config.DB.Exec(`
					DELETE FROM temporary_assignments 
					WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
				`, driverID, replacementVehicleID.Int64)
			}
		}

		// Notify driver
		var vehicleNumber string
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
		config.DB.Exec(`
			INSERT INTO notifications (recipient_role, recipient_id, title, message, type)
			VALUES ('DRIVER', ?, ?, ?, 'info')
		`, driverID, "Replacement Cancelled",
			"The replacement for "+vehicleNumber+" has been cancelled by admin.")
	}

	_, err = config.DB.Exec("DELETE FROM vehicle_replacements WHERE id = ?", req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Replacement deleted successfully"})
}

// GET /api/admin/vehicle-replacements/pending-count
func GetPendingVehicleReplacementsCount(c *gin.Context) {
	var count int
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements WHERE status = 'pending'").Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// POST /api/admin/vehicle-replacements/check-expired
func CheckExpiredVehicleReplacements(c *gin.Context) {
	AutoCompleteExpiredVehicleReplacements()
	c.JSON(http.StatusOK, gin.H{"message": "Expired vehicle replacements checked and auto-completed"})
}

// GET /api/admin/vehicle-replacements/stats - Replacement statistics
func GetVehicleReplacementStats(c *gin.Context) {
	type Stats struct {
		Total     int `json:"total"`
		Active    int `json:"active"`
		Pending   int `json:"pending"`
		Completed int `json:"completed"`
		ThisMonth int `json:"this_month"`
	}

	var stats Stats
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements").Scan(&stats.Total)
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements WHERE status = 'approved'").Scan(&stats.Active)
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements WHERE status = 'pending'").Scan(&stats.Pending)
	config.DB.QueryRow("SELECT COUNT(*) FROM vehicle_replacements WHERE status = 'completed'").Scan(&stats.Completed)
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicle_replacements 
		WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
	`).Scan(&stats.ThisMonth)

	c.JSON(http.StatusOK, stats)
}

// GET /api/admin/vehicle-replacements/available-drivers - Get drivers available for replacement
func GetAvailableReplacementDrivers(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	excludeDriverID := c.Query("exclude_driver_id")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date required"})
		return
	}

	query := `
		SELECT d.id, u.full_name, u.phone, d.license_type
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		WHERE d.status = 'active'
		AND d.id NOT IN (
			SELECT lr.driver_id FROM leave_requests lr
			WHERE lr.status = 'admin_approved'
			AND lr.start_date <= ? AND lr.end_date >= ?
		)
		AND d.id NOT IN (
			SELECT ta.replacement_driver_id FROM temporary_assignments ta
			WHERE ta.status = 'active'
			AND ta.start_date <= ? AND ta.end_date >= ?
		)
		AND d.id NOT IN (
			SELECT vr.replacement_driver_id FROM vehicle_replacements vr
			WHERE vr.status IN ('pending', 'approved')
			AND vr.replacement_type = 'driver'
			AND vr.replacement_driver_id IS NOT NULL
			AND vr.start_date <= ? AND vr.end_date >= ?
		)
	`

	args := []interface{}{endDate, startDate, endDate, startDate, endDate, startDate}

	if excludeDriverID != "" {
		query += " AND d.id != ?"
		args = append(args, excludeDriverID)
	}

	query += " ORDER BY u.full_name"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Get available replacement drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type AvailableDriver struct {
		ID          int    `json:"id"`
		FullName    string `json:"full_name"`
		Phone       string `json:"phone"`
		LicenseType string `json:"license_type"`
	}

	var drivers []AvailableDriver
	for rows.Next() {
		var d AvailableDriver
		rows.Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseType)
		drivers = append(drivers, d)
	}

	if drivers == nil {
		drivers = []AvailableDriver{}
	}
	c.JSON(http.StatusOK, drivers)
}

// GET /api/admin/vehicle-replacements/driver-vehicle - Get vehicle assigned to a driver
func GetDriverVehicle(c *gin.Context) {
	driverID := c.Query("driver_id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "driver_id required"})
		return
	}

	type VehicleInfo struct {
		ID            int    `json:"id"`
		VehicleNumber string `json:"vehicle_number"`
		VehicleType   string `json:"vehicle_type"`
		VehicleName   string `json:"vehicle_name"`
		ShiftID       *int   `json:"shift_id"`
		ShiftName     string `json:"shift_name"`
		IsEV          bool   `json:"is_ev"`
	}

	var vehicles []VehicleInfo

	// Regular assignments
	rows, err := config.DB.Query(`
		SELECT DISTINCT v.id, v.vehicle_number, v.vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number),
			   a.shift_id, COALESCE(s.name, ''), FALSE
		FROM assignments a
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.driver_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
	`, driverID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var vi VehicleInfo
			rows.Scan(&vi.ID, &vi.VehicleNumber, &vi.VehicleType, &vi.VehicleName, &vi.ShiftID, &vi.ShiftName, &vi.IsEV)
			vehicles = append(vehicles, vi)
		}
	}

	// EV cluster assignments
	evRows, err := config.DB.Query(`
		SELECT DISTINCT v.id, v.vehicle_number, v.vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number),
			   ev.shift_id, COALESCE(s.name, 'EV Duty'), TRUE
		FROM ev_assignments ev
		JOIN vehicles v ON ev.vehicle_id = v.id
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN shifts s ON ev.shift_id = s.id
		WHERE dcm.driver_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date AND ev.status = 'active'
	`, driverID)
	if err == nil {
		defer evRows.Close()
		for evRows.Next() {
			var vi VehicleInfo
			evRows.Scan(&vi.ID, &vi.VehicleNumber, &vi.VehicleType, &vi.VehicleName, &vi.ShiftID, &vi.ShiftName, &vi.IsEV)
			vi.IsEV = true
			vehicles = append(vehicles, vi)
		}
	}

	if vehicles == nil {
		vehicles = []VehicleInfo{}
	}
	c.JSON(http.StatusOK, vehicles)
}
