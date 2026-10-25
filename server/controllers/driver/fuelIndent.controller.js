const fs = require('fs');
const path = require('path');
const db = require('../../config/db');

async function getDriverIDFromUser(userId) {
  const [rows] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [userId]);
  return rows && rows.length > 0 ? rows[0].id : null;
}

async function getDriverFuelIndents(req, res) {
  try {
    const driverID = await getDriverIDFromUser(req.userId);
    if (!driverID) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const [rows] = await db.query(`
      SELECT 
        fi.id, fi.vehicle_id, fi.driver_id, fi.fuel_requested,
        COALESCE(fi.fuel_filled, 0) as fuel_filled, COALESCE(fi.fuel_amount, 0) as fuel_amount,
        fi.odometer_reading, fi.status,
        COALESCE(DATE_FORMAT(fi.requested_at, '%d-%m-%Y %h:%i %p'), '') as requested_at,
        COALESCE(DATE_FORMAT(fi.completed_at, '%d-%m-%Y %h:%i %p'), '') as completed_at,
        COALESCE(v.vehicle_number, '') as vehicle_number, COALESCE(v.vehicle_name, '') as vehicle_name,
        COALESCE(u.full_name, '') as driver_name,
        COALESCE(fi.fuel_indent_number, '') as fuel_indent_number,
        COALESCE(fi.vehicle_type, '') as vehicle_type, COALESCE(fi.fuel_type, '') as fuel_type,
        COALESCE(DATE_FORMAT(fi.filled_date, '%d-%m-%Y'), '') as filled_date,
        COALESCE(
          CASE
            WHEN fi.filled_time IS NULL OR fi.filled_time = '' THEN ''
            ELSE DATE_FORMAT(STR_TO_DATE(fi.filled_time, '%H:%i'), '%h:%i %p')
          END,
        '') as filled_time,
        COALESCE(fi.bill_file_name, '') as bill_file_name,
        COALESCE(fi.bill_original_name, '') as bill_original_name,
        COALESCE(fi.bill_file_type, '') as bill_file_type,
        COALESCE(fi.bill_file_size, 0) as bill_file_size,
        COALESCE(DATE_FORMAT(fi.bill_uploaded_at, '%d-%m-%Y %h:%i %p'), '') as bill_uploaded_at
      FROM fuel_indents fi
      LEFT JOIN vehicles v ON fi.vehicle_id = v.id
      LEFT JOIN drivers dr ON fi.driver_id = dr.id
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE fi.driver_id = ?
      ORDER BY fi.requested_at DESC
    `, [driverID]);

    const indents = (rows || []).map(fi => {
      let bill_file_url = '';
      if (fi.bill_file_name && fi.bill_file_name.trim()) {
        bill_file_url = '/documents/FuelIndents/' + fi.bill_file_name;
      }
      return {
        ...fi,
        fuel_requested: Number(fi.fuel_requested || 0),
        fuel_filled: Number(fi.fuel_filled || 0),
        fuel_amount: Number(fi.fuel_amount || 0),
        bill_file_url: bill_file_url
      };
    });

    return res.status(200).json(indents);
  } catch (err) {
    console.error('GetDriverFuelIndents error:', err);
    return res.status(200).json([]);
  }
}

async function createDriverFuelIndent(req, res) {
  try {
    const {
      vehicle_id, driver_id, filled_date, filled_time,
      filled_liters, fuel_amount, odometer_reading,
      fuel_indent_number, vehicle_type, fuel_type
    } = req.body;

    if (!vehicle_id || !driver_id) {
      return res.status(400).json({ error: 'Vehicle and driver are required' });
    }
    if (!filled_date) {
      return res.status(400).json({ error: 'Filled date is required' });
    }
    const liters = Number(filled_liters || 0);
    const amount = Number(fuel_amount || 0);
    if (liters <= 0) {
      return res.status(400).json({ error: 'Filled liters must be greater than 0' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Fuel amount must be greater than 0' });
    }

    const [result] = await db.query(`
      INSERT INTO fuel_indents 
        (vehicle_id, driver_id, fuel_requested, fuel_filled, fuel_amount, odometer_reading, status, requested_at,
         fuel_indent_number, vehicle_type, fuel_type, filled_date, filled_time)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, ?, ?, ?, ?)
    `, [
      vehicle_id, driver_id, liters, liters, amount,
      odometer_reading || 0,
      fuel_indent_number || '', vehicle_type || '', fuel_type || '',
      filled_date, filled_time || ''
    ]);

    return res.status(200).json({
      message: 'Fuel indent raised successfully',
      id: result.insertId
    });
  } catch (err) {
    console.error('CreateDriverFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to create fuel indent: ' + err.message });
  }
}

async function getDriversDropdown(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT d.id, u.full_name
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE u.status != 'inactive'
      ORDER BY u.full_name
    `);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetDriversDropdown error:', err);
    return res.status(200).json([]);
  }
}

async function uploadDriverFuelIndentBill(req, res) {
  try {
    const driverID = await getDriverIDFromUser(req.userId);
    if (!driverID) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const indentID = parseInt(req.params.id, 10);
    if (!indentID || indentID <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    const [rows] = await db.query('SELECT driver_id, bill_file_path FROM fuel_indents WHERE id = ?', [indentID]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Fuel indent not found' });
    }

    if (rows[0].driver_id !== driverID) {
      return res.status(403).json({ error: 'You can upload bills only for your own indents' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const allowedTypes = {
      'application/pdf': 'pdf',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/png': 'image',
      'image/webp': 'image'
    };
    const fileType = allowedTypes[file.mimetype];
    if (!fileType) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Only PDF and image files (JPEG, PNG, WebP) are allowed' });
    }

    // Delete old file if present
    const oldPath = rows[0].bill_file_path;
    if (oldPath && fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
    }

    const filename = file.filename;
    await db.query(`
      UPDATE fuel_indents
      SET bill_file_name = ?,
          bill_original_name = ?,
          bill_file_type = ?,
          bill_file_size = ?,
          bill_file_path = ?,
          bill_uploaded_at = NOW()
      WHERE id = ?
    `, [filename, file.originalname, fileType, file.size, file.path, indentID]);

    return res.status(200).json({
      message: 'Fuel bill uploaded successfully',
      bill: {
        file_name: filename,
        original_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        file_url: '/documents/FuelIndents/' + filename
      }
    });
  } catch (err) {
    console.error('UploadDriverFuelIndentBill error:', err);
    return res.status(500).json({ error: 'Failed to upload bill' });
  }
}

async function updateDriverFuelIndent(req, res) {
  try {
    const driverID = await getDriverIDFromUser(req.userId);
    if (!driverID) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const indentID = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!indentID || isNaN(indentID)) {
      return res.status(400).json({ error: 'Valid fuel indent ID required' });
    }
    const { filled_date, filled_time, odometer_reading, filled_liters, fuel_amount } = req.body;

    if (!filled_date || !filled_date.trim()) {
      return res.status(400).json({ error: 'Filled date is required' });
    }
    const liters = Number(filled_liters || 0);
    const amount = Number(fuel_amount || 0);
    if (liters <= 0) {
      return res.status(400).json({ error: 'Filled liters must be greater than 0' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Fuel amount must be greater than 0' });
    }

    const [result] = await db.query(`
      UPDATE fuel_indents
      SET filled_date = ?,
          filled_time = ?,
          odometer_reading = ?,
          fuel_requested = ?,
          fuel_filled = ?,
          fuel_amount = ?
      WHERE id = ? AND driver_id = ?
    `, [filled_date, filled_time || '', odometer_reading || 0, liters, liters, amount, indentID, driverID]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Fuel indent not found' });
    }

    return res.status(200).json({ message: 'Fuel indent updated successfully' });
  } catch (err) {
    console.error('UpdateDriverFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to update fuel indent' });
  }
}

async function deleteDriverFuelIndent(req, res) {
  try {
    const driverID = await getDriverIDFromUser(req.userId);
    if (!driverID) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const indentID = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!indentID || isNaN(indentID)) {
      return res.status(400).json({ error: 'Valid fuel indent ID required' });
    }
    const [rows] = await db.query('SELECT bill_file_path FROM fuel_indents WHERE id = ? AND driver_id = ?', [indentID, driverID]);

    const [result] = await db.query('DELETE FROM fuel_indents WHERE id = ? AND driver_id = ?', [indentID, driverID]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Fuel indent not found' });
    }

    if (rows && rows[0]?.bill_file_path && fs.existsSync(rows[0].bill_file_path)) {
      try { fs.unlinkSync(rows[0].bill_file_path); } catch (e) { /* ignore */ }
    }

    return res.status(200).json({ message: 'Fuel indent deleted successfully' });
  } catch (err) {
    console.error('DeleteDriverFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to delete fuel indent' });
  }
}

module.exports = {
  getDriverFuelIndents,
  createDriverFuelIndent,
  getDriversDropdown,
  uploadDriverFuelIndentBill,
  updateDriverFuelIndent,
  deleteDriverFuelIndent
};
