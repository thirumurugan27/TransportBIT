const db = require('../../config/db');

function upsertKmAssignedVehicle(vehicleMap, v) {
  if (!v.id) return;
  const existing = vehicleMap[v.id];
  if (!existing) {
    vehicleMap[v.id] = { ...v };
    return;
  }
  if (!existing.vehicle_name && v.vehicle_name) existing.vehicle_name = v.vehicle_name;
  if (!existing.vehicle_number && v.vehicle_number) existing.vehicle_number = v.vehicle_number;
  if (!existing.vehicle_type && v.vehicle_type) existing.vehicle_type = v.vehicle_type;
  if (!existing.fuel_type && v.fuel_type) existing.fuel_type = v.fuel_type;
  if (!existing.assignment_id && v.assignment_id) existing.assignment_id = v.assignment_id;
  if (!existing.source && v.source) existing.source = v.source;
  if (!existing.source_label && v.source_label) existing.source_label = v.source_label;
}

function toKmVehicleList(vehicleMap) {
  const vehicles = Object.values(vehicleMap);
  for (const v of vehicles) {
    if (!v.vehicle_type || !v.vehicle_type.trim()) {
      if ((v.fuel_type || '').toUpperCase() === 'EV') {
        v.vehicle_type = 'EV';
      } else {
        v.vehicle_type = 'Vehicle';
      }
    }
    if (!v.source_label || !v.source_label.trim()) {
      switch (v.source) {
        case 'assignment':
          v.source_label = 'Shift Assignment';
          break;
        case 'temporary':
          v.source_label = 'Temporary Assignment';
          break;
        case 'ev_group':
          v.source_label = 'EV Group Assignment';
          break;
        case 'vehicle_request':
          v.source_label = 'Vehicle Request';
          break;
        default:
          v.source_label = 'Assigned';
      }
    }
  }

  vehicles.sort((a, b) => {
    let left = (a.vehicle_name || a.vehicle_number || '').toLowerCase().trim();
    let right = (b.vehicle_name || b.vehicle_number || '').toLowerCase().trim();
    if (left === right) return a.id - b.id;
    return left.localeCompare(right);
  });

  return vehicles;
}

async function getDriverKmLogAssignedVehicles(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    const date = req.query.date ? req.query.date.trim() : '';

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const driverIDInt = parseInt(driverID, 10);
    if (isNaN(driverIDInt) || driverIDInt <= 0) {
      return res.status(400).json({ error: 'invalid driver_id' });
    }

    const vehicleMap = {};

    // 1) Regular assignments
    let assignmentQuery = `
      SELECT v.id,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
             COALESCE(v.vehicle_number, '') as vehicle_number,
             COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
             COALESCE(v.fuel_type, '') as fuel_type,
             a.id as assignment_id
      FROM assignments a
      JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE a.driver_id = ?
        AND COALESCE(a.is_deleted, 0) = 0
    `;
    const assignmentArgs = [driverIDInt];
    if (date) {
      assignmentQuery += ' AND ? BETWEEN a.start_date AND a.end_date';
      assignmentArgs.push(date);
    }

    try {
      const [rows] = await db.query(assignmentQuery, assignmentArgs);
      for (const r of rows || []) {
        upsertKmAssignedVehicle(vehicleMap, {
          id: r.id,
          vehicle_name: r.vehicle_name,
          vehicle_number: r.vehicle_number,
          vehicle_type: r.vehicle_type,
          fuel_type: r.fuel_type,
          assignment_id: r.assignment_id,
          source: 'assignment',
          source_label: 'Shift Assignment'
        });
      }
    } catch (e) {
      console.error('Assignment error in assigned vehicles:', e);
    }

    // 2) Temporary assignments
    let temporaryQuery = `
      SELECT v.id,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
             COALESCE(v.vehicle_number, '') as vehicle_number,
             COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
             COALESCE(v.fuel_type, '') as fuel_type,
             ta.id as temporary_assignment_id
      FROM temporary_assignments ta
      JOIN vehicles v ON v.id = ta.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE ta.replacement_driver_id = ?
        AND COALESCE(ta.is_deleted, 0) = 0
    `;
    const temporaryArgs = [driverIDInt];
    if (date) {
      temporaryQuery += ' AND ? BETWEEN ta.start_date AND ta.end_date';
      temporaryArgs.push(date);
    }

    try {
      const [rows] = await db.query(temporaryQuery, temporaryArgs);
      for (const r of rows || []) {
        upsertKmAssignedVehicle(vehicleMap, {
          id: r.id,
          vehicle_name: r.vehicle_name,
          vehicle_number: r.vehicle_number,
          vehicle_type: r.vehicle_type,
          fuel_type: r.fuel_type,
          source: 'temporary',
          source_label: 'Temporary Assignment'
        });
      }
    } catch (e) {
      console.error('Temp assignment error in assigned vehicles:', e);
    }

    // 3) EV group assignments
    let evQuery = `
      SELECT DISTINCT v.id,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
             COALESCE(v.vehicle_number, '') as vehicle_number,
             COALESCE(vt.type, v.fuel_type, 'EV') as vehicle_type,
             COALESCE(v.fuel_type, 'EV') as fuel_type
      FROM ev_assignments ev
      JOIN driver_cluster_members dcm ON dcm.cluster_id = ev.cluster_id
      JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
      JOIN vehicles v ON v.id = vgm.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE dcm.driver_id = ?
        AND COALESCE(ev.is_deleted, 0) = 0
    `;
    const evArgs = [driverIDInt];
    if (date) {
      evQuery += `
        AND ? BETWEEN ev.start_date AND ev.end_date
        AND (dcm.valid_from IS NULL OR ? >= dcm.valid_from)
        AND (dcm.valid_to IS NULL OR ? <= dcm.valid_to)
        AND (vgm.valid_from IS NULL OR ? >= vgm.valid_from)
        AND (vgm.valid_to IS NULL OR ? <= vgm.valid_to)
      `;
      evArgs.push(date, date, date, date, date);
    }

    try {
      const [rows] = await db.query(evQuery, evArgs);
      for (const r of rows || []) {
        upsertKmAssignedVehicle(vehicleMap, {
          id: r.id,
          vehicle_name: r.vehicle_name,
          vehicle_number: r.vehicle_number,
          vehicle_type: r.vehicle_type,
          fuel_type: r.fuel_type,
          source: 'ev_group',
          source_label: 'EV Group Assignment'
        });
      }
    } catch (e) {
      console.error('EV error in assigned vehicles:', e);
    }

    // 4) Vehicle requests assigned to driver
    const requestQuery = `
      SELECT DISTINCT v.id,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
             COALESCE(v.vehicle_number, '') as vehicle_number,
             COALESCE(vt.type, v.fuel_type, 'Vehicle') as vehicle_type,
             COALESCE(v.fuel_type, '') as fuel_type
      FROM vehiclerequests vr
      JOIN vehicles v ON v.id = vr.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE vr.driver_id = ?
        AND vr.vehicle_id IS NOT NULL
        AND COALESCE(vr.is_deleted, 0) = 0
        AND vr.status IN ('assigned', 'trip_started', 'completed', 'cancelled')
    `;

    try {
      const [rows] = await db.query(requestQuery, [driverIDInt]);
      for (const r of rows || []) {
        upsertKmAssignedVehicle(vehicleMap, {
          id: r.id,
          vehicle_name: r.vehicle_name,
          vehicle_number: r.vehicle_number,
          vehicle_type: r.vehicle_type,
          fuel_type: r.fuel_type,
          source: 'vehicle_request',
          source_label: 'Vehicle Request'
        });
      }
    } catch (e) {
      console.error('Vehicle request error in assigned vehicles:', e);
    }

    return res.status(200).json(toKmVehicleList(vehicleMap));
  } catch (err) {
    console.error('GetDriverKmLogAssignedVehicles error:', err);
    return res.status(500).json({ error: 'Error fetching assigned vehicles' });
  }
}

async function getDriverKmLogs(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const [rows] = await db.query(`
      SELECT k.id, k.driver_id, DATE_FORMAT(k.date, '%d-%m-%Y') as date, 
             k.start_km, k.end_km, k.total_km, k.fuel_consumed,
             COALESCE(k.remarks, '') as remarks,
             COALESCE(vt.type, '') as vehicle_type, k.vehicle_id, v.vehicle_number,
             COALESCE(k.status, 'approved') as status
      FROM km_logs k
      LEFT JOIN vehicles v ON k.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE k.driver_id = ?
      ORDER BY k.date DESC
      LIMIT 30
    `, [driverID]);

    const logs = (rows || []).map(l => ({
      id: l.id,
      driver_id: l.driver_id,
      date: l.date,
      start_km: Number(l.start_km || 0),
      end_km: Number(l.end_km || 0),
      total_km: Number(l.total_km || 0),
      fuel_consumed: l.fuel_consumed !== null ? Number(l.fuel_consumed) : null,
      remarks: l.remarks,
      vehicle_type: l.vehicle_type,
      vehicle_id: l.vehicle_id,
      vehicle_number: l.vehicle_number,
      status: l.status
    }));

    return res.status(200).json(logs);
  } catch (err) {
    console.error('Get km logs error:', err);
    return res.status(500).json({ error: 'Error fetching km logs' });
  }
}

async function addDriverKmLog(req, res) {
  try {
    const {
      driver_id, date, start_km, end_km, remarks,
      vehicle_id, assignment_id, shift_id, force
    } = req.body;

    const startKm = Number(start_km || 0);
    const endKm = Number(end_km || 0);
    let totalKm = Number(req.body.total_km || 0);

    if (!driver_id || !date) {
      return res.status(400).json({ error: 'driver_id and date required' });
    }
    if (vehicle_id === undefined || vehicle_id === null) {
      return res.status(400).json({ error: 'vehicle_id required' });
    }
    if (endKm < startKm) {
      return res.status(400).json({ error: 'End KM must be greater than Start KM' });
    }
    if (totalKm === 0) {
      totalKm = endKm - startKm;
    }

    if (!force) {
      let dupQuery = 'SELECT id FROM km_logs WHERE driver_id = ? AND date = ? AND vehicle_id = ?';
      const dupArgs = [driver_id, date, vehicle_id];
      if (shift_id) {
        dupQuery += ' AND shift_id = ?';
        dupArgs.push(shift_id);
      }
      const [dups] = await db.query(dupQuery, dupArgs);
      if (dups && dups.length > 0) {
        return res.status(409).json({
          code: 'duplicate',
          error: 'You have already submitted a KM log for this date and vehicle. Do you want to add another log?'
        });
      }
    }

    const [drv] = await db.query(`
      SELECT u.id
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `, [driver_id]);

    if (!drv || drv.length === 0) {
      return res.status(400).json({ error: 'Driver not found' });
    }
    const recordedByUserID = drv[0].id;

    let finalAssignmentID = assignment_id || null;
    if (!finalAssignmentID) {
      const [aRows] = await db.query(`
        SELECT id FROM assignments
        WHERE driver_id = ? AND vehicle_id = ? AND ? BETWEEN start_date AND end_date
        ORDER BY start_date DESC
        LIMIT 1
      `, [driver_id, vehicle_id, date]);
      if (aRows && aRows.length > 0) {
        finalAssignmentID = aRows[0].id;
      }
    }

    const fuelConsumed = req.body.fuel_consumed !== undefined && req.body.fuel_consumed !== null
      ? Number(req.body.fuel_consumed) : null;

    const [result] = await db.query(`
      INSERT INTO km_logs (
        driver_id, date, start_km, end_km, total_km, fuel_consumed, remarks,
        vehicle_id, assignment_id, shift_id,
        recorded_by_user_id, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      driver_id, date, startKm, endKm, totalKm, fuelConsumed, remarks || '',
      vehicle_id, finalAssignmentID, shift_id || null, recordedByUserID
    ]);

    return res.status(200).json({
      message: 'KM log submitted for approval',
      id: result.insertId,
      status: 'pending'
    });
  } catch (err) {
    console.error('Add km log error:', err);
    return res.status(500).json({ error: 'Error adding km log' });
  }
}

async function getLastLogForVehicle(req, res) {
  try {
    const vehicleID = req.query.vehicle_id;
    if (!vehicleID) {
      return res.status(400).json({ error: 'vehicle_id required' });
    }

    const [rows] = await db.query(`
      SELECT end_km 
      FROM km_logs 
      WHERE vehicle_id = ? 
      ORDER BY date DESC, end_km DESC 
      LIMIT 1
    `, [vehicleID]);

    const endKm = rows && rows.length > 0 ? Number(rows[0].end_km || 0) : 0;
    return res.status(200).json({ end_km: endKm });
  } catch (err) {
    console.error('Get last log error:', err);
    return res.status(200).json({ end_km: 0 });
  }
}

module.exports = {
  getDriverKmLogAssignedVehicles,
  getDriverKmLogs,
  addDriverKmLog,
  getLastLogForVehicle
};
