const db = require('../../config/db');

async function reportIssue(req, res) {
  try {
    const { title, description, severity, vehicle_id, odometer_at_service } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!vehicle_id) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    const sev = severity || 'medium';
    const userID = req.userId;

    const [result] = await db.query(`
      INSERT INTO service_records 
      (vehicle_id, reported_by, title, description, severity, status, odometer_at_service)
      VALUES (?, ?, ?, ?, ?, 'reported', ?)
    `, [vehicle_id, userID, title, description || '', sev, odometer_at_service || null]);

    const id = result.insertId;

    const [veh] = await db.query('SELECT vehicle_number FROM vehicles WHERE id = ?', [vehicle_id]);
    const vehicleNumber = veh[0]?.vehicle_number || '';

    const [usr] = await db.query('SELECT full_name FROM users WHERE id = ?', [userID]);
    const driverName = usr[0]?.full_name || '';

    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, type, title, message, reference_id, is_read)
      VALUES ('ADMIN', 0, 'service_reported', ?, ?, ?, FALSE)
    `, [
      'New Service Request',
      `Driver ${driverName} reported an issue for vehicle ${vehicleNumber}: ${title} (Severity: ${sev})`,
      id
    ]);

    return res.status(200).json({ message: 'Issue reported successfully', id });
  } catch (err) {
    console.error('ReportIssue error:', err);
    return res.status(500).json({ error: 'Failed to report issue: ' + err.message });
  }
}

async function getMyServiceRequests(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT 
        sr.id, sr.vehicle_id, COALESCE(v.vehicle_number, '') as vehicle_number, COALESCE(v.vehicle_name, '') as vehicle_name,
        sr.title, COALESCE(sr.description, '') as description, sr.severity, sr.status,
        COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), '') as scheduled_date, 
        COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'), '') as completed_at,
        COALESCE(sr.admin_remarks, '') as admin_remarks, COALESCE(sr.rejection_reason, '') as rejection_reason,
        sr.total_cost, sr.odometer_at_service, DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM service_records sr
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE sr.reported_by = ?
      ORDER BY sr.created_at DESC
    `, [userID]);

    const records = (rows || []).map(r => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      vehicle_number: r.vehicle_number,
      vehicle_name: r.vehicle_name,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      scheduled_date: r.scheduled_date || null,
      completed_at: r.completed_at || null,
      admin_remarks: r.admin_remarks,
      rejection_reason: r.rejection_reason,
      total_cost: Number(r.total_cost || 0),
      odometer_at_service: r.odometer_at_service,
      created_at: r.created_at
    }));

    return res.status(200).json(records);
  } catch (err) {
    console.error('GetMyServiceRequests error:', err);
    return res.status(200).json([]);
  }
}

async function getVehicleServiceHistory(req, res) {
  try {
    const vehicleID = req.query.vehicle_id;
    if (!vehicleID) {
      return res.status(400).json({ error: 'vehicle_id is required' });
    }

    const [rows] = await db.query(`
      SELECT 
        sr.id, sr.vehicle_id, COALESCE(v.vehicle_number, '') as vehicle_number, COALESCE(v.vehicle_name, '') as vehicle_name,
        sr.title, COALESCE(sr.description, '') as description, sr.severity, sr.status,
        COALESCE(DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y'), '') as scheduled_date, 
        COALESCE(DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p'), '') as completed_at,
        COALESCE(sr.admin_remarks, '') as admin_remarks, COALESCE(sr.rejection_reason, '') as rejection_reason,
        sr.total_cost, sr.odometer_at_service, DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM service_records sr
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE sr.vehicle_id = ? AND sr.status IN ('completed', 'in_progress', 'approved')
      ORDER BY sr.created_at DESC
    `, [vehicleID]);

    const records = (rows || []).map(r => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      vehicle_number: r.vehicle_number,
      vehicle_name: r.vehicle_name,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      scheduled_date: r.scheduled_date || null,
      completed_at: r.completed_at || null,
      admin_remarks: r.admin_remarks,
      rejection_reason: r.rejection_reason,
      total_cost: Number(r.total_cost || 0),
      odometer_at_service: r.odometer_at_service,
      created_at: r.created_at
    }));

    return res.status(200).json(records);
  } catch (err) {
    console.error('GetVehicleServiceHistory error:', err);
    return res.status(200).json([]);
  }
}

module.exports = {
  reportIssue,
  getMyServiceRequests,
  getVehicleServiceHistory
};
