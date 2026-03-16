package admin

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
)

// GET /api/admin/default-vehicle-drivers
func GetDefaultVehicleDrivers(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT dvd.id,
		       dvd.vehicle_id,
		       dvd.driver_id,
		       dvd.notes,
		       dvd.created_by,
		       DATE_FORMAT(dvd.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
		       DATE_FORMAT(dvd.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
		       COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
		       v.vehicle_number,
		       COALESCE(vt.type, '') AS vehicle_type,
		       COALESCE(u.full_name, '') AS driver_name,
		       COALESCE(u.phone, '') AS driver_phone
		FROM default_vehicle_drivers dvd
		JOIN vehicles v ON v.id = dvd.vehicle_id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		JOIN drivers d ON d.id = dvd.driver_id
		JOIN users u ON u.id = d.user_id
		ORDER BY v.vehicle_number ASC
	`)
	if err != nil {
		log.Printf("GetDefaultVehicleDrivers query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch default driver mappings"})
		return
	}
	defer rows.Close()

	mappings := make([]models.DefaultVehicleDriver, 0)
	for rows.Next() {
		var m models.DefaultVehicleDriver
		var notes sql.NullString
		var createdBy sql.NullInt64
		if err := rows.Scan(
			&m.ID,
			&m.VehicleID,
			&m.DriverID,
			&notes,
			&createdBy,
			&m.CreatedAt,
			&m.UpdatedAt,
			&m.VehicleName,
			&m.VehicleNumber,
			&m.VehicleType,
			&m.DriverName,
			&m.DriverPhone,
		); err != nil {
			log.Printf("GetDefaultVehicleDrivers scan error: %v", err)
			continue
		}

		if notes.Valid {
			m.Notes = &notes.String
		}
		if createdBy.Valid {
			v := int(createdBy.Int64)
			m.CreatedBy = &v
		}
		mappings = append(mappings, m)
	}

	c.JSON(http.StatusOK, mappings)
}

// POST /api/admin/default-vehicle-drivers/create
func CreateDefaultVehicleDriver(c *gin.Context) {
	var req models.CreateDefaultVehicleDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id and driver_id are required"})
		return
	}

	if req.VehicleID <= 0 || req.DriverID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id and driver_id must be valid"})
		return
	}

	if !recordExists("vehicles", req.VehicleID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle not found"})
		return
	}

	if !recordExists("drivers", req.DriverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	vehicleInUse, driverInUse, err := defaultMappingConflictExists(req.VehicleID, req.DriverID, 0)
	if err != nil {
		log.Printf("CreateDefaultVehicleDriver conflict check error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate default driver mapping"})
		return
	}
	if vehicleInUse {
		c.JSON(http.StatusConflict, gin.H{"error": "This vehicle already has a default driver mapping"})
		return
	}
	if driverInUse {
		c.JSON(http.StatusConflict, gin.H{"error": "This driver is already mapped to another vehicle"})
		return
	}

	_, err = config.DB.Exec(`
		INSERT INTO default_vehicle_drivers (vehicle_id, driver_id, notes, created_by)
		VALUES (?, ?, ?, ?)
	`, req.VehicleID, req.DriverID, req.Notes, req.CreatedBy)
	if err != nil {
		if isDuplicateKeyErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "This vehicle already has a default driver mapping"})
			return
		}
		log.Printf("CreateDefaultVehicleDriver insert error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create default driver mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Default driver mapping created successfully"})
}

// PUT /api/admin/default-vehicle-drivers/update
func UpdateDefaultVehicleDriver(c *gin.Context) {
	var req models.UpdateDefaultVehicleDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id, vehicle_id and driver_id are required"})
		return
	}

	if req.ID <= 0 || req.VehicleID <= 0 || req.DriverID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id, vehicle_id and driver_id must be valid"})
		return
	}

	if !recordExists("default_vehicle_drivers", req.ID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping not found"})
		return
	}

	if !recordExists("vehicles", req.VehicleID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle not found"})
		return
	}

	if !recordExists("drivers", req.DriverID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found"})
		return
	}

	vehicleInUse, driverInUse, err := defaultMappingConflictExists(req.VehicleID, req.DriverID, req.ID)
	if err != nil {
		log.Printf("UpdateDefaultVehicleDriver conflict check error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate default driver mapping"})
		return
	}
	if vehicleInUse {
		c.JSON(http.StatusConflict, gin.H{"error": "This vehicle already has a default driver mapping"})
		return
	}
	if driverInUse {
		c.JSON(http.StatusConflict, gin.H{"error": "This driver is already mapped to another vehicle"})
		return
	}

	res, err := config.DB.Exec(`
		UPDATE default_vehicle_drivers
		SET vehicle_id = ?,
		    driver_id = ?,
		    notes = ?,
		    updated_at = NOW()
		WHERE id = ?
	`, req.VehicleID, req.DriverID, req.Notes, req.ID)
	if err != nil {
		if isDuplicateKeyErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "This vehicle already has a default driver mapping"})
			return
		}
		log.Printf("UpdateDefaultVehicleDriver update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update default driver mapping"})
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Default driver mapping updated successfully"})
}

// DELETE /api/admin/default-vehicle-drivers/delete?id={id}
func DeleteDefaultVehicleDriver(c *gin.Context) {
	idStr := c.Query("id")
	if strings.TrimSpace(idStr) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	res, err := config.DB.Exec(`DELETE FROM default_vehicle_drivers WHERE id = ?`, id)
	if err != nil {
		log.Printf("DeleteDefaultVehicleDriver delete error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete default driver mapping"})
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mapping not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Default driver mapping deleted successfully"})
}

func recordExists(table string, id int) bool {
	if id <= 0 {
		return false
	}

	query := "SELECT COUNT(1) FROM " + table + " WHERE id = ?"
	var count int
	if err := config.DB.QueryRow(query, id).Scan(&count); err != nil {
		return false
	}
	return count > 0
}

func isDuplicateKeyErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique")
}

func defaultMappingConflictExists(vehicleID, driverID, excludeID int) (bool, bool, error) {
	vehicleQuery := `SELECT COUNT(1) FROM default_vehicle_drivers WHERE vehicle_id = ?`
	driverQuery := `SELECT COUNT(1) FROM default_vehicle_drivers WHERE driver_id = ?`
	vehicleArgs := []interface{}{vehicleID}
	driverArgs := []interface{}{driverID}

	if excludeID > 0 {
		vehicleQuery += ` AND id <> ?`
		driverQuery += ` AND id <> ?`
		vehicleArgs = append(vehicleArgs, excludeID)
		driverArgs = append(driverArgs, excludeID)
	}

	var vehicleCount int
	if err := config.DB.QueryRow(vehicleQuery, vehicleArgs...).Scan(&vehicleCount); err != nil {
		return false, false, err
	}

	var driverCount int
	if err := config.DB.QueryRow(driverQuery, driverArgs...).Scan(&driverCount); err != nil {
		return false, false, err
	}

	return vehicleCount > 0, driverCount > 0, nil
}
