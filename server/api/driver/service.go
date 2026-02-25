package driver

import (
	"database/sql"
	"fmt"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// DriverServiceRecord - service record view for drivers
type DriverServiceRecord struct {
	ID                int     `json:"id"`
	VehicleID         int     `json:"vehicle_id"`
	VehicleNumber     string  `json:"vehicle_number"`
	VehicleName       string  `json:"vehicle_name"`
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	Severity          string  `json:"severity"`
	Status            string  `json:"status"`
	ServiceTypeName   string  `json:"service_type_name"`
	ScheduledDate     *string `json:"scheduled_date"`
	CompletedAt       *string `json:"completed_at"`
	AdminRemarks      string  `json:"admin_remarks"`
	RejectionReason   string  `json:"rejection_reason"`
	TotalCost         float64 `json:"total_cost"`
	OdometerAtService *int    `json:"odometer_at_service"`
	CreatedAt         string  `json:"created_at"`
}

// ReportIssue allows a driver to report a vehicle issue
func ReportIssue(c *gin.Context) {
	var req models.DriverServiceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if req.VehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID is required"})
		return
	}

	severity := req.Severity
	if severity == "" {
		severity = "medium"
	}

	// Get user_id from JWT context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO service_records 
		(vehicle_id, service_type_id, reported_by, title, description, severity, status, odometer_at_service)
		VALUES (?, ?, ?, ?, ?, ?, 'reported', ?)
	`, req.VehicleID, req.ServiceTypeID, userID, req.Title, req.Description, severity, req.OdometerAtService)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to report issue: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	// Get vehicle number for notification
	var vehicleNumber string
	config.DB.QueryRow(`SELECT vehicle_number FROM vehicles WHERE id = ?`, req.VehicleID).Scan(&vehicleNumber)

	// Get driver name for notification
	var driverName string
	config.DB.QueryRow(`SELECT full_name FROM users WHERE id = ?`, userID).Scan(&driverName)

	// Notify admins
	config.DB.Exec(`
		INSERT INTO notifications (recipient_role, recipient_id, type, title, message, reference_id, is_read)
		VALUES ('ADMIN', 0, 'service_reported', ?, ?, ?, FALSE)
	`, "New Service Request",
		fmt.Sprintf("Driver %s reported an issue for vehicle %s: %s (Severity: %s)", driverName, vehicleNumber, req.Title, severity),
		id)

	c.JSON(http.StatusOK, gin.H{"message": "Issue reported successfully", "id": id})
}

// GetMyServiceRequests returns service requests reported by the current driver
func GetMyServiceRequests(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			sr.id, sr.vehicle_id, COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''),
			sr.title, COALESCE(sr.description, ''), sr.severity, sr.status,
			COALESCE(st.name, ''), COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), ''), COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'), ''),
			COALESCE(sr.admin_remarks, ''), COALESCE(sr.rejection_reason, ''),
			sr.total_cost, sr.odometer_at_service, DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN service_types st ON sr.service_type_id = st.id
		WHERE sr.reported_by = ?
		ORDER BY sr.created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusOK, []DriverServiceRecord{})
		return
	}
	defer rows.Close()

	records := scanDriverServiceRecords(rows)
	c.JSON(http.StatusOK, records)
}

// GetVehicleServiceHistory returns service history for a given vehicle
func GetVehicleServiceHistory(c *gin.Context) {
	vehicleID := c.Query("vehicle_id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id is required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			sr.id, sr.vehicle_id, COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''),
			sr.title, COALESCE(sr.description, ''), sr.severity, sr.status,
			COALESCE(st.name, ''), COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), ''), COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'), ''),
			COALESCE(sr.admin_remarks, ''), COALESCE(sr.rejection_reason, ''),
			sr.total_cost, sr.odometer_at_service, DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p')
		FROM service_records sr
		LEFT JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN service_types st ON sr.service_type_id = st.id
		WHERE sr.vehicle_id = ? AND sr.status IN ('completed', 'in_progress', 'approved')
		ORDER BY sr.created_at DESC
	`, vehicleID)
	if err != nil {
		c.JSON(http.StatusOK, []DriverServiceRecord{})
		return
	}
	defer rows.Close()

	records := scanDriverServiceRecords(rows)
	c.JSON(http.StatusOK, records)
}

// scanDriverServiceRecords helper
func scanDriverServiceRecords(rows *sql.Rows) []DriverServiceRecord {
	var records []DriverServiceRecord
	for rows.Next() {
		var r DriverServiceRecord
		var scheduledDate, completedAt sql.NullString
		var odometerAtService sql.NullInt64

		if err := rows.Scan(
			&r.ID, &r.VehicleID, &r.VehicleNumber, &r.VehicleName,
			&r.Title, &r.Description, &r.Severity, &r.Status,
			&r.ServiceTypeName, &scheduledDate, &completedAt,
			&r.AdminRemarks, &r.RejectionReason,
			&r.TotalCost, &odometerAtService, &r.CreatedAt,
		); err != nil {
			continue
		}

		if scheduledDate.Valid {
			r.ScheduledDate = &scheduledDate.String
		}
		if completedAt.Valid {
			r.CompletedAt = &completedAt.String
		}
		if odometerAtService.Valid {
			v := int(odometerAtService.Int64)
			r.OdometerAtService = &v
		}

		records = append(records, r)
	}

	if records == nil {
		records = []DriverServiceRecord{}
	}
	return records
}
