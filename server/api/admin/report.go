package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"transport-server/config"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

/* =========================
   REPORT GENERATION HANDLERS
   Exports Excel (.xlsx) files
========================= */

// styleHeader applies a consistent header style to a cell range
func styleHeader(f *excelize.File, sheet string, cols int, row int) {
	style, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"2B5797"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "CCCCCC", Style: 1},
			{Type: "right", Color: "CCCCCC", Style: 1},
			{Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
	})
	for c := 1; c <= cols; c++ {
		cell, _ := excelize.CoordinatesToCellName(c, row)
		f.SetCellStyle(sheet, cell, cell, style)
	}
}

// styleTitleRow adds title and subtitle to the sheet
func styleTitleRow(f *excelize.File, sheet, title, period string, cols int) {
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "2B5797"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	subStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Color: "666666", Italic: true},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})

	endCol, _ := excelize.CoordinatesToCellName(cols, 1)
	f.MergeCell(sheet, "A1", endCol)
	f.SetCellValue(sheet, "A1", title)
	f.SetCellStyle(sheet, "A1", endCol, titleStyle)

	endCol2, _ := excelize.CoordinatesToCellName(cols, 2)
	f.MergeCell(sheet, "A2", endCol2)
	f.SetCellValue(sheet, "A2", period)
	f.SetCellStyle(sheet, "A2", endCol2, subStyle)
}

func setColWidths(f *excelize.File, sheet string, widths map[string]float64) {
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}
}

// sendExcel writes the workbook to the HTTP response
func sendExcel(c *gin.Context, f *excelize.File, filename string) {
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Transfer-Encoding", "binary")
	if err := f.Write(c.Writer); err != nil {
		log.Printf("Error writing excel: %v", err)
	}
}

// ===================================
// 1. ATTENDANCE REPORT
// ===================================

// GET /api/admin/reports/attendance?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateAttendanceReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateAttendanceReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		WITH RECURSIVE date_range AS (
			SELECT ? AS d
			UNION ALL
			SELECT d + INTERVAL 1 DAY FROM date_range WHERE d < ?
		)
		SELECT
			u.full_name,
			d.license_number,
			DATE_FORMAT(dr.d, '%d-%m-%Y') as date,
			CASE
				WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved'
					AND dr.d BETWEEN lr.start_date AND lr.end_date THEN 'On Leave'
				WHEN a.status = 'present' THEN 'Present'
				WHEN a.status = 'absent' THEN 'Absent'
				WHEN a.status = 'on_leave' THEN 'On Leave'
				ELSE 'Not Marked'
			END as status,
			COALESCE(TIME_FORMAT(a.checkin_time, '%h:%i %p'), '-') as checkin,
			COALESCE(TIME_FORMAT(a.checkout_time, '%h:%i %p'), '-') as checkout
		FROM date_range dr
		CROSS JOIN drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN attendance a ON a.user_id = u.id AND a.date = dr.d
		LEFT JOIN leave_requests lr ON lr.driver_id = d.id
			AND lr.status = 'admin_approved'
			AND dr.d BETWEEN lr.start_date AND lr.end_date
		ORDER BY u.full_name, dr.d
	`, startDate, endDate)
	if err != nil {
		log.Printf("Attendance report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Attendance Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Driver Name", "License No", "Date", "Status", "Check-In", "Check-Out"}
	styleTitleRow(f, sheet, "DRIVER ATTENDANCE REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	for rows.Next() {
		var name, license, date, status, checkin, checkout string
		if err := rows.Scan(&name, &license, &date, &status, &checkin, &checkout); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), license)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), date)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), checkin)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), checkout)
		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 22, "C": 18, "D": 14, "E": 12, "F": 14, "G": 14})

	filename := fmt.Sprintf("Attendance_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 2. SERVICE RECORDS REPORT
// ===================================

// GET /api/admin/reports/service?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&status=...
func GenerateServiceReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateServiceReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	statusFilter := c.Query("status")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	query := `
		SELECT 
			v.vehicle_number, v.vehicle_name,
			COALESCE(st.name, '-') as service_type,
			sr.title, sr.severity,
			sr.status,
			COALESCE(sr.workshop_name, '-') as workshop,
			sr.labor_cost, sr.parts_cost, sr.total_cost,
			COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(sr.started_at, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y'), '-'),
			DATE_FORMAT(sr.created_at, '%d-%m-%Y')
		FROM service_records sr
		JOIN vehicles v ON sr.vehicle_id = v.id
		LEFT JOIN service_types st ON sr.service_type_id = st.id
		WHERE sr.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
	`
	args := []interface{}{startDate, endDate}

	if statusFilter != "" && statusFilter != "all" {
		query += " AND sr.status = ?"
		args = append(args, statusFilter)
	}
	query += " ORDER BY sr.created_at DESC"

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Service report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Service Records"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Vehicle No", "Vehicle Name", "Service Type", "Title", "Severity", "Status", "Workshop", "Labor Cost", "Parts Cost", "Total Cost", "Scheduled", "Started", "Completed", "Created"}
	styleTitleRow(f, sheet, "SERVICE RECORDS REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	var totalLabor, totalParts, totalCost float64
	for rows.Next() {
		var vNum, vName, sType, title, severity, status, workshop, scheduled, started, completed, created string
		var labor, parts, total float64
		if err := rows.Scan(&vNum, &vName, &sType, &title, &severity, &status, &workshop, &labor, &parts, &total, &scheduled, &started, &completed, &created); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), vNum)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), vName)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), sType)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), title)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), severity)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), workshop)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), labor)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), parts)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), total)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), scheduled)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), started)
		f.SetCellValue(sheet, fmt.Sprintf("N%d", row), completed)
		f.SetCellValue(sheet, fmt.Sprintf("O%d", row), created)
		totalLabor += labor
		totalParts += parts
		totalCost += total
		row++
		sno++
	}

	// Total row
	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("H%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("I%d", row), totalLabor)
	f.SetCellValue(sheet, fmt.Sprintf("J%d", row), totalParts)
	f.SetCellValue(sheet, fmt.Sprintf("K%d", row), totalCost)
	for _, col := range []string{"H", "I", "J", "K"} {
		f.SetCellStyle(sheet, fmt.Sprintf("%s%d", col, row), fmt.Sprintf("%s%d", col, row), totalStyle)
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 14, "C": 16, "D": 16, "E": 20, "F": 10, "G": 12, "H": 16, "I": 12, "J": 12, "K": 12, "L": 12, "M": 12, "N": 12, "O": 12})

	filename := fmt.Sprintf("Service_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 3. PURCHASE / BILLS REPORT
// ===================================

// GET /api/admin/reports/purchase?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GeneratePurchaseReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generatePurchaseReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			pp.id,
			COALESCE(v.vehicle_number, '-') as vehicle_number,
			COALESCE(vn.name, '-') as vendor_name,
			pp.category,
			pp.part_name,
			pp.quantity, pp.unit_price, pp.total_price,
			COALESCE(pp.invoice_number, '-'),
			pp.status,
			COALESCE(pp.warranty_months, 0),
			COALESCE(DATE_FORMAT(pp.purchased_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(pp.ordered_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(pp.received_date, '%d-%m-%Y'), '-'),
			DATE_FORMAT(pp.created_at, '%d-%m-%Y')
		FROM parts_purchased pp
		LEFT JOIN vehicles v ON pp.vehicle_id = v.id
		LEFT JOIN vendors vn ON pp.vendor_id = vn.id
		WHERE pp.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		ORDER BY pp.created_at DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("Purchase report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Purchase Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Part ID", "Vehicle No", "Vendor", "Category", "Part Name", "Qty", "Unit Price", "Total Price", "Invoice No", "Status", "Warranty (Months)", "Purchased", "Ordered", "Received", "Created"}
	styleTitleRow(f, sheet, "PURCHASE & PARTS REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	var grandTotal float64
	for rows.Next() {
		var id, warrantyMonths int
		var vehicleNum, vendor, category, partName, invoiceNo, status, purchased, ordered, received, created string
		var qty int
		var unitPrice, totalPrice float64
		if err := rows.Scan(&id, &vehicleNum, &vendor, &category, &partName, &qty, &unitPrice, &totalPrice, &invoiceNo, &status, &warrantyMonths, &purchased, &ordered, &received, &created); err != nil {
			log.Printf("Purchase report scan error: %v", err)
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), id)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), vehicleNum)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), vendor)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), category)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), partName)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), qty)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), unitPrice)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), totalPrice)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), invoiceNo)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), warrantyMonths)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), purchased)
		f.SetCellValue(sheet, fmt.Sprintf("N%d", row), ordered)
		f.SetCellValue(sheet, fmt.Sprintf("O%d", row), received)
		f.SetCellValue(sheet, fmt.Sprintf("P%d", row), created)
		grandTotal += totalPrice
		row++
		sno++
	}

	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("H%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("I%d", row), grandTotal)
	f.SetCellStyle(sheet, fmt.Sprintf("H%d", row), fmt.Sprintf("I%d", row), totalStyle)

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 8, "C": 14, "D": 18, "E": 14, "F": 20, "G": 6, "H": 12, "I": 12, "J": 14, "K": 12, "L": 12, "M": 12, "N": 12, "O": 12, "P": 12})

	filename := fmt.Sprintf("Purchase_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 4. LEAVE REPORT
// ===================================

// GET /api/admin/reports/leave?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateLeaveReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateLeaveReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name,
			lr.leave_type,
			DATE_FORMAT(lr.start_date, '%d-%m-%Y'),
			TIME_FORMAT(lr.start_time, '%h:%i %p'),
			DATE_FORMAT(lr.end_date, '%d-%m-%Y'),
			TIME_FORMAT(lr.end_time, '%h:%i %p'),
			lr.reason,
			lr.status,
			COALESCE(u_adm.full_name, '-') as approved_by,
			COALESCE(lr.admin_remarks, '-'),
			DATE_FORMAT(lr.created_at, '%d-%m-%Y %h:%i %p')
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
		WHERE lr.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		ORDER BY lr.created_at DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("Leave report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Leave Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Driver Name", "Leave Type", "Start Date", "Start Time", "End Date", "End Time", "Reason", "Status", "Approved By", "Remarks", "Applied On"}
	styleTitleRow(f, sheet, "DRIVER LEAVE REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	for rows.Next() {
		var name, leaveType, startD, startT, endD, endT, reason, status, approvedBy, remarks, appliedOn string
		if err := rows.Scan(&name, &leaveType, &startD, &startT, &endD, &endT, &reason, &status, &approvedBy, &remarks, &appliedOn); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), leaveType)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), startD)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), startT)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), endD)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), endT)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), reason)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), approvedBy)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), remarks)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), appliedOn)
		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 22, "C": 14, "D": 12, "E": 12, "F": 12, "G": 12, "H": 24, "I": 14, "J": 18, "K": 20, "L": 18})

	filename := fmt.Sprintf("Leave_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 5. KM & FUEL REPORT
// ===================================

// GET /api/admin/reports/km-fuel?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateKmFuelReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateKmFuelReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name as driver_name,
			v.vehicle_number, v.vehicle_name,
			DATE_FORMAT(k.date, '%d-%m-%Y'),
			k.start_km, k.end_km, k.total_km,
			COALESCE(k.fuel_consumed, 0),
			CASE WHEN k.fuel_consumed > 0 THEN ROUND(k.total_km / k.fuel_consumed, 2) ELSE 0 END as mileage,
			COALESCE(k.status, 'approved'),
			COALESCE(k.remarks, '-')
		FROM km_logs k
		JOIN drivers d ON k.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON k.vehicle_id = v.id
		WHERE k.date BETWEEN ? AND ?
		ORDER BY k.date DESC, u.full_name
	`, startDate, endDate)
	if err != nil {
		log.Printf("KM/Fuel report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "KM & Fuel Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Driver Name", "Vehicle No", "Vehicle Name", "Date", "Start KM", "End KM", "Total KM", "Fuel (L)", "Mileage (km/L)", "Status", "Remarks"}
	styleTitleRow(f, sheet, "KM & FUEL CONSUMPTION REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	var totalKm float64
	var totalFuel float64
	for rows.Next() {
		var driverName, vNum, vName, date, status, remarks string
		var startKm, endKm, totalK, fuel, mileage float64
		if err := rows.Scan(&driverName, &vNum, &vName, &date, &startKm, &endKm, &totalK, &fuel, &mileage, &status, &remarks); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), driverName)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), vNum)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), vName)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), date)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), startKm)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), endKm)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), totalK)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), fuel)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), mileage)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), remarks)
		totalKm += totalK
		totalFuel += fuel
		row++
		sno++
	}

	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("G%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("H%d", row), totalKm)
	f.SetCellValue(sheet, fmt.Sprintf("I%d", row), totalFuel)
	avgMileage := float64(0)
	if totalFuel > 0 {
		avgMileage = totalKm / totalFuel
	}
	f.SetCellValue(sheet, fmt.Sprintf("J%d", row), fmt.Sprintf("%.2f", avgMileage))
	for _, col := range []string{"G", "H", "I", "J"} {
		f.SetCellStyle(sheet, fmt.Sprintf("%s%d", col, row), fmt.Sprintf("%s%d", col, row), totalStyle)
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 22, "C": 14, "D": 16, "E": 12, "F": 12, "G": 12, "H": 12, "I": 10, "J": 14, "K": 12, "L": 20})

	filename := fmt.Sprintf("KM_Fuel_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 6. VEHICLE FLEET REPORT
// ===================================

// GET /api/admin/reports/vehicle-fleet
func GenerateVehicleFleetReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateVehicleFleetReportPDF(c)
		return
	}
	rows, err := config.DB.Query(`
		SELECT 
			v.vehicle_number, v.vehicle_name, COALESCE(vt.type, '') as vehicle_type, v.fuel_type,
			v.seating_capacity, v.status,
			COALESCE(DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'), '-'),
			CASE WHEN v.insurance_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.insurance_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END as insurance_status,
			CASE WHEN v.fc_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.fc_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END as fc_status,
			CASE WHEN v.permit_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.permit_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END as permit_status
		FROM vehicles v
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("Vehicle fleet report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Vehicle Fleet"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Vehicle No", "Vehicle Name", "Type", "Fuel Type", "Seats", "Status", "Insurance Expiry", "Insurance Status", "FC Expiry", "FC Status", "Permit Expiry", "Permit Status"}
	styleTitleRow(f, sheet, "VEHICLE FLEET & DOCUMENT EXPIRY REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	// Conditional style for expired
	expiredStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF0000", Bold: true}})
	warningStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF8C00", Bold: true}})

	row := 5
	sno := 1
	for rows.Next() {
		var vNum, vName, vType, fuelType, status, insExp, fcExp, permExp, insStat, fcStat, permStat string
		var seats int
		if err := rows.Scan(&vNum, &vName, &vType, &fuelType, &seats, &status, &insExp, &fcExp, &permExp, &insStat, &fcStat, &permStat); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), vNum)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), vName)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), vType)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), fuelType)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), seats)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), insExp)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), insStat)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), fcExp)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), fcStat)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), permExp)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), permStat)

		// Color code expired/warning cells
		for _, col := range []string{"I", "K", "M"} {
			cellRef := fmt.Sprintf("%s%d", col, row)
			val, _ := f.GetCellValue(sheet, cellRef)
			switch val {
			case "EXPIRED":
				f.SetCellStyle(sheet, cellRef, cellRef, expiredStyle)
			case "EXPIRING SOON":
				f.SetCellStyle(sheet, cellRef, cellRef, warningStyle)
			}
		}

		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 14, "C": 18, "D": 10, "E": 10, "F": 6, "G": 10, "H": 16, "I": 16, "J": 14, "K": 16, "L": 14, "M": 16})

	filename := fmt.Sprintf("Vehicle_Fleet_Report_%s.xlsx", time.Now().Format("2006-01-02"))
	sendExcel(c, f, filename)
}

// ===================================
// 7. STUDENT FEE COLLECTION REPORT
// ===================================

// GET /api/admin/reports/student-fee?academic_year=2025-2026
func GenerateStudentFeeReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateStudentFeeReportPDF(c)
		return
	}
	academicYear := c.Query("academic_year")
	if academicYear == "" {
		academicYear = fmt.Sprintf("%d-%d", time.Now().Year(), time.Now().Year()+1)
	}

	rows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, u.username, '-'),
			COALESCE(u.roll_number, '-'),
			COALESCE(u.department, '-'),
			COALESCE(u.year, ''),
			COALESCE(v.vehicle_number, '-') as bus_name,
			COALESCE(s.stop_name, '-') as stop_name,
			COALESCE(st.total_fee, 0),
			COALESCE(st.paid_amount, 0),
			COALESCE(st.balance, 0),
			COALESCE(st.status, '-'),
			st.academic_year
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN buses b ON st.bus_id = b.id
		LEFT JOIN vehicles v ON b.vehicle_id = v.id
		LEFT JOIN bus_stops s ON st.stop_id = s.id
		WHERE st.academic_year = ?
		ORDER BY u.department, COALESCE(u.full_name, u.username)
	`, academicYear)
	if err != nil {
		log.Printf("Student fee report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Student Fee Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Academic Year: %s | Generated: %s", academicYear, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Student Name", "Roll No", "Department", "Year", "Bus", "Stop", "Total Fee", "Paid Amount", "Balance", "Status"}
	styleTitleRow(f, sheet, "STUDENT TRANSPORT FEE COLLECTION REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	balanceStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF0000", Bold: true}})

	row := 5
	sno := 1
	var totalFee, totalPaid, totalBalance float64
	for rows.Next() {
		var name, rollNo, dept, year, busName, stopName, status, acadYear string
		var fee, paid, balance float64
		if err := rows.Scan(&name, &rollNo, &dept, &year, &busName, &stopName, &fee, &paid, &balance, &status, &acadYear); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), rollNo)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), dept)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), year)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), busName)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), stopName)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), fee)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), paid)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), balance)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), status)

		if balance > 0 {
			f.SetCellStyle(sheet, fmt.Sprintf("J%d", row), fmt.Sprintf("J%d", row), balanceStyle)
		}

		totalFee += fee
		totalPaid += paid
		totalBalance += balance
		row++
		sno++
	}

	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("G%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("H%d", row), totalFee)
	f.SetCellValue(sheet, fmt.Sprintf("I%d", row), totalPaid)
	f.SetCellValue(sheet, fmt.Sprintf("J%d", row), totalBalance)
	for _, col := range []string{"G", "H", "I", "J"} {
		f.SetCellStyle(sheet, fmt.Sprintf("%s%d", col, row), fmt.Sprintf("%s%d", col, row), totalStyle)
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 24, "C": 14, "D": 14, "E": 6, "F": 16, "G": 16, "H": 12, "I": 12, "J": 12, "K": 12})

	filename := fmt.Sprintf("Student_Fee_Report_%s.xlsx", academicYear)
	sendExcel(c, f, filename)
}

// ===================================
// 8. FACULTY VEHICLE REQUEST REPORT
// ===================================

// GET /api/admin/reports/vehicle-requests?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateVehicleRequestReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateVehicleRequestReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, '-') as faculty_name,
			COALESCE(f.department, '-'),
			COALESCE(vr.BookingType, '-'),
			COALESCE(vr.TripType, '-'),
			COALESCE(vr.TripMode, '-'),
			COALESCE(vr.Purpose, vr.PurposeOfVisit, '-'),
			COALESCE(vr.CountPerson, 1),
			COALESCE(vr.OnwardFromPlace, '-'),
			COALESCE(vr.OnwardToPlace, '-'),
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %h:%i %p'), '-'),
			COALESCE(v.vehicle_number, '-') as vehicle,
			COALESCE(u_drv.full_name, '-') as driver,
			vr.status,
			COALESCE(DATE_FORMAT(vr.approved_at, '%d-%m-%Y'), '-'),
			DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p')
		FROM vehiclerequests vr
		JOIN faculty f ON vr.faculty_id = f.id
		JOIN users u ON f.user_id = u.id
		LEFT JOIN vehicles v ON vr.vehicle_id = v.id
		LEFT JOIN drivers d ON vr.driver_id = d.id
		LEFT JOIN users u_drv ON d.user_id = u_drv.id
		WHERE vr.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		ORDER BY vr.created_at DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("Vehicle request report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Vehicle Requests"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Faculty", "Department", "Booking Type", "Trip Type", "Trip Mode", "Purpose", "Persons", "From", "To", "Date & Time", "Vehicle", "Driver", "Status", "Approved On", "Requested On"}
	styleTitleRow(f, sheet, "FACULTY VEHICLE REQUEST REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	for rows.Next() {
		var faculty, dept, bookingType, tripType, tripMode, purpose, from, to, dateTime, vehicle, driver, status, approvedOn, requestedOn string
		var persons int
		if err := rows.Scan(&faculty, &dept, &bookingType, &tripType, &tripMode, &purpose, &persons, &from, &to, &dateTime, &vehicle, &driver, &status, &approvedOn, &requestedOn); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), faculty)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), dept)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), bookingType)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), tripType)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), tripMode)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), purpose)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), persons)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), from)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), to)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), dateTime)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), vehicle)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), driver)
		f.SetCellValue(sheet, fmt.Sprintf("N%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("O%d", row), approvedOn)
		f.SetCellValue(sheet, fmt.Sprintf("P%d", row), requestedOn)
		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 20, "C": 14, "D": 14, "E": 12, "F": 12, "G": 22, "H": 8, "I": 16, "J": 16, "K": 20, "L": 14, "M": 18, "N": 12, "O": 14, "P": 20})

	filename := fmt.Sprintf("Vehicle_Request_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 9. DRIVER MASTER REPORT
// ===================================

// GET /api/admin/reports/drivers
func GenerateDriverReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateDriverReportPDF(c)
		return
	}
	rows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, '-'),
			COALESCE(u.phone, '-'),
			COALESCE(u.email, '-'),
			COALESCE(d.license_number, '-'),
			COALESCE(d.license_type, '-'),
			COALESCE(DATE_FORMAT(d.license_expiry, '%d-%m-%Y'), '-'),
			COALESCE(d.experience_years, 0),
			COALESCE(DATE_FORMAT(d.date_of_joining, '%d-%m-%Y'), '-'),
			COALESCE(d.allowed_vehicle_type, '-'),
			COALESCE(u.status, 'active'),
			COALESCE(v.vehicle_number, '-') as home_vehicle,
			COALESCE(s.stop_name, '-') as home_stop,
			CASE WHEN d.license_expiry < CURDATE() THEN 'EXPIRED'
				 WHEN d.license_expiry < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END as license_status
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN vehicles v ON d.home_vehicle_id = v.id
		LEFT JOIN stops s ON d.home_stop_id = s.id
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("Driver report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Driver Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Driver Name", "Phone", "Email", "License No", "License Type", "License Expiry", "Experience (Yrs)", "Date of Joining", "Allowed Vehicle", "Status", "Home Vehicle", "Home Stop", "License Status"}
	styleTitleRow(f, sheet, "DRIVER MASTER REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	expiredStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF0000", Bold: true}})
	warningStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF8C00", Bold: true}})

	row := 5
	sno := 1
	for rows.Next() {
		var name, phone, email, licNo, licType, licExp, doj, allowedType, status, homeVeh, homeStop, licStatus string
		var expYears int
		if err := rows.Scan(&name, &phone, &email, &licNo, &licType, &licExp, &expYears, &doj, &allowedType, &status, &homeVeh, &homeStop, &licStatus); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), phone)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), email)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), licNo)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), licType)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), licExp)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), expYears)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), doj)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), allowedType)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), homeVeh)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), homeStop)
		f.SetCellValue(sheet, fmt.Sprintf("N%d", row), licStatus)

		cellRef := fmt.Sprintf("N%d", row)
		switch licStatus {
		case "EXPIRED":
			f.SetCellStyle(sheet, cellRef, cellRef, expiredStyle)
		case "EXPIRING SOON":
			f.SetCellStyle(sheet, cellRef, cellRef, warningStyle)
		}

		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 22, "C": 14, "D": 22, "E": 16, "F": 12, "G": 14, "H": 14, "I": 14, "J": 14, "K": 10, "L": 14, "M": 16, "N": 16})

	filename := fmt.Sprintf("Driver_Report_%s.xlsx", time.Now().Format("2006-01-02"))
	sendExcel(c, f, filename)
}

// ===================================
// 10. ASSIGNMENT REPORT
// ===================================

// GET /api/admin/reports/assignments?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateAssignmentReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateAssignmentReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name as driver_name,
			v.vehicle_number, v.vehicle_name,
			COALESCE(sh.name, '-') as shift_name,
			DATE_FORMAT(a.start_date, '%d-%m-%Y'),
			DATE_FORMAT(a.end_date, '%d-%m-%Y'),
			a.status,
			CASE WHEN a.is_temporary_replacement = 1 THEN 'Yes' ELSE 'No' END,
			COALESCE(a.description, '-'),
			DATE_FORMAT(a.created_at, '%d-%m-%Y')
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON a.vehicle_id = v.id
		LEFT JOIN shifts sh ON a.shift_id = sh.id
		WHERE a.start_date <= ? AND a.end_date >= ?
		ORDER BY a.start_date DESC, u.full_name
	`, endDate, startDate)
	if err != nil {
		log.Printf("Assignment report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Assignment Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Driver Name", "Vehicle No", "Vehicle Name", "Shift", "Start Date", "End Date", "Status", "Temp Replacement?", "Description", "Created"}
	styleTitleRow(f, sheet, "ASSIGNMENT REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	for rows.Next() {
		var driverName, vNum, vName, shift, startD, endD, status, tempRepl, desc, created string
		if err := rows.Scan(&driverName, &vNum, &vName, &shift, &startD, &endD, &status, &tempRepl, &desc, &created); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), driverName)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), vNum)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), vName)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), shift)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), startD)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), endD)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), status)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), tempRepl)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), desc)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), created)
		row++
		sno++
	}

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 22, "C": 14, "D": 18, "E": 14, "F": 12, "G": 12, "H": 12, "I": 16, "J": 22, "K": 12})

	filename := fmt.Sprintf("Assignment_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 11. VENDOR SPENDING REPORT
// ===================================

// GET /api/admin/reports/vendor?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateVendorReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateVendorReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			vn.name as vendor_name,
			COALESCE(vn.contact, '-'),
			COALESCE(vn.gst_number, '-'),
			COUNT(pp.id) as total_parts,
			SUM(pp.total_price) as total_spent,
			COUNT(DISTINCT pp.vehicle_id) as vehicles_served
		FROM vendors vn
		LEFT JOIN parts_purchased pp ON pp.vendor_id = vn.id
			AND pp.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		WHERE vn.is_active = 1
		GROUP BY vn.id, vn.name, vn.contact, vn.gst_number
		ORDER BY total_spent DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("Vendor report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Vendor Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Vendor Name", "Contact", "GST Number", "Total Parts", "Total Spent (₹)", "Vehicles Served"}
	styleTitleRow(f, sheet, "VENDOR SPENDING ANALYSIS REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	row := 5
	sno := 1
	var grandTotal float64
	for rows.Next() {
		var vendorName, contact, gst string
		var totalParts, vehiclesServed int
		var totalSpent float64
		if err := rows.Scan(&vendorName, &contact, &gst, &totalParts, &totalSpent, &vehiclesServed); err != nil {
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), vendorName)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), contact)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), gst)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), totalParts)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), totalSpent)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), vehiclesServed)
		grandTotal += totalSpent
		row++
		sno++
	}

	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("E%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("F%d", row), grandTotal)
	f.SetCellStyle(sheet, fmt.Sprintf("E%d", row), fmt.Sprintf("F%d", row), totalStyle)

	setColWidths(f, sheet, map[string]float64{"A": 6, "B": 24, "C": 16, "D": 18, "E": 12, "F": 16, "G": 16})

	filename := fmt.Sprintf("Vendor_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 12. STOP CHANGE REQUEST REPORT
// ===================================

// GET /api/admin/reports/stop-changes?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
func GenerateStopChangeReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateStopChangeReportPDF(c)
		return
	}
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		now := time.Now()
		startDate = now.AddDate(0, -1, 0).Format("2006-01-02")
		endDate = now.Format("2006-01-02")
	}

	rows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, u.username, 'Unknown'),
			COALESCE(u.roll_number, '-'),
			COALESCE(u.department, '-'),
			COALESCE(u.year, 0),
			COALESCE(cs.stop_name, '-') as from_stop,
			COALESCE(rs.stop_name, '-') as to_stop,
			COALESCE(scr.current_fee, 0),
			COALESCE(scr.new_fee, 0),
			COALESCE(scr.fee_difference, 0),
			COALESCE(st.paid_amount, 0),
			COALESCE(st.balance, 0),
			scr.status,
			COALESCE(scr.reason, '-'),
			COALESCE(admin.full_name, '-') as processed_by,
			COALESCE(scr.admin_remarks, '-'),
			DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p'),
			DATE_FORMAT(scr.processed_at, '%d-%m-%Y %h:%i %p')
		FROM stop_change_requests scr
		LEFT JOIN student_transport st ON scr.student_transport_id = st.id
		LEFT JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
		LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
		LEFT JOIN users admin ON scr.processed_by = admin.id
		WHERE DATE(scr.created_at) BETWEEN ? AND ?
		ORDER BY scr.created_at DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("Stop change report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet := "Stop Change Report"
	f.SetSheetName("Sheet1", sheet)

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Student Name", "Roll No", "Department", "Year", "From Stop", "To Stop", "Old Fee", "New Fee", "Difference", "Paid Amount", "Outstanding", "Status", "Reason", "Processed By", "Admin Remarks", "Requested At", "Processed At"}
	styleTitleRow(f, sheet, "STOP CHANGE REQUEST REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader(f, sheet, len(headers), 4)

	positiveStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF0000", Bold: true}})
	negativeStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "008000", Bold: true}})

	row := 5
	sno := 1
	var totalDiff float64
	var totalOutstanding float64
	for rows.Next() {
		var name, rollNo, dept, fromStop, toStop, status, reason, processedBy, adminRemarks string
		var year int
		var oldFee, newFee, diff, paidAmount, outstanding float64
		var createdAt, processedAt sql.NullString
		if err := rows.Scan(&name, &rollNo, &dept, &year, &fromStop, &toStop, &oldFee, &newFee, &diff, &paidAmount, &outstanding, &status, &reason, &processedBy, &adminRemarks, &createdAt, &processedAt); err != nil {
			log.Printf("Error scanning stop change row: %v", err)
			continue
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), rollNo)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), dept)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), year)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), fromStop)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), toStop)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), oldFee)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), newFee)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), diff)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), paidAmount)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), outstanding)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", row), strings.ToUpper(status))
		f.SetCellValue(sheet, fmt.Sprintf("N%d", row), reason)
		f.SetCellValue(sheet, fmt.Sprintf("O%d", row), processedBy)
		f.SetCellValue(sheet, fmt.Sprintf("P%d", row), adminRemarks)
		if createdAt.Valid {
			f.SetCellValue(sheet, fmt.Sprintf("Q%d", row), createdAt.String)
		}
		if processedAt.Valid {
			f.SetCellValue(sheet, fmt.Sprintf("R%d", row), processedAt.String)
		}

		if diff > 0 {
			f.SetCellStyle(sheet, fmt.Sprintf("J%d", row), fmt.Sprintf("J%d", row), positiveStyle)
		} else if diff < 0 {
			f.SetCellStyle(sheet, fmt.Sprintf("J%d", row), fmt.Sprintf("J%d", row), negativeStyle)
		}

		if outstanding > 0 {
			f.SetCellStyle(sheet, fmt.Sprintf("L%d", row), fmt.Sprintf("L%d", row), positiveStyle)
		}

		totalDiff += diff
		totalOutstanding += outstanding
		row++
		sno++
	}

	totalStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet, fmt.Sprintf("I%d", row), "TOTAL")
	f.SetCellValue(sheet, fmt.Sprintf("J%d", row), totalDiff)
	f.SetCellValue(sheet, fmt.Sprintf("L%d", row), totalOutstanding)
	f.SetCellStyle(sheet, fmt.Sprintf("I%d", row), fmt.Sprintf("L%d", row), totalStyle)

	setColWidths(f, sheet, map[string]float64{
		"A": 6, "B": 22, "C": 14, "D": 16, "E": 6, "F": 16, "G": 16,
		"H": 12, "I": 12, "J": 14, "K": 14, "L": 14, "M": 10, "N": 24, "O": 16, "P": 24, "Q": 20, "R": 20,
	})

	filename := fmt.Sprintf("Stop_Change_Report_%s_to_%s.xlsx", startDate, endDate)
	sendExcel(c, f, filename)
}

// ===================================
// 13. BUS DETAIL REPORT
// ===================================

// GET /api/admin/reports/bus-detail?bus_id=X
func GenerateBusDetailReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateBusDetailReportPDF(c)
		return
	}
	busID := c.Query("bus_id")
	if busID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bus_id is required"})
		return
	}

	// ── Bus & Vehicle Info ──
	var busName, startPoint, endPoint, vehicleNumber, vehicleName, vehicleType string
	var fuelType, vehicleStatus string
	var seatingCap int
	var vehicleID int
	var insuranceExpiry, fcExpiry, permitExpiry sql.NullString
	err := config.DB.QueryRow(`
		SELECT 
			b.vehicle_id,
			CONCAT(COALESCE(b.start_point, ''), ' - ', COALESCE(b.end_point, '')),
			COALESCE(b.start_point, ''), COALESCE(b.end_point, ''),
			b.vehicle_id, COALESCE(v.vehicle_number, ''), COALESCE(v.vehicle_name, ''),
			COALESCE(vt.type, ''), COALESCE(v.fuel_type, ''), COALESCE(v.seating_capacity, 0),
			COALESCE(v.status, ''),
			DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'),
			DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'),
			DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y')
		FROM buses b
		JOIN vehicles v ON b.vehicle_id = v.id
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		WHERE b.id = ?
	`, busID).Scan(&vehicleID, &busName, &startPoint, &endPoint,
		&vehicleID, &vehicleNumber, &vehicleName,
		&vehicleType, &fuelType, &seatingCap,
		&vehicleStatus,
		&insuranceExpiry, &fcExpiry, &permitExpiry)
	if err != nil {
		log.Printf("Bus detail report error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Bus not found"})
		return
	}

	// ── Driver Assignment ──
	var driverName, driverPhone, shiftName string
	config.DB.QueryRow(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.phone, ''), COALESCE(s.name, '')
		FROM assignments a
		JOIN drivers d ON a.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN shifts s ON a.shift_id = s.id
		WHERE a.vehicle_id = ? AND a.status = 'active' AND CURDATE() BETWEEN a.start_date AND a.end_date
		LIMIT 1
	`, vehicleID).Scan(&driverName, &driverPhone, &shiftName)

	f := excelize.NewFile()

	// ══════════════════════════════
	// SHEET 1: BUS OVERVIEW
	// ══════════════════════════════
	sheet1 := "Bus Overview"
	f.SetSheetName("Sheet1", sheet1)

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 16, Color: "7D53F6"},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	labelStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "333333"},
		Alignment: &excelize.Alignment{Horizontal: "right"},
	})
	valueStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 11},
		Alignment: &excelize.Alignment{Horizontal: "left"},
	})
	sectionStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 13, Color: "7D53F6"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "7D53F6", Style: 2},
		},
	})

	displayName := vehicleName
	if displayName == "" {
		displayName = vehicleNumber
	}

	f.MergeCell(sheet1, "A1", "D1")
	f.SetCellValue(sheet1, "A1", fmt.Sprintf("BUS DETAIL REPORT — %s", displayName))
	f.SetCellStyle(sheet1, "A1", "D1", titleStyle)

	f.SetCellValue(sheet1, "A2", fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM")))

	// Vehicle Information Section
	row := 4
	f.MergeCell(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row))
	f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), "Vehicle Information")
	f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), sectionStyle)
	row++

	details := [][]string{
		{"Bus Name:", busName},
		{"Vehicle Number:", vehicleNumber},
		{"Vehicle Name:", vehicleName},
		{"Vehicle Type:", vehicleType},
		{"Fuel Type:", fuelType},
		{"Seating Capacity:", fmt.Sprintf("%d", seatingCap)},
		{"Status:", vehicleStatus},
		{"Route:", fmt.Sprintf("%s → %s", startPoint, endPoint)},
	}
	for _, d := range details {
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), d[0])
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), d[1])
		f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), labelStyle)
		f.SetCellStyle(sheet1, fmt.Sprintf("B%d", row), fmt.Sprintf("B%d", row), valueStyle)
		row++
	}

	// Document Expiry Section
	row++
	f.MergeCell(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row))
	f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), "Document Expiry")
	f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), sectionStyle)
	row++

	expDocs := [][]string{
		{"Insurance Expiry:", nullStr(insuranceExpiry, "N/A")},
		{"FC Expiry:", nullStr(fcExpiry, "N/A")},
		{"Permit Expiry:", nullStr(permitExpiry, "N/A")},
	}
	for _, d := range expDocs {
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), d[0])
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), d[1])
		f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), labelStyle)
		f.SetCellStyle(sheet1, fmt.Sprintf("B%d", row), fmt.Sprintf("B%d", row), valueStyle)
		row++
	}

	// Driver Assignment Section
	row++
	f.MergeCell(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row))
	f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), "Current Driver Assignment")
	f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), sectionStyle)
	row++

	if driverName != "" {
		driverDetails := [][]string{
			{"Driver Name:", driverName},
			{"Phone:", driverPhone},
			{"Shift:", shiftName},
		}
		for _, d := range driverDetails {
			f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), d[0])
			f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), d[1])
			f.SetCellStyle(sheet1, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), labelStyle)
			f.SetCellStyle(sheet1, fmt.Sprintf("B%d", row), fmt.Sprintf("B%d", row), valueStyle)
			row++
		}
	} else {
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), "No driver currently assigned")
		row++
	}

	setColWidths(f, sheet1, map[string]float64{"A": 22, "B": 28, "C": 20, "D": 20})

	// ══════════════════════════════
	// SHEET 2: STOPS & FEES
	// ══════════════════════════════
	sheet2 := "Stops & Fees"
	f.NewSheet(sheet2)

	stopHeaders := []string{"S.No", "Stop Name", "Stop Order", "Fee (₹)", "Distance (KM)", "Arrival Time", "Students Count"}
	period2 := fmt.Sprintf("Bus: %s (%s) | Route: %s → %s", displayName, vehicleNumber, startPoint, endPoint)
	styleTitleRow(f, sheet2, "STOPS & FEE DETAILS", period2, len(stopHeaders))

	for i, h := range stopHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet2, cell, h)
	}
	styleHeader(f, sheet2, len(stopHeaders), 4)

	stopRows, err := config.DB.Query(`
		SELECT 
			bs.stop_name, bs.stop_order, bs.fee, COALESCE(bs.distance_km, 0),
			COALESCE(DATE_FORMAT(bs.arrival_time, '%h:%i %p'), '-'),
			(SELECT COUNT(*) FROM student_transport st WHERE st.stop_id = bs.id AND st.status = 'active')
		FROM bus_stops bs
		WHERE bs.vehicle_id = ?
		ORDER BY bs.stop_order
	`, vehicleID)
	if err != nil {
		log.Printf("Bus stops query error: %v", err)
	}

	srow := 5
	sno := 1
	var totalStudents int
	var totalFeeSum float64
	if stopRows != nil {
		defer stopRows.Close()
		for stopRows.Next() {
			var stopName string
			var stopOrder int
			var fee, distKm float64
			var arrTime string
			var studentCount int
			if err := stopRows.Scan(&stopName, &stopOrder, &fee, &distKm, &arrTime, &studentCount); err != nil {
				continue
			}
			f.SetCellValue(sheet2, fmt.Sprintf("A%d", srow), sno)
			f.SetCellValue(sheet2, fmt.Sprintf("B%d", srow), stopName)
			f.SetCellValue(sheet2, fmt.Sprintf("C%d", srow), stopOrder)
			f.SetCellValue(sheet2, fmt.Sprintf("D%d", srow), fee)
			f.SetCellValue(sheet2, fmt.Sprintf("E%d", srow), distKm)
			f.SetCellValue(sheet2, fmt.Sprintf("F%d", srow), arrTime)
			f.SetCellValue(sheet2, fmt.Sprintf("G%d", srow), studentCount)
			totalStudents += studentCount
			totalFeeSum += fee
			srow++
			sno++
		}
	}

	totStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet2, fmt.Sprintf("C%d", srow), "TOTAL")
	f.SetCellValue(sheet2, fmt.Sprintf("G%d", srow), totalStudents)
	f.SetCellStyle(sheet2, fmt.Sprintf("C%d", srow), fmt.Sprintf("G%d", srow), totStyle)

	setColWidths(f, sheet2, map[string]float64{"A": 6, "B": 24, "C": 12, "D": 14, "E": 14, "F": 14, "G": 16})

	// ══════════════════════════════
	// SHEET 3: STUDENTS
	// ══════════════════════════════
	sheet3 := "Students"
	f.NewSheet(sheet3)

	stuHeaders := []string{"S.No", "Student Name", "Roll No", "Email", "Department", "Year", "Stop", "Total Fee", "Paid Amount", "Balance", "Status", "Academic Year"}
	period3 := fmt.Sprintf("Bus: %s (%s) | Total Students: %d", displayName, vehicleNumber, totalStudents)
	styleTitleRow(f, sheet3, "STUDENT LIST & FEE DETAILS", period3, len(stuHeaders))

	for i, h := range stuHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet3, cell, h)
	}
	styleHeader(f, sheet3, len(stuHeaders), 4)

	stuRows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, u.username, 'Unknown'),
			COALESCE(u.roll_number, '-'),
			COALESCE(u.email, '-'),
			COALESCE(u.department, '-'),
			COALESCE(u.year, 0),
			COALESCE(bs.stop_name, '-'),
			st.total_fee, st.paid_amount, st.balance,
			st.status, st.academic_year
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops bs ON st.stop_id = bs.id
		WHERE st.bus_id = ? AND st.status = 'active'
		ORDER BY bs.stop_name, u.full_name
	`, busID)
	if err != nil {
		log.Printf("Bus students query error: %v", err)
	}

	balStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Color: "FF0000", Bold: true}})
	strow := 5
	ssno := 1
	var sTotalFee, sTotalPaid, sTotalBal float64
	if stuRows != nil {
		defer stuRows.Close()
		for stuRows.Next() {
			var name, rollNo, email, dept, stopN, status, acadYear string
			var year int
			var tFee, pAmt, bal float64
			if err := stuRows.Scan(&name, &rollNo, &email, &dept, &year, &stopN, &tFee, &pAmt, &bal, &status, &acadYear); err != nil {
				continue
			}
			f.SetCellValue(sheet3, fmt.Sprintf("A%d", strow), ssno)
			f.SetCellValue(sheet3, fmt.Sprintf("B%d", strow), name)
			f.SetCellValue(sheet3, fmt.Sprintf("C%d", strow), rollNo)
			f.SetCellValue(sheet3, fmt.Sprintf("D%d", strow), email)
			f.SetCellValue(sheet3, fmt.Sprintf("E%d", strow), dept)
			f.SetCellValue(sheet3, fmt.Sprintf("F%d", strow), year)
			f.SetCellValue(sheet3, fmt.Sprintf("G%d", strow), stopN)
			f.SetCellValue(sheet3, fmt.Sprintf("H%d", strow), tFee)
			f.SetCellValue(sheet3, fmt.Sprintf("I%d", strow), pAmt)
			f.SetCellValue(sheet3, fmt.Sprintf("J%d", strow), bal)
			f.SetCellValue(sheet3, fmt.Sprintf("K%d", strow), strings.ToUpper(status))
			f.SetCellValue(sheet3, fmt.Sprintf("L%d", strow), acadYear)

			if bal > 0 {
				f.SetCellStyle(sheet3, fmt.Sprintf("J%d", strow), fmt.Sprintf("J%d", strow), balStyle)
			}

			sTotalFee += tFee
			sTotalPaid += pAmt
			sTotalBal += bal
			strow++
			ssno++
		}
	}

	stuTotStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 11}, Alignment: &excelize.Alignment{Horizontal: "right"}})
	f.SetCellValue(sheet3, fmt.Sprintf("G%d", strow), "TOTAL")
	f.SetCellValue(sheet3, fmt.Sprintf("H%d", strow), sTotalFee)
	f.SetCellValue(sheet3, fmt.Sprintf("I%d", strow), sTotalPaid)
	f.SetCellValue(sheet3, fmt.Sprintf("J%d", strow), sTotalBal)
	for _, col := range []string{"G", "H", "I", "J"} {
		f.SetCellStyle(sheet3, fmt.Sprintf("%s%d", col, strow), fmt.Sprintf("%s%d", col, strow), stuTotStyle)
	}

	setColWidths(f, sheet3, map[string]float64{
		"A": 6, "B": 22, "C": 14, "D": 24, "E": 16, "F": 6,
		"G": 18, "H": 12, "I": 12, "J": 12, "K": 10, "L": 14,
	})

	filename := fmt.Sprintf("Bus_Detail_%s_%s.xlsx", strings.ReplaceAll(displayName, " ", "_"), time.Now().Format("02-01-2006"))
	sendExcel(c, f, filename)
}

func nullStr(ns sql.NullString, fallback string) string {
	if ns.Valid {
		return ns.String
	}
	return fallback
}

// ===================================
// 14. DRIVER GROUP (CLUSTER) REPORT
// ===================================

// GET /api/admin/reports/driver-groups
func GenerateDriverGroupReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateDriverGroupReportPDF(c)
		return
	}

	// ── Date range filter ──
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// ── Sheet 1: Driver Groups ──
	query := `
		SELECT c.id, c.name, COALESCE(c.description, '-'),
			(SELECT COUNT(DISTINCT dcm.driver_id) FROM driver_cluster_members dcm WHERE dcm.cluster_id = c.id),
			COALESCE(DATE_FORMAT(c.valid_from, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(c.valid_to, '%d-%m-%Y'), '-'),
			DATE_FORMAT(c.created_at, '%d-%m-%Y %h:%i %p')
		FROM driver_clusters c`
	var args []interface{}
	if startDate != "" && endDate != "" {
		query += ` WHERE c.valid_from <= ? AND c.valid_to >= ?`
		args = append(args, endDate, startDate)
	}
	query += ` ORDER BY c.name`

	groupRows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Driver group report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer groupRows.Close()

	f := excelize.NewFile()
	sheet1 := "Driver Groups"
	f.SetSheetName("Sheet1", sheet1)

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	if startDate != "" && endDate != "" {
		period = fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	}
	headers1 := []string{"S.No", "Group Name", "Description", "Driver Count", "Valid From", "Valid To", "Created At"}
	styleTitleRow(f, sheet1, "DRIVER GROUP REPORT", period, len(headers1))

	for i, h := range headers1 {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet1, cell, h)
	}
	styleHeader(f, sheet1, len(headers1), 4)

	row := 5
	sno := 1
	var groupIDs []int
	var groupNames []string
	for groupRows.Next() {
		var id, driverCount int
		var name, description, validFrom, validTo, createdAt string
		if err := groupRows.Scan(&id, &name, &description, &driverCount, &validFrom, &validTo, &createdAt); err != nil {
			continue
		}
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet1, fmt.Sprintf("C%d", row), description)
		f.SetCellValue(sheet1, fmt.Sprintf("D%d", row), driverCount)
		f.SetCellValue(sheet1, fmt.Sprintf("E%d", row), validFrom)
		f.SetCellValue(sheet1, fmt.Sprintf("F%d", row), validTo)
		f.SetCellValue(sheet1, fmt.Sprintf("G%d", row), createdAt)
		groupIDs = append(groupIDs, id)
		groupNames = append(groupNames, name)
		row++
		sno++
	}

	setColWidths(f, sheet1, map[string]float64{"A": 6, "B": 22, "C": 28, "D": 14, "E": 14, "F": 14, "G": 22})

	// ── Sheet 2: Driver Group Members ──
	sheet2 := "Group Members"
	f.NewSheet(sheet2)

	headers2 := []string{"S.No", "Group Name", "Driver Name", "License No", "Phone", "Valid From", "Valid To", "Added At"}
	styleTitleRow(f, sheet2, "DRIVER GROUP MEMBERS", period, len(headers2))

	for i, h := range headers2 {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet2, cell, h)
	}
	styleHeader(f, sheet2, len(headers2), 4)

	mrow := 5
	msno := 1
	for idx, gID := range groupIDs {
		memberRows, err := config.DB.Query(`
			SELECT COALESCE(u.full_name, '-'), COALESCE(d.license_number, '-'), COALESCE(u.phone, '-'),
				COALESCE(DATE_FORMAT(dcm.valid_from, '%d-%m-%Y'), '-'),
				COALESCE(DATE_FORMAT(dcm.valid_to, '%d-%m-%Y'), '-'),
				DATE_FORMAT(dcm.added_at, '%d-%m-%Y %h:%i %p')
			FROM driver_cluster_members dcm
			JOIN drivers d ON dcm.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			WHERE dcm.cluster_id = ?
			ORDER BY u.full_name
		`, gID)
		if err != nil {
			continue
		}
		for memberRows.Next() {
			var driverName, licenseNo, phone, validFrom, validTo, addedAt string
			if err := memberRows.Scan(&driverName, &licenseNo, &phone, &validFrom, &validTo, &addedAt); err != nil {
				continue
			}
			f.SetCellValue(sheet2, fmt.Sprintf("A%d", mrow), msno)
			f.SetCellValue(sheet2, fmt.Sprintf("B%d", mrow), groupNames[idx])
			f.SetCellValue(sheet2, fmt.Sprintf("C%d", mrow), driverName)
			f.SetCellValue(sheet2, fmt.Sprintf("D%d", mrow), licenseNo)
			f.SetCellValue(sheet2, fmt.Sprintf("E%d", mrow), phone)
			f.SetCellValue(sheet2, fmt.Sprintf("F%d", mrow), validFrom)
			f.SetCellValue(sheet2, fmt.Sprintf("G%d", mrow), validTo)
			f.SetCellValue(sheet2, fmt.Sprintf("H%d", mrow), addedAt)
			mrow++
			msno++
		}
		memberRows.Close()
	}

	setColWidths(f, sheet2, map[string]float64{"A": 6, "B": 22, "C": 22, "D": 18, "E": 14, "F": 14, "G": 14, "H": 22})

	filename := fmt.Sprintf("Driver_Group_Report_%s.xlsx", time.Now().Format("2006-01-02"))
	sendExcel(c, f, filename)
}

// ===================================
// 15. VEHICLE GROUP REPORT
// ===================================

// GET /api/admin/reports/vehicle-groups
func GenerateVehicleGroupReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateVehicleGroupReportPDF(c)
		return
	}

	// ── Date range filter ──
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// ── Sheet 1: Vehicle Groups ──
	query := `
		SELECT vg.id, vg.name, COALESCE(vg.description, '-'),
			(SELECT COUNT(DISTINCT vgm.vehicle_id) FROM vehicle_group_members vgm WHERE vgm.group_id = vg.id),
			COALESCE(DATE_FORMAT(vg.valid_from, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(vg.valid_to, '%d-%m-%Y'), '-'),
			DATE_FORMAT(vg.created_at, '%d-%m-%Y %h:%i %p'),
			DATE_FORMAT(vg.updated_at, '%d-%m-%Y %h:%i %p')
		FROM vehicle_groups vg`
	var args []interface{}
	if startDate != "" && endDate != "" {
		query += ` WHERE vg.valid_from <= ? AND vg.valid_to >= ?`
		args = append(args, endDate, startDate)
	}
	query += ` ORDER BY vg.name`

	groupRows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("Vehicle group report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer groupRows.Close()

	f := excelize.NewFile()
	sheet1 := "Vehicle Groups"
	f.SetSheetName("Sheet1", sheet1)

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	if startDate != "" && endDate != "" {
		period = fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	}
	headers1 := []string{"S.No", "Group Name", "Description", "Vehicle Count", "Valid From", "Valid To", "Created At", "Updated At"}
	styleTitleRow(f, sheet1, "VEHICLE GROUP REPORT", period, len(headers1))

	for i, h := range headers1 {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet1, cell, h)
	}
	styleHeader(f, sheet1, len(headers1), 4)

	row := 5
	sno := 1
	var groupIDs []int
	var groupNames []string
	for groupRows.Next() {
		var id, vehicleCount int
		var name, description, validFrom, validTo, createdAt, updatedAt string
		if err := groupRows.Scan(&id, &name, &description, &vehicleCount, &validFrom, &validTo, &createdAt, &updatedAt); err != nil {
			continue
		}
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet1, fmt.Sprintf("C%d", row), description)
		f.SetCellValue(sheet1, fmt.Sprintf("D%d", row), vehicleCount)
		f.SetCellValue(sheet1, fmt.Sprintf("E%d", row), validFrom)
		f.SetCellValue(sheet1, fmt.Sprintf("F%d", row), validTo)
		f.SetCellValue(sheet1, fmt.Sprintf("G%d", row), createdAt)
		f.SetCellValue(sheet1, fmt.Sprintf("H%d", row), updatedAt)
		groupIDs = append(groupIDs, id)
		groupNames = append(groupNames, name)
		row++
		sno++
	}

	setColWidths(f, sheet1, map[string]float64{"A": 6, "B": 22, "C": 28, "D": 14, "E": 14, "F": 14, "G": 22, "H": 22})

	// ── Sheet 2: Vehicle Group Members ──
	sheet2 := "Group Members"
	f.NewSheet(sheet2)

	headers2 := []string{"S.No", "Group Name", "Vehicle Number", "Vehicle Type", "Vehicle Status", "Valid From", "Valid To", "Added At"}
	styleTitleRow(f, sheet2, "VEHICLE GROUP MEMBERS", period, len(headers2))

	for i, h := range headers2 {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet2, cell, h)
	}
	styleHeader(f, sheet2, len(headers2), 4)

	mrow := 5
	msno := 1
	for idx, gID := range groupIDs {
		memberRows, err := config.DB.Query(`
			SELECT COALESCE(v.vehicle_number, '-'), COALESCE(vt.type, '-'), COALESCE(v.status, '-'),
				COALESCE(DATE_FORMAT(vgm.valid_from, '%d-%m-%Y'), '-'),
				COALESCE(DATE_FORMAT(vgm.valid_to, '%d-%m-%Y'), '-'),
				DATE_FORMAT(vgm.added_at, '%d-%m-%Y %h:%i %p')
			FROM vehicle_group_members vgm
			JOIN vehicles v ON vgm.vehicle_id = v.id
			LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
			WHERE vgm.group_id = ?
			ORDER BY v.vehicle_number
		`, gID)
		if err != nil {
			continue
		}
		for memberRows.Next() {
			var vehicleNumber, vehicleType, vehicleStatus, validFrom, validTo, addedAt string
			if err := memberRows.Scan(&vehicleNumber, &vehicleType, &vehicleStatus, &validFrom, &validTo, &addedAt); err != nil {
				continue
			}
			f.SetCellValue(sheet2, fmt.Sprintf("A%d", mrow), msno)
			f.SetCellValue(sheet2, fmt.Sprintf("B%d", mrow), groupNames[idx])
			f.SetCellValue(sheet2, fmt.Sprintf("C%d", mrow), vehicleNumber)
			f.SetCellValue(sheet2, fmt.Sprintf("D%d", mrow), vehicleType)
			f.SetCellValue(sheet2, fmt.Sprintf("E%d", mrow), vehicleStatus)
			f.SetCellValue(sheet2, fmt.Sprintf("F%d", mrow), validFrom)
			f.SetCellValue(sheet2, fmt.Sprintf("G%d", mrow), validTo)
			f.SetCellValue(sheet2, fmt.Sprintf("H%d", mrow), addedAt)
			mrow++
			msno++
		}
		memberRows.Close()
	}

	setColWidths(f, sheet2, map[string]float64{"A": 6, "B": 22, "C": 18, "D": 14, "E": 14, "F": 14, "G": 14, "H": 22})

	filename := fmt.Sprintf("Vehicle_Group_Report_%s.xlsx", time.Now().Format("2006-01-02"))
	sendExcel(c, f, filename)
}

// ===================================
// 16. SHIFTS & TIMINGS REPORT
// ===================================

// GET /api/admin/reports/shifts
func GenerateShiftReport(c *gin.Context) {
	if c.Query("format") == "pdf" {
		generateShiftReportPDF(c)
		return
	}

	rows, err := config.DB.Query(`
		SELECT s.id, s.name, 
			TIME_FORMAT(s.start_time, '%h:%i %p'), 
			TIME_FORMAT(s.end_time, '%h:%i %p'),
			COALESCE(s.description, '-'),
			COALESCE(u.full_name, '-') as created_by,
			(SELECT COUNT(DISTINCT a.driver_id) FROM assignments a 
			 WHERE a.shift_id = s.id AND a.status = 'active' 
			 AND CURDATE() BETWEEN a.start_date AND a.end_date) as active_drivers,
			(SELECT COUNT(DISTINCT a.vehicle_id) FROM assignments a 
			 WHERE a.shift_id = s.id AND a.status = 'active' 
			 AND CURDATE() BETWEEN a.start_date AND a.end_date) as active_vehicles
		FROM shifts s
		LEFT JOIN users u ON s.created_by = u.id
		ORDER BY s.start_time, s.name
	`)
	if err != nil {
		log.Printf("Shift report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	sheet1 := "Shifts & Timings"
	f.SetSheetName("Sheet1", sheet1)

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	headers := []string{"S.No", "Shift Name", "Start Time", "End Time", "Description", "Created By", "Active Drivers", "Active Vehicles"}
	styleTitleRow(f, sheet1, "SHIFTS & TIMINGS REPORT", period, len(headers))

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet1, cell, h)
	}
	styleHeader(f, sheet1, len(headers), 4)

	row := 5
	sno := 1
	var shiftIDs []int
	var shiftNames []string
	for rows.Next() {
		var id, activeDrivers, activeVehicles int
		var name, startTime, endTime, description, createdBy string
		if err := rows.Scan(&id, &name, &startTime, &endTime, &description, &createdBy, &activeDrivers, &activeVehicles); err != nil {
			continue
		}
		f.SetCellValue(sheet1, fmt.Sprintf("A%d", row), sno)
		f.SetCellValue(sheet1, fmt.Sprintf("B%d", row), name)
		f.SetCellValue(sheet1, fmt.Sprintf("C%d", row), startTime)
		f.SetCellValue(sheet1, fmt.Sprintf("D%d", row), endTime)
		f.SetCellValue(sheet1, fmt.Sprintf("E%d", row), description)
		f.SetCellValue(sheet1, fmt.Sprintf("F%d", row), createdBy)
		f.SetCellValue(sheet1, fmt.Sprintf("G%d", row), activeDrivers)
		f.SetCellValue(sheet1, fmt.Sprintf("H%d", row), activeVehicles)
		shiftIDs = append(shiftIDs, id)
		shiftNames = append(shiftNames, name)
		row++
		sno++
	}

	setColWidths(f, sheet1, map[string]float64{"A": 6, "B": 22, "C": 14, "D": 14, "E": 28, "F": 20, "G": 16, "H": 16})

	// ── Sheet 2: Shift Assignments (current active assignments per shift) ──
	sheet2 := "Shift Assignments"
	f.NewSheet(sheet2)

	headers2 := []string{"S.No", "Shift Name", "Driver Name", "Vehicle Number", "Vehicle Name", "Start Date", "End Date"}
	styleTitleRow(f, sheet2, "CURRENT SHIFT-WISE ASSIGNMENTS", period, len(headers2))

	for i, h := range headers2 {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet2, cell, h)
	}
	styleHeader(f, sheet2, len(headers2), 4)

	arow := 5
	asno := 1
	for idx, sID := range shiftIDs {
		assignRows, err := config.DB.Query(`
			SELECT COALESCE(u.full_name, '-'), 
				COALESCE(v.vehicle_number, '-'), COALESCE(v.vehicle_name, '-'),
				DATE_FORMAT(a.start_date, '%d-%m-%Y'), DATE_FORMAT(a.end_date, '%d-%m-%Y')
			FROM assignments a
			JOIN drivers d ON a.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			JOIN vehicles v ON a.vehicle_id = v.id
			WHERE a.shift_id = ? AND a.status = 'active' AND CURDATE() BETWEEN a.start_date AND a.end_date
			ORDER BY u.full_name
		`, sID)
		if err != nil {
			continue
		}
		for assignRows.Next() {
			var driverName, vehicleNum, vehicleName, startDate, endDate string
			if err := assignRows.Scan(&driverName, &vehicleNum, &vehicleName, &startDate, &endDate); err != nil {
				continue
			}
			f.SetCellValue(sheet2, fmt.Sprintf("A%d", arow), asno)
			f.SetCellValue(sheet2, fmt.Sprintf("B%d", arow), shiftNames[idx])
			f.SetCellValue(sheet2, fmt.Sprintf("C%d", arow), driverName)
			f.SetCellValue(sheet2, fmt.Sprintf("D%d", arow), vehicleNum)
			f.SetCellValue(sheet2, fmt.Sprintf("E%d", arow), vehicleName)
			f.SetCellValue(sheet2, fmt.Sprintf("F%d", arow), startDate)
			f.SetCellValue(sheet2, fmt.Sprintf("G%d", arow), endDate)
			arow++
			asno++
		}
		assignRows.Close()
	}

	setColWidths(f, sheet2, map[string]float64{"A": 6, "B": 22, "C": 22, "D": 16, "E": 18, "F": 14, "G": 14})

	filename := fmt.Sprintf("Shifts_Timings_Report_%s.xlsx", time.Now().Format("2006-01-02"))
	sendExcel(c, f, filename)
}
