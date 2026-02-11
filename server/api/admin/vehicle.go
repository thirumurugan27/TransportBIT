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
		       fcr.id as fc_replacement_id,
		       fcr.status as fc_replacement_status,
		       DATE_FORMAT(fcr.start_date, '%d-%m-%Y') as fc_start_date,
		       DATE_FORMAT(fcr.end_date, '%d-%m-%Y') as fc_end_date,
		       fcr.reason as fc_reason,
		       rv.vehicle_number as replacement_vehicle_number,
		       vgm.group_id as vehicle_group_id,
		       COALESCE(vg.name, '') as vehicle_group_name
		FROM vehicles v
		LEFT JOIN buses b ON v.id = b.vehicle_id
		LEFT JOIN fc_replacement_requests fcr ON v.id = fcr.vehicle_id 
		    AND fcr.status IN ('approved', 'active', 'pending')
		LEFT JOIN vehicles rv ON fcr.replacement_vehicle_id = rv.id
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
		FCReplacementID          *int    `json:"fc_replacement_id"`
		FCReplacementStatus      *string `json:"fc_replacement_status"`
		FCStartDate              *string `json:"fc_start_date"`
		FCEndDate                *string `json:"fc_end_date"`
		FCReason                 *string `json:"fc_reason"`
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
			&v.FCReplacementID, &v.FCReplacementStatus, &v.FCStartDate, &v.FCEndDate,
			&v.FCReason, &v.ReplacementVehicleNumber,
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
		busName := req.VehicleName
		if busName == "" {
			busName = req.VehicleNumber
		}
		_, err = config.DB.Exec(`
			INSERT INTO buses (vehicle_id, name, start_point, end_point)
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
	query := `
		SELECT v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, 
		       COALESCE(b.start_point, '') as start_point,
		       COALESCE(b.end_point, '') as end_point,
		       (SELECT COUNT(*) FROM bus_stops bs WHERE bs.vehicle_id = v.id) as stops_count
		FROM vehicles v
		LEFT JOIN buses b ON v.id = b.vehicle_id
		WHERE v.vehicle_type = 'BUS'
		ORDER BY vehicle_name ASC
	`

	rows, err := config.DB.Query(query)
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
		VehicleName     string `json:"vehicle_name"`
		StartPoint      string `json:"start_point"`
		EndPoint        string `json:"end_point"`
		StopsCount      int    `json:"stops_count"`
	}

	var fleet []BusFleetItem
	for rows.Next() {
		var item BusFleetItem
		err := rows.Scan(&item.ID, &item.VehicleNumber, &item.VehicleType, &item.FuelType,
			&item.SeatingCapacity, &item.Status, &item.VehicleName, &item.StartPoint, &item.EndPoint, &item.StopsCount)
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
			INSERT INTO buses (vehicle_id, name, start_point, end_point)
			VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), start_point = VALUES(start_point), end_point = VALUES(end_point)
		`, v.ID, v.VehicleName, v.StartPoint, v.EndPoint)
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
