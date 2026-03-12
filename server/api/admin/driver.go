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
	"net/mail"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/models"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

var googleSheetIDPattern = regexp.MustCompile(`/spreadsheets/d/([a-zA-Z0-9-_]+)`)

var bulkDriverRequiredHeaders = []string{
	"full_name",
	"phone",
	"license_number",
	"license_type",
	"license_expiry",
	"experience_years",
	"allowed_vehicle_type",
}

var supportedDriverLicenseTypes = map[string]struct{}{
	"LMV":  {},
	"HMV":  {},
	"MCWG": {},
}

type parsedBulkDriverRow struct {
	preview    models.BulkDriverPreviewRow
	request    models.CreateDriverRequest
	phoneKey   string
	licenseKey string
}

/* =========================
   ADMIN → DRIVER MANAGEMENT
========================= */

// GET /api/admin/drivers
func GetDrivers(c *gin.Context) {
	// Get today's attendance status for each driver
	// Priority: on_leave (from approved leave) > attendance record > not_marked
	rows, err := config.DB.Query(`
		SELECT d.id, d.user_id,
		       COALESCE(u.full_name, '') as full_name,
		       COALESCE(u.role, '') as role,
		       COALESCE(u.phone, '') as phone,
		       COALESCE(u.email, '') as email,
		       COALESCE(d.license_number, '') as license_number,
		       COALESCE(d.license_type, '') as license_type,
		       COALESCE(DATE_FORMAT(d.license_expiry, '%d-%m-%Y'), '') as license_expiry,
		       COALESCE(d.experience_years, 0) as experience_years,
		       COALESCE(DATE_FORMAT(d.date_of_joining, '%d-%m-%Y'), '') as date_of_joining,
		       COALESCE(DATE_FORMAT(d.date_of_relieving, '%d-%m-%Y'), '') as date_of_relieving,
		       COALESCE(d.allowed_vehicle_type, '') as allowed_vehicle_type,
		       d.home_vehicle_id, d.home_stop_id,
		       CASE 
		           WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved' 
		               AND CURDATE() BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
		           WHEN a.status IS NOT NULL THEN a.status
		           ELSE 'not_marked'
		       END as status,
		       dcm.cluster_id, COALESCE(c.name, '') as cluster_name
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
		LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = CURDATE()
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
		    AND lr.status = 'admin_approved'
		    AND CURDATE() BETWEEN lr.start_date AND lr.end_date
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var drivers []models.DriverResponse

	for rows.Next() {
		var d models.DriverResponse
		if err := rows.Scan(
			&d.ID,
			&d.UserID,
			&d.FullName,
			&d.Role,
			&d.Phone,
			&d.Email,
			&d.LicenseNumber,
			&d.LicenseType,
			&d.LicenseExpiry,
			&d.ExperienceYears,
			&d.DateOfJoining,
			&d.DateOfRelieving,
			&d.AllowedVehicleType,
			&d.HomeVehicleID,
			&d.HomeStopID,
			&d.Status,
			&d.ClusterID,
			&d.ClusterName,
		); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		drivers = append(drivers, d)
	}

	c.JSON(http.StatusOK, drivers)
}

func CreateDriver(c *gin.Context) {
	var req models.CreateDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	req, validationErrors := normalizeCreateDriverRequest(req)
	validationErrors = append(validationErrors, validateCreateDriverRequest(req)...)
	if len(validationErrors) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": strings.Join(uniqueStrings(validationErrors), ", ")})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = createDriverTx(tx, req); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver created successfully"})
}

func PreviewBulkDrivers(c *gin.Context) {
	var req models.BulkDriverSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.SheetURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sheet_url is required"})
		return
	}

	preview, _, err := previewBulkDriverSheet(req.SheetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

func PreviewBulkDriversFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	records, sourceLabel, err := readDriverRecordsFromUpload(fileHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preview, _, err := previewBulkDriverRecords(records)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	preview.CSVURL = sourceLabel

	c.JSON(http.StatusOK, preview)
}

func ImportBulkDrivers(c *gin.Context) {
	var req models.BulkDriverSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.SheetURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sheet_url is required"})
		return
	}

	preview, validRows, err := previewBulkDriverSheet(req.SheetURL)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid driver rows found for import"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	for _, driverReq := range validRows {
		if err = createDriverTxWithoutCredentials(tx, driverReq); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Import failed: %v", err)})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit driver import"})
		return
	}

	c.JSON(http.StatusOK, models.BulkDriverImportResponse{
		Message:      fmt.Sprintf("%d drivers imported successfully", len(validRows)),
		CreatedCount: len(validRows),
		FailedCount:  preview.InvalidRows,
		Preview:      preview,
	})
}

func ImportBulkDriversFile(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	records, sourceLabel, err := readDriverRecordsFromUpload(fileHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preview, validRows, err := previewBulkDriverRecords(records)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid driver rows found for import"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	for _, driverReq := range validRows {
		if err = createDriverTxWithoutCredentials(tx, driverReq); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Import failed: %v", err)})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit driver import"})
		return
	}

	c.JSON(http.StatusOK, models.BulkDriverImportResponse{
		Message:      fmt.Sprintf("%d drivers imported successfully", len(validRows)),
		CreatedCount: len(validRows),
		FailedCount:  preview.InvalidRows,
		Preview:      preview,
	})
}

// POST /api/admin/drivers/update
func UpdateDriver(c *gin.Context) {
	var req models.DriverResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Resolve driver ID (from query or body)
	idStr := c.Query("id")
	if idStr != "" {
		if id, convErr := strconv.Atoi(idStr); convErr == nil {
			req.ID = id
		}
	}
	if req.ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Driver ID required"})
		return
	}

	// Resolve user ID if not provided
	if req.UserID == 0 {
		var userID int
		if err := config.DB.QueryRow("SELECT user_id FROM drivers WHERE id=?", req.ID).Scan(&userID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
			return
		}
		req.UserID = userID
	}

	var licenseExpiry interface{}
	if req.LicenseExpiry == "" {
		licenseExpiry = nil
	} else {
		licenseExpiry = req.LicenseExpiry
	}

	var dateOfJoining interface{}
	if req.DateOfJoining == "" {
		dateOfJoining = nil
	} else {
		dateOfJoining = req.DateOfJoining
	}

	var dateOfRelieving interface{}
	if req.DateOfRelieving == "" {
		dateOfRelieving = nil
	} else {
		dateOfRelieving = req.DateOfRelieving
	}

	// Update users table
	_, err := config.DB.Exec(`
		UPDATE users SET full_name=?, phone=?, email=?
		WHERE id=?
	`, req.FullName, req.Phone, req.Email, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update drivers table
	_, err = config.DB.Exec(`
		UPDATE drivers SET license_number=?, license_type=?, license_expiry=?,
		       experience_years=?, date_of_joining=?, date_of_relieving=?, allowed_vehicle_type=?, home_vehicle_id=?, home_stop_id=?
		WHERE id=?
	`, req.LicenseNumber, req.LicenseType, licenseExpiry,
		req.ExperienceYears, dateOfJoining, dateOfRelieving, req.AllowedVehicleType, req.HomeVehicleID, req.HomeStopID, req.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver updated successfully"})
}

// DELETE /api/admin/drivers/delete?id=X
func DeleteDriver(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID required"})
		return
	}
	id, _ := strconv.Atoi(idStr)

	// Get user_id first
	var userID int
	err := config.DB.QueryRow("SELECT user_id FROM drivers WHERE id=?", id).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	// Delete driver (cascades from users due to FK)
	_, err = config.DB.Exec("DELETE FROM users WHERE id=?", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver deleted successfully"})
}

func createDriverTx(tx *sql.Tx, req models.CreateDriverRequest) error {
	result, err := tx.Exec(`
		INSERT INTO users (username, password, full_name, phone, email, role)
		VALUES (?, ?, ?, ?, ?, 'DRIVER')
	`,
		req.Username,
		req.Password,
		req.FullName,
		req.Phone,
		req.Email,
	)
	if err != nil {
		return err
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get user ID: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO drivers (
			user_id, license_number, license_type, license_expiry,
			experience_years, date_of_joining, date_of_relieving, allowed_vehicle_type,
			home_vehicle_id, home_stop_id
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		userID,
		req.LicenseNumber,
		req.LicenseType,
		nilIfEmpty(req.LicenseExpiry),
		req.ExperienceYears,
		nilIfEmpty(req.DateOfJoining),
		nilIfEmpty(req.DateOfRelieving),
		req.AllowedVehicleType,
		req.HomeVehicleID,
		req.HomeStopID,
	)
	if err != nil {
		return err
	}

	return nil
}

func createDriverTxWithoutCredentials(tx *sql.Tx, req models.CreateDriverRequest) error {
	result, err := tx.Exec(`
		INSERT INTO users (username, password, full_name, phone, email, role)
		VALUES (?, ?, ?, ?, ?, 'DRIVER')
	`,
		nil,
		nil,
		req.FullName,
		req.Phone,
		req.Email,
	)
	if err != nil {
		return err
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get user ID: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO drivers (
			user_id, license_number, license_type, license_expiry,
			experience_years, date_of_joining, date_of_relieving, allowed_vehicle_type,
			home_vehicle_id, home_stop_id
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		userID,
		req.LicenseNumber,
		req.LicenseType,
		nilIfEmpty(req.LicenseExpiry),
		req.ExperienceYears,
		nilIfEmpty(req.DateOfJoining),
		nilIfEmpty(req.DateOfRelieving),
		req.AllowedVehicleType,
		req.HomeVehicleID,
		req.HomeStopID,
	)
	if err != nil {
		return err
	}

	return nil
}

func previewBulkDriverSheet(sheetURL string) (models.BulkDriverSheetPreviewResponse, []models.CreateDriverRequest, error) {
	response := models.BulkDriverSheetPreviewResponse{
		SheetURL:        strings.TrimSpace(sheetURL),
		RequiredHeaders: bulkDriverRequiredHeaders,
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

	preview, validRows, err := previewBulkDriverRecords(records)
	if err != nil {
		return response, nil, err
	}
	preview.SheetURL = response.SheetURL
	preview.CSVURL = csvURL
	preview.RequiredHeaders = bulkDriverRequiredHeaders

	return preview, validRows, nil
}

func previewBulkDriverRecords(records [][]string) (models.BulkDriverSheetPreviewResponse, []models.CreateDriverRequest, error) {
	response := models.BulkDriverSheetPreviewResponse{
		RequiredHeaders: bulkDriverRequiredHeaders,
	}

	if len(records) < 2 {
		return response, nil, fmt.Errorf("the sheet does not contain any driver rows")
	}

	headers := mapCSVHeaders(records[0])
	missingHeaders := []string{}
	for _, header := range bulkDriverRequiredHeaders {
		if _, ok := headers[header]; !ok {
			missingHeaders = append(missingHeaders, header)
		}
	}
	if len(missingHeaders) > 0 {
		return response, nil, fmt.Errorf("missing required columns: %s", strings.Join(missingHeaders, ", "))
	}

	existingPhones, existingLicenses, err := getExistingDriverImportKeys()
	if err != nil {
		return response, nil, fmt.Errorf("failed to load existing drivers: %w", err)
	}

	phoneCounts := map[string]int{}
	licenseCounts := map[string]int{}
	parsedRows := []parsedBulkDriverRow{}

	for idx, record := range records[1:] {
		if rowIsBlank(record) {
			continue
		}

		rowNumber := idx + 2
		previewRow, normalizedReq, rowErrors := buildBulkDriverRowPreview(rowNumber, record, headers)
		parsedRow := parsedBulkDriverRow{
			preview:    previewRow,
			request:    normalizedReq,
			phoneKey:   normalizePhoneKey(normalizedReq.Phone),
			licenseKey: strings.ToLower(normalizedReq.LicenseNumber),
		}
		parsedRow.preview.Errors = uniqueStrings(rowErrors)

		if parsedRow.phoneKey != "" {
			phoneCounts[parsedRow.phoneKey]++
		}
		if parsedRow.licenseKey != "" {
			licenseCounts[parsedRow.licenseKey]++
		}

		parsedRows = append(parsedRows, parsedRow)
	}

	if len(parsedRows) == 0 {
		return response, nil, fmt.Errorf("the sheet only contains empty rows")
	}

	validRows := []models.CreateDriverRequest{}
	for _, parsedRow := range parsedRows {
		errors := append([]string{}, parsedRow.preview.Errors...)

		if parsedRow.phoneKey != "" {
			if _, exists := existingPhones[parsedRow.phoneKey]; exists {
				errors = append(errors, "Phone number already exists")
			}
			if phoneCounts[parsedRow.phoneKey] > 1 {
				errors = append(errors, "Phone number is duplicated in the sheet")
			}
		}
		if parsedRow.licenseKey != "" {
			if _, exists := existingLicenses[parsedRow.licenseKey]; exists {
				errors = append(errors, "License number already exists")
			}
			if licenseCounts[parsedRow.licenseKey] > 1 {
				errors = append(errors, "License number is duplicated in the sheet")
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

func readDriverRecordsFromUpload(fileHeader *multipart.FileHeader) ([][]string, string, error) {
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

func buildBulkDriverRowPreview(rowNumber int, record []string, headers map[string]int) (models.BulkDriverPreviewRow, models.CreateDriverRequest, []string) {
	getValue := func(header string) string {
		idx, ok := headers[header]
		if !ok || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	errors := []string{}
	experienceYears := 0
	experienceRaw := getValue("experience_years")
	if experienceRaw == "" {
		errors = append(errors, "Experience years is required")
	} else {
		parsedExperience, err := strconv.Atoi(experienceRaw)
		if err != nil {
			errors = append(errors, "Experience years must be a valid number")
		} else {
			experienceYears = parsedExperience
		}
	}

	req := models.CreateDriverRequest{
		FullName:           getValue("full_name"),
		Phone:              getValue("phone"),
		Email:              getValue("email"),
		LicenseNumber:      getValue("license_number"),
		LicenseType:        getValue("license_type"),
		LicenseExpiry:      getValue("license_expiry"),
		ExperienceYears:    experienceYears,
		DateOfJoining:      getValue("date_of_joining"),
		DateOfRelieving:    getValue("date_of_relieving"),
		AllowedVehicleType: getValue("allowed_vehicle_type"),
	}

	req, normalizeErrors := normalizeCreateDriverRequest(req)
	errors = append(errors, normalizeErrors...)
	errors = append(errors, validateDriverProfileFields(req)...)

	previewRow := models.BulkDriverPreviewRow{
		RowNumber:          rowNumber,
		FullName:           req.FullName,
		Phone:              req.Phone,
		Email:              req.Email,
		LicenseNumber:      req.LicenseNumber,
		LicenseType:        req.LicenseType,
		LicenseExpiry:      req.LicenseExpiry,
		ExperienceYears:    req.ExperienceYears,
		DateOfJoining:      req.DateOfJoining,
		DateOfRelieving:    req.DateOfRelieving,
		AllowedVehicleType: req.AllowedVehicleType,
	}

	return previewRow, req, errors
}

func normalizeCreateDriverRequest(req models.CreateDriverRequest) (models.CreateDriverRequest, []string) {
	errors := []string{}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.Password = strings.TrimSpace(req.Password)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.LicenseNumber = strings.ToUpper(strings.TrimSpace(req.LicenseNumber))
	req.LicenseType = strings.ToUpper(strings.TrimSpace(req.LicenseType))
	req.AllowedVehicleType = strings.ToUpper(strings.TrimSpace(req.AllowedVehicleType))
	req.DateOfJoining = strings.TrimSpace(req.DateOfJoining)
	req.DateOfRelieving = strings.TrimSpace(req.DateOfRelieving)
	req.LicenseExpiry = strings.TrimSpace(req.LicenseExpiry)

	if req.LicenseExpiry != "" {
		normalizedDate, err := normalizeFlexibleDate(req.LicenseExpiry)
		if err != nil {
			errors = append(errors, "License expiry must be a valid date")
		} else {
			req.LicenseExpiry = normalizedDate
		}
	}
	if req.DateOfJoining != "" {
		normalizedDate, err := normalizeFlexibleDate(req.DateOfJoining)
		if err != nil {
			errors = append(errors, "Date of joining must be a valid date")
		} else {
			req.DateOfJoining = normalizedDate
		}
	}
	if req.DateOfRelieving != "" {
		normalizedDate, err := normalizeFlexibleDate(req.DateOfRelieving)
		if err != nil {
			errors = append(errors, "Date of relieving must be a valid date")
		} else {
			req.DateOfRelieving = normalizedDate
		}
	}

	return req, errors
}

func validateCreateDriverRequest(req models.CreateDriverRequest) []string {
	errors := validateDriverProfileFields(req)

	if req.Username == "" {
		errors = append(errors, "Username is required")
	}
	if req.Password == "" {
		errors = append(errors, "Password is required")
	}

	return uniqueStrings(errors)
}

func validateDriverProfileFields(req models.CreateDriverRequest) []string {
	errors := []string{}

	if req.FullName == "" {
		errors = append(errors, "Full name is required")
	}
	if req.Phone == "" {
		errors = append(errors, "Phone is required")
	}
	if req.LicenseNumber == "" {
		errors = append(errors, "License number is required")
	}
	if req.LicenseType == "" {
		errors = append(errors, "License type is required")
	} else if _, ok := supportedDriverLicenseTypes[req.LicenseType]; !ok {
		errors = append(errors, "License type must be one of LMV, HMV, or MCWG")
	}
	if req.LicenseExpiry == "" {
		errors = append(errors, "License expiry is required")
	}
	if req.ExperienceYears < 0 {
		errors = append(errors, "Experience years cannot be negative")
	}
	if req.AllowedVehicleType == "" {
		errors = append(errors, "Allowed vehicle type is required")
	}
	if req.Email != "" {
		if _, err := mail.ParseAddress(req.Email); err != nil {
			errors = append(errors, "Email must be valid")
		}
	}

	return uniqueStrings(errors)
}

func buildGoogleSheetCSVURL(sheetURL string) (string, error) {
	trimmed := strings.TrimSpace(sheetURL)
	if trimmed == "" {
		return "", fmt.Errorf("sheet_url is required")
	}

	parsedURL, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid Google Sheet URL")
	}

	if strings.Contains(parsedURL.Host, "docs.google.com") && strings.Contains(parsedURL.Path, "/export") {
		query := parsedURL.Query()
		query.Set("format", "csv")
		parsedURL.RawQuery = query.Encode()
		return parsedURL.String(), nil
	}

	matches := googleSheetIDPattern.FindStringSubmatch(parsedURL.Path)
	if len(matches) < 2 {
		return "", fmt.Errorf("paste a valid Google Sheet link")
	}

	gid := parsedURL.Query().Get("gid")
	if gid == "" && strings.Contains(parsedURL.Fragment, "gid=") {
		for _, fragmentPart := range strings.Split(parsedURL.Fragment, "&") {
			if strings.HasPrefix(fragmentPart, "gid=") {
				gid = strings.TrimPrefix(fragmentPart, "gid=")
				break
			}
		}
	}
	if gid == "" {
		gid = "0"
	}

	return fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s", matches[1], gid), nil
}

func fetchGoogleSheetRecords(csvURL string) ([][]string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(csvURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch the Google Sheet")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		if len(body) > 0 {
			return nil, fmt.Errorf("Google Sheet fetch failed: %s", strings.TrimSpace(string(body)))
		}
		return nil, fmt.Errorf("Google Sheet fetch failed with status %d", resp.StatusCode)
	}

	reader := csv.NewReader(resp.Body)
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read the sheet as CSV")
	}

	return records, nil
}

func mapCSVHeaders(record []string) map[string]int {
	headers := map[string]int{}
	for idx, header := range record {
		normalized := normalizeCSVHeader(header)
		if normalized == "" {
			continue
		}
		headers[normalized] = idx
	}
	return headers
}

func normalizeCSVHeader(header string) string {
	normalized := strings.ToLower(strings.TrimSpace(header))
	normalized = strings.NewReplacer(" ", "_", "-", "_", "/", "_", ".", "_").Replace(normalized)

	switch normalized {
	case "name", "driver_name":
		return "full_name"
	case "mobile", "mobile_number", "phone_number", "contact_number":
		return "phone"
	case "user_name":
		return "username"
	case "mail":
		return "email"
	case "licence_number", "license_no", "licence_no":
		return "license_number"
	case "licence_type":
		return "license_type"
	case "license_expiry_date", "licence_expiry", "licence_expiry_date":
		return "license_expiry"
	case "joining_date", "date_joined":
		return "date_of_joining"
	case "relieving_date", "date_relieved":
		return "date_of_relieving"
	case "experience", "experience_year":
		return "experience_years"
	case "vehicle_type", "allowed_vehicle":
		return "allowed_vehicle_type"
	default:
		return normalized
	}
}

func getExistingDriverImportKeys() (map[string]struct{}, map[string]struct{}, error) {
	rows, err := config.DB.Query(`
		SELECT COALESCE(u.phone, ''), COALESCE(d.license_number, '')
		FROM drivers d
		JOIN users u ON d.user_id = u.id
	`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	phones := map[string]struct{}{}
	licenses := map[string]struct{}{}

	for rows.Next() {
		var phone, licenseNumber string
		if err := rows.Scan(&phone, &licenseNumber); err != nil {
			return nil, nil, err
		}
		if phone != "" {
			phones[normalizePhoneKey(phone)] = struct{}{}
		}
		if licenseNumber != "" {
			licenses[strings.ToLower(strings.TrimSpace(licenseNumber))] = struct{}{}
		}
	}

	return phones, licenses, rows.Err()
}

func normalizeFlexibleDate(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	layouts := []string{
		"2006-01-02",
		"02-01-2006",
		"02/01/2006",
		"2/1/2006",
		"02 Jan 2006",
		"2 Jan 2006",
		"02-Jan-2006",
		"2-Jan-2006",
		"2006/01/02",
	}

	for _, layout := range layouts {
		parsed, err := time.Parse(layout, trimmed)
		if err == nil {
			return parsed.Format("2006-01-02"), nil
		}
	}

	return "", fmt.Errorf("invalid date")
}

func normalizePhoneKey(value string) string {
	b := strings.Builder{}
	for _, r := range value {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func rowIsBlank(record []string) bool {
	for _, value := range record {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
