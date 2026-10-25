const db = require('../../config/db');

async function applyLeave(req, res) {
  try {
    const { start_date, end_date, reason } = req.body;
    let driverID = req.body.driver_id;

    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields: driver_id, start_date, end_date' });
    }

    const startTime = req.body.start_time || '09:00:00';
    const endTime = req.body.end_time || '17:00:00';
    const leaveType = req.body.leave_type || 'Leave';

    const [result] = await db.query(`
      INSERT INTO leave_requests
      (driver_id, leave_type, start_date, start_time, end_date, end_time, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())
    `, [driverID, leaveType, start_date, startTime, end_date, endTime, reason || '']);

    return res.status(200).json({
      message: 'Leave request submitted successfully',
      id: result.insertId
    });
  } catch (err) {
    console.error('ApplyLeave DB Error:', err);
    return res.status(500).json({ error: 'Failed to apply leave' });
  }
}

async function getMyLeaveRequests(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id is required' });
    }

    const [rows] = await db.query(`
      SELECT lr.id, lr.driver_id, lr.leave_type,
             DATE_FORMAT(lr.start_date, '%d-%m-%Y') as start_date,
             TIME_FORMAT(lr.start_time, '%h:%i %p') as start_time,
             DATE_FORMAT(lr.end_date, '%d-%m-%Y') as end_date,
             TIME_FORMAT(lr.end_time, '%h:%i %p') as end_time,
             lr.reason, lr.status,
             lr.admin_id, u_adm.full_name as admin_name, 
             DATE_FORMAT(lr.admin_approved_at, '%d-%m-%Y %h:%i %p') as admin_approved_at, 
             lr.admin_remarks, 
             DATE_FORMAT(lr.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM leave_requests lr
      LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
      WHERE lr.driver_id = ?
      ORDER BY lr.created_at DESC
    `, [driverID]);

    const leaves = (rows || []).map(l => ({
      id: l.id,
      driver_id: l.driver_id,
      leave_type: l.leave_type,
      start_date: l.start_date,
      start_time: l.start_time,
      end_date: l.end_date,
      end_time: l.end_time,
      reason: l.reason,
      status: l.status,
      admin_id: l.admin_id,
      admin_name: l.admin_name,
      admin_approved_at: l.admin_approved_at,
      admin_remarks: l.admin_remarks,
      created_at: l.created_at
    }));

    return res.status(200).json({ leaves });
  } catch (err) {
    console.error('Get leave requests error:', err);
    return res.status(500).json({ error: 'Error fetching leave requests' });
  }
}

module.exports = {
  applyLeave,
  getMyLeaveRequests
};
