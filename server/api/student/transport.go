package student

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"transport-server/config"
	"transport-server/models"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

// InitStudentTransportTables creates the transport_requests table if it doesn't exist
func InitStudentTransportTables() {
	// Create transport_requests table
	_, err := config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS transport_requests (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			bus_id INT NOT NULL,
			stop_id INT NOT NULL,
			academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
			reason TEXT,
			status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
			admin_remarks TEXT,
			processed_by INT,
			processed_at TIMESTAMP NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
			FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
		)
	`)
	if err != nil {
		log.Printf("Error creating transport_requests table: %v", err)
	} else {
		log.Println("✅ transport_requests table ready")
	}

	// Create student_transport table
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS student_transport (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			bus_id INT NOT NULL,
			stop_id INT NOT NULL,
			transport_fee_id INT,
			total_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
			paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
			balance DECIMAL(10, 2) GENERATED ALWAYS AS (total_fee - paid_amount) STORED,
			academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
			status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
			UNIQUE KEY unique_student_year (user_id, academic_year)
		)
	`)
	if err != nil {
		log.Printf("Error creating student_transport table: %v", err)
	} else {
		log.Println("✅ student_transport table ready")
	}

	// Create transport_fees table
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS transport_fees (
			id INT AUTO_INCREMENT PRIMARY KEY,
			stop_id INT NOT NULL,
			fee_amount DECIMAL(10, 2) NOT NULL,
			academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY unique_stop_year (stop_id, academic_year)
		)
	`)
	if err != nil {
		log.Printf("Error creating transport_fees table: %v", err)
	} else {
		log.Println("✅ transport_fees table ready")
	}

	// Create transport_payments table
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS transport_payments (
			id INT AUTO_INCREMENT PRIMARY KEY,
			student_transport_id INT NOT NULL,
			amount DECIMAL(10, 2) NOT NULL,
			payment_date DATE NOT NULL,
			payment_method ENUM('cash', 'upi', 'bank_transfer', 'card', 'other') DEFAULT 'cash',
			transaction_id VARCHAR(100),
			receipt_number VARCHAR(50),
			remarks TEXT,
			recorded_by INT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (student_transport_id) REFERENCES student_transport(id) ON DELETE CASCADE,
			FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
		)
	`)
	if err != nil {
		log.Printf("Error creating transport_payments table: %v", err)
	} else {
		log.Println("✅ transport_payments table ready")
	}

	// Create stop_change_requests table
	_, err = config.DB.Exec(`
		CREATE TABLE IF NOT EXISTS stop_change_requests (
			id INT AUTO_INCREMENT PRIMARY KEY,
			student_transport_id INT NOT NULL,
			current_stop_id INT NOT NULL,
			requested_stop_id INT NOT NULL,
			current_fee DECIMAL(10, 2) NOT NULL,
			new_fee DECIMAL(10, 2) NOT NULL,
			fee_difference DECIMAL(10, 2) GENERATED ALWAYS AS (new_fee - current_fee) STORED,
			reason TEXT,
			status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
			admin_remarks TEXT,
			processed_by INT,
			processed_at TIMESTAMP NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (student_transport_id) REFERENCES student_transport(id) ON DELETE CASCADE,
			FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
		)
	`)
	if err != nil {
		log.Printf("Error creating stop_change_requests table: %v", err)
	} else {
		log.Println("✅ stop_change_requests table ready")
	}
}

/* =========================
   STUDENT TRANSPORT HANDLERS
========================= */

// GET /api/student/transport - Get student's transport details
func GetMyTransport(c *gin.Context) {
	// Get user from token
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	var transport models.StudentTransport
	err = config.DB.QueryRow(`
		SELECT 
			st.id, st.user_id, COALESCE(u.full_name, u.username) as student_name, COALESCE(u.email, ''),
			st.bus_id, COALESCE(b.bus_name, '') as bus_name, COALESCE(v.vehicle_number, '') as bus_number, 
			COALESCE(b.start_point, '') as route_start, COALESCE(b.end_point, '') as route_end,
			st.stop_id, COALESCE(bs.stop_name, '') as stop_name, '' as stop_location,
			st.total_fee, st.paid_amount, st.balance,
			st.academic_year, st.status,
			COALESCE(TIME_FORMAT(bs.arrival_time, '%H:%i'), '') as arrival_time,
			'' as departure_time
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN buses b ON st.bus_id = b.id
		LEFT JOIN vehicles v ON b.vehicle_id = v.id
		LEFT JOIN bus_stops bs ON st.stop_id = bs.id
		WHERE st.user_id = ? AND st.status = 'active'
		ORDER BY st.id DESC LIMIT 1
	`, userID).Scan(
		&transport.ID, &transport.UserID, &transport.StudentName, &transport.StudentEmail,
		&transport.BusID, &transport.BusName, &transport.BusNumber, &transport.RouteStart, &transport.RouteEnd,
		&transport.StopID, &transport.StopName, &transport.StopLocation,
		&transport.TotalFee, &transport.PaidAmount, &transport.Balance,
		&transport.AcademicYear, &transport.Status,
		&transport.ArrivalTime, &transport.DepartureTime,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "No transport assigned", "message": "You have not been assigned to any bus yet. Please contact the transport office."})
		return
	}
	if err != nil {
		log.Printf("Error fetching student transport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transport details"})
		return
	}

	c.JSON(http.StatusOK, transport)
}

// GET /api/student/transport/payments - Get payment history
func GetMyPayments(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	rows, err := config.DB.Query(`
		SELECT 
			p.id, p.student_transport_id, u.full_name,
			p.amount, DATE_FORMAT(p.payment_date, '%d-%m-%Y'),
			p.payment_method, COALESCE(p.transaction_id, ''),
			COALESCE(p.receipt_number, ''), COALESCE(p.remarks, ''),
			COALESCE(p.recorded_by, 0), COALESCE(admin.full_name, 'System')
		FROM transport_payments p
		JOIN student_transport st ON p.student_transport_id = st.id
		JOIN users u ON st.user_id = u.id
		LEFT JOIN users admin ON p.recorded_by = admin.id
		WHERE st.user_id = ?
		ORDER BY p.payment_date DESC, p.id DESC
	`, userID)
	if err != nil {
		log.Printf("Error fetching payments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payments"})
		return
	}
	defer rows.Close()

	var payments []models.TransportPayment
	for rows.Next() {
		var p models.TransportPayment
		err := rows.Scan(
			&p.ID, &p.StudentTransportID, &p.StudentName,
			&p.Amount, &p.PaymentDate, &p.PaymentMethod,
			&p.TransactionID, &p.ReceiptNumber, &p.Remarks,
			&p.RecordedBy, &p.RecordedByName,
		)
		if err != nil {
			log.Printf("Error scanning payment: %v", err)
			continue
		}
		payments = append(payments, p)
	}

	c.JSON(http.StatusOK, payments)
}

// POST /api/student/stop-change/request - Submit stop change request
func RequestStopChange(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	var req models.CreateStopChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get current student transport
	var studentTransportID, currentStopID int
	var currentFee float64
	err = config.DB.QueryRow(`
		SELECT st.id, st.stop_id, st.total_fee
		FROM student_transport st
		WHERE st.user_id = ? AND st.status = 'active'
		LIMIT 1
	`, userID).Scan(&studentTransportID, &currentStopID, &currentFee)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active transport assignment found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching student transport: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	// Check if same stop
	if currentStopID == req.RequestedStopID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Requested stop is same as current stop"})
		return
	}

	// Check for pending requests
	var pendingCount int
	config.DB.QueryRow(`
		SELECT COUNT(*) FROM stop_change_requests 
		WHERE student_transport_id = ? AND status = 'pending'
	`, studentTransportID).Scan(&pendingCount)
	if pendingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You already have a pending stop change request"})
		return
	}

	// Get new stop fee directly from bus stop definition
	var newFee float64
	err = config.DB.QueryRow(`
		SELECT COALESCE(fee, 0) 
		FROM bus_stops 
		WHERE id = ?
	`, req.RequestedStopID).Scan(&newFee)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Selected stop was not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching stop fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
		return
	}

	// Create stop change request
	_, err = config.DB.Exec(`
		INSERT INTO stop_change_requests 
		(student_transport_id, current_stop_id, requested_stop_id, current_fee, new_fee, reason, status)
		VALUES (?, ?, ?, ?, ?, ?, 'pending')
	`, studentTransportID, currentStopID, req.RequestedStopID, currentFee, newFee, req.Reason)
	if err != nil {
		log.Printf("Error creating stop change request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Stop change request submitted successfully",
		"current_fee":    currentFee,
		"new_fee":        newFee,
		"fee_difference": newFee - currentFee,
	})
}

// POST /api/student/stop-change/request/cancel - Cancel pending stop change request
func CancelStopChangeRequest(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CancelStopChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.RequestID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	userID := int(claims["user_id"].(float64))

	var requestID int
	err = config.DB.QueryRow(`
		SELECT scr.id 
		FROM stop_change_requests scr
		JOIN student_transport st ON scr.student_transport_id = st.id
		WHERE scr.id = ? AND st.user_id = ? AND scr.status = 'pending'
	`, req.RequestID, userID).Scan(&requestID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "No pending request found"})
		return
	}
	if err != nil {
		log.Printf("Error validating stop change request cancel: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel request"})
		return
	}

	if _, err := config.DB.Exec(`DELETE FROM stop_change_requests WHERE id = ?`, requestID); err != nil {
		log.Printf("Error deleting stop change request %d: %v", requestID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request cancelled successfully"})
}

// GET /api/student/stop-change/requests - Get my stop change requests
func GetMyStopChangeRequests(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	rows, err := config.DB.Query(`
		SELECT 
			scr.id, COALESCE(scr.student_transport_id, 0),
			COALESCE(u.full_name, 'Unknown Student'), COALESCE(u.email, ''),
			COALESCE(scr.current_stop_id, 0), COALESCE(cs.stop_name, gs.stop_name, 'Unknown Stop'),
			COALESCE(scr.requested_stop_id, 0), COALESCE(rs.stop_name, 'Unknown Stop'),
			COALESCE(scr.current_fee, 0), COALESCE(scr.new_fee, 0), COALESCE(scr.fee_difference, 0),
			COALESCE(scr.reason, ''), scr.status,
			COALESCE(scr.admin_remarks, ''),
			scr.processed_by, COALESCE(admin.full_name, ''),
			DATE_FORMAT(scr.processed_at, '%d-%m-%Y %H:%i'), DATE_FORMAT(scr.created_at, '%d-%m-%Y %H:%i')
		FROM stop_change_requests scr
		JOIN student_transport st ON scr.student_transport_id = st.id
		JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
		LEFT JOIN stops gs ON scr.current_stop_id = gs.id
		LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
		LEFT JOIN users admin ON scr.processed_by = admin.id
		WHERE st.user_id = ?
		ORDER BY scr.created_at DESC
	`, userID)
	if err != nil {
		log.Printf("Error fetching stop change requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch requests"})
		return
	}
	defer rows.Close()

	var requests []models.StopChangeRequest
	for rows.Next() {
		var r models.StopChangeRequest
		var processedAt sql.NullString
		var processedBy sql.NullInt64
		var createdAt sql.NullString

		err := rows.Scan(
			&r.ID, &r.StudentTransportID,
			&r.StudentName, &r.StudentEmail,
			&r.CurrentStopID, &r.CurrentStopName,
			&r.RequestedStopID, &r.RequestedStopName,
			&r.CurrentFee, &r.NewFee, &r.FeeDifference,
			&r.Reason, &r.Status,
			&r.AdminRemarks,
			&processedBy, &r.ProcessedByName,
			&processedAt, &createdAt,
		)
		if createdAt.Valid {
			r.CreatedAt = createdAt.String
		}
		if err != nil {
			log.Printf("Error scanning: %v", err)
			continue
		}
		if processedBy.Valid {
			id := int(processedBy.Int64)
			r.ProcessedBy = &id
		}
		if processedAt.Valid {
			r.ProcessedAt = &processedAt.String
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// GET /api/student/bus/:id/stops - Get all stops for a bus (for dropdown)
func GetBusStopsForStudent(c *gin.Context) {
	busID := c.Param("id")

	// Get vehicle_id from buses table
	var vehicleID int
	err := config.DB.QueryRow(`SELECT vehicle_id FROM buses WHERE id = ?`, busID).Scan(&vehicleID)
	if err != nil {
		log.Printf("Error fetching bus: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Bus not found"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			bs.id, bs.stop_name, bs.stop_order, bs.fee, COALESCE(bs.distance_km, 0),
			COALESCE(TIME_FORMAT(bs.arrival_time, '%H:%i'), '')
		FROM bus_stops bs
		WHERE bs.vehicle_id = ?
		ORDER BY bs.stop_order ASC
	`, vehicleID)
	if err != nil {
		log.Printf("Error fetching bus stops: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stops"})
		return
	}
	defer rows.Close()

	type BusStopWithFee struct {
		ID          int     `json:"id"`
		StopID      int     `json:"stop_id"`
		StopName    string  `json:"stop_name"`
		StopOrder   int     `json:"stop_order"`
		Fee         float64 `json:"fee"`
		DistanceKm  float64 `json:"distance_km"`
		ArrivalTime string  `json:"arrival_time"`
	}

	var stops []BusStopWithFee
	for rows.Next() {
		var s BusStopWithFee
		if err := rows.Scan(
			&s.ID, &s.StopName, &s.StopOrder, &s.Fee, &s.DistanceKm, &s.ArrivalTime,
		); err != nil {
			log.Printf("Error scanning stop: %v", err)
			continue
		}
		s.StopID = s.ID // For frontend compatibility
		stops = append(stops, s)
	}

	c.JSON(http.StatusOK, stops)
}

// GET /api/student/available-stops - Get all stops available for stop change
func GetAvailableStops(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	// Get current bus ID
	var busID, currentStopID int
	err = config.DB.QueryRow(`
		SELECT bus_id, stop_id FROM student_transport 
		WHERE user_id = ? AND status = 'active' LIMIT 1
	`, userID).Scan(&busID, &currentStopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active transport found"})
		return
	}

	// Get vehicle_id for the bus to map stops
	var vehicleID int
	err = config.DB.QueryRow(`SELECT vehicle_id FROM buses WHERE id = ?`, busID).Scan(&vehicleID)
	if err != nil {
		log.Printf("Error fetching vehicle for bus %d: %v", busID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bus assignment"})
		return
	}

	// Get all stops on the same bus route except the current one
	rows, err := config.DB.Query(`
		SELECT 
			bs.id, bs.stop_name, bs.stop_order,
			COALESCE(bs.fee, 0),
			COALESCE(TIME_FORMAT(bs.arrival_time, '%H:%i'), '')
		FROM bus_stops bs
		WHERE bs.vehicle_id = ? AND bs.id != ?
		ORDER BY bs.stop_order ASC
	`, vehicleID, currentStopID)
	if err != nil {
		log.Printf("Error fetching available stops: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stops"})
		return
	}
	defer rows.Close()

	type AvailableStop struct {
		StopID      int     `json:"stop_id"`
		StopName    string  `json:"stop_name"`
		Location    string  `json:"location"`
		StopOrder   int     `json:"stop_order"`
		ArrivalTime string  `json:"arrival_time"`
		Fee         float64 `json:"fee"`
	}

	var stops []AvailableStop
	for rows.Next() {
		var s AvailableStop
		if err := rows.Scan(&s.StopID, &s.StopName, &s.StopOrder, &s.Fee, &s.ArrivalTime); err != nil {
			log.Printf("Error scanning available stop: %v", err)
			continue
		}
		s.Location = ""
		stops = append(stops, s)
	}

	c.JSON(http.StatusOK, stops)
}

// GET /api/student/buses - Get all available buses
func GetAllBuses(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			b.id, b.bus_name, v.vehicle_number, 
			COALESCE(b.start_point, ''), COALESCE(b.end_point, ''), COALESCE(v.seating_capacity, 0)
		FROM buses b
		JOIN vehicles v ON b.vehicle_id = v.id
		ORDER BY b.bus_name
	`)
	if err != nil {
		log.Printf("Error fetching buses: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch buses"})
		return
	}
	defer rows.Close()

	type BusInfo struct {
		ID              int    `json:"id"`
		Name            string `json:"name"`
		BusName         string `json:"bus_name"`
		VehicleNumber   string `json:"vehicle_number"`
		Route           string `json:"route"`
		StartPoint      string `json:"start_point"`
		EndPoint        string `json:"end_point"`
		SeatingCapacity int    `json:"seating_capacity"`
	}

	var buses []BusInfo
	for rows.Next() {
		var b BusInfo
		if err := rows.Scan(&b.ID, &b.BusName, &b.VehicleNumber, &b.StartPoint, &b.EndPoint, &b.SeatingCapacity); err != nil {
			log.Printf("Error scanning bus: %v", err)
			continue
		}
		b.Name = b.BusName
		b.Route = b.StartPoint + " → " + b.EndPoint
		buses = append(buses, b)
	}

	c.JSON(http.StatusOK, buses)
}

// POST /api/student/transport/request - Request bus/stop assignment
func RequestTransport(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	var req models.CreateTransportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.AcademicYear == "" {
		req.AcademicYear = "2025-2026"
	}

	// Check if student already has active transport
	var existingCount int
	config.DB.QueryRow(`SELECT COUNT(*) FROM student_transport WHERE user_id = ? AND status = 'active'`, userID).Scan(&existingCount)
	if existingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You already have an active transport assignment. Use stop change request instead."})
		return
	}

	// Check if student already has a pending request
	var pendingCount int
	config.DB.QueryRow(`SELECT COUNT(*) FROM transport_requests WHERE user_id = ? AND status = 'pending'`, userID).Scan(&pendingCount)
	if pendingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You already have a pending transport request"})
		return
	}

	// Create request
	_, err = config.DB.Exec(`
		INSERT INTO transport_requests (user_id, bus_id, stop_id, academic_year, reason, status)
		VALUES (?, ?, ?, ?, ?, 'pending')
	`, userID, req.BusID, req.StopID, req.AcademicYear, req.Reason)
	if err != nil {
		log.Printf("Error creating transport request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transport request submitted successfully. Please wait for admin approval."})
}

// GET /api/student/transport/requests - Get my transport requests
func GetMyTransportRequests(c *gin.Context) {
	tokenStr := c.GetHeader("Authorization")
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	claims, err := utils.ParseJWT(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := int(claims["user_id"].(float64))

	rows, err := config.DB.Query(`
		SELECT 
			tr.id, tr.user_id,
			tr.bus_id, b.bus_name, CONCAT(b.start_point, ' → ', b.end_point) as route,
			tr.stop_id, bs.stop_name, bs.fee,
			tr.academic_year, COALESCE(tr.reason, ''), tr.status,
			COALESCE(tr.admin_remarks, ''),
			tr.processed_by,
			tr.processed_at, tr.created_at
		FROM transport_requests tr
		JOIN buses b ON tr.bus_id = b.id
		JOIN bus_stops bs ON tr.stop_id = bs.id
		WHERE tr.user_id = ?
		ORDER BY tr.created_at DESC
	`, userID)
	if err != nil {
		log.Printf("Error fetching transport requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch requests"})
		return
	}
	defer rows.Close()

	var requests []models.TransportRequest
	for rows.Next() {
		var r models.TransportRequest
		var processedAt sql.NullTime
		var processedBy sql.NullInt64
		err := rows.Scan(
			&r.ID, &r.UserID,
			&r.BusID, &r.BusName, &r.Route,
			&r.StopID, &r.StopName, &r.Fee,
			&r.AcademicYear, &r.Reason, &r.Status,
			&r.AdminRemarks,
			&processedBy,
			&processedAt, &r.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning: %v", err)
			continue
		}
		if processedBy.Valid {
			r.ProcessedBy = int(processedBy.Int64)
		}
		if processedAt.Valid {
			r.ProcessedAt = &processedAt.Time
		}
		requests = append(requests, r)
	}

	c.JSON(http.StatusOK, requests)
}

// Helper: Get user ID from token in query param (for some endpoints)
func getUserIDFromQuery(c *gin.Context) (int, error) {
	userIDStr := c.Query("user_id")
	if userIDStr == "" {
		return 0, nil
	}
	return strconv.Atoi(userIDStr)
}
