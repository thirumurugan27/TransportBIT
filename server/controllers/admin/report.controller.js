const db = require('../../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Common Excel exporter helper
 */
async function sendExcel(res, { title, subtitle, filename, headers, rows, colWidths }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  // Title row
  sheet.addRow([title]);
  sheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = sheet.getCell('A1');
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF2B5797' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle row
  sheet.addRow([subtitle || '']);
  sheet.mergeCells(2, 1, 2, headers.length);
  const subCell = sheet.getCell('A2');
  subCell.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Empty spacer row
  sheet.addRow([]);

  // Header row
  const headerRow = sheet.addRow(headers);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  });

  // Data rows
  for (const r of rows) {
    const row = sheet.addRow(r);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
      cell.alignment = { vertical: 'middle' };
    });
  }

  // Column widths
  if (colWidths && colWidths.length > 0) {
    colWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
  } else {
    headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = Math.max(h.length + 5, 15);
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Common PDF exporter helper
 */
function sendPDF(res, { title, subtitle, filename, headers, rows, landscape }) {
  const doc = new PDFDocument({
    layout: landscape ? 'landscape' : 'portrait',
    margin: 30,
    size: 'A4'
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#2B5797').fontSize(16).text(title, { align: 'center' });
  if (subtitle) {
    doc.fillColor('#666666').fontSize(10).text(subtitle, { align: 'center' });
  }
  doc.moveDown(1.5);

  const startX = 30;
  const pageWidth = landscape ? 841.89 - 60 : 595.28 - 60;
  const colWidth = pageWidth / headers.length;

  // Header Table
  const headerY = doc.y;
  doc.rect(startX, headerY, pageWidth, 20).fill('#2B5797');
  doc.fillColor('#FFFFFF').fontSize(9);

  headers.forEach((h, i) => {
    doc.text(h, startX + i * colWidth + 2, headerY + 5, {
      width: colWidth - 4,
      align: 'center',
      ellipsis: true
    });
  });

  doc.moveDown(1.5);

  // Data rows
  let currentY = headerY + 22;
  doc.fillColor('#222222').fontSize(8);

  rows.forEach((r, rowIdx) => {
    if (currentY > (landscape ? 550 : 780)) {
      doc.addPage();
      currentY = 40;
    }

    if (rowIdx % 2 === 1) {
      doc.rect(startX, currentY - 2, pageWidth, 16).fill('#F0F4FC');
      doc.fillColor('#222222');
    }

    r.forEach((val, colIdx) => {
      const textVal = val !== null && val !== undefined ? String(val) : '';
      doc.text(textVal, startX + colIdx * colWidth + 2, currentY, {
        width: colWidth - 4,
        align: 'left',
        ellipsis: true
      });
    });

    currentY += 16;
  });

  doc.end();
}

// 1. Attendance Report
async function generateAttendanceReport(req, res) {
  try {
    const { start_date, end_date, format } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const [rows] = await db.query(`
      WITH RECURSIVE date_range AS (
        SELECT ? AS d
        UNION ALL
        SELECT d + INTERVAL 1 DAY FROM date_range WHERE d < ?
      )
      SELECT
        u.full_name,
        d.license_number,
        DATE_FORMAT(dr.d, '%d-%m-%Y') AS date,
        CASE
          WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved'
            AND dr.d BETWEEN lr.start_date AND lr.end_date THEN 'On Leave'
          WHEN a.status = 'present' THEN 'Present'
          WHEN a.status = 'absent' THEN 'Absent'
          WHEN a.status = 'on_leave' THEN 'On Leave'
          ELSE 'Not Marked'
        END AS status,
        COALESCE(TIME_FORMAT(a.checkin_time, '%h:%i %p'), '-') AS checkin,
        COALESCE(TIME_FORMAT(a.checkout_time, '%h:%i %p'), '-') AS checkout
      FROM date_range dr
      CROSS JOIN drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = dr.d
      LEFT JOIN leave_requests lr ON lr.driver_id = d.id
        AND lr.status = 'admin_approved'
        AND dr.d BETWEEN lr.start_date AND lr.end_date
      ORDER BY u.full_name, dr.d
    `, [start_date, end_date]);

    const headers = ['Driver Name', 'License No.', 'Date', 'Status', 'Check-In', 'Check-Out'];
    const data = (rows || []).map(r => [r.full_name, r.license_number, r.date, r.status, r.checkin, r.checkout]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Driver Attendance Report',
        subtitle: `Period: ${start_date} to ${end_date}`,
        filename: `attendance_report_${start_date}_to_${end_date}.pdf`,
        headers,
        rows: data,
        landscape: false
      });
    }

    return sendExcel(res, {
      title: 'Driver Attendance Report',
      subtitle: `Period: ${start_date} to ${end_date}`,
      filename: `attendance_report_${start_date}_to_${end_date}.xlsx`,
      headers,
      rows: data,
      colWidths: [25, 20, 15, 15, 15, 15]
    });
  } catch (err) {
    console.error('GenerateAttendanceReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 2. Service Report
async function generateServiceReport(req, res) {
  try {
    const { status, severity, vehicle_id, date_from, date_to, format } = req.query;

    let query = `
      SELECT 
        sr.id, COALESCE(v.vehicle_number, '') AS vehicle_number, COALESCE(vt.type, '') AS vehicle_type,
        sr.title, sr.severity, sr.status,
        COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), '') AS scheduled_date,
        COALESCE(sr.workshop_name, '') AS workshop_name,
        COALESCE(sr.labor_cost, 0) AS labor_cost,
        COALESCE(sr.parts_cost, 0) AS parts_cost,
        COALESCE(sr.total_cost, 0) AS total_cost
      FROM service_records sr
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE 1=1
    `;
    const args = [];
    if (status) { query += ` AND sr.status = ?`; args.push(status); }
    if (severity) { query += ` AND sr.severity = ?`; args.push(severity); }
    if (vehicle_id) { query += ` AND sr.vehicle_id = ?`; args.push(vehicle_id); }
    if (date_from) { query += ` AND sr.created_at >= ?`; args.push(date_from); }
    if (date_to) { query += ` AND sr.created_at <= ?`; args.push(date_to + ' 23:59:59'); }

    query += ` ORDER BY sr.created_at DESC`;

    const [rows] = await db.query(query, args);
    const headers = ['ID', 'Vehicle', 'Type', 'Title', 'Severity', 'Status', 'Scheduled', 'Workshop', 'Labor (₹)', 'Parts (₹)', 'Total (₹)'];
    const data = (rows || []).map(r => [
      r.id, r.vehicle_number, r.vehicle_type, r.title, r.severity, r.status,
      r.scheduled_date, r.workshop_name, r.labor_cost, r.parts_cost, r.total_cost
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Vehicle Service Report',
        subtitle: 'Maintenance and Service Records',
        filename: 'service_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Vehicle Service Report',
      subtitle: 'Maintenance and Service Records',
      filename: 'service_report.xlsx',
      headers,
      rows: data,
      colWidths: [8, 16, 14, 25, 12, 14, 14, 20, 14, 14, 14]
    });
  } catch (err) {
    console.error('GenerateServiceReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 3. Purchase Report
async function generatePurchaseReport(req, res) {
  try {
    const { category, status, vendor_id, vehicle_id, date_from, date_to, format } = req.query;

    let query = `
      SELECT 
        po.id, po.category, COALESCE(po.invoice_number, '') AS invoice_number,
        COALESCE(vdr.name, '') AS vendor_name,
        COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), '') AS vehicle_number,
        COALESCE(DATE_FORMAT(po.purchased_date, '%d-%m-%Y'), '') AS purchased_date,
        po.status,
        COUNT(p.id) AS product_count,
        COALESCE(SUM(p.total_price), 0) AS total_amount
      FROM purchase_orders po
      LEFT JOIN vendors vdr ON po.vendor_id = vdr.id
      LEFT JOIN service_records sr ON po.service_record_id = sr.id
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      LEFT JOIN vehicles dv ON po.vehicle_id = dv.id
      LEFT JOIN parts_purchased p ON p.purchase_order_id = po.id
      WHERE 1=1
    `;
    const args = [];
    if (category) { query += ` AND po.category = ?`; args.push(category); }
    if (status) { query += ` AND po.status = ?`; args.push(status); }
    if (vendor_id) { query += ` AND po.vendor_id = ?`; args.push(vendor_id); }
    if (vehicle_id) { query += ` AND (sr.vehicle_id = ? OR po.vehicle_id = ?)`; args.push(vehicle_id, vehicle_id); }
    if (date_from) { query += ` AND po.purchased_date >= ?`; args.push(date_from); }
    if (date_to) { query += ` AND po.purchased_date <= ?`; args.push(date_to); }

    query += `
      GROUP BY po.id, po.category, po.invoice_number, vdr.name, v.vehicle_number, dv.vehicle_number, po.purchased_date, po.status
      ORDER BY po.created_at DESC
    `;

    const [rows] = await db.query(query, args);
    const headers = ['Order ID', 'Category', 'Invoice No.', 'Vendor', 'Vehicle', 'Purchased Date', 'Status', 'Products', 'Total (₹)'];
    const data = (rows || []).map(r => [
      r.id, r.category, r.invoice_number, r.vendor_name, r.vehicle_number, r.purchased_date, r.status, r.product_count, r.total_amount
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Purchase Orders & Inventory Report',
        subtitle: 'Parts & Vehicle Procurement',
        filename: 'purchase_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Purchase Orders & Inventory Report',
      subtitle: 'Parts & Vehicle Procurement',
      filename: 'purchase_report.xlsx',
      headers,
      rows: data,
      colWidths: [10, 16, 16, 22, 16, 16, 14, 10, 16]
    });
  } catch (err) {
    console.error('GeneratePurchaseReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 4. Leave Report
async function generateLeaveReport(req, res) {
  try {
    const { status, driver_id, date_from, date_to, format } = req.query;

    let query = `
      SELECT 
        u.full_name AS driver_name, COALESCE(u.phone, '') AS phone,
        lr.leave_type,
        DATE_FORMAT(lr.start_date, '%d-%m-%Y') AS start_date,
        DATE_FORMAT(lr.end_date, '%d-%m-%Y') AS end_date,
        DATEDIFF(lr.end_date, lr.start_date) + 1 AS days,
        COALESCE(lr.reason, '') AS reason,
        lr.status,
        DATE_FORMAT(lr.created_at, '%d-%m-%Y %h:%i %p') AS created_at
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const args = [];
    if (status) { query += ` AND lr.status = ?`; args.push(status); }
    if (driver_id) { query += ` AND lr.driver_id = ?`; args.push(driver_id); }
    if (date_from) { query += ` AND lr.start_date >= ?`; args.push(date_from); }
    if (date_to) { query += ` AND lr.end_date <= ?`; args.push(date_to); }

    query += ` ORDER BY lr.created_at DESC`;

    const [rows] = await db.query(query, args);
    const headers = ['Driver Name', 'Phone', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status', 'Applied At'];
    const data = (rows || []).map(r => [
      r.driver_name, r.phone, r.leave_type, r.start_date, r.end_date, r.days, r.reason, r.status, r.created_at
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Driver Leave Report',
        subtitle: 'Leave Requests & Approvals',
        filename: 'leave_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Driver Leave Report',
      subtitle: 'Leave Requests & Approvals',
      filename: 'leave_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 16, 14, 14, 14, 8, 25, 16, 20]
    });
  } catch (err) {
    console.error('GenerateLeaveReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 5. KM & Fuel Report
async function generateKmFuelReport(req, res) {
  try {
    const { vehicle_id, driver_id, date_from, date_to, start_date, end_date, format } = req.query;
    const startDate = start_date || date_from;
    const endDate = end_date || date_to;

    let query = `
      SELECT 
        COALESCE(u.full_name, '') AS driver_name,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        COALESCE(v.vehicle_name, '') AS vehicle_name,
        DATE_FORMAT(k.date, '%d-%m-%Y') AS log_date,
        k.start_km, k.end_km, k.total_km,
        COALESCE(k.fuel_consumed, 0) AS fuel_consumed,
        CASE WHEN k.fuel_consumed > 0 THEN ROUND(k.total_km / k.fuel_consumed, 2) ELSE 0 END AS mileage,
        COALESCE(k.status, 'approved') AS status,
        COALESCE(k.remarks, '-') AS remarks
      FROM km_logs k
      LEFT JOIN drivers d ON k.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN vehicles v ON k.vehicle_id = v.id
      WHERE 1=1
    `;
    const args = [];
    if (vehicle_id) { query += ` AND k.vehicle_id = ?`; args.push(vehicle_id); }
    if (driver_id) { query += ` AND k.driver_id = ?`; args.push(driver_id); }
    if (startDate) { query += ` AND k.date >= ?`; args.push(startDate); }
    if (endDate) { query += ` AND k.date <= ?`; args.push(endDate); }

    query += ` ORDER BY k.date DESC, u.full_name ASC`;

    const [rows] = await db.query(query, args);
    const headers = ['Driver Name', 'Vehicle No', 'Vehicle Name', 'Date', 'Start KM', 'End KM', 'Total KM', 'Fuel (L)', 'Mileage (km/L)', 'Status', 'Remarks'];
    const data = (rows || []).map(r => [
      r.driver_name, r.vehicle_number, r.vehicle_name, r.log_date, r.start_km, r.end_km, r.total_km, r.fuel_consumed, r.mileage, r.status, r.remarks
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'KM & Fuel Consumption Report',
        subtitle: 'Log Records & Consumption',
        filename: 'km_fuel_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'KM & Fuel Consumption Report',
      subtitle: 'Log Records & Consumption',
      filename: 'km_fuel_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 14, 16, 12, 12, 12, 12, 10, 14, 12, 20]
    });
  } catch (err) {
    console.error('GenerateKmFuelReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 6. Vehicle Fleet Report
async function generateVehicleFleetReport(req, res) {
  try {
    const { status, vehicle_type_id, fuel_type, format } = req.query;

    let query = `
      SELECT 
        v.vehicle_number, COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
        COALESCE(vt.type, '') AS vehicle_type,
        COALESCE(v.seating_capacity, 0) AS seating_capacity,
        COALESCE(v.fuel_type, '') AS fuel_type,
        COALESCE(DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y'), '') AS insurance_expiry,
        COALESCE(DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y'), '') AS fc_expiry,
        COALESCE(DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y'), '') AS permit_expiry,
        v.status
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE 1=1
    `;
    const args = [];
    if (status) { query += ` AND v.status = ?`; args.push(status); }
    if (vehicle_type_id) { query += ` AND v.vehicle_type_id = ?`; args.push(vehicle_type_id); }
    if (fuel_type) { query += ` AND v.fuel_type = ?`; args.push(fuel_type); }

    query += ` ORDER BY COALESCE(vt.type, ''), v.vehicle_number ASC`;

    const [rows] = await db.query(query, args);
    const headers = ['Vehicle No.', 'Name', 'Type', 'Capacity', 'Fuel Type', 'Insurance Expiry', 'FC Expiry', 'Permit Expiry', 'Status'];
    const data = (rows || []).map(r => [
      r.vehicle_number, r.vehicle_name, r.vehicle_type, r.seating_capacity, r.fuel_type, r.insurance_expiry, r.fc_expiry, r.permit_expiry, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Vehicle Fleet Report',
        subtitle: 'Institution Vehicle Directory & Document Status',
        filename: 'vehicle_fleet_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Vehicle Fleet Report',
      subtitle: 'Institution Vehicle Directory & Document Status',
      filename: 'vehicle_fleet_report.xlsx',
      headers,
      rows: data,
      colWidths: [18, 20, 16, 12, 14, 18, 18, 14]
    });
  } catch (err) {
    console.error('GenerateVehicleFleetReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 7. Student Fee Report
async function generateStudentFeeReport(req, res) {
  try {
    const { academic_year, status, bus_id, format } = req.query;

    let query = `
      SELECT 
        COALESCE(u.full_name, '') AS student_name,
        COALESCE(u.roll_number, '') AS roll_number,
        COALESCE(u.department, '') AS department,
        COALESCE(u.year, 0) AS year,
        COALESCE(v.vehicle_number, '') AS bus_number,
        COALESCE(bs.stop_name, '') AS stop_name,
        st.total_fee, st.paid_amount, st.balance,
        st.status
      FROM student_transport st
      JOIN users u ON st.user_id = u.id
      LEFT JOIN buses b ON st.bus_id = b.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN bus_stops bs ON st.stop_id = bs.id
      WHERE 1=1
    `;
    const args = [];
    if (academic_year) { query += ` AND st.academic_year = ?`; args.push(academic_year); }
    if (status) { query += ` AND st.status = ?`; args.push(status); }
    if (bus_id) { query += ` AND st.bus_id = ?`; args.push(bus_id); }

    query += ` ORDER BY u.full_name ASC`;

    const [rows] = await db.query(query, args);
    const headers = ['Student Name', 'Roll No.', 'Dept', 'Year', 'Bus', 'Stop', 'Total Fee (₹)', 'Paid (₹)', 'Balance (₹)', 'Status'];
    const data = (rows || []).map(r => [
      r.student_name, r.roll_number, r.department, r.year, r.bus_number, r.stop_name, r.total_fee, r.paid_amount, r.balance, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Student Transport & Fee Report',
        subtitle: `Academic Year: ${academic_year || 'All'}`,
        filename: 'student_fee_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Student Transport & Fee Report',
      subtitle: `Academic Year: ${academic_year || 'All'}`,
      filename: 'student_fee_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 14, 12, 8, 16, 20, 14, 14, 14, 12]
    });
  } catch (err) {
    console.error('GenerateStudentFeeReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 8. Vehicle Request Report
async function generateVehicleRequestReport(req, res) {
  try {
    const { status, booking_type, date_from, date_to, format } = req.query;

    let query = `
      SELECT 
        vr.id,
        COALESCE(ru.full_name, u.full_name, '') AS requester_name,
        COALESCE(f.department, rf.department, '') AS department,
        COALESCE(vr.BookingType, '') AS booking_type,
        COALESCE(vr.TripType, '') AS trip_type,
        COALESCE(vr.Purpose, vr.PurposeOfVisit, '') AS purpose,
        CONCAT(COALESCE(vr.OnwardFromPlace, ''), ' - ', COALESCE(vr.OnwardToPlace, '')) AS route,
        COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %h:%i %p'), '') AS start_datetime,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        COALESCE(ud.full_name, '') AS driver_name,
        vr.status
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty rf ON rf.user_id = ru.id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      LEFT JOIN drivers d ON vr.driver_id = d.id
      LEFT JOIN users ud ON d.user_id = ud.id
      WHERE 1=1
    `;
    const args = [];
    if (status) { query += ` AND vr.status = ?`; args.push(status); }
    if (booking_type) { query += ` AND vr.BookingType = ?`; args.push(booking_type); }
    if (date_from) { query += ` AND vr.created_at >= ?`; args.push(date_from); }
    if (date_to) { query += ` AND vr.created_at <= ?`; args.push(date_to + ' 23:59:59'); }

    query += ` ORDER BY vr.created_at DESC`;

    const [rows] = await db.query(query, args);
    const headers = ['Req ID', 'Requester', 'Department', 'Booking Type', 'Trip Type', 'Purpose', 'Route', 'Start Time', 'Vehicle', 'Driver', 'Status'];
    const data = (rows || []).map(r => [
      r.id, r.requester_name, r.department, r.booking_type, r.trip_type, r.purpose, r.route, r.start_datetime, r.vehicle_number, r.driver_name, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Vehicle Booking Requests Report',
        subtitle: 'Faculty & Official Trips',
        filename: 'vehicle_requests_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Vehicle Booking Requests Report',
      subtitle: 'Faculty & Official Trips',
      filename: 'vehicle_requests_report.xlsx',
      headers,
      rows: data,
      colWidths: [10, 20, 16, 14, 12, 22, 22, 20, 16, 20, 14]
    });
  } catch (err) {
    console.error('GenerateVehicleRequestReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 9. Driver Report
async function generateDriverReport(req, res) {
  try {
    const { status, license_type, format } = req.query;

    let query = `
      SELECT 
        u.full_name, COALESCE(u.phone, '') AS phone, COALESCE(u.email, '') AS email,
        d.license_number, d.license_type, COALESCE(d.experience_years, 0) AS experience_years,
        COALESCE(DATE_FORMAT(d.license_expiry, '%d-%m-%Y'), '') AS license_expiry,
        u.status
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const args = [];
    if (status) { query += ` AND u.status = ?`; args.push(status); }
    if (license_type) { query += ` AND d.license_type = ?`; args.push(license_type); }

    query += ` ORDER BY u.full_name ASC`;

    const [rows] = await db.query(query, args);
    const headers = ['Full Name', 'Phone', 'Email', 'License No.', 'License Type', 'Experience (Yrs)', 'License Expiry', 'Status'];
    const data = (rows || []).map(r => [
      r.full_name, r.phone, r.email, r.license_number, r.license_type, r.experience_years, r.license_expiry, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Driver Directory & License Report',
        subtitle: 'Staff Details & Document Expiry',
        filename: 'driver_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Driver Directory & License Report',
      subtitle: 'Staff Details & Document Expiry',
      filename: 'driver_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 16, 22, 18, 16, 16, 16, 14]
    });
  } catch (err) {
    console.error('GenerateDriverReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 10. Assignment Report
async function generateAssignmentReport(req, res) {
  try {
    const { start_date, end_date, driver_id, format } = req.query;

    let query = `
      SELECT 
        DATE_FORMAT(a.start_date, '%d-%m-%Y') AS start_date,
        DATE_FORMAT(a.end_date, '%d-%m-%Y') AS end_date,
        u.full_name AS driver_name,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        COALESCE(s.name, '') AS shift_name,
        COALESCE(CONCAT(TIME_FORMAT(s.start_time, '%h:%i %p'), ' - ', TIME_FORMAT(s.end_time, '%h:%i %p')), '') AS shift_time,
        a.status
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE 1=1
    `;
    const args = [];
    if (driver_id) { query += ` AND a.driver_id = ?`; args.push(driver_id); }
    if (start_date) { query += ` AND a.end_date >= ?`; args.push(start_date); }
    if (end_date) { query += ` AND a.start_date <= ?`; args.push(end_date); }

    query += ` ORDER BY a.start_date DESC`;

    const [rows] = await db.query(query, args);
    const headers = ['Start Date', 'End Date', 'Driver Name', 'Vehicle No.', 'Shift', 'Time', 'Status'];
    const data = (rows || []).map(r => [
      r.start_date, r.end_date, r.driver_name, r.vehicle_number, r.shift_name, r.shift_time, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Duty & Vehicle Assignment Report',
        subtitle: 'Driver Shift Schedules',
        filename: 'assignment_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Duty & Vehicle Assignment Report',
      subtitle: 'Driver Shift Schedules',
      filename: 'assignment_report.xlsx',
      headers,
      rows: data,
      colWidths: [14, 14, 22, 16, 20, 22, 14]
    });
  } catch (err) {
    console.error('GenerateAssignmentReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 11. Vendor Report
async function generateVendorReport(req, res) {
  try {
    const { include_inactive, search, format } = req.query;

    let query = `
      SELECT v.name, COALESCE(v.contact, '') AS contact, COALESCE(v.email, '') AS email,
             COALESCE(v.gst_number, '') AS gst_number, COALESCE(v.address, '') AS address,
             COALESCE(stats.parts_count, 0) AS parts_count,
             COALESCE(stats.total_spent, 0) AS total_spent,
             CASE WHEN v.is_active = 1 THEN 'Active' ELSE 'Inactive' END AS status
      FROM vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(total_price) AS total_spent, COUNT(*) AS parts_count
        FROM parts_purchased
        WHERE vendor_id IS NOT NULL
        GROUP BY vendor_id
      ) stats ON v.id = stats.vendor_id
      WHERE 1=1
    `;
    const args = [];
    if (include_inactive !== 'true') { query += ` AND v.is_active = 1`; }
    if (search) {
      query += ` AND (v.name LIKE ? OR v.contact LIKE ? OR v.email LIKE ? OR v.gst_number LIKE ?)`;
      const s = `%${search}%`;
      args.push(s, s, s, s);
    }

    query += ` ORDER BY v.name ASC`;

    const [rows] = await db.query(query, args);
    const headers = ['Vendor Name', 'Contact', 'Email', 'GST No.', 'Address', 'Parts Purchased', 'Total Spent (₹)', 'Status'];
    const data = (rows || []).map(r => [
      r.name, r.contact, r.email, r.gst_number, r.address, r.parts_count, r.total_spent, r.status
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Vendor Procurement & Expenditure Report',
        subtitle: 'Supplier Contacts & Purchase Volume',
        filename: 'vendor_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Vendor Procurement & Expenditure Report',
      subtitle: 'Supplier Contacts & Purchase Volume',
      filename: 'vendor_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 16, 22, 18, 25, 14, 16, 12]
    });
  } catch (err) {
    console.error('GenerateVendorReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 12. Stop Change Report
async function generateStopChangeReport(req, res) {
  try {
    const { status, format } = req.query;

    let query = `
      SELECT 
        COALESCE(u.full_name, 'Unknown Student') AS student_name,
        COALESCE(u.email, '') AS email,
        COALESCE(cs.stop_name, 'Unknown Stop') AS current_stop,
        COALESCE(rs.stop_name, 'Unknown Stop') AS requested_stop,
        COALESCE(scr.current_fee, 0) AS current_fee,
        COALESCE(scr.new_fee, 0) AS new_fee,
        COALESCE(scr.fee_difference, 0) AS fee_difference,
        COALESCE(scr.reason, '') AS reason,
        scr.status,
        COALESCE(admin.full_name, 'Pending') AS processed_by,
        COALESCE(DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p'), '') AS created_at
      FROM stop_change_requests scr
      LEFT JOIN student_transport st ON scr.student_transport_id = st.id
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
      LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
      LEFT JOIN users admin ON scr.processed_by = admin.id
      WHERE 1=1
    `;
    const args = [];
    if (status && status !== 'all') { query += ` AND scr.status = ?`; args.push(status); }

    query += ` ORDER BY scr.created_at DESC`;

    const [rows] = await db.query(query, args);
    const headers = ['Student Name', 'Email', 'Current Stop', 'Requested Stop', 'Old Fee (₹)', 'New Fee (₹)', 'Diff (₹)', 'Reason', 'Status', 'Processed By', 'Date'];
    const data = (rows || []).map(r => [
      r.student_name, r.email, r.current_stop, r.requested_stop, r.current_fee, r.new_fee, r.fee_difference, r.reason, r.status, r.processed_by, r.created_at
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Stop Change Requests Report',
        subtitle: 'Student Route Adjustment Log',
        filename: 'stop_change_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Stop Change Requests Report',
      subtitle: 'Student Route Adjustment Log',
      filename: 'stop_change_report.xlsx',
      headers,
      rows: data,
      colWidths: [22, 20, 18, 18, 12, 12, 12, 22, 14, 18, 18]
    });
  } catch (err) {
    console.error('GenerateStopChangeReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 13. Bus Detail Report
async function generateBusDetailReport(req, res) {
  try {
    const { bus_id, format } = req.query;

    let query = `
      SELECT 
        b.id, COALESCE(v.vehicle_number, '') AS vehicle_number, COALESCE(v.vehicle_name, '') AS vehicle_name,
        CONCAT(COALESCE(b.start_point, ''), ' → ', COALESCE(b.end_point, '')) AS route,
        COALESCE(v.seating_capacity, 50) AS capacity,
        COUNT(DISTINCT st.user_id) AS student_count
      FROM buses b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN student_transport st ON b.id = st.bus_id AND st.status = 'active'
      WHERE 1=1
    `;
    const args = [];
    if (bus_id) { query += ` AND b.id = ?`; args.push(bus_id); }

    query += `
      GROUP BY b.id, v.vehicle_number, v.vehicle_name, b.start_point, b.end_point, v.seating_capacity
      ORDER BY v.vehicle_number ASC
    `;

    const [rows] = await db.query(query, args);
    const headers = ['Bus ID', 'Vehicle No.', 'Bus Name', 'Route', 'Capacity', 'Enrolled Students'];
    const data = (rows || []).map(r => [
      r.id, r.vehicle_number, r.vehicle_name, r.route, r.capacity, r.student_count
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'College Bus Route & Capacity Report',
        subtitle: 'Student Route Operations',
        filename: 'bus_detail_report.pdf',
        headers,
        rows: data,
        landscape: false
      });
    }

    return sendExcel(res, {
      title: 'College Bus Route & Capacity Report',
      subtitle: 'Student Route Operations',
      filename: 'bus_detail_report.xlsx',
      headers,
      rows: data,
      colWidths: [10, 18, 20, 25, 12, 18]
    });
  } catch (err) {
    console.error('GenerateBusDetailReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 14. Driver Group Report
async function generateDriverGroupReport(req, res) {
  try {
    const { format } = req.query;

    const [rows] = await db.query(`
      SELECT 
        dc.id, dc.name AS cluster_name,
        COALESCE(DATE_FORMAT(dc.valid_from, '%d-%m-%Y'), '-') AS valid_from,
        COALESCE(DATE_FORMAT(dc.valid_to, '%d-%m-%Y'), '-') AS valid_to,
        COUNT(dcm.driver_id) AS member_count,
        COALESCE(GROUP_CONCAT(u.full_name SEPARATOR ', '), 'None') AS drivers
      FROM driver_clusters dc
      LEFT JOIN driver_cluster_members dcm ON dc.id = dcm.cluster_id
      LEFT JOIN drivers d ON dcm.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      GROUP BY dc.id, dc.name, dc.valid_from, dc.valid_to
      ORDER BY dc.name ASC
    `);

    const headers = ['Group ID', 'Group Name', 'Valid From', 'Valid To', 'Driver Count', 'Members'];
    const data = (rows || []).map(r => [
      r.id, r.cluster_name, r.valid_from, r.valid_to, r.member_count, r.drivers
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Driver Clusters & Groups Report',
        subtitle: 'Driver Group Allocations',
        filename: 'driver_group_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Driver Clusters & Groups Report',
      subtitle: 'Driver Group Allocations',
      filename: 'driver_group_report.xlsx',
      headers,
      rows: data,
      colWidths: [12, 22, 14, 14, 14, 40]
    });
  } catch (err) {
    console.error('GenerateDriverGroupReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 15. Vehicle Group Report
async function generateVehicleGroupReport(req, res) {
  try {
    const { format } = req.query;

    const [rows] = await db.query(`
      SELECT 
        vg.id, vg.name AS group_name,
        COALESCE(DATE_FORMAT(vg.valid_from, '%d-%m-%Y'), '-') AS valid_from,
        COALESCE(DATE_FORMAT(vg.valid_to, '%d-%m-%Y'), '-') AS valid_to,
        COUNT(vgm.vehicle_id) AS vehicle_count,
        COALESCE(GROUP_CONCAT(v.vehicle_number SEPARATOR ', '), 'None') AS vehicles
      FROM vehicle_groups vg
      LEFT JOIN vehicle_group_members vgm ON vg.id = vgm.group_id
      LEFT JOIN vehicles v ON vgm.vehicle_id = v.id
      GROUP BY vg.id, vg.name, vg.valid_from, vg.valid_to
      ORDER BY vg.name ASC
    `);

    const headers = ['Group ID', 'Group Name', 'Valid From', 'Valid To', 'Vehicle Count', 'Vehicles'];
    const data = (rows || []).map(r => [
      r.id, r.group_name, r.valid_from, r.valid_to, r.vehicle_count, r.vehicles
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Vehicle Fleet Groups Report',
        subtitle: 'Vehicle Group Allocations',
        filename: 'vehicle_group_report.pdf',
        headers,
        rows: data,
        landscape: true
      });
    }

    return sendExcel(res, {
      title: 'Vehicle Fleet Groups Report',
      subtitle: 'Vehicle Group Allocations',
      filename: 'vehicle_group_report.xlsx',
      headers,
      rows: data,
      colWidths: [12, 22, 14, 14, 14, 40]
    });
  } catch (err) {
    console.error('GenerateVehicleGroupReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 16. Shift Report
async function generateShiftReport(req, res) {
  try {
    const { format } = req.query;

    const [rows] = await db.query(`
      SELECT 
        s.id, s.name,
        TIME_FORMAT(s.start_time, '%h:%i %p') AS start_time,
        TIME_FORMAT(s.end_time, '%h:%i %p') AS end_time,
        COUNT(a.id) AS active_assignments
      FROM shifts s
      LEFT JOIN assignments a ON s.id = a.shift_id AND a.status IN ('active', 'assigned') AND CURDATE() BETWEEN a.start_date AND a.end_date
      GROUP BY s.id, s.name, s.start_time, s.end_time
      ORDER BY s.start_time ASC
    `);

    const headers = ['Shift ID', 'Shift Name', 'Start Time', 'End Time', 'Active Assignments'];
    const data = (rows || []).map(r => [
      r.id, r.name, r.start_time, r.end_time, r.active_assignments
    ]);

    if (format === 'pdf') {
      return sendPDF(res, {
        title: 'Shift Timings & Duty Rosters Report',
        subtitle: 'College Transport Shifts',
        filename: 'shift_report.pdf',
        headers,
        rows: data,
        landscape: false
      });
    }

    return sendExcel(res, {
      title: 'Shift Timings & Duty Rosters Report',
      subtitle: 'College Transport Shifts',
      filename: 'shift_report.xlsx',
      headers,
      rows: data,
      colWidths: [12, 25, 18, 18, 20]
    });
  } catch (err) {
    console.error('GenerateShiftReport error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  GenerateAttendanceReport: generateAttendanceReport,
  generateAttendanceReport,
  GenerateServiceReport: generateServiceReport,
  generateServiceReport,
  GeneratePurchaseReport: generatePurchaseReport,
  generatePurchaseReport,
  GenerateLeaveReport: generateLeaveReport,
  generateLeaveReport,
  GenerateKmFuelReport: generateKmFuelReport,
  generateKmFuelReport,
  GenerateVehicleFleetReport: generateVehicleFleetReport,
  generateVehicleFleetReport,
  GenerateStudentFeeReport: generateStudentFeeReport,
  generateStudentFeeReport,
  GenerateVehicleRequestReport: generateVehicleRequestReport,
  generateVehicleRequestReport,
  GenerateDriverReport: generateDriverReport,
  generateDriverReport,
  GenerateAssignmentReport: generateAssignmentReport,
  generateAssignmentReport,
  GenerateVendorReport: generateVendorReport,
  generateVendorReport,
  GenerateStopChangeReport: generateStopChangeReport,
  generateStopChangeReport,
  GenerateBusDetailReport: generateBusDetailReport,
  generateBusDetailReport,
  GenerateDriverGroupReport: generateDriverGroupReport,
  generateDriverGroupReport,
  GenerateVehicleGroupReport: generateVehicleGroupReport,
  generateVehicleGroupReport,
  GenerateShiftReport: generateShiftReport,
  generateShiftReport
};
