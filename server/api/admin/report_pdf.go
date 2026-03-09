package admin

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"transport-server/config"
	"transport-server/utils"

	"github.com/gin-gonic/gin"
)

/* =========================
   PDF REPORT GENERATION
   Generates branded PDF files
========================= */

// ── 1. ATTENDANCE ──

func generateAttendanceReportPDF(c *gin.Context) {
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
			DATE_FORMAT(dr.d, '%d-%m-%Y'),
			CASE
				WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved'
					AND dr.d BETWEEN lr.start_date AND lr.end_date THEN 'On Leave'
				WHEN a.status = 'present' THEN 'Present'
				WHEN a.status = 'absent' THEN 'Absent'
				WHEN a.status = 'on_leave' THEN 'On Leave'
				ELSE 'Not Marked'
			END,
			COALESCE(TIME_FORMAT(a.checkin_time, '%h:%i %p'), '-'),
			COALESCE(TIME_FORMAT(a.checkout_time, '%h:%i %p'), '-')
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
		log.Printf("PDF attendance report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Driver Name", "License No", "Date", "Status", "Check-In", "Check-Out"}
	// Portrait: 7 cols - widths proportional to content, scaleWidths fills to 190mm
	widths := []float64{8, 30, 28, 20, 20, 22, 22}
	var data [][]string
	sno := 1
	for rows.Next() {
		var name, license, date, status, checkin, checkout string
		if err := rows.Scan(&name, &license, &date, &status, &checkin, &checkout); err != nil {
			continue
		}
		data = append(data, []string{fmt.Sprintf("%d", sno), name, license, date, status, checkin, checkout})
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("DRIVER ATTENDANCE REPORT", period, false) // portrait – 7 cols fit cleanly
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Attendance_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 2. SERVICE RECORDS ──

func generateServiceReportPDF(c *gin.Context) {
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
			COALESCE(st.name, '-'), sr.title, sr.severity, sr.status,
			COALESCE(sr.workshop_name, '-'),
			sr.labor_cost, sr.parts_cost, sr.total_cost,
			COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(sr.started_at, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y'), '-')
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
		log.Printf("PDF service report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Vehicle No", "Vehicle", "Type", "Title", "Severity", "Status", "Workshop", "Labor", "Parts", "Total", "Scheduled", "Started", "Completed"}
	// 14 cols – Vehicle No, Status, Parts wider; scaleWidths fills landscape width
	widths := []float64{8, 26, 22, 16, 28, 14, 22, 22, 14, 22, 16, 20, 20, 20}
	var data [][]string
	sno := 1
	var totalLabor, totalParts, totalCost float64
	for rows.Next() {
		var vNum, vName, sType, title, severity, status, workshop, scheduled, started, completed string
		var labor, parts, total float64
		if err := rows.Scan(&vNum, &vName, &sType, &title, &severity, &status, &workshop, &labor, &parts, &total, &scheduled, &started, &completed); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), vNum, vName, sType, title, severity, status, workshop,
			utils.FmtMoney(labor), utils.FmtMoney(parts), utils.FmtMoney(total),
			scheduled, started, completed,
		})
		totalLabor += labor
		totalParts += parts
		totalCost += total
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("SERVICE RECORDS REPORT", period, true)
	pr.AddTable(headers, data, widths)

	totals := make([]string, len(headers))
	totals[7] = "TOTAL"
	totals[8] = utils.FmtMoney(totalLabor)
	totals[9] = utils.FmtMoney(totalParts)
	totals[10] = utils.FmtMoney(totalCost)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("Service_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 3. PURCHASE REPORT ──

func generatePurchaseReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			pp.id, COALESCE(v.vehicle_number, '-'), COALESCE(vn.name, '-'),
			pp.category, pp.part_name, pp.quantity, pp.unit_price, pp.total_price,
			COALESCE(pp.invoice_number, '-'), pp.status,
			COALESCE(pp.warranty_months, 0),
			COALESCE(DATE_FORMAT(pp.purchased_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(pp.ordered_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(pp.received_date, '%d-%m-%Y'), '-'),
			DATE_FORMAT(pp.created_at, '%d-%m-%Y')
		FROM parts_purchased pp
		LEFT JOIN vehicles v ON pp.vehicle_id = v.id
		LEFT JOIN vendors vn ON pp.vendor_id = vn.id
		WHERE pp.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		ORDER BY pp.created_at ASC
	`, startDate, endDate)
	if err != nil {
		log.Printf("PDF purchase report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "ID", "Vehicle", "Vendor", "Category", "Part", "Qty", "Unit Price", "Total", "Invoice", "Status", "Warranty", "Purchased", "Ordered", "Received", "Created"}
	widths := []float64{8, 9, 18, 22, 16, 26, 8, 16, 16, 18, 14, 12, 18, 18, 18, 18}
	var data [][]string
	sno := 1
	var grandTotal float64
	for rows.Next() {
		var id, warrantyMonths, qty int
		var vehicleNum, vendor, category, partName, invoiceNo, status, purchased, ordered, received, created string
		var unitPrice, totalPrice float64
		if err := rows.Scan(&id, &vehicleNum, &vendor, &category, &partName, &qty, &unitPrice, &totalPrice, &invoiceNo, &status, &warrantyMonths, &purchased, &ordered, &received, &created); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), fmt.Sprintf("%d", id), vehicleNum, vendor, category, partName,
			fmt.Sprintf("%d", qty), utils.FmtMoney(unitPrice), utils.FmtMoney(totalPrice),
			invoiceNo, status, fmt.Sprintf("%d mo", warrantyMonths), purchased, ordered, received, created,
		})
		grandTotal += totalPrice
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("PURCHASE & PARTS REPORT", period, true)
	pr.AddTable(headers, data, widths)

	totals := make([]string, len(headers))
	totals[7] = "TOTAL"
	totals[8] = utils.FmtMoney(grandTotal)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("Purchase_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 4. LEAVE REPORT ──

func generateLeaveReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name, lr.leave_type,
			DATE_FORMAT(lr.start_date, '%d-%m-%Y'), TIME_FORMAT(lr.start_time, '%h:%i %p'),
			DATE_FORMAT(lr.end_date, '%d-%m-%Y'), TIME_FORMAT(lr.end_time, '%h:%i %p'),
			lr.reason, lr.status,
			COALESCE(u_adm.full_name, '-'), COALESCE(lr.admin_remarks, '-'),
			DATE_FORMAT(lr.created_at, '%d-%m-%Y %h:%i %p')
		FROM leave_requests lr
		JOIN drivers d ON lr.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
		WHERE lr.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		ORDER BY lr.created_at DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("PDF leave report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Driver Name", "Leave Type", "Start Date", "Start Time", "End Date", "End Time", "Reason", "Status", "Approved By", "Remarks", "Applied On"}
	// Long-text cols (Reason, Remarks) are narrower; wrapping handles overflow
	widths := []float64{8, 30, 18, 20, 18, 20, 18, 28, 14, 24, 26, 22}
	var data [][]string
	sno := 1
	for rows.Next() {
		var name, leaveType, startD, startT, endD, endT, reason, status, approvedBy, remarks, appliedOn string
		if err := rows.Scan(&name, &leaveType, &startD, &startT, &endD, &endT, &reason, &status, &approvedBy, &remarks, &appliedOn); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), name, leaveType, startD, startT, endD, endT, reason, status, approvedBy, remarks, appliedOn,
		})
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("DRIVER LEAVE REPORT", period, true)
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Leave_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 5. KM & FUEL REPORT ──

func generateKmFuelReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name, v.vehicle_number, v.vehicle_name,
			DATE_FORMAT(k.date, '%d-%m-%Y'),
			k.start_km, k.end_km, k.total_km,
			COALESCE(k.fuel_consumed, 0),
			CASE WHEN k.fuel_consumed > 0 THEN ROUND(k.total_km / k.fuel_consumed, 2) ELSE 0 END,
			COALESCE(k.status, 'approved'), COALESCE(k.remarks, '-')
		FROM km_logs k
		JOIN drivers d ON k.driver_id = d.id
		JOIN users u ON d.user_id = u.id
		JOIN vehicles v ON k.vehicle_id = v.id
		WHERE k.date BETWEEN ? AND ?
		ORDER BY k.date DESC, u.full_name
	`, startDate, endDate)
	if err != nil {
		log.Printf("PDF KM/Fuel report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Driver Name", "Vehicle No", "Vehicle", "Date", "Start KM", "End KM", "Total KM", "Fuel(L)", "Mileage", "Status", "Remarks"}
	widths := []float64{8, 30, 20, 24, 20, 18, 18, 18, 14, 16, 14, 28}
	var data [][]string
	sno := 1
	var totalKm, totalFuel float64
	for rows.Next() {
		var driverName, vNum, vName, date, status, remarks string
		var startKm, endKm, totalK, fuel, mileage float64
		if err := rows.Scan(&driverName, &vNum, &vName, &date, &startKm, &endKm, &totalK, &fuel, &mileage, &status, &remarks); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), driverName, vNum, vName, date,
			fmt.Sprintf("%.0f", startKm), fmt.Sprintf("%.0f", endKm), fmt.Sprintf("%.0f", totalK),
			fmt.Sprintf("%.1f", fuel), fmt.Sprintf("%.2f", mileage), status, remarks,
		})
		totalKm += totalK
		totalFuel += fuel
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("KM & FUEL CONSUMPTION REPORT", period, true)
	pr.AddTable(headers, data, widths)

	avgMileage := float64(0)
	if totalFuel > 0 {
		avgMileage = totalKm / totalFuel
	}
	totals := make([]string, len(headers))
	totals[6] = "TOTAL"
	totals[7] = fmt.Sprintf("%.0f", totalKm)
	totals[8] = fmt.Sprintf("%.1f", totalFuel)
	totals[9] = fmt.Sprintf("%.2f", avgMileage)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("KM_Fuel_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 6. VEHICLE FLEET REPORT ──

func generateVehicleFleetReportPDF(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT 
			v.vehicle_number, v.vehicle_name, COALESCE(vt.type, '') as vehicle_type, v.fuel_type,
			v.seating_capacity, v.status,
			COALESCE(DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'), '-'),
			COALESCE(DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'), '-'),
			CASE WHEN v.insurance_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.insurance_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END,
			CASE WHEN v.fc_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.fc_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END,
			CASE WHEN v.permit_expire_date < CURDATE() THEN 'EXPIRED'
				 WHEN v.permit_expire_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END
		FROM vehicles v
		LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
		ORDER BY v.vehicle_number
	`)
	if err != nil {
		log.Printf("PDF vehicle fleet report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Vehicle No", "Vehicle Name", "Type", "Fuel", "Seats", "Status", "Insurance Exp.", "Ins.Status", "FC Expiry", "FC Status", "Permit Exp.", "Permit Status"}
	widths := []float64{8, 20, 28, 14, 12, 10, 13, 22, 20, 20, 20, 20, 22}
	var data [][]string
	sno := 1
	for rows.Next() {
		var vNum, vName, vType, fuelType, status, insExp, fcExp, permExp, insStat, fcStat, permStat string
		var seats int
		if err := rows.Scan(&vNum, &vName, &vType, &fuelType, &seats, &status, &insExp, &fcExp, &permExp, &insStat, &fcStat, &permStat); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), vNum, vName, vType, fuelType, fmt.Sprintf("%d", seats), status,
			insExp, insStat, fcExp, fcStat, permExp, permStat,
		})
		sno++
	}

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("VEHICLE FLEET & DOCUMENT EXPIRY REPORT", period, true)
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Vehicle_Fleet_Report_%s.pdf", time.Now().Format("2006-01-02")))
}

// ── 7. STUDENT FEE COLLECTION ──

func generateStudentFeeReportPDF(c *gin.Context) {
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
			COALESCE(v.vehicle_number, '-'),
			COALESCE(s.stop_name, '-'),
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
		log.Printf("PDF student fee report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Student Name", "Roll No", "Dept", "Year", "Bus", "Stop", "Total Fee", "Paid", "Balance", "Status"}
	widths := []float64{8, 36, 20, 16, 10, 24, 24, 20, 20, 20, 16}
	var data [][]string
	sno := 1
	var totalFee, totalPaid, totalBalance float64
	for rows.Next() {
		var name, rollNo, dept, year, busName, stopName, status, acadYear string
		var fee, paid, balance float64
		if err := rows.Scan(&name, &rollNo, &dept, &year, &busName, &stopName, &fee, &paid, &balance, &status, &acadYear); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), name, rollNo, dept, year, busName, stopName,
			utils.FmtMoney(fee), utils.FmtMoney(paid), utils.FmtMoney(balance), status,
		})
		totalFee += fee
		totalPaid += paid
		totalBalance += balance
		sno++
	}

	period := fmt.Sprintf("Academic Year: %s | Generated: %s", academicYear, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("STUDENT TRANSPORT FEE COLLECTION REPORT", period, true)
	pr.AddTable(headers, data, widths)

	totals := make([]string, len(headers))
	totals[6] = "TOTAL"
	totals[7] = utils.FmtMoney(totalFee)
	totals[8] = utils.FmtMoney(totalPaid)
	totals[9] = utils.FmtMoney(totalBalance)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("Student_Fee_Report_%s.pdf", academicYear))
}

// ── 8. VEHICLE REQUESTS ──

func generateVehicleRequestReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, '-'),
			COALESCE(f.department, '-'),
			COALESCE(vr.BookingType, '-'),
			COALESCE(vr.TripType, '-'),
			COALESCE(vr.TripMode, '-'),
			COALESCE(vr.Purpose, vr.PurposeOfVisit, '-'),
			COALESCE(vr.CountPerson, 1),
			COALESCE(vr.OnwardFromPlace, '-'),
			COALESCE(vr.OnwardToPlace, '-'),
			COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %h:%i %p'), '-'),
			COALESCE(v.vehicle_number, '-'),
			COALESCE(u_drv.full_name, '-'),
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
		log.Printf("PDF vehicle request report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Faculty", "Dept", "Booking", "Trip", "Mode", "Purpose", "Prs", "From", "To", "Date & Time", "Vehicle", "Driver", "Status", "Approved", "Requested"}
	widths := []float64{8, 22, 14, 14, 12, 12, 24, 8, 16, 16, 24, 16, 22, 14, 18, 24}
	var data [][]string
	sno := 1
	for rows.Next() {
		var faculty, dept, bookingType, tripType, tripMode, purpose, from, to, dateTime, vehicle, driver, status, approvedOn, requestedOn string
		var persons int
		if err := rows.Scan(&faculty, &dept, &bookingType, &tripType, &tripMode, &purpose, &persons, &from, &to, &dateTime, &vehicle, &driver, &status, &approvedOn, &requestedOn); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), faculty, dept, bookingType, tripType, tripMode, purpose,
			fmt.Sprintf("%d", persons), from, to, dateTime, vehicle, driver, status, approvedOn, requestedOn,
		})
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("FACULTY VEHICLE REQUEST REPORT", period, true)
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Vehicle_Request_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 9. DRIVER MASTER ──

func generateDriverReportPDF(c *gin.Context) {
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
			COALESCE(v.vehicle_number, '-'),
			COALESCE(s.stop_name, '-'),
			CASE WHEN d.license_expiry < CURDATE() THEN 'EXPIRED'
				 WHEN d.license_expiry < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING SOON'
				 ELSE 'Valid' END
		FROM drivers d
		JOIN users u ON d.user_id = u.id
		LEFT JOIN vehicles v ON d.home_vehicle_id = v.id
		LEFT JOIN stops s ON d.home_stop_id = s.id
		ORDER BY u.full_name
	`)
	if err != nil {
		log.Printf("PDF driver report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Driver Name", "Phone", "Email", "License No", "Lic. Type", "Lic. Expiry", "Exp(Yrs)", "DOJ", "Allowed", "Status", "Home Veh.", "Home Stop", "Lic. Status"}
	widths := []float64{8, 28, 20, 34, 22, 16, 20, 12, 18, 16, 14, 18, 18, 20}
	var data [][]string
	sno := 1
	for rows.Next() {
		var name, phone, email, licNo, licType, licExp, doj, allowedType, status, homeVeh, homeStop, licStatus string
		var expYears int
		if err := rows.Scan(&name, &phone, &email, &licNo, &licType, &licExp, &expYears, &doj, &allowedType, &status, &homeVeh, &homeStop, &licStatus); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), name, phone, email, licNo, licType, licExp,
			fmt.Sprintf("%d", expYears), doj, allowedType, status, homeVeh, homeStop, licStatus,
		})
		sno++
	}

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("DRIVER MASTER REPORT", period, true)
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Driver_Report_%s.pdf", time.Now().Format("2006-01-02")))
}

// ── 10. ASSIGNMENT REPORT ──

func generateAssignmentReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			u.full_name, v.vehicle_number, v.vehicle_name,
			COALESCE(sh.name, '-'),
			DATE_FORMAT(a.start_date, '%d-%m-%Y'), DATE_FORMAT(a.end_date, '%d-%m-%Y'),
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
		log.Printf("PDF assignment report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Driver Name", "Vehicle No", "Vehicle Name", "Shift", "Start Date", "End Date", "Status", "Temp?", "Description", "Created"}
	widths := []float64{8, 32, 20, 26, 18, 20, 20, 16, 12, 38, 20}
	var data [][]string
	sno := 1
	for rows.Next() {
		var driverName, vNum, vName, shift, startD, endD, status, tempRepl, desc, created string
		if err := rows.Scan(&driverName, &vNum, &vName, &shift, &startD, &endD, &status, &tempRepl, &desc, &created); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), driverName, vNum, vName, shift, startD, endD, status, tempRepl, desc, created,
		})
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("ASSIGNMENT REPORT", period, true)
	pr.AddTable(headers, data, widths)
	pr.Send(c, fmt.Sprintf("Assignment_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 11. VENDOR SPENDING ──

func generateVendorReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT 
			vn.name, COALESCE(vn.contact, '-'), COALESCE(vn.gst_number, '-'),
			COUNT(pp.id), SUM(pp.total_price), COUNT(DISTINCT pp.vehicle_id)
		FROM vendors vn
		LEFT JOIN parts_purchased pp ON pp.vendor_id = vn.id
			AND pp.created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
		WHERE vn.is_active = 1
		GROUP BY vn.id, vn.name, vn.contact, vn.gst_number
		ORDER BY SUM(pp.total_price) DESC
	`, startDate, endDate)
	if err != nil {
		log.Printf("PDF vendor report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Vendor Name", "Contact", "GST Number", "Total Parts", "Total Spent", "Vehicles Served"}
	// Portrait: 7 cols
	widths := []float64{8, 42, 24, 32, 20, 26, 24}
	var data [][]string
	sno := 1
	var grandTotal float64
	for rows.Next() {
		var vendorName, contact, gst string
		var totalParts, vehiclesServed int
		var totalSpent float64
		if err := rows.Scan(&vendorName, &contact, &gst, &totalParts, &totalSpent, &vehiclesServed); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), vendorName, contact, gst,
			fmt.Sprintf("%d", totalParts), utils.FmtMoney(totalSpent), fmt.Sprintf("%d", vehiclesServed),
		})
		grandTotal += totalSpent
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("VENDOR SPENDING ANALYSIS REPORT", period, false) // portrait is fine for 7 cols
	pr.AddTable(headers, data, widths)

	totals := make([]string, len(headers))
	totals[4] = "TOTAL"
	totals[5] = utils.FmtMoney(grandTotal)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("Vendor_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 12. STOP CHANGE REPORT ──

func generateStopChangeReportPDF(c *gin.Context) {
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
			COALESCE(u.roll_number, '-'), COALESCE(u.department, '-'), COALESCE(u.year, 0),
			COALESCE(cs.stop_name, '-'), COALESCE(rs.stop_name, '-'),
			COALESCE(scr.current_fee, 0), COALESCE(scr.new_fee, 0), COALESCE(scr.fee_difference, 0),
			COALESCE(st.paid_amount, 0), COALESCE(st.balance, 0),
			scr.status, COALESCE(scr.reason, '-'),
			COALESCE(admin.full_name, '-'), COALESCE(scr.admin_remarks, '-'),
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
		log.Printf("PDF stop change report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	headers := []string{"S.No", "Student", "Roll No", "Dept", "Yr", "From Stop", "To Stop", "Old Fee", "New Fee", "Diff", "Paid", "Balance", "Status", "Reason", "By", "Remarks", "Requested", "Processed"}
	widths := []float64{7, 18, 14, 12, 7, 16, 16, 14, 14, 12, 14, 14, 12, 20, 16, 20, 22, 20}
	var data [][]string
	sno := 1
	var totalDiff, totalOutstanding float64
	for rows.Next() {
		var name, rollNo, dept, fromStop, toStop, status, reason, processedBy, adminRemarks string
		var year int
		var oldFee, newFee, diff, paidAmount, outstanding float64
		var createdAt, processedAt sql.NullString
		if err := rows.Scan(&name, &rollNo, &dept, &year, &fromStop, &toStop, &oldFee, &newFee, &diff, &paidAmount, &outstanding, &status, &reason, &processedBy, &adminRemarks, &createdAt, &processedAt); err != nil {
			continue
		}
		data = append(data, []string{
			fmt.Sprintf("%d", sno), name, rollNo, dept, fmt.Sprintf("%d", year), fromStop, toStop,
			utils.FmtMoney(oldFee), utils.FmtMoney(newFee), utils.FmtMoney(diff),
			utils.FmtMoney(paidAmount), utils.FmtMoney(outstanding),
			strings.ToUpper(status), reason, processedBy, adminRemarks,
			nullStr(createdAt, "-"), nullStr(processedAt, "-"),
		})
		totalDiff += diff
		totalOutstanding += outstanding
		sno++
	}

	period := fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("STOP CHANGE REQUEST REPORT", period, true)
	pr.AddTable(headers, data, widths)

	totals := make([]string, len(headers))
	totals[8] = "TOTAL"
	totals[9] = utils.FmtMoney(totalDiff)
	totals[11] = utils.FmtMoney(totalOutstanding)
	pr.AddTotalRow(totals, widths)

	pr.Send(c, fmt.Sprintf("Stop_Change_Report_%s_to_%s.pdf", startDate, endDate))
}

// ── 13. BUS DETAIL REPORT ──

func generateBusDetailReportPDF(c *gin.Context) {
	busID := c.Query("bus_id")
	if busID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bus_id is required"})
		return
	}

	// ── Bus & Vehicle Info ──
	var busName, startPoint, endPoint, vehicleNumber, vehicleName, vehicleType string
	var fuelType, vehicleStatus string
	var seatingCap, vehicleID int
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
		log.Printf("PDF bus detail report error: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Bus not found"})
		return
	}

	// ── Driver ──
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

	displayName := vehicleName
	if displayName == "" {
		displayName = vehicleNumber
	}

	pr := utils.NewPDFReport(
		fmt.Sprintf("BUS DETAIL REPORT - %s", displayName),
		fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM")),
		true,
	)

	// Section 1: Vehicle Information
	pr.AddSection("Vehicle Information")
	pr.AddKeyValue("Bus Name:", busName)
	pr.AddKeyValue("Vehicle Number:", vehicleNumber)
	pr.AddKeyValue("Vehicle Name:", vehicleName)
	pr.AddKeyValue("Type / Fuel:", fmt.Sprintf("%s / %s", vehicleType, fuelType))
	pr.AddKeyValue("Seating Capacity:", fmt.Sprintf("%d", seatingCap))
	pr.AddKeyValue("Status:", vehicleStatus)
	pr.AddKeyValue("Route:", fmt.Sprintf("%s -> %s", startPoint, endPoint))

	// Section 2: Documents
	pr.AddSection("Document Expiry")
	pr.AddKeyValue("Insurance Expiry:", nullStr(insuranceExpiry, "N/A"))
	pr.AddKeyValue("FC Expiry:", nullStr(fcExpiry, "N/A"))
	pr.AddKeyValue("Permit Expiry:", nullStr(permitExpiry, "N/A"))

	// Section 3: Driver
	pr.AddSection("Current Driver Assignment")
	if driverName != "" {
		pr.AddKeyValue("Driver Name:", driverName)
		pr.AddKeyValue("Phone:", driverPhone)
		pr.AddKeyValue("Shift:", shiftName)
	} else {
		pr.AddKeyValue("", "No driver currently assigned")
	}

	// Section 4: Stops & Fees
	pr.AddSection("Stops & Fee Details")
	stopRows, err := config.DB.Query(`
		SELECT 
			bs.stop_name, bs.stop_order, bs.fee, COALESCE(bs.distance_km, 0),
			COALESCE(DATE_FORMAT(bs.arrival_time, '%h:%i %p'), '-'),
			(SELECT COUNT(*) FROM student_transport st WHERE st.stop_id = bs.id AND st.status = 'active')
		FROM bus_stops bs WHERE bs.vehicle_id = ? ORDER BY bs.stop_order
	`, vehicleID)
	if err == nil {
		defer stopRows.Close()
		stopHeaders := []string{"S.No", "Stop Name", "Order", "Fee", "Distance(KM)", "Arrival", "Students"}
		stopWidths := []float64{10, 70, 16, 22, 24, 22, 22}
		var stopData [][]string
		ssno := 1
		var totalStudents int
		for stopRows.Next() {
			var stopName string
			var stopOrder, studentCount int
			var fee, distKm float64
			var arrTime string
			if err := stopRows.Scan(&stopName, &stopOrder, &fee, &distKm, &arrTime, &studentCount); err != nil {
				continue
			}
			stopData = append(stopData, []string{
				fmt.Sprintf("%d", ssno), stopName, fmt.Sprintf("%d", stopOrder),
				utils.FmtMoney(fee), fmt.Sprintf("%.1f", distKm), arrTime, fmt.Sprintf("%d", studentCount),
			})
			totalStudents += studentCount
			ssno++
		}
		pr.AddTable(stopHeaders, stopData, stopWidths)
		totals := make([]string, 7)
		totals[5] = "TOTAL"
		totals[6] = fmt.Sprintf("%d", totalStudents)
		pr.AddTotalRow(totals, stopWidths)
	}

	// Section 5: Students
	pr.AddSection("Student List & Fee Details")
	stuRows, err := config.DB.Query(`
		SELECT 
			COALESCE(u.full_name, u.username, 'Unknown'),
			COALESCE(u.roll_number, '-'), COALESCE(u.email, '-'),
			COALESCE(u.department, '-'), COALESCE(u.year, 0),
			COALESCE(bs.stop_name, '-'),
			st.total_fee, st.paid_amount, st.balance, st.status, st.academic_year
		FROM student_transport st
		JOIN users u ON st.user_id = u.id
		LEFT JOIN bus_stops bs ON st.stop_id = bs.id
		WHERE st.bus_id = ? AND st.status = 'active'
		ORDER BY bs.stop_name, u.full_name
	`, busID)
	if err == nil {
		defer stuRows.Close()
		stuHeaders := []string{"S.No", "Student Name", "Roll No", "Email", "Dept", "Yr", "Stop", "Total Fee", "Paid", "Balance", "Status", "Year"}
		stuWidths := []float64{8, 28, 18, 38, 14, 8, 20, 18, 18, 18, 14, 16}
		var stuData [][]string
		ssno := 1
		var sTotalFee, sTotalPaid, sTotalBal float64
		for stuRows.Next() {
			var name, rollNo, email, dept, stopN, status, acadYear string
			var year int
			var tFee, pAmt, bal float64
			if err := stuRows.Scan(&name, &rollNo, &email, &dept, &year, &stopN, &tFee, &pAmt, &bal, &status, &acadYear); err != nil {
				continue
			}
			stuData = append(stuData, []string{
				fmt.Sprintf("%d", ssno), name, rollNo, email, dept, fmt.Sprintf("%d", year), stopN,
				utils.FmtMoney(tFee), utils.FmtMoney(pAmt), utils.FmtMoney(bal),
				strings.ToUpper(status), acadYear,
			})
			sTotalFee += tFee
			sTotalPaid += pAmt
			sTotalBal += bal
			ssno++
		}
		pr.AddTable(stuHeaders, stuData, stuWidths)
		totals := make([]string, 12)
		totals[6] = "TOTAL"
		totals[7] = utils.FmtMoney(sTotalFee)
		totals[8] = utils.FmtMoney(sTotalPaid)
		totals[9] = utils.FmtMoney(sTotalBal)
		pr.AddTotalRow(totals, stuWidths)
	}

	pr.Send(c, fmt.Sprintf("Bus_Detail_%s_%s.pdf", strings.ReplaceAll(displayName, " ", "_"), time.Now().Format("02-01-2006")))
}

// ── 14. DRIVER GROUP (CLUSTER) REPORT ──

func generateDriverGroupReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

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
		log.Printf("PDF driver group report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer groupRows.Close()

	type groupInfo struct {
		ID   int
		Name string
	}
	var groups []groupInfo

	headers := []string{"S.No", "Group Name", "Description", "Drivers", "Valid From", "Valid To", "Created At"}
	widths := []float64{10, 35, 50, 15, 24, 24, 32}
	var data [][]string
	sno := 1
	for groupRows.Next() {
		var id, driverCount int
		var name, description, validFrom, validTo, createdAt string
		if err := groupRows.Scan(&id, &name, &description, &driverCount, &validFrom, &validTo, &createdAt); err != nil {
			continue
		}
		data = append(data, []string{fmt.Sprintf("%d", sno), name, description, fmt.Sprintf("%d", driverCount), validFrom, validTo, createdAt})
		groups = append(groups, groupInfo{ID: id, Name: name})
		sno++
	}

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	if startDate != "" && endDate != "" {
		period = fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	}
	pr := utils.NewPDFReport("DRIVER GROUP REPORT", period, true)
	pr.AddTable(headers, data, widths)

	// Members section
	pr.AddSection("Driver Group Members")
	memberHeaders := []string{"S.No", "Group Name", "Driver Name", "License No", "Phone", "Valid From", "Valid To", "Added At"}
	memberWidths := []float64{10, 30, 35, 28, 22, 24, 24, 32}
	var memberData [][]string
	msno := 1
	for _, g := range groups {
		mRows, err := config.DB.Query(`
			SELECT COALESCE(u.full_name, '-'), COALESCE(d.license_number, '-'), COALESCE(u.phone, '-'),
				COALESCE(DATE_FORMAT(dcm.valid_from, '%d-%m-%Y'), '-'),
				COALESCE(DATE_FORMAT(dcm.valid_to, '%d-%m-%Y'), '-'),
				DATE_FORMAT(dcm.added_at, '%d-%m-%Y %h:%i %p')
			FROM driver_cluster_members dcm
			JOIN drivers d ON dcm.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			WHERE dcm.cluster_id = ?
			ORDER BY u.full_name
		`, g.ID)
		if err != nil {
			continue
		}
		for mRows.Next() {
			var driverName, licenseNo, phone, validFrom, validTo, addedAt string
			if err := mRows.Scan(&driverName, &licenseNo, &phone, &validFrom, &validTo, &addedAt); err != nil {
				continue
			}
			memberData = append(memberData, []string{fmt.Sprintf("%d", msno), g.Name, driverName, licenseNo, phone, validFrom, validTo, addedAt})
			msno++
		}
		mRows.Close()
	}
	pr.AddTable(memberHeaders, memberData, memberWidths)

	pr.Send(c, fmt.Sprintf("Driver_Group_Report_%s.pdf", time.Now().Format("02-01-2006")))
}

// ── 15. VEHICLE GROUP REPORT ──

func generateVehicleGroupReportPDF(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

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
		log.Printf("PDF vehicle group report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer groupRows.Close()

	type groupInfo struct {
		ID   int
		Name string
	}
	var groups []groupInfo

	headers := []string{"S.No", "Group Name", "Description", "Vehicles", "Valid From", "Valid To", "Created At", "Updated At"}
	widths := []float64{10, 30, 40, 16, 22, 22, 26, 26}
	var data [][]string
	sno := 1
	for groupRows.Next() {
		var id, vehicleCount int
		var name, description, validFrom, validTo, createdAt, updatedAt string
		if err := groupRows.Scan(&id, &name, &description, &vehicleCount, &validFrom, &validTo, &createdAt, &updatedAt); err != nil {
			continue
		}
		data = append(data, []string{fmt.Sprintf("%d", sno), name, description, fmt.Sprintf("%d", vehicleCount), validFrom, validTo, createdAt, updatedAt})
		groups = append(groups, groupInfo{ID: id, Name: name})
		sno++
	}

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	if startDate != "" && endDate != "" {
		period = fmt.Sprintf("Period: %s to %s | Generated: %s", startDate, endDate, time.Now().Format("02-01-2006 03:04 PM"))
	}
	pr := utils.NewPDFReport("VEHICLE GROUP REPORT", period, true)
	pr.AddTable(headers, data, widths)

	// Members section
	pr.AddSection("Vehicle Group Members")
	memberHeaders := []string{"S.No", "Group Name", "Vehicle Number", "Vehicle Type", "Status", "Valid From", "Valid To", "Added At"}
	memberWidths := []float64{10, 30, 30, 22, 18, 24, 24, 32}
	var memberData [][]string
	msno := 1
	for _, g := range groups {
		mRows, err := config.DB.Query(`
			SELECT COALESCE(v.vehicle_number, '-'), COALESCE(vt.type, '-'), COALESCE(v.status, '-'),
				COALESCE(DATE_FORMAT(vgm.valid_from, '%d-%m-%Y'), '-'),
				COALESCE(DATE_FORMAT(vgm.valid_to, '%d-%m-%Y'), '-'),
				DATE_FORMAT(vgm.added_at, '%d-%m-%Y %h:%i %p')
			FROM vehicle_group_members vgm
			JOIN vehicles v ON vgm.vehicle_id = v.id
			LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
			WHERE vgm.group_id = ?
			ORDER BY v.vehicle_number
		`, g.ID)
		if err != nil {
			continue
		}
		for mRows.Next() {
			var vehicleNumber, vehicleType, vehicleStatus, validFrom, validTo, addedAt string
			if err := mRows.Scan(&vehicleNumber, &vehicleType, &vehicleStatus, &validFrom, &validTo, &addedAt); err != nil {
				continue
			}
			memberData = append(memberData, []string{fmt.Sprintf("%d", msno), g.Name, vehicleNumber, vehicleType, vehicleStatus, validFrom, validTo, addedAt})
			msno++
		}
		mRows.Close()
	}
	pr.AddTable(memberHeaders, memberData, memberWidths)

	pr.Send(c, fmt.Sprintf("Vehicle_Group_Report_%s.pdf", time.Now().Format("02-01-2006")))
}

// ── 16. SHIFTS & TIMINGS REPORT ──

func generateShiftReportPDF(c *gin.Context) {
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
		log.Printf("PDF shift report error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate report"})
		return
	}
	defer rows.Close()

	type shiftInfo struct {
		ID   int
		Name string
	}
	var shifts []shiftInfo

	headers := []string{"S.No", "Shift Name", "Start Time", "End Time", "Description", "Created By", "Active Drivers", "Active Vehicles"}
	widths := []float64{10, 28, 20, 20, 40, 28, 22, 22}
	var data [][]string
	sno := 1
	for rows.Next() {
		var id, activeDrivers, activeVehicles int
		var name, startTime, endTime, description, createdBy string
		if err := rows.Scan(&id, &name, &startTime, &endTime, &description, &createdBy, &activeDrivers, &activeVehicles); err != nil {
			continue
		}
		data = append(data, []string{fmt.Sprintf("%d", sno), name, startTime, endTime, description, createdBy, fmt.Sprintf("%d", activeDrivers), fmt.Sprintf("%d", activeVehicles)})
		shifts = append(shifts, shiftInfo{ID: id, Name: name})
		sno++
	}

	period := fmt.Sprintf("Generated: %s", time.Now().Format("02-01-2006 03:04 PM"))
	pr := utils.NewPDFReport("SHIFTS & TIMINGS REPORT", period, true)
	pr.AddTable(headers, data, widths)

	// Shift assignments section
	pr.AddSection("Current Shift-wise Assignments")
	assignHeaders := []string{"S.No", "Shift Name", "Driver Name", "Vehicle Number", "Vehicle Name", "Start Date", "End Date"}
	assignWidths := []float64{10, 30, 35, 28, 30, 28, 28}
	var assignData [][]string
	asno := 1
	for _, s := range shifts {
		aRows, err := config.DB.Query(`
			SELECT COALESCE(u.full_name, '-'),
				COALESCE(v.vehicle_number, '-'), COALESCE(v.vehicle_name, '-'),
				DATE_FORMAT(a.start_date, '%d-%m-%Y'), DATE_FORMAT(a.end_date, '%d-%m-%Y')
			FROM assignments a
			JOIN drivers d ON a.driver_id = d.id
			JOIN users u ON d.user_id = u.id
			JOIN vehicles v ON a.vehicle_id = v.id
			WHERE a.shift_id = ? AND a.status = 'active' AND CURDATE() BETWEEN a.start_date AND a.end_date
			ORDER BY u.full_name
		`, s.ID)
		if err != nil {
			continue
		}
		for aRows.Next() {
			var driverName, vehicleNum, vehicleName, startDate, endDate string
			if err := aRows.Scan(&driverName, &vehicleNum, &vehicleName, &startDate, &endDate); err != nil {
				continue
			}
			assignData = append(assignData, []string{fmt.Sprintf("%d", asno), s.Name, driverName, vehicleNum, vehicleName, startDate, endDate})
			asno++
		}
		aRows.Close()
	}
	pr.AddTable(assignHeaders, assignData, assignWidths)

	pr.Send(c, fmt.Sprintf("Shifts_Timings_Report_%s.pdf", time.Now().Format("02-01-2006")))
}
