package bus

import (
	"log"
	"net/http"
	"strings"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
	=========================
	  BUS FLEET HANDLERS
	  Manage buses with their routes/stops and fees
	=========================
*/

// BusFleetItem - Bus with full details for fleet view
type BusFleetItem struct {
	ID              int     `json:"id"`
	VehicleNumber   string  `json:"vehicle_number"`
	VehicleType     string  `json:"vehicle_type"`
	FuelType        string  `json:"fuel_type"`
	SeatingCapacity int     `json:"seating_capacity"`
	Status          string  `json:"status"`
	DriverID        *int    `json:"driver_id"`
	DriverName      *string `json:"driver_name"`
	StartPoint      *string `json:"start_point"`
	EndPoint        *string `json:"end_point"`
	TotalStops      int     `json:"total_stops"`
}

// BusStop - Stop with fee for a bus route
type BusStop struct {
	ID          int     `json:"id"`
	StopID      int     `json:"stop_id"`
	VehicleID   int     `json:"vehicle_id"`
	StopName    string  `json:"stop_name"`
	StopOrder   int     `json:"stop_order"`
	Fee         float64 `json:"fee"`
	DistanceKm  float64 `json:"distance_km"`
	ArrivalTime string  `json:"arrival_time"`
}

type AddBusStopRequest struct {
	BusID       int     `json:"bus_id"`
	VehicleID   int     `json:"vehicle_id"`
	StopName    string  `json:"stop_name"`
	StopOrder   int     `json:"stop_order"`
	Fee         float64 `json:"fee"`
	DistanceKm  float64 `json:"distance_km"`
	ArrivalTime string  `json:"arrival_time"`
}

type UpdateBusStopRequest struct {
	ID          int     `json:"id"`
	StopName    string  `json:"stop_name"`
	StopOrder   int     `json:"stop_order"`
	Fee         float64 `json:"fee"`
	DistanceKm  float64 `json:"distance_km"`
	ArrivalTime string  `json:"arrival_time"`
}

type UpdateBusRouteRequest struct {
	ID          int    `json:"id"`
	VehicleID   int    `json:"vehicle_id"`
	StartPoint  string `json:"start_point"`
	EndPoint    string `json:"end_point"`
	VehicleName string `json:"vehicle_name"`
}

/*
=========================

	GET /api/admin/bus-fleet
	Get all buses with driver info and stop count

=========================
*/
func GetBusFleet(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			v.id, v.vehicle_number, v.vehicle_type, v.fuel_type, v.seating_capacity, v.status,
			(SELECT d2.id FROM assignments a2 
			 JOIN drivers d2 ON a2.driver_id = d2.id 
			 WHERE a2.vehicle_id = v.id AND a2.status = 'assigned' AND DATE(a2.assigned_date) = CURDATE() 
			 LIMIT 1) as driver_id,
			(SELECT u2.full_name FROM assignments a2 
			 JOIN drivers d2 ON a2.driver_id = d2.id 
			 JOIN users u2 ON d2.user_id = u2.id
			 WHERE a2.vehicle_id = v.id AND a2.status = 'assigned' AND DATE(a2.assigned_date) = CURDATE() 
			 LIMIT 1) as driver_name,
			COALESCE(b.start_point, '') as start_point, 
			COALESCE(b.end_point, '') as end_point,
			COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
			(SELECT COUNT(*) FROM bus_stops bs WHERE bs.vehicle_id = v.id) as total_stops
		FROM vehicles v
		LEFT JOIN buses b ON b.vehicle_id = v.id
		WHERE v.vehicle_type = 'BUS'
		ORDER BY COALESCE(v.vehicle_name, v.vehicle_number) ASC
	`)
	if err != nil {
		log.Printf("Get bus fleet error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching bus fleet"})
		return
	}
	defer rows.Close()

	type BusFleetItemExtended struct {
		ID              int     `json:"id"`
		VehicleNumber   string  `json:"vehicle_number"`
		VehicleType     string  `json:"vehicle_type"`
		FuelType        string  `json:"fuel_type"`
		SeatingCapacity int     `json:"seating_capacity"`
		Status          string  `json:"status"`
		DriverID        *int    `json:"driver_id"`
		DriverName      *string `json:"driver_name"`
		StartPoint      string  `json:"start_point"`
		EndPoint        string  `json:"end_point"`
		VehicleName     string  `json:"vehicle_name"`
		TotalStops      int     `json:"total_stops"`
	}

	var buses []BusFleetItemExtended
	for rows.Next() {
		var b BusFleetItemExtended
		rows.Scan(&b.ID, &b.VehicleNumber, &b.VehicleType, &b.FuelType, &b.SeatingCapacity, &b.Status,
			&b.DriverID, &b.DriverName, &b.StartPoint, &b.EndPoint, &b.VehicleName, &b.TotalStops)
		buses = append(buses, b)
	}

	c.JSON(http.StatusOK, buses)
}

/*
=========================

	GET /api/admin/bus/{id}/stops
	Get all stops for a specific bus

=========================
*/
func GetBusStops(c *gin.Context) {
	// Extract bus ID from URL path - param :id
	busID := c.Param("id")
	if busID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bus ID required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, vehicle_id, stop_name, stop_order, fee, distance_km,
			COALESCE(TIME_FORMAT(arrival_time, '%h:%i %p'), '') as arrival_time
		FROM bus_stops
		WHERE vehicle_id = ?
		ORDER BY stop_order ASC
	`, busID)
	if err != nil {
		log.Printf("Get bus stops error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching stops"})
		return
	}
	defer rows.Close()

	var stops []BusStop
	for rows.Next() {
		var s BusStop
		rows.Scan(&s.ID, &s.VehicleID, &s.StopName, &s.StopOrder, &s.Fee, &s.DistanceKm, &s.ArrivalTime)
		s.StopID = s.ID // Add stop_id as alias for frontend compatibility
		stops = append(stops, s)
	}

	c.JSON(http.StatusOK, stops)
}

/*
=========================

	POST /api/admin/bus-stop/add
	Add a stop to a bus route

=========================
*/
func AddBusStop(c *gin.Context) {
	var req AddBusStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	busID := req.BusID
	if busID == 0 {
		busID = req.VehicleID
	}
	if busID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bus ID is required"})
		return
	}

	// Auto-determine stop_order if not provided or zero
	stopOrder := req.StopOrder
	if stopOrder == 0 {
		var maxOrder int
		config.DB.QueryRow(`SELECT COALESCE(MAX(stop_order), 0) FROM bus_stops WHERE vehicle_id = ?`, busID).Scan(&maxOrder)
		stopOrder = maxOrder + 1
	}

	arrivalTime := strings.TrimSpace(req.ArrivalTime)
	var arrivalValue interface{}
	if arrivalTime != "" {
		arrivalValue = arrivalTime
	}

	_, err := config.DB.Exec(`
		INSERT INTO bus_stops (vehicle_id, stop_name, stop_order, fee, distance_km, arrival_time)
		VALUES (?, ?, ?, ?, ?, ?)
	`, busID, req.StopName, stopOrder, req.Fee, req.DistanceKm, arrivalValue)

	if err != nil {
		log.Printf("Add bus stop error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stop added successfully"})
}

/*
=========================

	POST /api/admin/bus-stop/update
	Update a bus stop

=========================
*/
func UpdateBusStop(c *gin.Context) {
	var req UpdateBusStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	arrivalTime := strings.TrimSpace(req.ArrivalTime)
	var arrivalValue interface{}
	if arrivalTime != "" {
		arrivalValue = arrivalTime
	}

	_, err := config.DB.Exec(`
		UPDATE bus_stops 
		SET stop_name=?, stop_order=?, fee=?, distance_km=?, arrival_time=?
		WHERE id=?
	`, req.StopName, req.StopOrder, req.Fee, req.DistanceKm, arrivalValue, req.ID)

	if err != nil {
		log.Printf("Update bus stop error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stop updated successfully"})
}

/*
=========================

	POST /api/admin/bus-stop/delete
	Delete a bus stop

=========================
*/
func DeleteBusStop(c *gin.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := config.DB.Exec(`DELETE FROM bus_stops WHERE id=?`, req.ID)
	if err != nil {
		log.Printf("Delete bus stop error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stop deleted successfully"})
}

/*
=========================

	POST /api/admin/bus-route/update
	Update bus route info (start/end points)

=========================
*/
func UpdateBusRoute(c *gin.Context) {
	var req UpdateBusRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Determine Vehicle ID from either id or vehicle_id
	vehicleID := req.VehicleID
	if vehicleID == 0 {
		vehicleID = req.ID
	}
	if vehicleID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID is required"})
		return
	}

	// Update or insert into buses table
	_, err := config.DB.Exec(`
		INSERT INTO buses (vehicle_id, start_point, end_point)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE start_point=VALUES(start_point), end_point=VALUES(end_point)
	`, vehicleID, req.StartPoint, req.EndPoint)

	if err != nil {
		log.Printf("Update bus route error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update bus route"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Route updated successfully"})
}


