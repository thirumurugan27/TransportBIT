package admin

import (
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
=========================

	GET /api/admin/assignments/absent-alerts
	Get assignments where driver is absent for a given date

=========================
*/
func GetAbsentDriverAlerts(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = "CURDATE()"
	} else {
		date = "'" + date + "'"
	}

	rows, err := config.DB.Query(`
		SELECT a.id, a.assigned_date, 
		       d.id as driver_id, u.full_name as driver_name, 
		       v.id as vehicle_id, v.vehicle_number,
		       s.id as shift_id, s.name as shift_name, s.start_time, s.end_time,
		       COALESCE(dc.id, 0) as cluster_id, COALESCE(dc.name, '') as cluster_name,
		       a.original_driver_id, a.is_temporary_replacement
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON a.vehicle_id = v.id
		JOIN shifts s ON a.shift_id = s.id
		LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN driver_clusters dc ON dcm.cluster_id = dc.id
		WHERE a.assigned_date = ` + date + `
		  AND a.status IN ('absent', 'on_leave')
		ORDER BY s.start_time
	`)
	if err != nil {
		log.Printf("Get absent alerts error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching alerts"})
		return
	}
	defer rows.Close()

	type AbsentAlert struct {
		AssignmentID           int    `json:"assignment_id"`
		AssignedDate           string `json:"assigned_date"`
		DriverID               int    `json:"driver_id"`
		DriverName             string `json:"driver_name"`
		VehicleID              int    `json:"vehicle_id"`
		VehicleNumber          string `json:"vehicle_number"`
		ShiftID                int    `json:"shift_id"`
		ShiftName              string `json:"shift_name"`
		StartTime              string `json:"start_time"`
		EndTime                string `json:"end_time"`
		ClusterID              int    `json:"cluster_id"`
		ClusterName            string `json:"cluster_name"`
		OriginalDriverID       *int   `json:"original_driver_id"`
		IsTemporaryReplacement bool   `json:"is_temporary_replacement"`
	}

	var alerts []AbsentAlert
	for rows.Next() {
		var a AbsentAlert
		err := rows.Scan(&a.AssignmentID, &a.AssignedDate, &a.DriverID, &a.DriverName,
			&a.VehicleID, &a.VehicleNumber, &a.ShiftID, &a.ShiftName,
			&a.StartTime, &a.EndTime, &a.ClusterID, &a.ClusterName,
			&a.OriginalDriverID, &a.IsTemporaryReplacement)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		alerts = append(alerts, a)
	}

	c.JSON(http.StatusOK, alerts)
}
