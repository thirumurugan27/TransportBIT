const db = require('../../config/db');

// GET /api/admin/temporary-assignments
async function getTemporaryAssignments(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT ta.id, ta.original_driver_id, ta.replacement_driver_id,
             ta.shift_id, ta.vehicle_id,
             DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
             ta.reason, ta.status,
             DATE_FORMAT(ta.created_at, '%d-%m-%Y %h:%i %p') as created_at,
             u_orig.full_name as original_driver_name,
             COALESCE(u_repl.full_name, 'Not Assigned') as replacement_driver_name,
             COALESCE(s.name, 'EV Cluster') as shift_name,
             COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '') as start_time,
             COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '') as end_time,
             v.vehicle_number, vt.type as vehicle_type, COALESCE(v.vehicle_name, '') as vehicle_name
      FROM temporary_assignments ta
      JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
      JOIN users u_orig ON d_orig.user_id = u_orig.id
      LEFT JOIN drivers d_repl ON ta.replacement_driver_id = d_repl.id
      LEFT JOIN users u_repl ON d_repl.user_id = u_repl.id
      LEFT JOIN shifts s ON ta.shift_id = s.id
      JOIN vehicles v ON ta.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE (CURDATE() BETWEEN ta.start_date AND ta.end_date
         OR ta.start_date >= CURDATE())
      AND ta.status = 'active'
      ORDER BY ta.start_date DESC, ta.id DESC
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getTemporaryAssignments error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/temporary-assignments/create
async function createTemporaryAssignment(req, res) {
  try {
    const body = req.tempReq || req.body;
    const {
      original_driver_id,
      replacement_driver_id,
      shift_id,
      vehicle_id,
      start_date,
      end_date,
      reason
    } = body;

    const createdBy = req.user ? req.user.user_id : (body.created_by || null);

    if (!original_driver_id || !replacement_driver_id) {
      return res.status(400).json({ error: 'Both original and replacement drivers are required' });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Check if replacement driver already has regular assignment during this period
    const [regRows] = await db.query(`
      SELECT COUNT(*) as count FROM assignments 
      WHERE driver_id = ? 
      AND (
        (start_date <= ? AND end_date >= ?) OR
        (start_date <= ? AND end_date >= ?) OR
        (start_date >= ? AND end_date <= ?)
      )
    `, [replacement_driver_id, start_date, start_date, end_date, end_date, start_date, end_date]);

    if (regRows[0].count > 0) {
      return res.status(409).json({ error: 'Replacement driver already has regular assignment during this period' });
    }

    // Check for overlapping temporary assignments
    const [tempRows] = await db.query(`
      SELECT COUNT(*) as count FROM temporary_assignments 
      WHERE replacement_driver_id = ? 
      AND status = 'active'
      AND (
        (start_date <= ? AND end_date >= ?) OR
        (start_date <= ? AND end_date >= ?) OR
        (start_date >= ? AND end_date <= ?)
      )
    `, [replacement_driver_id, start_date, start_date, end_date, end_date, start_date, end_date]);

    if (tempRows[0].count > 0) {
      return res.status(409).json({ error: 'Replacement driver already has temporary assignment during this period' });
    }

    const shiftIdVal = shift_id && parseInt(shift_id, 10) > 0 ? parseInt(shift_id, 10) : null;

    const [result] = await db.query(`
      INSERT INTO temporary_assignments (
        original_driver_id, replacement_driver_id, shift_id, vehicle_id,
        start_date, end_date, reason, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [original_driver_id, replacement_driver_id, shiftIdVal, vehicle_id, start_date, end_date, reason || null, createdBy]);

    return res.status(200).json({
      message: 'Temporary assignment created successfully',
      id: result.insertId
    });
  } catch (err) {
    console.error('createTemporaryAssignment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/temporary-assignments/:id or POST /api/admin/temporary-assignments/cancel
async function cancelTemporaryAssignment(req, res) {
  try {
    const id = req.params.id || req.body?.id || req.query?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    await db.query(`
      UPDATE temporary_assignments SET status='cancelled' WHERE id=?
    `, [id]);

    return res.status(200).json({ message: 'Temporary assignment cancelled' });
  } catch (err) {
    console.error('cancelTemporaryAssignment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getTemporaryAssignments,
  createTemporaryAssignment,
  cancelTemporaryAssignment
};
