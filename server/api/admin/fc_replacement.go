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
   FC REPLACEMENT HANDLERS
========================= */

// FCReplacementRequest - request for temporary vehicle replacement
type FCReplacementRequest struct {
	VehicleID            int    `json:"vehicle_id"`
	ReplacementVehicleID *int   `json:"replacement_vehicle_id"`
	DriverID             int    `json:"driver_id"`
	StartDate            string `json:"start_date"`
	EndDate              string `json:"end_date"`
	Reason               string `json:"reason"`
	Notes                string `json:"notes"`
	RequestedByRole      string `json:"requested_by_role"`
	RequestedByID        int    `json:"requested_by_id"`
}

// FCReplacementResponse - response with full details
type FCReplacementResponse struct {
	ID                    int     `json:"id"`
	VehicleID             int     `json:"vehicle_id"`
	VehicleNumber         string  `json:"vehicle_number"`
	VehicleType           string  `json:"vehicle_type"`
	ReplacementVehicleID  *int    `json:"replacement_vehicle_id"`
	ReplacementVehicleNum *string `json:"replacement_vehicle_number"`
	DriverID              int     `json:"driver_id"`
	DriverName            string  `json:"driver_name"`
	StartDate             string  `json:"start_date"`
	EndDate               string  `json:"end_date"`
	Reason                string  `json:"reason"`
	Status                string  `json:"status"`
	RequestedByRole       string  `json:"requested_by_role"`
	RequestedByID         int     `json:"requested_by_id"`
	ApprovedByID          *int    `json:"approved_by_id"`
	Notes                 *string `json:"notes"`
	DriverNotified        bool    `json:"driver_notified"`
	CreatedAt             string  `json:"created_at"`
	DaysRemaining         int     `json:"days_remaining"`
}

// GET /api/admin/fc-replacements - Get all FC replacement requests
func GetFCReplacements(c *gin.Context) {
	status := c.Query("status") // pending, approved, completed, all

	query := `
		SELECT 
			r.id, r.vehicle_id, v.vehicle_number, v.vehicle_type,
			r.replacement_vehicle_id, rv.vehicle_number as replacement_vehicle_number,
			r.driver_id, u.full_name as driver_name,
			DATE_FORMAT(r.start_date, '%d-%m-%Y') as start_date,
			DATE_FORMAT(r.end_date, '%d-%m-%Y') as end_date,
			r.reason, r.status, r.requested_by_role, r.requested_by_id,
			r.approved_by_id, r.notes, r.driver_notified,
			DATE_FORMAT(r.created_at, '%d-%m-%Y %H:%i') as created_at,
			DATEDIFF(r.end_date, CURDATE()) as days_remaining
		FROM fc_replacement_requests r
		JOIN vehicles v ON r.vehicle_id = v.id
		LEFT JOIN vehicles rv ON r.replacement_vehicle_id = rv.id
		JOIN drivers d ON r.driver_id = d.id
		JOIN users u ON d.user_id = u.id
	`

	if status != "" && status != "all" {
		query += " WHERE r.status = '" + status + "'"
	}

	query += " ORDER BY r.created_at DESC"

	rows, err := config.DB.Query(query)
	if err != nil {
		log.Printf("Get FC replacements error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var requests []FCReplacementResponse
	for rows.Next() {
		var r FCReplacementResponse
		err := rows.Scan(
			&r.ID, &r.VehicleID, &r.VehicleNumber, &r.VehicleType,
			&r.ReplacementVehicleID, &r.ReplacementVehicleNum,
			&r.DriverID, &r.DriverName,
			&r.StartDate, &r.EndDate,
			&r.Reason, &r.Status, &r.RequestedByRole, &r.RequestedByID,
			&r.ApprovedByID, &r.Notes, &r.DriverNotified,
			&r.CreatedAt, &r.DaysRemaining,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/admin/fc-replacements/create - Create FC replacement request
func CreateFCReplacement(c *gin.Context) {
	var req FCReplacementRequest
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

	// Set status based on who is requesting
	status := "pending"
	if req.RequestedByRole == "admin" {
		status = "approved" // Admin requests are auto-approved
	}

	result, err := config.DB.Exec(`
		INSERT INTO fc_replacement_requests 
		(vehicle_id, replacement_vehicle_id, driver_id, start_date, end_date, reason, status, requested_by_role, requested_by_id, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleID, req.ReplacementVehicleID, req.DriverID, req.StartDate, req.EndDate,
		req.Reason, status, req.RequestedByRole, req.RequestedByID, req.Notes)

	if err != nil {
		log.Printf("Create FC replacement error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	requestID, _ := result.LastInsertId()

	// If admin created and replacement vehicle is selected, activate immediately
	if req.RequestedByRole == "admin" && req.ReplacementVehicleID != nil {
		activateFCReplacement(int(requestID), req)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "FC replacement request created successfully",
		"id":      requestID,
		"status":  status,
	})
}

// POST /api/admin/fc-replacements/approve - Approve FC replacement (admin only)
func ApproveFCReplacement(c *gin.Context) {
	var req struct {
		RequestID            int `json:"request_id"`
		ReplacementVehicleID int `json:"replacement_vehicle_id"`
		ApprovedByID         int `json:"approved_by_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get the original request details
	var vehicleID, driverID int
	var startDate, endDate, reason string
	err := config.DB.QueryRow(`
		SELECT vehicle_id, driver_id, start_date, end_date, reason 
		FROM fc_replacement_requests WHERE id = ?
	`, req.RequestID).Scan(&vehicleID, &driverID, &startDate, &endDate, &reason)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Update the request with approval
	_, err = config.DB.Exec(`
		UPDATE fc_replacement_requests 
		SET status = 'approved', replacement_vehicle_id = ?, approved_by_id = ?
		WHERE id = ?
	`, req.ReplacementVehicleID, req.ApprovedByID, req.RequestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Activate the replacement
	activateFCReplacement(req.RequestID, FCReplacementRequest{
		VehicleID:            vehicleID,
		ReplacementVehicleID: &req.ReplacementVehicleID,
		DriverID:             driverID,
		StartDate:            startDate,
		EndDate:              endDate,
		Reason:               reason,
	})

	// Notify incharge of the cluster about approval
	var inchargeID int
	config.DB.QueryRow(`
		SELECT d2.id FROM driver_cluster_members dcm1
		JOIN driver_cluster_members dcm2 ON dcm1.cluster_id = dcm2.cluster_id
		JOIN drivers d2 ON d2.id = dcm2.driver_id AND d2.is_incharge = 1
		WHERE dcm1.driver_id = ? AND CURDATE() BETWEEN dcm1.valid_from AND dcm1.valid_to
		AND CURDATE() BETWEEN dcm2.valid_from AND dcm2.valid_to
	`, driverID).Scan(&inchargeID)

	if inchargeID > 0 {
		var vehicleNumber, replacementNumber string
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", req.ReplacementVehicleID).Scan(&replacementNumber)

		inchargeMsg := fmt.Sprintf("FC replacement for vehicle %s has been approved. Replacement vehicle: %s. Period: %s to %s",
			vehicleNumber, replacementNumber, startDate, endDate)
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
			VALUES (?, ?, ?, 'info', ?)
		`, inchargeID, "Replacement Request Approved", inchargeMsg, req.RequestID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "FC replacement approved and activated"})
}

// activateFCReplacement - Internal function to activate the replacement
func activateFCReplacement(requestID int, req FCReplacementRequest) {
	// Update original vehicle status to under_maintenance
	_, err := config.DB.Exec("UPDATE vehicles SET status = 'under_maintenance' WHERE id = ?", req.VehicleID)
	if err != nil {
		log.Printf("Error updating vehicle status: %v", err)
	}

	// Try to get driver's current assignment for this vehicle (regular assignment)
	var assignmentID int
	var shiftID int
	err = config.DB.QueryRow(`
		SELECT id, shift_id FROM assignments 
		WHERE driver_id = ? AND vehicle_id = ? 
		AND CURDATE() BETWEEN start_date AND end_date
		LIMIT 1
	`, req.DriverID, req.VehicleID).Scan(&assignmentID, &shiftID)

	// If no regular assignment, check for EV cluster assignment
	if err == sql.ErrNoRows {
		log.Printf("No regular assignment found, checking EV cluster assignment")
		// Get the cluster's default shift or use default
		err = config.DB.QueryRow(`
			SELECT COALESCE(ev.shift_id, 0)
			FROM ev_assignments ev
			JOIN driver_clusters dc ON ev.cluster_id = dc.id
			JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
			JOIN drivers d ON d.id = dcm.driver_id
			WHERE ev.vehicle_id = ? AND d.id = ?
			AND CURDATE() BETWEEN ev.start_date AND ev.end_date
			AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
			LIMIT 1
		`, req.VehicleID, req.DriverID).Scan(&shiftID)

		if err != nil && err != sql.ErrNoRows {
			log.Printf("Error finding EV cluster assignment: %v", err)
		}
	} else if err != nil {
		log.Printf("Error finding assignment: %v", err)
		return
	}

	// If still no shift found, try to get any default shift
	if shiftID == 0 {
		config.DB.QueryRow("SELECT id FROM shifts LIMIT 1").Scan(&shiftID)
	}

	// Create temporary assignment with replacement vehicle
	if req.ReplacementVehicleID != nil && shiftID > 0 {
		_, err = config.DB.Exec(`
			INSERT INTO temporary_assignments 
			(original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
		`, req.DriverID, req.DriverID, *req.ReplacementVehicleID, shiftID, req.StartDate, req.EndDate,
			"FC/Insurance/Permit: "+req.Reason)

		if err != nil {
			log.Printf("Error creating temp assignment: %v", err)
		} else {
			log.Printf("Created temporary assignment for driver %d with replacement vehicle %d", req.DriverID, *req.ReplacementVehicleID)
		}
	} else if req.ReplacementVehicleID != nil {
		log.Printf("Warning: Could not create temp assignment - shiftID is %d", shiftID)
	}

	// Get vehicle and driver details for notification
	var vehicleNumber, replacementVehicleNumber, driverName string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", req.VehicleID).Scan(&vehicleNumber)
	if req.ReplacementVehicleID != nil {
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", *req.ReplacementVehicleID).Scan(&replacementVehicleNumber)
	}
	config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
	`, req.DriverID).Scan(&driverName)

	// Calculate days
	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	endDate, _ := time.Parse("2006-01-02", req.EndDate)
	days := int(endDate.Sub(startDate).Hours()/24) + 1

	// Create driver notification
	message := "Your vehicle " + vehicleNumber + " is going for " + req.Reason + " from " + req.StartDate + " to " + req.EndDate + ". "
	if replacementVehicleNumber != "" {
		message += "You have been assigned " + replacementVehicleNumber + " for " + strconv.Itoa(days) + " days during this period. "
		message += "Your original vehicle will be automatically reassigned after this period."
	}

	_, err = config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'vehicle_change', ?)
	`, req.DriverID, "Vehicle Change Notification", message, requestID)

	if err != nil {
		log.Printf("Error creating notification: %v", err)
	}

	// Mark driver as notified
	config.DB.Exec("UPDATE fc_replacement_requests SET driver_notified = TRUE WHERE id = ?", requestID)
}

// GET /api/admin/fc-replacements/available-vehicles - Get available vehicles for replacement
func GetAvailableReplacementVehicles(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	vehicleType := c.Query("vehicle_type") // BUS, CAR, VAN, etc.
	excludeVehicleID := c.Query("exclude_vehicle_id")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date required"})
		return
	}

	// Get vehicles not assigned during the date range
	query := `
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.seating_capacity, v.fuel_type, v.status
		FROM vehicles v
		WHERE v.status IN ('active', 'available')
		AND v.id NOT IN (
			SELECT DISTINCT a.vehicle_id FROM assignments a
			WHERE a.start_date <= ? AND a.end_date >= ?
		)
		AND v.id NOT IN (
			SELECT DISTINCT ta.vehicle_id FROM temporary_assignments ta
			WHERE ta.status = 'active'
			AND ta.start_date <= ? AND ta.end_date >= ?
		)
		AND v.id NOT IN (
			SELECT DISTINCT fcr.vehicle_id FROM fc_replacement_requests fcr
			WHERE fcr.status IN ('pending', 'approved')
			AND fcr.start_date <= ? AND fcr.end_date >= ?
		)
	`

	args := []interface{}{endDate, startDate, endDate, startDate, endDate, startDate}

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
	}

	var vehicles []AvailableVehicle
	for rows.Next() {
		var v AvailableVehicle
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.SeatingCapacity, &v.FuelType, &v.Status)
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, vehicles)
}

// POST /api/admin/fc-replacements/complete - Mark FC replacement as completed (auto-reassign)
func CompleteFCReplacement(c *gin.Context) {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get the request details
	var vehicleID, driverID int
	var replacementVehicleID sql.NullInt64
	var reason string
	err := config.DB.QueryRow(`
		SELECT vehicle_id, driver_id, replacement_vehicle_id, reason 
		FROM fc_replacement_requests WHERE id = ?
	`, req.RequestID).Scan(&vehicleID, &driverID, &replacementVehicleID, &reason)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Mark request as completed
	_, err = config.DB.Exec("UPDATE fc_replacement_requests SET status = 'completed' WHERE id = ?", req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Restore original vehicle status back to available
	_, err = config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)
	if err != nil {
		log.Printf("Error restoring vehicle status: %v", err)
	}

	// Cancel the temporary assignment
	if replacementVehicleID.Valid {
		config.DB.Exec(`
			UPDATE temporary_assignments SET status = 'completed' 
			WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
		`, driverID, replacementVehicleID.Int64)
	}

	// Get vehicle number and driver name for notifications
	var vehicleNumber, driverName string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
	config.DB.QueryRow(`
		SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
	`, driverID).Scan(&driverName)

	// Create notification message
	driverMessage := "Your original vehicle " + vehicleNumber + " is back from " + reason + ". The temporary assignment has ended and you are now reassigned to your original vehicle."
	inchargeAdminMessage := "Temporary assignment for driver " + driverName + " has ended. Vehicle " + vehicleNumber + " is back from " + reason + " and is now available. Driver has been reassigned to their original vehicle."

	// Notify driver
	config.DB.Exec(`
		INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
		VALUES (?, ?, ?, 'vehicle_change', ?)
	`, driverID, "Vehicle Reassignment - Back to Original", driverMessage, req.RequestID)

	// Notify incharge of driver's cluster
	var inchargeDriverID int
	err = config.DB.QueryRow(`
		SELECT d2.id FROM driver_cluster_members dcm1
		JOIN driver_cluster_members dcm2 ON dcm1.cluster_id = dcm2.cluster_id
		JOIN drivers d2 ON d2.id = dcm2.driver_id
		WHERE dcm1.driver_id = ? AND d2.is_incharge = 1 AND d2.id != ?
		AND CURDATE() BETWEEN dcm1.valid_from AND dcm1.valid_to
		AND CURDATE() BETWEEN dcm2.valid_from AND dcm2.valid_to
	`, driverID, driverID).Scan(&inchargeDriverID)
	if err == nil && inchargeDriverID > 0 {
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
			VALUES (?, ?, ?, 'info', ?)
		`, inchargeDriverID, "Vehicle Back from Maintenance", inchargeAdminMessage, req.RequestID)
	}

	// Create admin alert (notify all admins via a log or alert table)
	log.Printf("FC Replacement Completed: %s", inchargeAdminMessage)

	// Create admin notification
	CreateAdminNotification("fc_completion", "FC Replacement Completed", inchargeAdminMessage)

	c.JSON(http.StatusOK, gin.H{"message": "FC replacement completed, driver reassigned to original vehicle"})
}

// AutoCompleteExpiredFCReplacements - Called by a scheduler or manually to complete expired replacements
func AutoCompleteExpiredFCReplacements() {
	rows, err := config.DB.Query(`
		SELECT id, vehicle_id, driver_id, replacement_vehicle_id, reason 
		FROM fc_replacement_requests 
		WHERE status = 'approved' AND end_date < CURDATE()
	`)
	if err != nil {
		log.Printf("Auto-complete FC replacements error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, vehicleID, driverID int
		var replacementVehicleID sql.NullInt64
		var reason string
		rows.Scan(&id, &vehicleID, &driverID, &replacementVehicleID, &reason)

		// Mark as completed
		config.DB.Exec("UPDATE fc_replacement_requests SET status = 'completed' WHERE id = ?", id)

		// Restore original vehicle status back to available
		config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)

		// Complete temp assignment
		if replacementVehicleID.Valid {
			config.DB.Exec(`
				UPDATE temporary_assignments SET status = 'completed' 
				WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
			`, driverID, replacementVehicleID.Int64)
		}

		// Get vehicle number and driver name for notifications
		var vehicleNumber, driverName string
		config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)
		config.DB.QueryRow(`
			SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
		`, driverID).Scan(&driverName)

		// Create notification messages
		driverMessage := "Your original vehicle " + vehicleNumber + " is back from " + reason + ". The temporary assignment has ended and you are now reassigned to your original vehicle."
		inchargeAdminMessage := "Temporary assignment for driver " + driverName + " has ended. Vehicle " + vehicleNumber + " is back from " + reason + " and is now available. Driver has been reassigned to their original vehicle."

		// Notify driver
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
			VALUES (?, ?, ?, 'vehicle_change', ?)
		`, driverID, "Vehicle Reassignment - Back to Original", driverMessage, id)

		// Notify incharge of driver's cluster
		var inchargeDriverID int
		err := config.DB.QueryRow(`
			SELECT d2.id FROM driver_cluster_members dcm1
			JOIN driver_cluster_members dcm2 ON dcm1.cluster_id = dcm2.cluster_id
			JOIN drivers d2 ON d2.id = dcm2.driver_id
			WHERE dcm1.driver_id = ? AND d2.is_incharge = 1 AND d2.id != ?
			AND CURDATE() BETWEEN dcm1.valid_from AND dcm1.valid_to
			AND CURDATE() BETWEEN dcm2.valid_from AND dcm2.valid_to
		`, driverID, driverID).Scan(&inchargeDriverID)
		if err == nil && inchargeDriverID > 0 {
			config.DB.Exec(`
				INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
				VALUES (?, ?, ?, 'info', ?)
			`, inchargeDriverID, "Vehicle Back from Maintenance", inchargeAdminMessage, id)
		}

		// Log for admin visibility
		log.Printf("FC Replacement Auto-Completed: %s", inchargeAdminMessage)

		// Create admin notification
		CreateAdminNotification("fc_completion", "FC Replacement Auto-Completed", inchargeAdminMessage)
	}
}

// GET /api/admin/fc-replacements/pending-count - Get count of pending requests
func GetPendingFCReplacementsCount(c *gin.Context) {
	var count int
	config.DB.QueryRow("SELECT COUNT(*) FROM fc_replacement_requests WHERE status = 'pending'").Scan(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// POST /api/admin/fc-replacements/reject - Reject FC replacement request
func RejectFCReplacement(c *gin.Context) {
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
		UPDATE fc_replacement_requests 
		SET status = 'rejected', notes = CONCAT(COALESCE(notes, ''), ' | Rejected: ', ?)
		WHERE id = ?
	`, req.Reason, req.RequestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "FC replacement request rejected"})
}

// POST /api/admin/fc-replacements/check-expired - Trigger auto-complete check for expired replacements
func CheckExpiredFCReplacements(c *gin.Context) {
	AutoCompleteExpiredFCReplacements()
	c.JSON(http.StatusOK, gin.H{"message": "Expired FC replacements checked and auto-completed"})
}

// GET /api/admin/fc-replacements/recent-completions - Get recently completed FC replacements (last 7 days)
func GetRecentFCCompletions(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			fcr.id, v.vehicle_number, u.full_name as driver_name, 
			fcr.reason, DATE_FORMAT(fcr.end_date, '%d-%m-%Y') as end_date,
			DATE_FORMAT(fcr.updated_at, '%d-%m-%Y %H:%i') as completed_at
		FROM fc_replacement_requests fcr
		JOIN vehicles v ON fcr.vehicle_id = v.id
		JOIN drivers d ON fcr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		WHERE fcr.status = 'completed' 
		AND fcr.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
		ORDER BY fcr.updated_at DESC
		LIMIT 10
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type RecentCompletion struct {
		ID            int    `json:"id"`
		VehicleNumber string `json:"vehicle_number"`
		DriverName    string `json:"driver_name"`
		Reason        string `json:"reason"`
		EndDate       string `json:"end_date"`
		CompletedAt   string `json:"completed_at"`
	}

	var completions []RecentCompletion
	for rows.Next() {
		var c RecentCompletion
		rows.Scan(&c.ID, &c.VehicleNumber, &c.DriverName, &c.Reason, &c.EndDate, &c.CompletedAt)
		completions = append(completions, c)
	}

	c.JSON(http.StatusOK, completions)
}

// GET /api/admin/fc-replacements/vehicle-drivers - Get drivers assigned to a specific vehicle
func GetVehicleDrivers(c *gin.Context) {
	vehicleID := c.Query("vehicle_id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id required"})
		return
	}

	type DriverInfo struct {
		ID          int    `json:"id"`
		FullName    string `json:"full_name"`
		ClusterID   *int   `json:"cluster_id"`
		ClusterName string `json:"cluster_name"`
		IsIncharge  bool   `json:"is_incharge"`
		ShiftID     *int   `json:"shift_id"`
		ShiftName   string `json:"shift_name"`
		IsEV        bool   `json:"is_ev"`
	}

	var drivers []DriverInfo

	// 1. Get drivers from regular assignments
	rows, err := config.DB.Query(`
		SELECT DISTINCT d.id, u.full_name, dcm.cluster_id, 
			   COALESCE(dc.name, '') as cluster_name, d.is_incharge,
			   a.shift_id, COALESCE(s.name, '') as shift_name, FALSE as is_ev
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN driver_clusters dc ON dcm.cluster_id = dc.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.vehicle_id = ?
		  AND CURDATE() BETWEEN a.start_date AND a.end_date
		ORDER BY u.full_name
	`, vehicleID)

	if err != nil {
		log.Printf("Get vehicle drivers error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var d DriverInfo
		rows.Scan(&d.ID, &d.FullName, &d.ClusterID, &d.ClusterName, &d.IsIncharge, &d.ShiftID, &d.ShiftName, &d.IsEV)
		drivers = append(drivers, d)
	}

	// 2. Get drivers from EV cluster assignments (for EV vehicles)
	evRows, err := config.DB.Query(`
		SELECT DISTINCT d.id, u.full_name, dcm.cluster_id, 
			   COALESCE(dc.name, '') as cluster_name, d.is_incharge,
			   ev.shift_id as shift_id, COALESCE(s.name, 'EV Duty') as shift_name, TRUE as is_ev
		FROM ev_assignments ev
		JOIN driver_clusters dc ON ev.cluster_id = dc.id
		JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN shifts s ON ev.shift_id = s.id
		WHERE ev.vehicle_id = ?
		  AND CURDATE() BETWEEN ev.start_date AND ev.end_date
		  AND ev.status = 'active'
		ORDER BY u.full_name
	`, vehicleID)

	if err == nil {
		defer evRows.Close()
		for evRows.Next() {
			var d DriverInfo
			evRows.Scan(&d.ID, &d.FullName, &d.ClusterID, &d.ClusterName, &d.IsIncharge, &d.ShiftID, &d.ShiftName, &d.IsEV)
			d.IsEV = true
			drivers = append(drivers, d)
		}
	}

	c.JSON(http.StatusOK, drivers)
}

// POST /api/admin/fc-replacements/update - Update FC replacement request
func UpdateFCReplacement(c *gin.Context) {
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

	// Check if request exists and is in a state that allows editing
	var status string
	err := config.DB.QueryRow("SELECT status FROM fc_replacement_requests WHERE id = ?", req.RequestID).Scan(&status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Only allow editing pending or approved requests
	if status != "pending" && status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot edit completed or rejected requests"})
		return
	}

	// Validate dates
	if req.StartDate != "" && req.EndDate != "" {
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
	}

	// Get driver_id and vehicle details before update
	var driverID, vehicleID int
	var vehicleNumber string
	config.DB.QueryRow(`
		SELECT fcr.driver_id, fcr.vehicle_id, v.vehicle_number 
		FROM fc_replacement_requests fcr
		JOIN vehicles v ON fcr.vehicle_id = v.id
		WHERE fcr.id = ?
	`, req.RequestID).Scan(&driverID, &vehicleID, &vehicleNumber)

	// Update the request
	_, err = config.DB.Exec(`
		UPDATE fc_replacement_requests 
		SET start_date = ?, end_date = ?, reason = ?, notes = ?
		WHERE id = ?
	`, req.StartDate, req.EndDate, req.Reason, req.Notes, req.RequestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If status is approved, also update the temporary assignment dates
	if status == "approved" {
		config.DB.Exec(`
			UPDATE temporary_assignments ta
			JOIN fc_replacement_requests fcr ON 
				ta.original_driver_id = fcr.driver_id 
				AND ta.status = 'active'
			SET ta.start_date = ?, ta.end_date = ?
			WHERE fcr.id = ?
		`, req.StartDate, req.EndDate, req.RequestID)
	}

	// Notify the driver about the update
	if driverID > 0 {
		message := fmt.Sprintf("Your FC replacement request for vehicle %s has been updated. New dates: %s to %s. Reason: %s",
			vehicleNumber, req.StartDate, req.EndDate, req.Reason)
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
			VALUES (?, ?, ?, 'info', ?)
		`, driverID, "Replacement Request Updated", message, req.RequestID)
	}

	// Also notify the incharge of that cluster
	var inchargeID int
	config.DB.QueryRow(`
		SELECT d2.id FROM driver_cluster_members dcm1
		JOIN driver_cluster_members dcm2 ON dcm1.cluster_id = dcm2.cluster_id
		JOIN drivers d2 ON d2.id = dcm2.driver_id AND d2.is_incharge = 1
		WHERE dcm1.driver_id = ? 
		AND CURDATE() BETWEEN dcm1.valid_from AND dcm1.valid_to
		AND CURDATE() BETWEEN dcm2.valid_from AND dcm2.valid_to
	`, driverID).Scan(&inchargeID)

	if inchargeID > 0 && inchargeID != driverID {
		inchargeMsg := fmt.Sprintf("Admin updated FC replacement request for vehicle %s. New dates: %s to %s",
			vehicleNumber, req.StartDate, req.EndDate)
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type, related_id)
			VALUES (?, ?, ?, 'info', ?)
		`, inchargeID, "Replacement Request Updated by Admin", inchargeMsg, req.RequestID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "FC replacement request updated successfully"})
}

// POST /api/admin/fc-replacements/delete - Delete FC replacement request
func DeleteFCReplacement(c *gin.Context) {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get request details
	var status string
	var vehicleID int
	var replacementVehicleID sql.NullInt64
	var driverID int
	err := config.DB.QueryRow(`
		SELECT status, vehicle_id, replacement_vehicle_id, driver_id 
		FROM fc_replacement_requests WHERE id = ?
	`, req.RequestID).Scan(&status, &vehicleID, &replacementVehicleID, &driverID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Get vehicle number before any cleanup
	var vehicleNumber string
	config.DB.QueryRow("SELECT vehicle_number FROM vehicles WHERE id = ?", vehicleID).Scan(&vehicleNumber)

	// If request was approved, we need to clean up
	if status == "approved" {
		// Restore original vehicle status back to available
		config.DB.Exec("UPDATE vehicles SET status = 'available' WHERE id = ?", vehicleID)

		// Cancel/delete the temporary assignment
		if replacementVehicleID.Valid {
			config.DB.Exec(`
				DELETE FROM temporary_assignments 
				WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
			`, driverID, replacementVehicleID.Int64)
		}

		// Notify driver
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type)
			VALUES (?, ?, ?, 'info')
		`, driverID, "Replacement Request Cancelled",
			"The FC/Insurance replacement request for vehicle "+vehicleNumber+" has been cancelled by admin.")
	}

	// Notify incharge of the cluster
	var inchargeID int
	config.DB.QueryRow(`
		SELECT d2.id FROM driver_cluster_members dcm1
		JOIN driver_cluster_members dcm2 ON dcm1.cluster_id = dcm2.cluster_id
		JOIN drivers d2 ON d2.id = dcm2.driver_id AND d2.is_incharge = 1
		WHERE dcm1.driver_id = ?
		AND CURDATE() BETWEEN dcm1.valid_from AND dcm1.valid_to
		AND CURDATE() BETWEEN dcm2.valid_from AND dcm2.valid_to
	`, driverID).Scan(&inchargeID)

	if inchargeID > 0 {
		inchargeMsg := fmt.Sprintf("Admin deleted FC replacement request for vehicle %s", vehicleNumber)
		config.DB.Exec(`
			INSERT INTO driver_notifications (driver_id, title, message, type)
			VALUES (?, ?, ?, 'alert')
		`, inchargeID, "Replacement Request Deleted by Admin", inchargeMsg)
	}

	// Delete the request
	_, err = config.DB.Exec("DELETE FROM fc_replacement_requests WHERE id = ?", req.RequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "FC replacement request deleted successfully"})
}

// GET /api/admin/fc-replacements/cluster-drivers - Get all drivers in a cluster
func GetClusterDrivers(c *gin.Context) {
	clusterID := c.Query("cluster_id")
	if clusterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cluster_id required"})
		return
	}

	type DriverInfo struct {
		ID         int    `json:"id"`
		FullName   string `json:"full_name"`
		IsIncharge bool   `json:"is_incharge"`
	}

	rows, err := config.DB.Query(`
		SELECT d.id, u.full_name, d.is_incharge
		FROM driver_cluster_members dcm
		JOIN drivers d ON d.id = dcm.driver_id
		JOIN users u ON d.user_id = u.id
		WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		ORDER BY d.is_incharge DESC, u.full_name
	`, clusterID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var drivers []DriverInfo
	for rows.Next() {
		var d DriverInfo
		rows.Scan(&d.ID, &d.FullName, &d.IsIncharge)
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}
