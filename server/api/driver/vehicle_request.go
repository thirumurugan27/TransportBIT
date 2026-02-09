package driver

import (
	"fmt"
	"log"
	"net/http"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// GET /api/driver/vehicle-requests - Get vehicle requests assigned to driver
func GetDriverVehicleRequests(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get driver ID
	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder")
	purposeExpr := "'' as Purpose"
	if colExists["Purpose"] && colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose"
	} else if colExists["Purpose"] {
		purposeExpr = "COALESCE(vr.Purpose, '') as Purpose"
	} else if colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.PurposeOfVisit, '') as Purpose"
	}
	requestUnderExpr := "'' as RequestUnder"
	if colExists["RequestUnder"] {
		requestUnderExpr = "COALESCE(vr.RequestUnder, '') as RequestUnder"
	}

	// Fetch assigned vehicle requests
	query := fmt.Sprintf(`
		SELECT 
			vr.id, vr.faculty_id,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			COALESCE(vr.TripMode, 'official') as TripMode,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vr.OnwardFromPlace, '') as OnwardFromPlace,
			COALESCE(vr.OnwardToPlace, '') as OnwardToPlace,
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%Y-%%m-%%d %%H:%%i') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? AND vr.status IN ('assigned', 'completed')
		ORDER BY vr.OnwardFromDateTime DESC
	`, requestUnderExpr, purposeExpr)
	rows, err := config.DB.Query(query, driverID)
	if err != nil {
		log.Printf("Error fetching driver vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var requests []models.VehicleRequest
	for rows.Next() {
		var r models.VehicleRequest
		err := rows.Scan(
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone,
			&r.Status, &r.AdminRemarks,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// GET /api/driver/vehicle-requests/upcoming - Get upcoming vehicle requests
func GetDriverUpcomingVehicleRequests(c *gin.Context) {
	userID, err := utils.GetUserIDFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var driverID int
	err = config.DB.QueryRow(`SELECT id FROM drivers WHERE user_id = ?`, userID).Scan(&driverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver profile not found"})
		return
	}

	colExists, _ := config.HasColumns("vehiclerequests", "Purpose", "PurposeOfVisit", "RequestUnder")
	purposeExpr := "'' as Purpose"
	if colExists["Purpose"] && colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose"
	} else if colExists["Purpose"] {
		purposeExpr = "COALESCE(vr.Purpose, '') as Purpose"
	} else if colExists["PurposeOfVisit"] {
		purposeExpr = "COALESCE(vr.PurposeOfVisit, '') as Purpose"
	}
	requestUnderExpr := "'' as RequestUnder"
	if colExists["RequestUnder"] {
		requestUnderExpr = "COALESCE(vr.RequestUnder, '') as RequestUnder"
	}

	// Fetch upcoming assigned vehicle requests (departure date >= today)
	query := fmt.Sprintf(`
		SELECT 
			vr.id, vr.faculty_id,
			COALESCE(vr.BookingType, 'faculty') as BookingType,
			COALESCE(vr.TripType, 'one_way') as TripType,
			COALESCE(vr.TripMode, 'official') as TripMode,
			%s,
			%s,
			COALESCE(vr.CountPerson, 1) as CountPerson,
			COALESCE(vr.OnwardFromPlace, '') as OnwardFromPlace,
			COALESCE(vr.OnwardToPlace, '') as OnwardToPlace,
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardFromDateTime,
			COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as OnwardTodateTime,
			COALESCE(vr.ReturnFromPlace, '') as ReturnFromPlace,
			COALESCE(vr.ReturnToPlace, '') as ReturnToPlace,
			COALESCE(DATE_FORMAT(vr.ReturnFromDateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnFromDateTime,
			COALESCE(DATE_FORMAT(vr.ReturnTodateTime, '%%Y-%%m-%%d %%H:%%i'), '') as ReturnTodateTime,
			COALESCE(vr.ContactName, '') as ContactName,
			COALESCE(vr.ContactPhone, '') as ContactPhone,
			vr.status,
			COALESCE(vr.admin_remarks, '') as admin_remarks,
			u.full_name as faculty_name,
			COALESCE(u.email, '') as faculty_email,
			COALESCE(u.phone, '') as faculty_phone,
			COALESCE(f.department, '') as faculty_department,
			COALESCE(v.vehicle_number, '') as vehicle_number,
			COALESCE(v.vehicle_type, '') as vehicle_type,
			COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
			DATE_FORMAT(vr.created_at, '%%Y-%%m-%%d %%H:%%i') as created_at
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		WHERE vr.driver_id = ? 
		AND vr.status = 'assigned'
		AND DATE(vr.OnwardFromDateTime) >= CURDATE()
		ORDER BY vr.OnwardFromDateTime ASC
	`, requestUnderExpr, purposeExpr)
	rows, err := config.DB.Query(query, driverID)
	if err != nil {
		log.Printf("Error fetching upcoming vehicle requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var requests []models.VehicleRequest
	for rows.Next() {
		var r models.VehicleRequest
		err := rows.Scan(
			&r.ID, &r.FacultyID,
			&r.BookingType, &r.TripType, &r.TripMode, &r.RequestUnder, &r.Purpose, &r.CountPerson,
			&r.OnwardFromPlace, &r.OnwardToPlace, &r.OnwardFromDateTime, &r.OnwardToDateTime,
			&r.ReturnFromPlace, &r.ReturnToPlace, &r.ReturnFromDateTime, &r.ReturnToDateTime,
			&r.ContactName, &r.ContactPhone,
			&r.Status, &r.AdminRemarks,
			&r.FacultyName, &r.FacultyEmail, &r.FacultyPhone, &r.FacultyDepartment,
			&r.VehicleNumber, &r.VehicleType, &r.VehicleName,
			&r.CreatedAt,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}
