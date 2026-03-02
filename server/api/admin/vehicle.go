package admin

import (
	"log"
	"net/http"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

/* =========================
   VEHICLE HANDLERS
========================= */

// GET /api/admin/vehicles - List all vehicles
func GetAllVehicles(c *gin.Context) {
	query := `
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y') as insurance_expire_date,
		       DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y') as fc_expire_date,
		       DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y') as permit_expire_date,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
		       COALESCE(b.start_point, ''),
		       COALESCE(b.end_point, ''),
		       vr.id as replacement_id,
		       vr.status as replacement_status,
		       DATE_FORMAT(vr.start_date, '%d-%m-%Y') as replacement_start_date,
		       DATE_FORMAT(vr.end_date, '%d-%m-%Y') as replacement_end_date,
		       vr.reason as replacement_reason,
		       rv.vehicle_number as replacement_vehicle_number,
		       vgm.group_id as vehicle_group_id,
		       COALESCE(vg.name, '') as vehicle_group_name
		FROM vehicles v
		LEFT JOIN buses b ON v.id = b.vehicle_id
		LEFT JOIN vehicle_replacements vr ON v.id = vr.vehicle_id 
		    AND vr.status IN ('approved', 'pending')
		LEFT JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
		LEFT JOIN vehicle_group_members vgm ON vgm.vehicle_id = v.id AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
		LEFT JOIN vehicle_groups vg ON vg.id = vgm.group_id
		ORDER BY v.id DESC
	`

	rows, err := config.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type VehicleWithReplacement struct {
		ID                       int     `json:"id"`
		VehicleNumber            string  `json:"vehicle_number"`
		VehicleType              string  `json:"vehicle_type"`
		FuelType                 string  `json:"fuel_type"`
		SeatingCapacity          int     `json:"seating_capacity"`
		Status                   string  `json:"status"`
		InsuranceExpireDate      *string `json:"insurance_expire_date"`
		FCExpireDate             *string `json:"fc_expire_date"`
		PermitExpireDate         *string `json:"permit_expire_date"`
		VehicleName              string  `json:"vehicle_name"`
		StartPoint               string  `json:"start_point"`
		EndPoint                 string  `json:"end_point"`
		ReplacementID            *int    `json:"replacement_id"`
		ReplacementStatus        *string `json:"replacement_status"`
		ReplacementStartDate     *string `json:"replacement_start_date"`
		ReplacementEndDate       *string `json:"replacement_end_date"`
		ReplacementReason        *string `json:"replacement_reason"`
		ReplacementVehicleNumber *string `json:"replacement_vehicle_number"`
		VehicleGroupID           *int    `json:"vehicle_group_id"`
		VehicleGroupName         string  `json:"vehicle_group_name"`
	}

	var vehicles []VehicleWithReplacement
	for rows.Next() {
		var v VehicleWithReplacement
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status,
			&v.InsuranceExpireDate, &v.FCExpireDate, &v.PermitExpireDate,
			&v.VehicleName, &v.StartPoint, &v.EndPoint,
			&v.ReplacementID, &v.ReplacementStatus, &v.ReplacementStartDate, &v.ReplacementEndDate,
			&v.ReplacementReason, &v.ReplacementVehicleNumber,
			&v.VehicleGroupID, &v.VehicleGroupName)
		vehicles = append(vehicles, v)
	}

	c.JSON(http.StatusOK, vehicles)
}

// POST /api/admin/vehicles/create - Create vehicle
func CreateVehicle(c *gin.Context) {
	var req models.CreateVehicleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	query := `
		INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type, fuel_type, seating_capacity, 
		                      insurance_expire_date, fc_expire_date, permit_expire_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	// Normalise empty date strings → nil so MySQL receives NULL, not ''
	req.InsuranceExpireDate = nullifyEmptyDate(req.InsuranceExpireDate)
	req.FCExpireDate = nullifyEmptyDate(req.FCExpireDate)
	req.PermitExpireDate = nullifyEmptyDate(req.PermitExpireDate)

	result, err := config.DB.Exec(query,
		req.VehicleName, req.VehicleNumber, req.VehicleType, req.FuelType, req.SeatingCapacity,
		req.InsuranceExpireDate, req.FCExpireDate, req.PermitExpireDate)

	if err != nil {
		log.Printf("Create vehicle error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If it's a bus, also create a record in the buses table
	if req.VehicleType == "BUS" {
		vehicleID, _ := result.LastInsertId()
		_, err = config.DB.Exec(`
			INSERT INTO buses (vehicle_id, start_point, end_point)
			VALUES (?, ?, ?)
		`, vehicleID, req.StartPoint, req.EndPoint)
		if err != nil {
			log.Printf("Create bus record error: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle created successfully"})
}

// nullifyEmptyDate converts a *string that holds an empty string into nil,
// so the SQL driver sends NULL to MySQL DATE columns instead of an empty
// string (which MySQL strict mode rejects as an invalid date value).
func nullifyEmptyDate(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

// POST /api/admin/vehicles/update - Update vehicle
func UpdateVehicle(c *gin.Context) {
	var v models.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Normalise empty date strings → nil so MySQL receives NULL, not ''
	v.InsuranceExpireDate = nullifyEmptyDate(v.InsuranceExpireDate)
	v.FCExpireDate = nullifyEmptyDate(v.FCExpireDate)
	v.PermitExpireDate = nullifyEmptyDate(v.PermitExpireDate)

	query := `
		UPDATE vehicles SET vehicle_name=?, vehicle_number=?, vehicle_type=?, fuel_type=?, seating_capacity=?, status=?,
		       insurance_expire_date=?, fc_expire_date=?, permit_expire_date=?
		WHERE id=?
	`
	_, err := config.DB.Exec(query,
		v.VehicleName, v.VehicleNumber, v.VehicleType, v.FuelType, v.SeatingCapacity, v.Status,
		v.InsuranceExpireDate, v.FCExpireDate, v.PermitExpireDate, v.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If it's a bus, update or create the bus record
	if v.VehicleType == "BUS" {
		_, err = config.DB.Exec(`
			INSERT INTO buses (vehicle_id, start_point, end_point)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE start_point = VALUES(start_point), end_point = VALUES(end_point)
		`, v.ID, v.StartPoint, v.EndPoint)
		if err != nil {
			log.Printf("Update bus error: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle updated successfully"})
}

// DELETE /api/admin/vehicles/delete?id=X
func DeleteVehicle(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}

	_, err := config.DB.Exec("DELETE FROM vehicles WHERE id=?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle deleted successfully"})
}

// GET /api/admin/vehicles/alerts - Get vehicles with expired/critical documents
func GetVehicleDocumentAlerts(c *gin.Context) {
	// Get vehicles with expired documents OR expiring within 10 days
	rows, err := config.DB.Query(`
		SELECT id, vehicle_number, vehicle_type, status,
		       insurance_expire_date, fc_expire_date, permit_expire_date,
		       DATEDIFF(insurance_expire_date, CURDATE()) as insurance_days,
		       DATEDIFF(fc_expire_date, CURDATE()) as fc_days,
		       DATEDIFF(permit_expire_date, CURDATE()) as permit_days
		FROM vehicles 
		WHERE status IN ('active', 'available')
		  AND (
		    (insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10)
		    OR (fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10)
		    OR (permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10)
		  )
		ORDER BY 
		  LEAST(
		    COALESCE(DATEDIFF(insurance_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(fc_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(permit_expire_date, CURDATE()), 999)
		  ) ASC
	`)
	if err != nil {
		log.Printf("Vehicle document alerts error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type VehicleAlert struct {
		ID              int     `json:"id"`
		VehicleNumber   string  `json:"vehicle_number"`
		VehicleType     string  `json:"vehicle_type"`
		Status          string  `json:"status"`
		InsuranceExpire *string `json:"insurance_expire_date"`
		FCExpire        *string `json:"fc_expire_date"`
		PermitExpire    *string `json:"permit_expire_date"`
		InsuranceDays   *int    `json:"insurance_days"`
		FCDays          *int    `json:"fc_days"`
		PermitDays      *int    `json:"permit_days"`
	}

	var alerts []VehicleAlert
	for rows.Next() {
		var a VehicleAlert
		rows.Scan(&a.ID, &a.VehicleNumber, &a.VehicleType, &a.Status,
			&a.InsuranceExpire, &a.FCExpire, &a.PermitExpire,
			&a.InsuranceDays, &a.FCDays, &a.PermitDays)
		alerts = append(alerts, a)
	}

	// Count expired (< 0 days) and critical (0-10 days)
	expired := 0
	critical := 0
	for _, a := range alerts {
		hasExpired := false
		hasCritical := false

		if a.InsuranceDays != nil && *a.InsuranceDays < 0 {
			hasExpired = true
		} else if a.InsuranceDays != nil && *a.InsuranceDays <= 10 {
			hasCritical = true
		}

		if a.FCDays != nil && *a.FCDays < 0 {
			hasExpired = true
		} else if a.FCDays != nil && *a.FCDays <= 10 {
			hasCritical = true
		}

		if a.PermitDays != nil && *a.PermitDays < 0 {
			hasExpired = true
		} else if a.PermitDays != nil && *a.PermitDays <= 10 {
			hasCritical = true
		}

		if hasExpired {
			expired++
		} else if hasCritical {
			critical++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts":   alerts,
		"expired":  expired,
		"critical": critical,
		"total":    len(alerts),
	})
}
