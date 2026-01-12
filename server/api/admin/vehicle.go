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
		SELECT id, vehicle_number, vehicle_type, fuel_type, seating_capacity, status
		FROM vehicles ORDER BY id DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status)
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
		INSERT INTO vehicles (vehicle_number, vehicle_type, fuel_type, seating_capacity)
		VALUES (?, ?, ?, ?)
	`, req.VehicleNumber, req.VehicleType, req.FuelType, req.SeatingCapacity)

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
/* =========================
   BUS FLEET HANDLER
   GET /api/admin/bus-fleet
========================= */
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
		UPDATE vehicles SET vehicle_number=?, vehicle_type=?, fuel_type=?, seating_capacity=?, status=?
		WHERE id=?
	`, v.VehicleNumber, v.VehicleType, v.FuelType, v.SeatingCapacity, v.Status, v.ID)

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