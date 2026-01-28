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
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       v.insurance_expire_date, v.fc_expire_date, v.permit_expire_date,
		       fcr.id as fc_replacement_id,
		       fcr.status as fc_replacement_status,
		       DATE_FORMAT(fcr.start_date, '%Y-%m-%d') as fc_start_date,
		       DATE_FORMAT(fcr.end_date, '%Y-%m-%d') as fc_end_date,
		       fcr.reason as fc_reason,
		       rv.vehicle_number as replacement_vehicle_number
		FROM vehicles v
		LEFT JOIN fc_replacement_requests fcr ON v.id = fcr.vehicle_id 
		    AND fcr.status IN ('approved', 'active', 'pending')
		LEFT JOIN vehicles rv ON fcr.replacement_vehicle_id = rv.id
		ORDER BY v.id DESC
	`)
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
		FCReplacementID          *int    `json:"fc_replacement_id"`
		FCReplacementStatus      *string `json:"fc_replacement_status"`
		FCStartDate              *string `json:"fc_start_date"`
		FCEndDate                *string `json:"fc_end_date"`
		FCReason                 *string `json:"fc_reason"`
		ReplacementVehicleNumber *string `json:"replacement_vehicle_number"`
	}

	var vehicles []VehicleWithReplacement
	for rows.Next() {
		var v VehicleWithReplacement
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status,
			&v.InsuranceExpireDate, &v.FCExpireDate, &v.PermitExpireDate,
			&v.FCReplacementID, &v.FCReplacementStatus, &v.FCStartDate, &v.FCEndDate,
			&v.FCReason, &v.ReplacementVehicleNumber)
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

	result, err := config.DB.Exec(`
		INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity, 
		                      insurance_expire_date, fc_expire_date, permit_expire_date)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleNumber, req.VehicleType, req.FuelType, req.SeatingCapacity,
		req.InsuranceExpireDate, req.FCExpireDate, req.PermitExpireDate)

	if err != nil {
		log.Printf("Create vehicle error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If it's a bus, also create a record in the buses table
	if req.VehicleType == "BUS" {
		vehicleID, _ := result.LastInsertId()
		busName := req.BusName
		if busName == "" {
			busName = req.VehicleNumber
		}
		_, err = config.DB.Exec(`
			INSERT INTO buses (vehicle_id, bus_name, start_point, end_point)
			VALUES (?, ?, ?, ?)
		`, vehicleID, busName, req.StartPoint, req.EndPoint)
		if err != nil {
			log.Printf("Create bus record error: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle created successfully"})
}

/*
	=========================
	  BUS FLEET HANDLER
	  GET /api/admin/bus-fleet

=========================
*/
func GetBusFleet(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       COALESCE(b.bus_name, v.vehicle_number) as bus_name, 
		       COALESCE(b.start_point, '') as start_point,
		       COALESCE(b.end_point, '') as end_point
		FROM vehicles v
		LEFT JOIN buses b ON v.id = b.vehicle_id
		WHERE v.vehicle_type = 'BUS'
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("Get bus fleet error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching bus fleet"})
		return
	}
	defer rows.Close()

	type BusFleetItem struct {
		ID              int    `json:"id"`
		VehicleNumber   string `json:"vehicle_number"`
		VehicleType     string `json:"vehicle_type"`
		FuelType        string `json:"fuel_type"`
		SeatingCapacity int    `json:"seating_capacity"`
		Status          string `json:"status"`
		BusName         string `json:"bus_name"`
		StartPoint      string `json:"start_point"`
		EndPoint        string `json:"end_point"`
	}

	var fleet []BusFleetItem
	for rows.Next() {
		var item BusFleetItem
		err := rows.Scan(&item.ID, &item.VehicleNumber, &item.VehicleType, &item.FuelType,
			&item.SeatingCapacity, &item.Status, &item.BusName, &item.StartPoint, &item.EndPoint)
		if err != nil {
			continue
		}
		fleet = append(fleet, item)
	}

	c.JSON(http.StatusOK, fleet)
}

// POST /api/admin/vehicles/update - Update vehicle
func UpdateVehicle(c *gin.Context) {
	var v models.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`
		UPDATE vehicles SET vehicle_number=?, vehicle_type=?, fuel_type=?, seating_capacity=?, status=?,
		       insurance_expire_date=?, fc_expire_date=?, permit_expire_date=?
		WHERE id=?
	`, v.VehicleNumber, v.VehicleType, v.FuelType, v.SeatingCapacity, v.Status,
		v.InsuranceExpireDate, v.FCExpireDate, v.PermitExpireDate, v.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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
