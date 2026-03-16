package admin

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

var bulkVehicleRequiredHeaders = []string{
	"vehicle_number",
	"vehicle_type",
	"fuel_type",
	"seating_capacity",
}
var supportedVehicleFuelTypes = map[string]struct{}{
	"DIESEL":   {},
	"PETROL":   {},
	"CNG":      {},
	"EV":       {},
	"ELECTRIC": {},
}

type parsedBulkVehicleRow struct {
	preview          models.BulkVehiclePreviewRow
	request          models.CreateVehicleRequest
	vehicleNumberKey string
}

func GetAllVehicles(c *gin.Context) {
	query := `
		SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.fuel_type, v.seating_capacity, v.status,
		       DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.insurance_start_date,  '%d-%m-%Y'),
		       DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.fc_start_date,  '%d-%m-%Y'),
		       DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'),
		       DATE_FORMAT(v.permit_start_date,  '%d-%m-%Y'),
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
		ORDER BY v.id DESC`
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
		FCExpireDate             *string  `json:"fc_expire_date"`
		FCStartDate              *string  `json:"fc_start_date"`
		PermitExpireDate         *string  `json:"permit_expire_date"`
		PermitStartDate          *string  `json:"permit_start_date"`
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
			&v.InsuranceExpireDate, &v.InsuranceStartDate,
			&v.FCExpireDate, &v.FCStartDate,
			&v.PermitExpireDate, &v.PermitStartDate,
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

// POST /api/admin/vehicle-types/create - Create a new vehicle type
func CreateVehicleType(c *gin.Context) {
	var req models.CreateVehicleTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type and label are required"})
		return
	}

	// Normalize and validate
	vehicleType := strings.ToUpper(strings.TrimSpace(req.Type))
	label := strings.TrimSpace(req.Label)

	if vehicleType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type cannot be empty"})
		return
	}
	if label == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "label cannot be empty"})
		return
	}

	// Check if type already exists
	var exists int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicle_types WHERE UPPER(type) = UPPER(?)
	`, vehicleType).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "vehicle type already exists"})
		return
	}

	// Insert new vehicle type
	result, err := config.DB.Exec(`
		INSERT INTO vehicle_types (type, label, is_active)
		VALUES (?, ?, 1)
	`, vehicleType, label)
	if err != nil {
		log.Printf("Create vehicle type error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create vehicle type"})
		return
	}

	typeID, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"message": "Vehicle type created successfully",
		"id":      typeID,
		"type":    vehicleType,
		"label":   label,
	})
}

// PUT /api/admin/vehicle-types/:id - Update a vehicle type
func UpdateVehicleType(c *gin.Context) {
	typeID := c.Param("id")
	var req models.UpdateVehicleTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Validate input
	if req.Type == "" && req.Label == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one field must be provided"})
		return
	}

	// Build update query
	var query string
	var args []interface{}

	if req.Type != "" && req.Label != "" {
		query = `UPDATE vehicle_types SET type = ?, label = ? WHERE id = ?`
		args = []interface{}{strings.ToUpper(strings.TrimSpace(req.Type)), strings.TrimSpace(req.Label), typeID}
	} else if req.Type != "" {
		query = `UPDATE vehicle_types SET type = ? WHERE id = ?`
		args = []interface{}{strings.ToUpper(strings.TrimSpace(req.Type)), typeID}
	} else {
		query = `UPDATE vehicle_types SET label = ? WHERE id = ?`
		args = []interface{}{strings.TrimSpace(req.Label), typeID}
	}

	result, err := config.DB.Exec(query, args...)
	if err != nil {
		log.Printf("Update vehicle type error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update vehicle type"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "vehicle type not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle type updated successfully"})
}

// DELETE /api/admin/vehicle-types/:id - Deactivate a vehicle type
func DeleteVehicleType(c *gin.Context) {
	typeID := c.Param("id")

	// Check if this vehicle type is being used
	var vehicleCount int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) FROM vehicles WHERE vehicle_type_id = ?
	`, typeID).Scan(&vehicleCount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if vehicleCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("Cannot delete: %d vehicle(s) using this type", vehicleCount),
		})
		return
	}

	// Soft delete (mark as inactive)
	result, err := config.DB.Exec(`
		UPDATE vehicle_types SET is_active = 0 WHERE id = ?
	`, typeID)
	if err != nil {
		log.Printf("Delete vehicle type error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete vehicle type"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "vehicle type not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vehicle type deleted successfully"})
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
	req.FCExpireDate = nullifyEmptyDate(req.FCExpireDate)
	req.FCStartDate = nullifyEmptyDate(req.FCStartDate)
	req.PermitExpireDate = nullifyEmptyDate(req.PermitExpireDate)
	req.PermitStartDate = nullifyEmptyDate(req.PermitStartDate)
	// Insert vehicle row with all fields including documents
	result, err := config.DB.Exec(`
		INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
			chassis_number, engine_number, permit_number, additional_permit,
			insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
			insurance_expire_date, insurance_start_date,
			fc_expire_date, fc_start_date,
			permit_expire_date, permit_start_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleName, req.VehicleNumber, vehicleTypeID, req.FuelType, req.SeatingCapacity,
		req.ChassisNumber, req.EngineNumber, req.PermitNumber, req.AdditionalPermit,
		req.InsuranceAmount, req.RoadTaxAmount, req.PollutionExpire, req.GreenTaxExpire, req.MVTaxExpire,
		req.InsuranceExpireDate, req.InsuranceStartDate,
		req.FCExpireDate, req.FCStartDate,
		req.PermitExpireDate, req.PermitStartDate)
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
		{"fc", "start_date", formatDateForAudit(req.FCStartDate)},
		{"fc", "expire_date", formatDateForAudit(req.FCExpireDate)},
		{"permit", "start_date", formatDateForAudit(req.PermitStartDate)},
		{"permit", "expire_date", formatDateForAudit(req.PermitExpireDate)},
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

func PreviewBulkVehicles(c *gin.Context) {
	var req models.BulkDriverSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.SheetURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sheet_url is required"})
		return
	}

	preview, _, err := previewBulkVehicleSheet(req.SheetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

func PreviewBulkVehiclesFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	records, sourceLabel, err := readVehicleRecordsFromUpload(fileHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preview, _, err := previewBulkVehicleRecords(records)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	preview.CSVURL = sourceLabel

	c.JSON(http.StatusOK, preview)
}

func ImportBulkVehicles(c *gin.Context) {
	var req models.BulkDriverSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.SheetURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sheet_url is required"})
		return
	}

	preview, validRows, err := previewBulkVehicleSheet(req.SheetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if preview.InvalidRows > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Fix invalid rows in the sheet before importing",
			"preview": preview,
		})
		return
	}
	if len(validRows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid vehicle rows found for import"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	for _, vehicleReq := range validRows {
		if err = createVehicleTx(tx, vehicleReq); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Import failed: %v", err)})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit vehicle import"})
		return
	}

	c.JSON(http.StatusOK, models.BulkVehicleImportResponse{
		Message:      fmt.Sprintf("%d vehicles imported successfully", len(validRows)),
		CreatedCount: len(validRows),
		FailedCount:  preview.InvalidRows,
		Preview:      preview,
	})
}

func ImportBulkVehiclesFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	records, sourceLabel, err := readVehicleRecordsFromUpload(fileHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preview, validRows, err := previewBulkVehicleRecords(records)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	preview.CSVURL = sourceLabel

	if preview.InvalidRows > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Fix invalid rows in the file before importing",
			"preview": preview,
		})
		return
	}
	if len(validRows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid vehicle rows found for import"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	for _, vehicleReq := range validRows {
		if err = createVehicleTx(tx, vehicleReq); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Import failed: %v", err)})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit vehicle import"})
		return
	}

	c.JSON(http.StatusOK, models.BulkVehicleImportResponse{
		Message:      fmt.Sprintf("%d vehicles imported successfully", len(validRows)),
		CreatedCount: len(validRows),
		FailedCount:  preview.InvalidRows,
		Preview:      preview,
	})
}

func previewBulkVehicleSheet(sheetURL string) (models.BulkVehicleSheetPreviewResponse, []models.CreateVehicleRequest, error) {
	response := models.BulkVehicleSheetPreviewResponse{
		SheetURL:        strings.TrimSpace(sheetURL),
		RequiredHeaders: bulkVehicleRequiredHeaders,
	}

	csvURL, err := buildGoogleSheetCSVURL(sheetURL)
	if err != nil {
		return response, nil, err
	}
	response.CSVURL = csvURL

	records, err := fetchGoogleSheetRecords(csvURL)
	if err != nil {
		return response, nil, err
	}

	preview, validRows, err := previewBulkVehicleRecords(records)
	if err != nil {
		return response, nil, err
	}
	preview.SheetURL = response.SheetURL
	preview.CSVURL = csvURL
	preview.RequiredHeaders = bulkVehicleRequiredHeaders

	return preview, validRows, nil
}

func previewBulkVehicleRecords(records [][]string) (models.BulkVehicleSheetPreviewResponse, []models.CreateVehicleRequest, error) {
	response := models.BulkVehicleSheetPreviewResponse{
		RequiredHeaders: bulkVehicleRequiredHeaders,
	}

	if len(records) < 2 {
		return response, nil, fmt.Errorf("the sheet does not contain any vehicle rows")
	}

	headers := mapVehicleCSVHeaders(records[0])
	missingHeaders := []string{}
	for _, header := range bulkVehicleRequiredHeaders {
		if _, ok := headers[header]; !ok {
			missingHeaders = append(missingHeaders, header)
		}
	}
	if len(missingHeaders) > 0 {
		return response, nil, fmt.Errorf("missing required columns: %s", strings.Join(missingHeaders, ", "))
	}

	existingNumbers, err := getExistingVehicleNumbers()
	if err != nil {
		return response, nil, fmt.Errorf("failed to load existing vehicles: %w", err)
	}

	allowedVehicleTypes, err := getActiveVehicleTypeSet()
	if err != nil {
		return response, nil, fmt.Errorf("failed to load vehicle types: %w", err)
	}

	vehicleCounts := map[string]int{}
	parsedRows := []parsedBulkVehicleRow{}

	for idx, record := range records[1:] {
		if rowIsBlank(record) {
			continue
		}

		rowNumber := idx + 2
		previewRow, normalizedReq, rowErrors := buildBulkVehicleRowPreview(rowNumber, record, headers, allowedVehicleTypes)
		parsedRow := parsedBulkVehicleRow{
			preview:          previewRow,
			request:          normalizedReq,
			vehicleNumberKey: strings.ToUpper(strings.TrimSpace(normalizedReq.VehicleNumber)),
		}
		parsedRow.preview.Errors = uniqueStrings(rowErrors)

		if parsedRow.vehicleNumberKey != "" {
			vehicleCounts[parsedRow.vehicleNumberKey]++
		}

		parsedRows = append(parsedRows, parsedRow)
	}

	if len(parsedRows) == 0 {
		return response, nil, fmt.Errorf("the sheet only contains empty rows")
	}

	validRows := []models.CreateVehicleRequest{}
	for _, parsedRow := range parsedRows {
		errors := append([]string{}, parsedRow.preview.Errors...)

		if parsedRow.vehicleNumberKey != "" {
			if _, exists := existingNumbers[parsedRow.vehicleNumberKey]; exists {
				errors = append(errors, "Vehicle number already exists")
			}
			if vehicleCounts[parsedRow.vehicleNumberKey] > 1 {
				errors = append(errors, "Vehicle number is duplicated in the sheet")
			}
		}

		parsedRow.preview.Errors = uniqueStrings(errors)
		parsedRow.preview.IsValid = len(parsedRow.preview.Errors) == 0
		response.Rows = append(response.Rows, parsedRow.preview)
		if parsedRow.preview.IsValid {
			validRows = append(validRows, parsedRow.request)
		}
	}

	response.TotalRows = len(response.Rows)
	response.ReadyRows = len(validRows)
	response.InvalidRows = response.TotalRows - response.ReadyRows

	return response, validRows, nil
}

func readVehicleRecordsFromUpload(fileHeader *multipart.FileHeader) ([][]string, string, error) {
	openedFile, err := fileHeader.Open()
	if err != nil {
		return nil, "", fmt.Errorf("failed to open uploaded file")
	}
	defer openedFile.Close()

	contentBytes, err := io.ReadAll(io.LimitReader(openedFile, 20*1024*1024))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read uploaded file")
	}
	if len(contentBytes) == 0 {
		return nil, "", fmt.Errorf("uploaded file is empty")
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	sourceLabel := fmt.Sprintf("Uploaded File: %s", fileHeader.Filename)

	switch ext {
	case ".csv":
		csvReader := csv.NewReader(bytes.NewReader(contentBytes))
		csvReader.FieldsPerRecord = -1
		csvReader.TrimLeadingSpace = true
		records, parseErr := csvReader.ReadAll()
		if parseErr != nil {
			return nil, "", fmt.Errorf("failed to parse CSV file")
		}
		return records, sourceLabel, nil
	case ".xlsx", ".xlsm", ".xltx", ".xltm":
		excelFile, openErr := excelize.OpenReader(bytes.NewReader(contentBytes))
		if openErr != nil {
			return nil, "", fmt.Errorf("failed to parse Excel file")
		}
		defer func() { _ = excelFile.Close() }()

		sheets := excelFile.GetSheetList()
		if len(sheets) == 0 {
			return nil, "", fmt.Errorf("Excel file has no sheets")
		}

		activeSheet := excelFile.GetSheetName(excelFile.GetActiveSheetIndex())
		if activeSheet == "" {
			activeSheet = sheets[0]
		}

		records, rowsErr := excelFile.GetRows(activeSheet)
		if rowsErr != nil {
			return nil, "", fmt.Errorf("failed to read rows from Excel sheet")
		}

		return records, fmt.Sprintf("%s (sheet: %s)", sourceLabel, activeSheet), nil
	default:
		return nil, "", fmt.Errorf("unsupported file type. Upload .xlsx or .csv")
	}
}

func mapVehicleCSVHeaders(record []string) map[string]int {
	headers := map[string]int{}
	for idx, header := range record {
		normalized := normalizeVehicleCSVHeader(header)
		if normalized == "" {
			continue
		}
		headers[normalized] = idx
	}
	return headers
}

func normalizeVehicleCSVHeader(header string) string {
	normalized := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(header)), "\ufeff")
	normalized = strings.NewReplacer(" ", "_", "-", "_", "/", "_", ".", "_").Replace(normalized)

	switch normalized {
	case "registration_number", "vehicle_reg_number", "reg_number", "vehicle_no", "vehicle_no_":
		return "vehicle_number"
	case "vehiclecategory", "category", "vehicle_category", "vehiclekind", "vehicle_kind", "type":
		return "vehicle_type"
	case "fuel", "fuelcategory", "fuel_category":
		return "fuel_type"
	case "capacity", "seat_capacity", "seats":
		return "seating_capacity"
	case "vehiclename", "bus_name", "name":
		return "vehicle_name"
	default:
		return normalized
	}
}

func buildBulkVehicleRowPreview(rowNumber int, record []string, headers map[string]int, allowedVehicleTypes map[string]struct{}) (models.BulkVehiclePreviewRow, models.CreateVehicleRequest, []string) {
	getValue := func(header string) string {
		idx, ok := headers[header]
		if !ok || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	errors := []string{}

	seatingCapacity := 0
	seatingRaw := getValue("seating_capacity")
	if seatingRaw == "" {
		errors = append(errors, "Seating capacity is required")
	} else {
		parsedSeating, err := strconv.Atoi(seatingRaw)
		if err != nil || parsedSeating < 0 {
			errors = append(errors, "Seating capacity must be a valid non-negative number")
		} else {
			seatingCapacity = parsedSeating
		}
	}

	insuranceAmount, insuranceErr := parseOptionalFloat(getValue("insurance_amount"))
	if insuranceErr != nil {
		errors = append(errors, "Insurance amount must be a valid number")
	}

	roadTaxAmount, roadTaxErr := parseOptionalFloat(getValue("road_tax_amount"))
	if roadTaxErr != nil {
		errors = append(errors, "Road tax amount must be a valid number")
	}

	req := models.CreateVehicleRequest{
		VehicleNumber:       getValue("vehicle_number"),
		VehicleType:         getValue("vehicle_type"),
		FuelType:            getValue("fuel_type"),
		SeatingCapacity:     seatingCapacity,
		VehicleName:         getValue("vehicle_name"),
		StartPoint:          getValue("start_point"),
		EndPoint:            getValue("end_point"),
		ChassisNumber:       toOptionalStringPtr(getValue("chassis_number")),
		EngineNumber:        toOptionalStringPtr(getValue("engine_number")),
		PermitNumber:        toOptionalStringPtr(getValue("permit_number")),
		AdditionalPermit:    toOptionalStringPtr(getValue("additional_permit")),
		InsuranceAmount:     insuranceAmount,
		RoadTaxAmount:       roadTaxAmount,
		PollutionExpire:     toOptionalDatePtr(getValue("pollution_expire"), &errors, "Pollution expiry"),
		GreenTaxExpire:      toOptionalDatePtr(getValue("green_tax_expire"), &errors, "Green tax expiry"),
		MVTaxExpire:         toOptionalDatePtr(getValue("mv_tax_expire"), &errors, "MV tax expiry"),
		InsuranceExpireDate: toOptionalDatePtr(getValue("insurance_expire_date"), &errors, "Insurance expiry date"),
		InsuranceStartDate:  toOptionalDatePtr(getValue("insurance_start_date"), &errors, "Insurance start date"),
		FCExpireDate:        toOptionalDatePtr(getValue("fc_expire_date"), &errors, "FC expiry date"),
		FCStartDate:         toOptionalDatePtr(getValue("fc_start_date"), &errors, "FC start date"),
		PermitExpireDate:    toOptionalDatePtr(getValue("permit_expire_date"), &errors, "Permit expiry date"),
		PermitStartDate:     toOptionalDatePtr(getValue("permit_start_date"), &errors, "Permit start date"),
	}

	req, normalizeErrors := normalizeBulkVehicleRequest(req)
	errors = append(errors, normalizeErrors...)
	errors = append(errors, validateBulkVehicleRequest(req, allowedVehicleTypes)...)

	previewRow := models.BulkVehiclePreviewRow{
		RowNumber:        rowNumber,
		VehicleNumber:    req.VehicleNumber,
		VehicleType:      req.VehicleType,
		FuelType:         req.FuelType,
		SeatingCapacity:  req.SeatingCapacity,
		VehicleName:      req.VehicleName,
		StartPoint:       req.StartPoint,
		EndPoint:         req.EndPoint,
		ChassisNumber:    ptrToString(req.ChassisNumber),
		EngineNumber:     ptrToString(req.EngineNumber),
		PermitNumber:     ptrToString(req.PermitNumber),
		AdditionalPermit: ptrToString(req.AdditionalPermit),
		InsuranceAmount:  req.InsuranceAmount,
		RoadTaxAmount:    req.RoadTaxAmount,
		PollutionExpire:  ptrToString(req.PollutionExpire),
		GreenTaxExpire:   ptrToString(req.GreenTaxExpire),
		MVTaxExpire:      ptrToString(req.MVTaxExpire),
		InsuranceStart:   ptrToString(req.InsuranceStartDate),
		InsuranceExpire:  ptrToString(req.InsuranceExpireDate),
		FCStart:          ptrToString(req.FCStartDate),
		FCExpire:         ptrToString(req.FCExpireDate),
		PermitStart:      ptrToString(req.PermitStartDate),
		PermitExpire:     ptrToString(req.PermitExpireDate),
	}

	return previewRow, req, errors
}

func normalizeBulkVehicleRequest(req models.CreateVehicleRequest) (models.CreateVehicleRequest, []string) {
	errors := []string{}

	req.VehicleNumber = strings.ToUpper(strings.TrimSpace(req.VehicleNumber))
	req.VehicleType = strings.ToUpper(strings.TrimSpace(req.VehicleType))
	req.VehicleType = strings.NewReplacer(" ", "_", "-", "_").Replace(req.VehicleType)
	req.FuelType = strings.ToUpper(strings.TrimSpace(req.FuelType))
	req.VehicleName = strings.TrimSpace(req.VehicleName)
	req.StartPoint = strings.TrimSpace(req.StartPoint)
	req.EndPoint = strings.TrimSpace(req.EndPoint)

	if req.FuelType == "ELECTRIC" {
		req.FuelType = "EV"
	}
	if req.FuelType == "ELECTRIC_VEHICLE" || req.FuelType == "BATTERY" || req.FuelType == "BATTERY_VEHICLE" {
		req.FuelType = "EV"
	}

	if req.ChassisNumber != nil {
		trimmed := strings.TrimSpace(*req.ChassisNumber)
		req.ChassisNumber = toOptionalStringPtr(trimmed)
	}
	if req.EngineNumber != nil {
		trimmed := strings.TrimSpace(*req.EngineNumber)
		req.EngineNumber = toOptionalStringPtr(trimmed)
	}
	if req.PermitNumber != nil {
		trimmed := strings.TrimSpace(*req.PermitNumber)
		req.PermitNumber = toOptionalStringPtr(trimmed)
	}
	if req.AdditionalPermit != nil {
		trimmed := strings.TrimSpace(*req.AdditionalPermit)
		req.AdditionalPermit = toOptionalStringPtr(trimmed)
	}

	if req.SeatingCapacity < 0 {
		errors = append(errors, "Seating capacity cannot be negative")
	}

	return req, errors
}

func validateBulkVehicleRequest(req models.CreateVehicleRequest, allowedVehicleTypes map[string]struct{}) []string {
	errors := []string{}

	if req.VehicleNumber == "" {
		errors = append(errors, "Vehicle number is required")
	}
	if req.VehicleType == "" {
		errors = append(errors, "Vehicle type is required")
	} else {
		if _, ok := allowedVehicleTypes[req.VehicleType]; !ok {
			errors = append(errors, "Vehicle type is invalid or inactive")
		}
	}
	if req.FuelType == "" {
		errors = append(errors, "Fuel type is required")
	} else if _, ok := supportedVehicleFuelTypes[req.FuelType]; !ok {
		errors = append(errors, "Fuel type must be one of DIESEL, PETROL, CNG, or EV")
	}
	if req.SeatingCapacity <= 0 {
		errors = append(errors, "Seating capacity must be greater than zero")
	}

	return uniqueStrings(errors)
}

func getExistingVehicleNumbers() (map[string]struct{}, error) {
	rows, err := config.DB.Query(`SELECT COALESCE(vehicle_number, '') FROM vehicles`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	numbers := map[string]struct{}{}
	for rows.Next() {
		var number string
		if err := rows.Scan(&number); err != nil {
			return nil, err
		}
		trimmed := strings.ToUpper(strings.TrimSpace(number))
		if trimmed != "" {
			numbers[trimmed] = struct{}{}
		}
	}

	return numbers, rows.Err()
}

func getActiveVehicleTypeSet() (map[string]struct{}, error) {
	rows, err := config.DB.Query(`
		SELECT UPPER(type)
		FROM vehicle_types
		WHERE is_active = 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	types := map[string]struct{}{}
	for rows.Next() {
		var vehicleType string
		if err := rows.Scan(&vehicleType); err != nil {
			return nil, err
		}
		trimmed := strings.TrimSpace(vehicleType)
		if trimmed != "" {
			types[trimmed] = struct{}{}
		}
	}

	return types, rows.Err()
}

func parseOptionalFloat(raw string) (*float64, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	value, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil, err
	}
	if value < 0 {
		return nil, fmt.Errorf("value cannot be negative")
	}
	return &value, nil
}

func toOptionalDatePtr(raw string, errors *[]string, label string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	normalized, err := normalizeFlexibleDate(trimmed)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s must be a valid date", label))
		return nil
	}
	return &normalized
}

func toOptionalStringPtr(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func resolveVehicleTypeIDTx(tx *sql.Tx, vehicleType string) (int, error) {
	var vehicleTypeID int
	err := tx.QueryRow(`
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

func createVehicleTx(tx *sql.Tx, req models.CreateVehicleRequest) error {
	vehicleTypeID, err := resolveVehicleTypeIDTx(tx, req.VehicleType)
	if err != nil {
		return fmt.Errorf("invalid vehicle_type: %s", req.VehicleType)
	}

	result, err := tx.Exec(`
		INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
			chassis_number, engine_number, permit_number, additional_permit,
			insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
			insurance_expire_date, insurance_start_date,
			fc_expire_date, fc_start_date,
			permit_expire_date, permit_start_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.VehicleName, req.VehicleNumber, vehicleTypeID, req.FuelType, req.SeatingCapacity,
		req.ChassisNumber, req.EngineNumber, req.PermitNumber, req.AdditionalPermit,
		req.InsuranceAmount, req.RoadTaxAmount, req.PollutionExpire, req.GreenTaxExpire, req.MVTaxExpire,
		req.InsuranceExpireDate, req.InsuranceStartDate,
		req.FCExpireDate, req.FCStartDate,
		req.PermitExpireDate, req.PermitStartDate,
	)
	if err != nil {
		return err
	}

	vehicleID, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get vehicle ID: %w", err)
	}

	if req.VehicleType == "BUS" {
		_, err = tx.Exec(`
			INSERT INTO buses (vehicle_id, start_point, end_point)
			VALUES (?, ?, ?)
		`, vehicleID, req.StartPoint, req.EndPoint)
		if err != nil {
			return err
		}
	}

	return nil
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
	v.FCExpireDate = nullifyEmptyDate(v.FCExpireDate)
	v.FCStartDate = nullifyEmptyDate(v.FCStartDate)
	v.PermitExpireDate = nullifyEmptyDate(v.PermitExpireDate)
	v.PermitStartDate = nullifyEmptyDate(v.PermitStartDate)
	// ---- Read current document values BEFORE update for audit diff ----
	var oldInsExpire, oldInsStart *string
	var oldFCExpire, oldFCStart *string
	var oldPermitExpire, oldPermitStart *string
	readErr := config.DB.QueryRow(`
		SELECT DATE_FORMAT(insurance_expire_date, '%d-%m-%Y'), DATE_FORMAT(insurance_start_date, '%d-%m-%Y'),
		       DATE_FORMAT(fc_expire_date, '%d-%m-%Y'), DATE_FORMAT(fc_start_date, '%d-%m-%Y'),
		       DATE_FORMAT(permit_expire_date, '%d-%m-%Y'), DATE_FORMAT(permit_start_date, '%d-%m-%Y')
		FROM vehicles WHERE id = ?
	`, v.ID).Scan(
		&oldInsExpire, &oldInsStart,
		&oldFCExpire, &oldFCStart,
		&oldPermitExpire, &oldPermitStart,
	)
	if readErr != nil {
		log.Printf("Audit read-before-write error for vehicle %d: %v", v.ID, readErr)
	}
	// Update all vehicle fields including documents
	_, err = config.DB.Exec(`
		UPDATE vehicles SET vehicle_name=?, vehicle_number=?, vehicle_type_id=?, fuel_type=?, seating_capacity=?, status=?,
			chassis_number=?, engine_number=?, permit_number=?, additional_permit=?,
			insurance_amount=?, road_tax_amount=?, pollution_expire=?, green_tax_expire=?, mv_tax_expire=?,
			insurance_expire_date=?, insurance_start_date=?,
			fc_expire_date=?, fc_start_date=?,
			permit_expire_date=?, permit_start_date=?
		WHERE id=?
	`, v.VehicleName, v.VehicleNumber, vehicleTypeID, v.FuelType, v.SeatingCapacity, v.Status,
		v.ChassisNumber, v.EngineNumber, v.PermitNumber, v.AdditionalPermit,
		v.InsuranceAmount, v.RoadTaxAmount, v.PollutionExpire, v.GreenTaxExpire, v.MVTaxExpire,
		v.InsuranceExpireDate, v.InsuranceStartDate,
		v.FCExpireDate, v.FCStartDate,
		v.PermitExpireDate, v.PermitStartDate,
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
	compareAndLog(v.ID, "fc", "start_date", oldFCStart, formatDateForAudit(v.FCStartDate), userID, userName)
	compareAndLog(v.ID, "fc", "expire_date", oldFCExpire, formatDateForAudit(v.FCExpireDate), userID, userName)
	compareAndLog(v.ID, "permit", "start_date", oldPermitStart, formatDateForAudit(v.PermitStartDate), userID, userName)
	compareAndLog(v.ID, "permit", "expire_date", oldPermitExpire, formatDateForAudit(v.PermitExpireDate), userID, userName)
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
