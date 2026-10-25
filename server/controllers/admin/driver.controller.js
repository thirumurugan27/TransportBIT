const axios = require('axios');
const ExcelJS = require('exceljs');
const db = require('../../config/db');

function normalizeCSVHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePhoneKey(val) {
  return String(val || '').replace(/\D+/g, '');
}

function normalizeFlexibleDate(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Check DD-MM-YYYY
  let m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  // Check DD/MM/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  // Check YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return str;
}

async function getDrivers(req, res) {
  try {
    const [rows] = await db.query(`
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
      ORDER BY d.id DESC
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getDrivers error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function createDriver(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const {
      username, password, full_name, phone, email,
      license_number, license_type, license_expiry,
      experience_years, date_of_joining, date_of_relieving,
      allowed_vehicle_type, home_vehicle_id, home_stop_id
    } = req.body;

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!license_number || !String(license_number).trim()) {
      return res.status(400).json({ error: 'License number is required' });
    }

    const uname = username && username.trim() ? username.trim() : (phone ? normalizePhoneKey(phone) : license_number.trim());
    const pwd = password && password.trim() ? password.trim() : (phone ? normalizePhoneKey(phone).slice(-6) || 'driver123' : 'driver123');

    await connection.beginTransaction();

    const [userRes] = await connection.query(`
      INSERT INTO users (username, password, full_name, phone, email, role)
      VALUES (?, ?, ?, ?, ?, 'DRIVER')
    `, [uname, pwd, full_name, phone || '', email || '']);

    const userId = userRes.insertId;

    await connection.query(`
      INSERT INTO drivers (
        user_id, license_number, license_type, license_expiry,
        experience_years, date_of_joining, date_of_relieving, allowed_vehicle_type,
        home_vehicle_id, home_stop_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, license_number, license_type || 'LMV',
      normalizeFlexibleDate(license_expiry) || null,
      experience_years ? parseInt(experience_years, 10) : 0,
      normalizeFlexibleDate(date_of_joining) || null,
      normalizeFlexibleDate(date_of_relieving) || null,
      allowed_vehicle_type || '',
      home_vehicle_id || null,
      home_stop_id || null
    ]);

    await connection.commit();
    return res.status(200).json({ message: 'Driver created successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('createDriver error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
}

async function updateDriver(req, res) {
  try {
    const body = req.body;
    let driverID = req.query.id ? parseInt(req.query.id, 10) : (body.id ? parseInt(body.id, 10) : 0);

    if (!driverID) {
      return res.status(400).json({ error: 'Driver ID required' });
    }

    let userID = body.user_id;
    if (!userID) {
      const [rows] = await db.query('SELECT user_id FROM drivers WHERE id=?', [driverID]);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      userID = rows[0].user_id;
    }

    await db.query(`
      UPDATE users SET full_name=?, phone=?, email=?
      WHERE id=?
    `, [body.full_name || '', body.phone || '', body.email || '', userID]);

    await db.query(`
      UPDATE drivers SET license_number=?, license_type=?, license_expiry=?,
             experience_years=?, date_of_joining=?, date_of_relieving=?, allowed_vehicle_type=?, home_vehicle_id=?, home_stop_id=?
      WHERE id=?
    `, [
      body.license_number || '',
      body.license_type || '',
      normalizeFlexibleDate(body.license_expiry) || null,
      body.experience_years ? parseInt(body.experience_years, 10) : 0,
      normalizeFlexibleDate(body.date_of_joining) || null,
      normalizeFlexibleDate(body.date_of_relieving) || null,
      body.allowed_vehicle_type || '',
      body.home_vehicle_id || null,
      body.home_stop_id || null,
      driverID
    ]);

    return res.status(200).json({ message: 'Driver updated successfully' });
  } catch (err) {
    console.error('updateDriver error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function deleteDriver(req, res) {
  try {
    const id = req.query.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    const [rows] = await db.query('SELECT user_id FROM drivers WHERE id=?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const userID = rows[0].user_id;
    await db.query('DELETE FROM users WHERE id=?', [userID]);
    return res.status(200).json({ message: 'Driver deleted successfully' });
  } catch (err) {
    console.error('deleteDriver error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Bulk parsing helpers
async function parseRowsFromBuffer(file) {
  const records = [];
  const ext = (file.originalname || '').toLowerCase();
  if (ext.endsWith('.csv')) {
    const text = file.buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    for (const line of lines) {
      records.push(line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    if (worksheet) {
      worksheet.eachRow((row, rowNumber) => {
        const rowVals = [];
        row.eachCell({ includeEmpty: true }, cell => {
          rowVals.push(cell.text ? String(cell.text).trim() : '');
        });
        records.push(rowVals);
      });
    }
  }
  return records;
}

async function parseGoogleSheet(sheetURL) {
  const m = sheetURL.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error('Invalid Google Sheet URL');
  const sheetID = m[1];
  const csvURL = `https://docs.google.com/spreadsheets/d/${sheetID}/export?format=csv`;
  const resp = await axios.get(csvURL);
  const lines = resp.data.split(/\r?\n/).filter(l => l.trim().length > 0);
  const records = lines.map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
  return { records, csvURL };
}

async function processDriverRecords(records) {
  if (!records || records.length < 2) {
    throw new Error('Sheet must contain headers and at least one data row');
  }

  const rawHeaders = records[0];
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[normalizeCSVHeader(h)] = idx;
  });

  const required = ['full_name', 'phone', 'license_number'];
  const missing = required.filter(h => headerMap[h] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required headers: ${missing.join(', ')}`);
  }

  const [existingDrivers] = await db.query(`
    SELECT u.phone, d.license_number
    FROM drivers d JOIN users u ON d.user_id = u.id
  `);
  const existingPhones = new Set((existingDrivers || []).map(d => normalizePhoneKey(d.phone)).filter(Boolean));
  const existingLicenses = new Set((existingDrivers || []).map(d => String(d.license_number).toUpperCase().trim()).filter(Boolean));

  const rows = [];
  const validRequests = [];
  let readyRows = 0;
  let invalidRows = 0;

  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.every(c => !c)) continue;

    const get = (key) => {
      const idx = headerMap[key];
      return idx !== undefined && rec[idx] !== undefined ? String(rec[idx]).trim() : '';
    };

    const fullName = get('full_name');
    const phone = get('phone');
    const email = get('email');
    const licenseNumber = get('license_number');
    const licenseType = get('license_type') || 'LMV';
    const licenseExpiry = get('license_expiry');
    const experienceYears = parseInt(get('experience_years') || '0', 10) || 0;
    const dateOfJoining = get('date_of_joining');
    const dateOfRelieving = get('date_of_relieving');
    const allowedVehicleType = get('allowed_vehicle_type') || '';

    const errors = [];
    if (!fullName) errors.push('Full name is required');
    if (!phone) errors.push('Phone is required');
    if (!licenseNumber) errors.push('License number is required');

    const phoneKey = normalizePhoneKey(phone);
    if (phoneKey && existingPhones.has(phoneKey)) {
      errors.push('Phone already exists');
    }
    const licKey = String(licenseNumber).toUpperCase().trim();
    if (licKey && existingLicenses.has(licKey)) {
      errors.push('License number already exists');
    }

    const isValid = errors.length === 0;
    if (isValid) {
      readyRows++;
      validRequests.push({
        fullName, phone, email, licenseNumber, licenseType,
        licenseExpiry, experienceYears, dateOfJoining, dateOfRelieving, allowedVehicleType
      });
    } else {
      invalidRows++;
    }

    rows.push({
      row_number: i,
      full_name: fullName,
      phone,
      email,
      license_number: licenseNumber,
      license_type: licenseType,
      license_expiry: licenseExpiry,
      experience_years: experienceYears,
      date_of_joining: dateOfJoining,
      date_of_relieving: dateOfRelieving,
      allowed_vehicle_type: allowedVehicleType,
      errors,
      is_valid: isValid
    });
  }

  return {
    total_rows: rows.length,
    ready_rows: readyRows,
    invalid_rows: invalidRows,
    required_headers: required,
    rows,
    validRequests
  };
}

async function previewBulkDrivers(req, res) {
  try {
    const { sheet_url } = req.body;
    if (!sheet_url) {
      return res.status(400).json({ error: 'sheet_url is required' });
    }
    const { records, csvURL } = await parseGoogleSheet(sheet_url);
    const result = await processDriverRecords(records);
    return res.status(200).json({
      sheet_url,
      csv_url: csvURL,
      ...result
    });
  } catch (err) {
    console.error('PreviewBulkDrivers error:', err);
    return res.status(400).json({ error: err.message });
  }
}

async function previewBulkDriversFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }
    const records = await parseRowsFromBuffer(req.file);
    const result = await processDriverRecords(records);
    return res.status(200).json(result);
  } catch (err) {
    console.error('PreviewBulkDriversFile error:', err);
    return res.status(400).json({ error: err.message });
  }
}

async function importDriversList(validRequests) {
  let createdCount = 0;
  let failedCount = 0;

  for (const r of validRequests) {
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const uname = r.phone ? normalizePhoneKey(r.phone) : r.licenseNumber;
      const pwd = r.phone ? normalizePhoneKey(r.phone).slice(-6) || 'driver123' : 'driver123';

      const [userRes] = await connection.query(`
        INSERT INTO users (username, password, full_name, phone, email, role)
        VALUES (?, ?, ?, ?, ?, 'DRIVER')
      `, [uname, pwd, r.fullName, r.phone || '', r.email || '']);

      await connection.query(`
        INSERT INTO drivers (
          user_id, license_number, license_type, license_expiry,
          experience_years, date_of_joining, date_of_relieving, allowed_vehicle_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userRes.insertId, r.licenseNumber, r.licenseType,
        normalizeFlexibleDate(r.licenseExpiry) || null,
        r.experienceYears,
        normalizeFlexibleDate(r.dateOfJoining) || null,
        normalizeFlexibleDate(r.dateOfRelieving) || null,
        r.allowedVehicleType || ''
      ]);

      await connection.commit();
      createdCount++;
    } catch (e) {
      await connection.rollback();
      failedCount++;
      console.error('Error importing row:', e);
    } finally {
      connection.release();
    }
  }

  return { createdCount, failedCount };
}

async function importBulkDrivers(req, res) {
  try {
    const { sheet_url } = req.body;
    if (!sheet_url) {
      return res.status(400).json({ error: 'sheet_url is required' });
    }
    const { records, csvURL } = await parseGoogleSheet(sheet_url);
    const result = await processDriverRecords(records);
    const { createdCount, failedCount } = await importDriversList(result.validRequests);

    return res.status(200).json({
      message: `Successfully imported ${createdCount} drivers`,
      created_count: createdCount,
      failed_count: failedCount,
      preview: {
        sheet_url,
        csv_url: csvURL,
        ...result
      }
    });
  } catch (err) {
    console.error('ImportBulkDrivers error:', err);
    return res.status(400).json({ error: err.message });
  }
}

async function importBulkDriversFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }
    const records = await parseRowsFromBuffer(req.file);
    const result = await processDriverRecords(records);
    const { createdCount, failedCount } = await importDriversList(result.validRequests);

    return res.status(200).json({
      message: `Successfully imported ${createdCount} drivers`,
      created_count: createdCount,
      failed_count: failedCount,
      preview: result
    });
  } catch (err) {
    console.error('ImportBulkDriversFile error:', err);
    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  previewBulkDrivers,
  previewBulkDriversFile,
  importBulkDrivers,
  importBulkDriversFile
};
