const db = require('../../config/db');
const path = require('path');
const fs = require('fs');

/**
 * Get all fuel indents
 */
async function getFuelIndents(req, res) {
  try {
    const query = `
      SELECT 
        fi.id, fi.vehicle_id, fi.driver_id, fi.fuel_requested, 
        COALESCE(fi.fuel_filled, 0) AS fuel_filled, 
        COALESCE(fi.fuel_amount, 0) AS fuel_amount, 
        fi.odometer_reading, fi.status,
        COALESCE(DATE_FORMAT(fi.requested_at, '%d-%m-%Y %h:%i %p'), '') AS requested_at,
        COALESCE(DATE_FORMAT(fi.completed_at, '%d-%m-%Y %h:%i %p'), '') AS completed_at,
        COALESCE(v.vehicle_number, '') AS vehicle_number, 
        COALESCE(v.vehicle_name, '') AS vehicle_name, 
        COALESCE(u.full_name, '') AS driver_name,
        COALESCE(fi.fuel_indent_number, '') AS fuel_indent_number, 
        COALESCE(fi.vehicle_type, '') AS vehicle_type, 
        COALESCE(fi.fuel_type, '') AS fuel_type,
        COALESCE(DATE_FORMAT(fi.filled_date, '%d-%m-%Y'), '') AS filled_date,
        COALESCE(
          CASE
            WHEN fi.filled_time IS NULL OR fi.filled_time = '' THEN ''
            ELSE DATE_FORMAT(STR_TO_DATE(fi.filled_time, '%H:%i'), '%h:%i %p')
          END,
        '') AS filled_time,
        COALESCE(fi.bill_file_name, '') AS bill_file_name, 
        COALESCE(fi.bill_original_name, '') AS bill_original_name, 
        COALESCE(fi.bill_file_type, '') AS bill_file_type,
        COALESCE(fi.bill_file_size, 0) AS bill_file_size, 
        COALESCE(DATE_FORMAT(fi.bill_uploaded_at, '%d-%m-%Y %h:%i %p'), '') AS bill_uploaded_at
      FROM fuel_indents fi
      LEFT JOIN vehicles v ON fi.vehicle_id = v.id
      LEFT JOIN drivers dr ON fi.driver_id = dr.id
      LEFT JOIN users u ON dr.user_id = u.id
      ORDER BY fi.requested_at DESC
    `;
    const [rows] = await db.query(query);

    const indents = (rows || []).map(fi => {
      let bill_file_url = '';
      if (fi.bill_file_name && fi.bill_file_name.trim() !== '') {
        bill_file_url = '/documents/FuelIndents/' + fi.bill_file_name;
      }
      return {
        ...fi,
        completed_at: fi.completed_at || null,
        bill_uploaded_at: fi.bill_uploaded_at || null,
        bill_file_url
      };
    });

    return res.status(200).json(indents);
  } catch (err) {
    console.error('GetFuelIndents error:', err);
    return res.status(200).json([]);
  }
}

/**
 * Create a new fuel indent
 */
async function createFuelIndent(req, res) {
  try {
    const {
      vehicle_id,
      driver_id,
      fuel_amount,
      filled_liters,
      odometer_reading,
      fuel_indent_number,
      vehicle_type,
      fuel_type,
      filled_date,
      filled_time
    } = req.body;

    const vId = parseInt(vehicle_id, 10);
    const dId = parseInt(driver_id, 10);
    const amount = parseFloat(fuel_amount);
    const liters = parseFloat(filled_liters) || 0;
    const odo = parseInt(odometer_reading, 10) || 0;

    if (!vId || !dId) {
      return res.status(400).json({ error: 'Vehicle and driver are required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Fuel amount must be greater than 0' });
    }

    const query = `
      INSERT INTO fuel_indents 
        (vehicle_id, driver_id, fuel_requested, fuel_filled, fuel_amount, odometer_reading, status, requested_at,
         fuel_indent_number, vehicle_type, fuel_type, filled_date, filled_time)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      vId,
      dId,
      liters,
      liters,
      amount,
      odo,
      fuel_indent_number || '',
      vehicle_type || '',
      fuel_type || '',
      filled_date || null,
      filled_time || null
    ]);

    return res.status(200).json({
      message: 'Fuel indent created successfully',
      id: result.insertId
    });
  } catch (err) {
    console.error('CreateFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to create fuel indent: ' + err.message });
  }
}

/**
 * Complete a fuel indent
 */
async function completeFuelIndent(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    const { fuel_filled } = req.body;
    const query = `
      UPDATE fuel_indents 
      SET fuel_filled = ?, status = 'completed', completed_at = NOW()
      WHERE id = ?
    `;
    await db.query(query, [parseFloat(fuel_filled) || 0, id]);

    return res.status(200).json({ message: 'Fuel indent completed' });
  } catch (err) {
    console.error('CompleteFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to complete fuel indent' });
  }
}

/**
 * Approve a fuel indent
 */
async function approveFuelIndent(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    await db.query(
      `UPDATE fuel_indents SET status = 'completed', completed_at = NOW() WHERE id = ? AND status = 'pending'`,
      [id]
    );

    return res.status(200).json({ message: 'Fuel indent approved' });
  } catch (err) {
    console.error('ApproveFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to approve fuel indent' });
  }
}

/**
 * Reject a fuel indent
 */
async function rejectFuelIndent(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    await db.query(
      `UPDATE fuel_indents SET status = 'rejected' WHERE id = ? AND status = 'pending'`,
      [id]
    );

    return res.status(200).json({ message: 'Fuel indent rejected' });
  } catch (err) {
    console.error('RejectFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to reject fuel indent' });
  }
}

/**
 * Get count of pending fuel indents
 */
async function getPendingFuelIndentCount(req, res) {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM fuel_indents WHERE status = 'pending'`);
    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('GetPendingFuelIndentCount error:', err);
    return res.status(200).json({ count: 0 });
  }
}

/**
 * Upload fuel indent bill
 */
async function uploadFuelIndentBill(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    const [exists] = await db.query(`SELECT id, bill_file_path FROM fuel_indents WHERE id = ?`, [id]);
    if (!exists || exists.length === 0) {
      return res.status(404).json({ error: 'Fuel indent not found' });
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
      return res.status(400).json({ error: 'Only PDF and image files (JPEG, PNG, WebP) are allowed' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'Documents', 'FuelIndents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      ext = fileType === 'pdf' ? '.pdf' : '.jpg';
    }

    const uniqueName = `fuel_indent_${id}_${Date.now()}${ext}`;
    const savePath = path.join(uploadDir, uniqueName);

    // Remove old file if exists
    if (exists[0].bill_file_path && fs.existsSync(exists[0].bill_file_path)) {
      try {
        fs.unlinkSync(exists[0].bill_file_path);
      } catch (e) {
        console.error('Failed to remove old bill:', e);
      }
    }

    // Write file from buffer (if memoryUpload) or move from disk
    if (file.buffer) {
      fs.writeFileSync(savePath, file.buffer);
    } else if (file.path) {
      fs.renameSync(file.path, savePath);
    }

    await db.query(`
      UPDATE fuel_indents
      SET bill_file_name = ?,
          bill_original_name = ?,
          bill_file_type = ?,
          bill_file_size = ?,
          bill_file_path = ?,
          bill_uploaded_at = NOW()
      WHERE id = ?
    `, [uniqueName, file.originalname, fileType, file.size, savePath, id]);

    return res.status(200).json({
      message: 'Fuel bill uploaded successfully',
      bill: {
        file_name: uniqueName,
        original_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        file_url: '/documents/FuelIndents/' + uniqueName
      }
    });
  } catch (err) {
    console.error('UploadFuelIndentBill error:', err);
    return res.status(500).json({ error: 'Failed to upload bill: ' + err.message });
  }
}

/**
 * Update editable fields of fuel indent
 */
async function updateFuelIndent(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    const { filled_date, filled_time, odometer_reading, filled_liters, fuel_amount } = req.body;

    if (!filled_date || !filled_date.trim()) {
      return res.status(400).json({ error: 'Filled date is required' });
    }
    const liters = parseFloat(filled_liters);
    const amount = parseFloat(fuel_amount);
    if (!liters || liters <= 0) {
      return res.status(400).json({ error: 'Filled liters must be greater than 0' });
    }
    if (!amount || amount <= 0) {
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
      WHERE id = ?
    `, [filled_date, filled_time || null, parseInt(odometer_reading, 10) || 0, liters, liters, amount, id]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Fuel indent not found' });
    }

    return res.status(200).json({ message: 'Fuel indent updated successfully' });
  } catch (err) {
    console.error('UpdateFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to update fuel indent' });
  }
}

/**
 * Delete a fuel indent
 */
async function deleteFuelIndent(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid indent ID' });
    }

    const [rows] = await db.query(`SELECT bill_file_path FROM fuel_indents WHERE id = ?`, [id]);
    const billPath = rows?.[0]?.bill_file_path;

    const [result] = await db.query(`DELETE FROM fuel_indents WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Fuel indent not found' });
    }

    if (billPath && fs.existsSync(billPath)) {
      try {
        fs.unlinkSync(billPath);
      } catch (e) {
        console.error('Error deleting bill file:', e);
      }
    }

    return res.status(200).json({ message: 'Fuel indent deleted successfully' });
  } catch (err) {
    console.error('DeleteFuelIndent error:', err);
    return res.status(500).json({ error: 'Failed to delete fuel indent' });
  }
}

module.exports = {
  getFuelIndents,
  createFuelIndent,
  completeFuelIndent,
  approveFuelIndent,
  rejectFuelIndent,
  getPendingFuelIndentCount,
  uploadFuelIndentBill,
  updateFuelIndent,
  deleteFuelIndent
};
