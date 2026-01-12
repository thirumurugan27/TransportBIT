package admin

import (
	"log"
	"net/http"

	"transport-server/config"

	"github.com/gin-gonic/gin"
)

/*
=========================

	GET /api/admin/drivers/km-suggestions
	Get drivers sorted by least KM driven (for vehicle assignment)

=========================
*/
func GetDriverKmSuggestions(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT d.id, u.full_name, 
			   COALESCE(SUM(k.total_km), 0) as total_km_driven,
			   COUNT(k.id) as trips_count,
			   COALESCE(att.status, 'absent') as status
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN km_logs k ON k.driver_id = d.id
		LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
		GROUP BY d.id, u.full_name, att.status
		ORDER BY total_km_driven ASC, trips_count ASC
	`)
	if err != nil {
		log.Printf("Get KM suggestions error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching suggestions"})
		return
	}
	defer rows.Close()

	type DriverSuggestion struct {
		ID            int     `json:"id"`
		Name          string  `json:"name"`
		TotalKmDriven float64 `json:"total_km_driven"`
		TripsCount    int     `json:"trips_count"`
		Status        string  `json:"status"`
	}

	var suggestions []DriverSuggestion
	for rows.Next() {
		var s DriverSuggestion
		err := rows.Scan(&s.ID, &s.Name, &s.TotalKmDriven, &s.TripsCount, &s.Status)
		if err != nil {
			continue
		}
		suggestions = append(suggestions, s)
	}

	c.JSON(http.StatusOK, suggestions)
}
