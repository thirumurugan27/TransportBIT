package admin
import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"transport-server/config"
	"transport-server/models"
	"github.com/gin-gonic/gin"
)
func GetAllVehicles(c *gin.Context) {
	query := `
		SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.insurance_start_date,  '%d-%m-%Y'),
		       v.insurance_remarks,
		       DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.fc_start_date,  '%d-%m-%Y'),
		       v.fc_remarks,
		       DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.permit_start_date,  '%d-%m-%Y'),
		       v.permit_remarks,
		       COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
		       COALESCE(b.start_point, ''),
		       COALESCE(b.end_point, ''),
		       v.chassis_number, v.engine_number, v.permit_number, v.additional_permit,
		       v.insurance_amount, v.road_tax_amount,
		       DATE_FORMAT(v.pollution_expire, '%d-%m-%Y'),
		       DATE_FORMAT(v.green_tax_expire, '%d-%m-%Y'),
		       DATE_FORMAT(v.mv_tax_expire, '%d-%m-%Y'),
		       vr.id as replacement_id,
		       vr.status as replacement_status,
		       DATE_FORMAT(vr.start_date, '%d-%m-%Y') as replacement_start_date,
		       DATE_FORMAT(vr.end_date, '%d-%m-%Y') as replacement_end_date,
		       vr.reason as replacement_reason,
		       rv.vehicle_number as replacement_vehicle_number,
		       vgm.group_id as vehicle_group_id,
		       COALESCE(vg.name, '') as vehicle_group_name
		FROM vehicles v
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
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
		ID                       int      `json:"id"`
		VehicleNumber            string   `json:"vehicle_number"`
		VehicleType              string   `json:"vehicle_type"`
		FuelType                 string   `json:"fuel_type"`
		SeatingCapacity          int      `json:"seating_capacity"`
		Status                   string   `json:"status"`
		InsuranceExpireDate      *string  `json:"insurance_expire_date"`
		InsuranceStartDate       *string  `json:"insurance_start_date"`
		InsuranceRemarks         *string  `json:"insurance_remarks"`
		FCExpireDate             *string  `json:"fc_expire_date"`
		FCStartDate              *string  `json:"fc_start_date"`
		FCRemarks                *string  `json:"fc_remarks"`
		PermitExpireDate         *string  `json:"permit_expire_date"`
		PermitStartDate          *string  `json:"permit_start_date"`
		PermitRemarks            *string  `json:"permit_remarks"`
		VehicleName              string   `json:"vehicle_name"`
		StartPoint               string   `json:"start_point"`
		EndPoint                 string   `json:"end_point"`
		ChassisNumber            *string  `json:"chassis_number"`
		EngineNumber             *string  `json:"engine_number"`
		PermitNumber             *string  `json:"permit_number"`
		AdditionalPermit         *string  `json:"additional_permit"`
		InsuranceAmount          *float64 `json:"insurance_amount"`
		RoadTaxAmount            *float64 `json:"road_tax_amount"`
		PollutionExpire          *string  `json:"pollution_expire"`
		GreenTaxExpire           *string  `json:"green_tax_expire"`
		MVTaxExpire              *string  `json:"mv_tax_expire"`
		ReplacementID            *int     `json:"replacement_id"`
		ReplacementStatus        *string  `json:"replacement_status"`
		ReplacementStartDate     *string  `json:"replacement_start_date"`
		ReplacementEndDate       *string  `json:"replacement_end_date"`
		ReplacementReason        *string  `json:"replacement_reason"`
		ReplacementVehicleNumber *string  `json:"replacement_vehicle_number"`
		VehicleGroupID           *int     `json:"vehicle_group_id"`
		VehicleGroupName         string   `json:"vehicle_group_name"`
	}
	var vehicles []VehicleWithReplacement
	for rows.Next() {
		var v VehicleWithReplacement
		rows.Scan(&v.ID, &v.VehicleNumber, &v.VehicleType, &v.FuelType, &v.SeatingCapacity, &v.Status,
			&v.InsuranceExpireDate, &v.InsuranceStartDate, &v.InsuranceRemarks,
			&v.FCExpireDate, &v.FCStartDate, &v.FCRemarks,
			&v.PermitExpireDate, &v.PermitStartDate, &v.PermitRemarks,
			&v.VehicleName, &v.StartPoint, &v.EndPoint,
			&v.ChassisNumber, &v.EngineNumber, &v.PermitNumber, &v.AdditionalPermit,
			&v.InsuranceAmount, &v.RoadTaxAmount,
			&v.PollutionExpire, &v.GreenTaxExpire, &v.MVTaxExpire,
			&v.ReplacementID, &v.ReplacementStatus, &v.ReplacementStartDate, &v.ReplacementEndDate,
			&v.ReplacementReason, &v.ReplacementVehicleNumber,
			&v.VehicleGroupID, &v.VehicleGroupName)
		vehicles = append(vehicles, v)
	}
	c.JSON(http.StatusOK, vehicles)
}
// GET /api/admin/vehicle-types - list master vehicle types
func GetVehicleTypes(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, type, label
		FROM vehicle_types
		WHERE is_active = 1
		ORDER BY id ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	type VehicleType struct {
		ID    int    `json:"id"`
		Type  string `json:"type"`
		Label string `json:"label"`
	}
	var out []VehicleType
	for rows.Next() {
		var t VehicleType
		if scanErr := rows.Scan(&t.ID, &t.Type, &t.Label); scanErr == nil {
			out = append(out, t)
		}
	}
	c.JSON(http.StatusOK, out)
}
func resolveVehicleTypeID(vehicleType string) (int, error) {
	var vehicleTypeID int
	err := config.DB.QueryRow(`
		SELECT id
		FROM vehicle_types
		WHERE is_active = 1 AND UPPER(type) = UPPER(?)
		LIMIT 1
	`, vehicleType).Scan(&vehicleTypeID)
	if err != nil {
		return 0, err
	}
	return vehicleTypeID, nil
}
// POST /api/admin/vehicles/create - Create vehicle
func CreateVehicle(c *gin.Context) {
	var req models.CreateVehicleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	// Normalise empty strings → nil
	req.VehicleType = strings.ToUpper(strings.TrimSpace(req.VehicleType))
	if req.VehicleType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_type is required"})
		return
	}
	vehicleTypeID, err := resolveVehicleTypeID(req.VehicleType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_type"})
		return
	}
	req.InsuranceExpireDate = nullifyEmptyDate(req.InsuranceExpireDate)
	req.InsuranceStartDate = nullifyEmptyDate(req.InsuranceStartDate)
	req.InsuranceRemarks = nullifyEmptyString(req.InsuranceRemarks)
	req.FCExpireDate = nullifyEmptyDate(req.FCExpireDate)
	req.FCStartDate = nullifyEmptyDate(req.FCStartDate)
	req.FCRemarks = nullifyEmptyString(req.FCRemarks)
	req.PermitExpireDate = nullifyEmptyDate(req.PermitExpireDate)
	req.PermitStartDate = nullifyEmptyDate(req.PermitStartDate)
	req.PermitRemarks = nullifyEmptyString(req.PermitRemarks)
	// Insert vehicle row with all fields including documents
	result, err := config.DB.Exec(`
		INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
			chassis_number, engine_number, permit_number, additional_permit,
			insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
			insurance_expire_date, insurance_start_date, insurance_remarks,
			fc_expire_date, fc_start_date, fc_remarks,
			permit_expire_date, permit_start_date, permit_remarks)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleName, req.VehicleNumber, vehicleTypeID, req.FuelType, req.SeatingCapacity,
		req.ChassisNumber, req.EngineNumber, req.PermitNumber, req.AdditionalPermit,
		req.InsuranceAmount, req.RoadTaxAmount, req.PollutionExpire, req.GreenTaxExpire, req.MVTaxExpire,
		req.InsuranceExpireDate, req.InsuranceStartDate, req.InsuranceRemarks,
		req.FCExpireDate, req.FCStartDate, req.FCRemarks,
		req.PermitExpireDate, req.PermitStartDate, req.PermitRemarks)
	if err != nil {
		log.Printf("Create vehicle error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	vehicleID, _ := result.LastInsertId()
	// Write initial audit log entries for any non-null document fields
	userID := c.GetInt("user_id")
	userName := c.GetString("username")
	if userName == "" {
		userName = "System"
	}
	type docField struct {
		docType   string
		fieldName string
		value     *string
	}
	initialFields := []docField{
		{"insurance", "start_date", formatDateForAudit(req.InsuranceStartDate)},
		{"insurance", "expire_date", formatDateForAudit(req.InsuranceExpireDate)},
		{"insurance", "remarks", req.InsuranceRemarks},
		{"fc", "start_date", formatDateForAudit(req.FCStartDate)},
		{"fc", "expire_date", formatDateForAudit(req.FCExpireDate)},
		{"fc", "remarks", req.FCRemarks},
		{"permit", "start_date", formatDateForAudit(req.PermitStartDate)},
		{"permit", "expire_date", formatDateForAudit(req.PermitExpireDate)},
		{"permit", "remarks", req.PermitRemarks},
	}
	for _, f := range initialFields {
		if f.value != nil {
			insertAuditLog(int(vehicleID), f.docType, f.fieldName, nil, f.value, userID, userName)
		}
	}
	// If it's a bus, also create a record in the buses table
	if req.VehicleType == "BUS" {
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
// so the SQL driver sends NULL to MySQL DATE columns instead of ” (which MySQL strict mode rejects).
func nullifyEmptyDate(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}
// nullifyEmptyString converts a *string that holds an empty string into nil.
func nullifyEmptyString(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}
// ptrToString safely dereferences a *string pointer, returning "" if nil.
func ptrToString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
// formatDateForAudit converts a date string from YYYY-MM-DD to DD-MM-YYYY for audit log display.
// If the string is not in YYYY-MM-DD format, it is returned as-is.
func formatDateForAudit(s *string) *string {
	if s == nil || *s == "" {
		return s
	}
	var y, m, d int
	if n, _ := fmt.Sscanf(*s, "%04d-%02d-%02d", &y, &m, &d); n == 3 {
		formatted := fmt.Sprintf("%02d-%02d-%04d", d, m, y)
		return &formatted
	}
	return s
}
// insertAuditLog inserts a single audit log row into vehicle_document_audit_log.
func insertAuditLog(vehicleID int, docType, fieldName string, oldVal, newVal *string, changedBy int, changedByName string) {
	_, err := config.DB.Exec(`
		INSERT INTO vehicle_document_audit_log (vehicle_id, document_type, field_name, old_value, new_value, changed_by, changed_by_name)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, vehicleID, docType, fieldName, oldVal, newVal, changedBy, changedByName)
	if err != nil {
		log.Printf("Audit log insert error: %v", err)
	}
}
// compareAndLog compares old and new *string values and logs any change.
func compareAndLog(vehicleID int, docType, fieldName string, oldVal, newVal *string, userID int, userName string) {
	oldStr := ptrToString(oldVal)
	newStr := ptrToString(newVal)
	if oldStr != newStr {
		insertAuditLog(vehicleID, docType, fieldName, oldVal, newVal, userID, userName)
	}
}
// POST /api/admin/vehicles/update - Update vehicle
func UpdateVehicle(c *gin.Context) {
	var v models.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	v.VehicleType = strings.ToUpper(strings.TrimSpace(v.VehicleType))
	if v.VehicleType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_type is required"})
		return
	}
	vehicleTypeID, err := resolveVehicleTypeID(v.VehicleType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vehicle_type"})
		return
	}
	// Normalise empty strings → nil
	v.InsuranceExpireDate = nullifyEmptyDate(v.InsuranceExpireDate)
	v.InsuranceStartDate = nullifyEmptyDate(v.InsuranceStartDate)
	v.InsuranceRemarks = nullifyEmptyString(v.InsuranceRemarks)
	v.FCExpireDate = nullifyEmptyDate(v.FCExpireDate)
	v.FCStartDate = nullifyEmptyDate(v.FCStartDate)
	v.FCRemarks = nullifyEmptyString(v.FCRemarks)
	v.PermitExpireDate = nullifyEmptyDate(v.PermitExpireDate)
	v.PermitStartDate = nullifyEmptyDate(v.PermitStartDate)
	v.PermitRemarks = nullifyEmptyString(v.PermitRemarks)
	// ---- Read current document values BEFORE update for audit diff ----
	var oldInsExpire, oldInsStart, oldInsRemarks *string
	var oldFCExpire, oldFCStart, oldFCRemarks *string
	var oldPermitExpire, oldPermitStart, oldPermitRemarks *string
	readErr := config.DB.QueryRow(`
		SELECT DATE_FORMAT(insurance_expire_date, '%d-%m-%Y'), DATE_FORMAT(insurance_start_date, '%d-%m-%Y'), insurance_remarks,
		       DATE_FORMAT(fc_expire_date, '%d-%m-%Y'), DATE_FORMAT(fc_start_date, '%d-%m-%Y'), fc_remarks,
		       DATE_FORMAT(permit_expire_date, '%d-%m-%Y'), DATE_FORMAT(permit_start_date, '%d-%m-%Y'), permit_remarks
		FROM vehicles WHERE id = ?
	`, v.ID).Scan(
		&oldInsExpire, &oldInsStart, &oldInsRemarks,
		&oldFCExpire, &oldFCStart, &oldFCRemarks,
		&oldPermitExpire, &oldPermitStart, &oldPermitRemarks,
	)
	if readErr != nil {
		log.Printf("Audit read-before-write error for vehicle %d: %v", v.ID, readErr)
	}
	// Update all vehicle fields including documents
	_, err = config.DB.Exec(`
		UPDATE vehicles SET vehicle_name=?, vehicle_number=?, vehicle_type_id=?, fuel_type=?, seating_capacity=?, status=?,
			chassis_number=?, engine_number=?, permit_number=?, additional_permit=?,
			insurance_amount=?, road_tax_amount=?, pollution_expire=?, green_tax_expire=?, mv_tax_expire=?,
			insurance_expire_date=?, insurance_start_date=?, insurance_remarks=?,
			fc_expire_date=?, fc_start_date=?, fc_remarks=?,
			permit_expire_date=?, permit_start_date=?, permit_remarks=?
		WHERE id=?
	`, v.VehicleName, v.VehicleNumber, vehicleTypeID, v.FuelType, v.SeatingCapacity, v.Status,
		v.ChassisNumber, v.EngineNumber, v.PermitNumber, v.AdditionalPermit,
		v.InsuranceAmount, v.RoadTaxAmount, v.PollutionExpire, v.GreenTaxExpire, v.MVTaxExpire,
		v.InsuranceExpireDate, v.InsuranceStartDate, v.InsuranceRemarks,
		v.FCExpireDate, v.FCStartDate, v.FCRemarks,
		v.PermitExpireDate, v.PermitStartDate, v.PermitRemarks,
		v.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// ---- Write audit log for any changed document fields ----
	userID := c.GetInt("user_id")
	userName := c.GetString("username")
	if userName == "" {
		userName = "System"
	}
	// Format new date values to DD-MM-YYYY before audit comparison so old and new are in the same format
	compareAndLog(v.ID, "insurance", "start_date", oldInsStart, formatDateForAudit(v.InsuranceStartDate), userID, userName)
	compareAndLog(v.ID, "insurance", "expire_date", oldInsExpire, formatDateForAudit(v.InsuranceExpireDate), userID, userName)
	compareAndLog(v.ID, "insurance", "remarks", oldInsRemarks, v.InsuranceRemarks, userID, userName)
	compareAndLog(v.ID, "fc", "start_date", oldFCStart, formatDateForAudit(v.FCStartDate), userID, userName)
	compareAndLog(v.ID, "fc", "expire_date", oldFCExpire, formatDateForAudit(v.FCExpireDate), userID, userName)
	compareAndLog(v.ID, "fc", "remarks", oldFCRemarks, v.FCRemarks, userID, userName)
	compareAndLog(v.ID, "permit", "start_date", oldPermitStart, formatDateForAudit(v.PermitStartDate), userID, userName)
	compareAndLog(v.ID, "permit", "expire_date", oldPermitExpire, formatDateForAudit(v.PermitExpireDate), userID, userName)
	compareAndLog(v.ID, "permit", "remarks", oldPermitRemarks, v.PermitRemarks, userID, userName)
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
// GET /api/admin/vehicles/:id/document-history - Get audit log for a vehicle's documents
func GetVehicleDocumentHistory(c *gin.Context) {
	vehicleID := c.Param("id")
	if vehicleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vehicle ID required"})
		return
	}
	docTypeFilter := c.Query("document_type") // optional: insurance, fc, permit
	var query string
	var args []interface{}
	if docTypeFilter != "" && (docTypeFilter == "insurance" || docTypeFilter == "fc" || docTypeFilter == "permit") {
		query = `
			SELECT id, vehicle_id, document_type, field_name, old_value, new_value, 
			       changed_by, changed_by_name, DATE_FORMAT(changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
			FROM vehicle_document_audit_log 
			WHERE vehicle_id = ? AND document_type = ?
			ORDER BY changed_at DESC
		`
		args = []interface{}{vehicleID, docTypeFilter}
	} else {
		query = `
			SELECT id, vehicle_id, document_type, field_name, old_value, new_value, 
			       changed_by, changed_by_name, DATE_FORMAT(changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
			FROM vehicle_document_audit_log 
			WHERE vehicle_id = ?
			ORDER BY changed_at DESC
		`
		args = []interface{}{vehicleID}
	}
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Document history query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var logs []models.VehicleDocumentAuditLog
	for rows.Next() {
		var l models.VehicleDocumentAuditLog
		if err := rows.Scan(&l.ID, &l.VehicleID, &l.DocumentType, &l.FieldName,
			&l.OldValue, &l.NewValue, &l.ChangedBy, &l.ChangedByName, &l.ChangedAt); err != nil {
			log.Printf("Document history scan error: %v", err)
			continue
		}
		logs = append(logs, l)
	}
	// Group by document type for easier frontend consumption
	grouped := map[string][]models.VehicleDocumentAuditLog{
		"insurance": {},
		"fc":        {},
		"permit":    {},
	}
	for _, l := range logs {
		grouped[l.DocumentType] = append(grouped[l.DocumentType], l)
	}
	c.JSON(http.StatusOK, gin.H{
		"logs":    logs,
		"grouped": grouped,
		"total":   len(logs),
	})
}
// GET /api/admin/vehicles/alerts - Get vehicles with expired/critical documents
func GetVehicleDocumentAlerts(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.status,
		       DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'),
		       DATEDIFF(v.insurance_expire_date, CURDATE()) as insurance_days,
		       DATEDIFF(v.fc_expire_date, CURDATE()) as fc_days,
		       DATEDIFF(v.permit_expire_date, CURDATE()) as permit_days
		FROM vehicles v
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE v.status IN ('active', 'available')
		  AND (
		    (v.insurance_expire_date IS NOT NULL AND DATEDIFF(v.insurance_expire_date, CURDATE()) <= 10)
		    OR (v.fc_expire_date IS NOT NULL AND DATEDIFF(v.fc_expire_date, CURDATE()) <= 10)
		    OR (v.permit_expire_date IS NOT NULL AND DATEDIFF(v.permit_expire_date, CURDATE()) <= 10)
		  )
		ORDER BY
		  LEAST(
		    COALESCE(DATEDIFF(v.insurance_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.fc_expire_date, CURDATE()), 999),
		    COALESCE(DATEDIFF(v.permit_expire_date, CURDATE()), 999)
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
// GetVehicleDocumentAuditSummary returns all audit logs (admin overview)
func GetVehicleDocumentAuditSummary(c *gin.Context) {
	limit := c.DefaultQuery("limit", "50")
	rows, err := config.DB.Query(`
		SELECT a.id, a.vehicle_id, v.vehicle_number, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
		       a.document_type, a.field_name, a.old_value, a.new_value, 
		       a.changed_by, a.changed_by_name, DATE_FORMAT(a.changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
		FROM vehicle_document_audit_log a
		LEFT JOIN vehicles v ON v.id = a.vehicle_id
		ORDER BY a.changed_at DESC
		LIMIT ` + fmt.Sprintf("%s", limit) + `
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	type AuditEntry struct {
		ID            int     `json:"id"`
		VehicleID     int     `json:"vehicle_id"`
		VehicleNumber string  `json:"vehicle_number"`
		VehicleName   string  `json:"vehicle_name"`
		DocumentType  string  `json:"document_type"`
		FieldName     string  `json:"field_name"`
		OldValue      *string `json:"old_value"`
		NewValue      *string `json:"new_value"`
		ChangedBy     int     `json:"changed_by"`
		ChangedByName string  `json:"changed_by_name"`
		ChangedAt     string  `json:"changed_at"`
	}
	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.VehicleID, &e.VehicleNumber, &e.VehicleName,
			&e.DocumentType, &e.FieldName, &e.OldValue, &e.NewValue,
			&e.ChangedBy, &e.ChangedByName, &e.ChangedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	c.JSON(http.StatusOK, gin.H{"entries": entries, "total": len(entries)})
}