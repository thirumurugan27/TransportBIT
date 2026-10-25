const db = require('../../config/db');

function buildAdminKmWhereClause(f) {
  const clauses = [];
  const args = [];

  if (f.startDate) {
    const end = f.endDate || f.startDate;
    clauses.push('kl.date BETWEEN ? AND ?');
    args.push(f.startDate, end);
  } else {
    switch (f.period) {
      case 'all':
        break;
      case 'today':
        clauses.push('kl.date = CURDATE()');
        break;
      case 'week':
        clauses.push('YEARWEEK(kl.date) = YEARWEEK(CURDATE())');
        break;
      default:
        clauses.push('kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
    }
  }

  if (f.driverId) {
    clauses.push('kl.driver_id = ?');
    args.push(f.driverId);
  }

  if (f.vehicleId) {
    clauses.push('kl.vehicle_id = ?');
    args.push(f.vehicleId);
  }

  if (f.vehicleType) {
    clauses.push("COALESCE(vt.type, '') = ?");
    args.push(f.vehicleType);
  }

  if (clauses.length === 0) {
    return { whereClause: '', args };
  }

  return { whereClause: 'WHERE ' + clauses.join(' AND '), args };
}

// GET /api/admin/driver-assigned-vehicles
async function getDriverAssignedVehicles(req, res) {
  try {
    const driverIdStr = req.query.driver_id;
    const dateParam = req.query.date || '';

    if (!driverIdStr) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const driverId = parseInt(driverIdStr, 10);
    if (!driverId) {
      return res.status(400).json({ error: 'Invalid driver_id' });
    }

    const dateFilter = dateParam ? '?' : 'CURDATE()';
    const vehicles = [];

    // 1. Regular assignments
    const regQuery = `
      SELECT v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, 'BUS') as vehicle_type,
             NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
             a.id as assignment_id, 'REGULAR' as assignment_type,
             a.shift_id,
             s.name as shift_name,
             TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
             TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
             DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date
      FROM assignments a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.driver_id = ?
      AND a.status IN ('assigned', 'active')
      AND ${dateFilter} BETWEEN a.start_date AND a.end_date
    `;
    const regArgs = [driverId];
    if (dateParam) regArgs.push(dateParam);

    const [regRows] = await db.query(regQuery, regArgs);
    vehicles.push(...(regRows || []));

    // 2. Temporary assignments
    const tempQuery = `
      SELECT v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, 'BUS') as vehicle_type,
             NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
             ta.id as assignment_id, 'TEMPORARY' as assignment_type,
             ta.shift_id,
             s.name as shift_name,
             TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
             TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
             DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date
      FROM temporary_assignments ta
      JOIN vehicles v ON ta.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN shifts s ON ta.shift_id = s.id
      WHERE ta.replacement_driver_id = ?
      AND ${dateFilter} BETWEEN ta.start_date AND ta.end_date
    `;
    const tempArgs = [driverId];
    if (dateParam) tempArgs.push(dateParam);

    const [tempRows] = await db.query(tempQuery, tempArgs);
    vehicles.push(...(tempRows || []));

    // 3. EV assignments
    const evQuery = `
      SELECT v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, 'EV') as vehicle_type,
             NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
             ev.id as assignment_id, 'EV_CLUSTER' as assignment_type,
             ev.shift_id,
             COALESCE(s.name, 'EV Duty') as shift_name,
             COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), TIME_FORMAT(dc.start_time, '%h:%i %p'), '08:00 AM') as start_time,
             COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), TIME_FORMAT(dc.end_time, '%h:%i %p'), '05:00 PM') as end_time,
             DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date
      FROM ev_assignments ev
      JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
      JOIN vehicles v ON v.id = vgm.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      JOIN driver_clusters dc ON ev.cluster_id = dc.id
      JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
      JOIN drivers d ON d.id = dcm.driver_id
      LEFT JOIN shifts s ON s.id = ev.shift_id
      WHERE d.id = ?
      AND ev.status = 'active'
      AND ${dateFilter} BETWEEN ev.start_date AND ev.end_date
      AND ${dateFilter} BETWEEN dcm.valid_from AND dcm.valid_to
      AND (vgm.valid_from IS NULL OR ${dateFilter} >= vgm.valid_from)
      AND (vgm.valid_to IS NULL OR ${dateFilter} <= vgm.valid_to)
    `;
    const evArgs = [driverId];
    if (dateParam) evArgs.push(dateParam, dateParam, dateParam, dateParam);

    const [evRows] = await db.query(evQuery, evArgs);
    vehicles.push(...(evRows || []));

    const [driverInfo] = await db.query(`
      SELECT u.full_name as driver_name, c.name as cluster_name
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
      WHERE d.id = ?
    `, [driverId]);

    const dInfo = driverInfo[0] || {};

    return res.status(200).json({
      driver_id: driverId,
      driver_name: dInfo.driver_name || '',
      cluster_name: dInfo.cluster_name || '',
      vehicles,
      date: dateParam
    });
  } catch (err) {
    console.error('getDriverAssignedVehicles error:', err);
    return res.status(500).json({ error: 'Failed to fetch assigned vehicles' });
  }
}

// GET /api/admin/km-filters
async function getKmFilterMeta(req, res) {
  try {
    const [driverRows] = await db.query(`
      SELECT d.id, u.full_name as name, COALESCE(c.name, 'Unassigned') as cluster
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
      ORDER BY u.full_name
    `);

    const [vehicleRows] = await db.query(`
      SELECT v.id, v.vehicle_number, 
             COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number) as vehicle_name
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.status IN ('active', 'available')
      ORDER BY v.vehicle_number
    `);

    return res.status(200).json({
      drivers: driverRows || [],
      vehicles: vehicleRows || []
    });
  } catch (err) {
    console.error('getKmFilterMeta error:', err);
    return res.status(500).json({ error: 'Unable to load filter metadata' });
  }
}

// POST /api/admin/km-log/add
async function adminAddKmLog(req, res) {
  try {
    const {
      admin_user_id,
      driver_id,
      vehicle_id,
      assignment_id,
      shift_id,
      date,
      start_km,
      end_km,
      total_km,
      fuel_consumed,
      remarks,
      vehicle_type
    } = req.body;

    const adminUserId = admin_user_id || (req.user ? req.user.user_id : null);

    if (!adminUserId || !driver_id || !date) {
      return res.status(400).json({ error: 'admin_user_id, driver_id and date required' });
    }
    if (!vehicle_id) {
      return res.status(400).json({ error: 'vehicle_id required' });
    }

    const start = parseFloat(start_km) || 0;
    const end = parseFloat(end_km) || 0;
    if (end < start) {
      return res.status(400).json({ error: 'End KM must be greater than Start KM' });
    }

    const total = parseFloat(total_km) || (end - start);

    const [adminRows] = await db.query(
      "SELECT full_name FROM users WHERE id = ? AND role = 'ADMIN'",
      [adminUserId]
    );
    if (!adminRows || adminRows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    let resolvedAssignmentId = assignment_id || null;
    if (!resolvedAssignmentId) {
      const [aRows] = await db.query(`
        SELECT id FROM assignments
        WHERE driver_id = ? AND vehicle_id = ? AND ? BETWEEN start_date AND end_date
        ORDER BY start_date DESC
        LIMIT 1
      `, [driver_id, vehicle_id, date]);
      if (aRows && aRows.length > 0) {
        resolvedAssignmentId = aRows[0].id;
      }
    }

    // Check if entry already exists
    let existingQuery = 'SELECT id FROM km_logs WHERE driver_id = ? AND date = ? AND vehicle_id = ?';
    const existingArgs = [driver_id, date, vehicle_id];
    if (shift_id) {
      existingQuery += ' AND shift_id = ?';
      existingArgs.push(shift_id);
    }

    const [existRows] = await db.query(existingQuery, existingArgs);

    if (!existRows || existRows.length === 0) {
      const [insertRes] = await db.query(`
        INSERT INTO km_logs (
          driver_id, date, start_km, end_km, total_km, fuel_consumed, remarks,
          vehicle_id, assignment_id, shift_id,
          recorded_by_user_id, status, approved_by, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())
      `, [
        driver_id, date, start, end, total,
        fuel_consumed != null ? parseFloat(fuel_consumed) : null,
        remarks || null,
        vehicle_id, resolvedAssignmentId, shift_id || null,
        adminUserId, adminUserId
      ]);

      return res.status(200).json({
        message: 'KM log recorded successfully',
        id: insertRes.insertId
      });
    } else {
      const existingId = existRows[0].id;
      await db.query(`
        UPDATE km_logs SET
          start_km = ?, end_km = ?, total_km = ?, fuel_consumed = ?, remarks = ?,
          vehicle_id = ?, assignment_id = ?, shift_id = ?,
          recorded_by_user_id = ?, status = 'approved', approved_by = ?, approved_at = NOW()
        WHERE id = ?
      `, [
        start, end, total,
        fuel_consumed != null ? parseFloat(fuel_consumed) : null,
        remarks || null,
        vehicle_id, resolvedAssignmentId, shift_id || null,
        adminUserId, adminUserId, existingId
      ]);

      return res.status(200).json({
        message: 'KM log updated successfully',
        id: existingId
      });
    }
  } catch (err) {
    console.error('adminAddKmLog error:', err);
    return res.status(500).json({ error: `Error adding KM log: ${err.message}` });
  }
}

// GET /api/admin/km-logs
async function getAdminKmLogs(req, res) {
  try {
    const period = req.query.period || 'month';
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const driverParam = req.query.driver_id;
    const vehicleParam = req.query.vehicle_id;
    const vehicleType = req.query.vehicle_type;
    const search = req.query.search;
    const statusParam = req.query.status || '';
    const limitParam = parseInt(req.query.limit || '200', 10);
    const limit = Math.min(Math.max(limitParam, 1), 500);

    const filters = {
      period,
      startDate,
      endDate,
      vehicleType,
      driverId: driverParam ? parseInt(driverParam, 10) : null,
      vehicleId: vehicleParam ? parseInt(vehicleParam, 10) : null
    };

    let { whereClause, args } = buildAdminKmWhereClause(filters);
    if (!whereClause) {
      whereClause = 'WHERE 1=1';
    }

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR v.vehicle_number LIKE ?)';
      const like = `%${search}%`;
      args.push(like, like);
    }

    if (statusParam) {
      whereClause += ' AND kl.status = ?';
      args.push(statusParam);
    }

    const queryStr = `
      SELECT
        kl.id,
        DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
        COALESCE(DATE_FORMAT(kl.created_at, '%h:%i %p'), '-') as recorded_time,
        kl.start_km,
        kl.end_km,
        kl.total_km,
        kl.fuel_consumed,
        kl.remarks,
        NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
        COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
        COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
        u.full_name as driver_name,
        COALESCE(c.name, 'Unassigned') as cluster_name,
        COALESCE(s.name, 'N/A') as shift,
        'N/A' as route_name,
        COALESCE(recorder.full_name, 'Unknown') as recorded_by_name,
        COALESCE(kl.status, 'approved') as status
      FROM km_logs kl
      JOIN drivers d ON kl.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND kl.date BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN assignments a ON kl.assignment_id = a.id
      LEFT JOIN shifts s ON COALESCE(kl.shift_id, a.shift_id) = s.id
      LEFT JOIN users recorder ON kl.recorded_by_user_id = recorder.id
      ${whereClause}
      ORDER BY kl.date DESC, kl.id DESC
      LIMIT ?
    `;

    const [logs] = await db.query(queryStr, [...args, limit]);

    const [summaryRows] = await db.query(`
      SELECT COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as total_trips
      FROM km_logs kl
      JOIN drivers d ON kl.driver_id = d.id
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${whereClause}
    `, args);

    const summary = summaryRows[0] || { total_km: 0, total_trips: 0 };

    return res.status(200).json({
      logs: logs || [],
      summary: {
        total_km: parseFloat(summary.total_km || 0),
        total_trips: parseInt(summary.total_trips || 0, 10)
      }
    });
  } catch (err) {
    console.error('GetAdminKmLogs error:', err);
    return res.status(500).json({ error: `Unable to fetch KM logs: ${err.message}` });
  }
}

// GET /api/admin/km-summary
async function getKMSummary(req, res) {
  try {
    const period = req.query.period || 'month';
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const driverParam = req.query.driver_id;
    const vehicleParam = req.query.vehicle_id;
    const vehicleType = req.query.vehicle_type;

    const filters = {
      period,
      startDate,
      endDate,
      vehicleType,
      driverId: driverParam ? parseInt(driverParam, 10) : null,
      vehicleId: vehicleParam ? parseInt(vehicleParam, 10) : null
    };

    let { whereClause, args } = buildAdminKmWhereClause(filters);
    if (!whereClause) whereClause = 'WHERE 1=1';

    const [summaryRows] = await db.query(`
      SELECT COALESCE(SUM(kl.total_km), 0) as grand_total_km, COUNT(*) as grand_total_trips
      FROM km_logs kl
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${whereClause}
    `, args);

    const grandTotalKm = parseFloat(summaryRows[0].grand_total_km || 0);
    const grandTotalTrips = parseInt(summaryRows[0].grand_total_trips || 0, 10);
    const avgPerTrip = grandTotalTrips > 0 ? grandTotalKm / grandTotalTrips : 0;

    const [byVehicleType] = await db.query(`
      SELECT COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             COUNT(*) as total_trips,
             COALESCE(SUM(kl.total_km), 0) as total_km,
             COALESCE(AVG(kl.total_km), 0) as avg_km_per_trip
      FROM km_logs kl
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${whereClause}
      GROUP BY COALESCE(vt.type, 'UNKNOWN')
    `, args);

    const [topDrivers] = await db.query(`
      SELECT kl.driver_id, u.full_name as driver_name, 
             COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as trips
      FROM km_logs kl
      JOIN drivers d ON kl.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${whereClause}
      GROUP BY kl.driver_id, u.full_name
      ORDER BY total_km DESC
      LIMIT 10
    `, args);

    let byVehicle = [];
    try {
      const [vRows] = await db.query(`
        SELECT v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
               COALESCE(v.vehicle_name, '') as model, COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as total_trips,
               COALESCE(AVG(kl.total_km), 0) as avg_km_per_trip
        FROM km_logs kl
        LEFT JOIN assignments a ON kl.assignment_id = a.id
        LEFT JOIN vehicles v ON COALESCE(kl.vehicle_id, a.vehicle_id) = v.id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        ${whereClause} AND COALESCE(kl.vehicle_id, a.vehicle_id) IS NOT NULL
        GROUP BY v.id, v.vehicle_number, COALESCE(vt.type, 'UNKNOWN'), COALESCE(v.vehicle_name, '')
        ORDER BY total_km DESC
        LIMIT 20
      `, args);
      byVehicle = vRows || [];
    } catch {
      byVehicle = [];
    }

    const [tripWiseList] = await db.query(`
      SELECT kl.id, kl.driver_id, u.full_name as driver_name, 
             COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
             COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
             kl.start_km, kl.end_km, kl.total_km
      FROM km_logs kl
      LEFT JOIN drivers d ON kl.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${whereClause}
      ORDER BY kl.date DESC, kl.id DESC
      LIMIT 200
    `, args);

    let selectedDriver = null;
    if (filters.driverId) {
      const [dRows] = await db.query(`
        SELECT u.full_name as name, COALESCE(SUM(kl.total_km), 0) as total, COUNT(*) as trips, 
               DATE_FORMAT(MIN(kl.date), '%d-%m-%Y') as first_date, DATE_FORMAT(MAX(kl.date), '%d-%m-%Y') as last_date
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        JOIN users u ON d.user_id = u.id
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        ${whereClause}
      `, args);
      if (dRows && dRows.length > 0) {
        selectedDriver = {
          driver_id: filters.driverId,
          driver_name: dRows[0].name,
          total_km: parseFloat(dRows[0].total || 0),
          trips: parseInt(dRows[0].trips || 0, 10),
          first_date: dRows[0].first_date || null,
          last_date: dRows[0].last_date || null
        };
      }
    }

    let selectedVehicle = null;
    if (filters.vehicleId) {
      const [vRows] = await db.query(`
        SELECT COALESCE(v.vehicle_number, 'N/A') as number, COALESCE(vt.type, 'UNKNOWN') as vtype,
               COALESCE(SUM(kl.total_km), 0) as total, COUNT(*) as trips, 
               DATE_FORMAT(MIN(kl.date), '%d-%m-%Y') as first_date, DATE_FORMAT(MAX(kl.date), '%d-%m-%Y') as last_date
        FROM km_logs kl
        LEFT JOIN vehicles v ON kl.vehicle_id = v.id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        ${whereClause}
      `, args);
      if (vRows && vRows.length > 0) {
        selectedVehicle = {
          vehicle_id: filters.vehicleId,
          vehicle_number: vRows[0].number,
          vehicle_type: vRows[0].vtype,
          total_km: parseFloat(vRows[0].total || 0),
          trips: parseInt(vRows[0].trips || 0, 10),
          first_date: vRows[0].first_date || null,
          last_date: vRows[0].last_date || null
        };
      }
    }

    return res.status(200).json({
      period,
      filters: {
        start_date: startDate,
        end_date: endDate,
        driver_id: driverParam,
        vehicle_id: vehicleParam
      },
      grand_total_km: grandTotalKm,
      grand_total_trips: grandTotalTrips,
      avg_km_per_trip: avgPerTrip,
      by_vehicle_type: byVehicleType || [],
      top_drivers: topDrivers || [],
      by_vehicle: byVehicle || [],
      trip_wise: tripWiseList || [],
      selected_driver: selectedDriver,
      selected_vehicle: selectedVehicle
    });
  } catch (err) {
    console.error('GetKMSummary error:', err);
    return res.status(500).json({ error: 'Failed to fetch KM summary' });
  }
}

// GET /api/admin/km-vehicle-summary
async function getVehicleKmSummary(req, res) {
  try {
    const period = req.query.period || 'month';
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const driverParam = req.query.driver_id;
    const vehicleIDParam = req.query.vehicle_id;
    const vehicleNumberParam = req.query.vehicle_number;
    const vehicleType = req.query.vehicle_type;

    const filters = {
      period,
      startDate,
      endDate,
      vehicleType,
      driverId: driverParam ? parseInt(driverParam, 10) : null,
      vehicleId: vehicleIDParam ? parseInt(vehicleIDParam, 10) : null
    };

    let { whereClause, args } = buildAdminKmWhereClause(filters);
    if (!whereClause) whereClause = 'WHERE 1=1';

    if (vehicleNumberParam) {
      whereClause += ' AND v.vehicle_number = ?';
      args.push(vehicleNumberParam);
    }

    let vehicleWhere = whereClause;
    if (filters.vehicleId) {
      vehicleWhere = vehicleWhere.replace(/kl\.vehicle_id = \?/g, 'COALESCE(kl.vehicle_id, a.vehicle_id) = ?');
    }

    const query = `
      SELECT 
        v.id as vehicle_id,
        v.vehicle_number,
        COALESCE(v.vehicle_name, '') AS vehicle_name,
        COALESCE(vt.type, 'UNKNOWN') AS vehicle_type,
        COALESCE(v.fuel_type, '') AS fuel_type,
        COALESCE(SUM(kl.total_km), 0) AS total_km,
        COUNT(kl.id) AS total_trips,
        COALESCE(AVG(kl.total_km), 0) AS avg_km_per_trip
      FROM km_logs kl
      LEFT JOIN assignments a ON kl.assignment_id = a.id
      LEFT JOIN vehicles v ON COALESCE(kl.vehicle_id, a.vehicle_id) = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ${vehicleWhere}
      AND COALESCE(kl.vehicle_id, a.vehicle_id) IS NOT NULL
      GROUP BY 
        v.id, v.vehicle_number, v.vehicle_name, COALESCE(vt.type, 'UNKNOWN'), v.fuel_type
      ORDER BY total_km DESC
    `;

    const [rows] = await db.query(query, args);

    return res.status(200).json({
      period,
      vehicles: rows || []
    });
  } catch (err) {
    console.error('getVehicleKmSummary error:', err);
    return res.status(500).json({ error: 'Unable to fetch vehicle summary' });
  }
}

// GET /api/admin/driver-km-history
async function getDriverKmHistory(req, res) {
  try {
    const driverIdStr = req.query.driver_id;
    if (!driverIdStr) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const driverId = parseInt(driverIdStr, 10);
    const period = req.query.period || 'all';
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    const [dInfoRows] = await db.query(`
      SELECT u.id as user_id, u.full_name as driver_name, c.name as cluster_name
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN driver_clusters c ON dcm.cluster_id = c.id
      WHERE d.id = ?
    `, [driverId]);

    if (!dInfoRows || dInfoRows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const dInfo = dInfoRows[0];

    let dateClause = '';
    const args = [driverId];

    if (startDate) {
      const end = endDate || startDate;
      dateClause = ' AND kl.date BETWEEN ? AND ?';
      args.push(startDate, end);
    } else {
      switch (period) {
        case 'today':
          dateClause = ' AND kl.date = CURDATE()';
          break;
        case 'week':
          dateClause = ' AND YEARWEEK(kl.date) = YEARWEEK(CURDATE())';
          break;
        case 'month':
          dateClause = ' AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case 'year':
          dateClause = ' AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)';
          break;
      }
    }

    const [statsRows] = await db.query(`
      SELECT COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as total_trips,
             DATE_FORMAT(MIN(kl.date), '%d-%m-%Y') as first_date, DATE_FORMAT(MAX(kl.date), '%d-%m-%Y') as last_date
      FROM km_logs kl
      WHERE kl.driver_id = ? ${dateClause}
    `, args);

    const stats = statsRows[0] || { total_km: 0, total_trips: 0 };
    const totalKm = parseFloat(stats.total_km || 0);
    const totalTrips = parseInt(stats.total_trips || 0, 10);
    const avgPerTrip = totalTrips > 0 ? totalKm / totalTrips : 0;

    const [byVehicle] = await db.query(`
      SELECT v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
             COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as total_trips,
             COALESCE(AVG(kl.total_km), 0) as avg_km_per_trip,
             DATE_FORMAT(MIN(kl.date), '%d-%m-%Y') as first_date, DATE_FORMAT(MAX(kl.date), '%d-%m-%Y') as last_date
      FROM km_logs kl
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE kl.driver_id = ? ${dateClause} AND kl.vehicle_id IS NOT NULL
      GROUP BY v.id, v.vehicle_number, COALESCE(vt.type, 'UNKNOWN'), v.vehicle_name
      ORDER BY total_km DESC
    `, args);

    const [byVehicleType] = await db.query(`
      SELECT COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as total_trips
      FROM km_logs kl
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE kl.driver_id = ? ${dateClause}
      GROUP BY COALESCE(vt.type, 'UNKNOWN')
      ORDER BY total_km DESC
    `, args);

    const [recentLogs] = await db.query(`
      SELECT kl.id, DATE_FORMAT(kl.date, '%d-%m-%Y') as date,
             NULLIF(COALESCE(v.vehicle_name, ''), '') as vehicle_name,
             COALESCE(v.vehicle_number, 'N/A') as vehicle_number,
             COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
             kl.start_km, kl.end_km, kl.total_km, kl.remarks
      FROM km_logs kl
      LEFT JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE kl.driver_id = ? ${dateClause}
      ORDER BY kl.date DESC, kl.id DESC
      LIMIT 20
    `, args);

    const [monthlyTrends] = await db.query(`
      SELECT DATE_FORMAT(kl.date, '%m-%Y') as month,
             COALESCE(SUM(kl.total_km), 0) as total_km, COUNT(*) as trips
      FROM km_logs kl
      WHERE kl.driver_id = ?
      AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(kl.date, '%m-%Y'), DATE_FORMAT(kl.date, '%Y-%m')
      ORDER BY DATE_FORMAT(kl.date, '%Y-%m') DESC
    `, [driverId]);

    return res.status(200).json({
      driver_id: driverId,
      driver_name: dInfo.driver_name || '',
      cluster_name: dInfo.cluster_name || '',
      total_km: totalKm,
      total_trips: totalTrips,
      avg_km_per_trip: avgPerTrip,
      first_date: stats.first_date || '',
      last_date: stats.last_date || '',
      by_vehicle: byVehicle || [],
      by_vehicle_type: byVehicleType || [],
      recent_logs: recentLogs || [],
      monthly_trends: monthlyTrends || []
    });
  } catch (err) {
    console.error('getDriverKmHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch driver KM history' });
  }
}

// POST /api/admin/km-log/approve
async function approveKmLog(req, res) {
  try {
    const { id, admin_user_id } = req.body;
    const adminUserId = admin_user_id || (req.user ? req.user.user_id : null);

    if (!id || !adminUserId) {
      return res.status(400).json({ error: 'id and admin_user_id required' });
    }

    const [adminRows] = await db.query(
      "SELECT full_name FROM users WHERE id = ? AND role = 'ADMIN'",
      [adminUserId]
    );
    if (!adminRows || adminRows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    const [rows] = await db.query(
      "SELECT COALESCE(status, 'approved') as status FROM km_logs WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'KM log not found' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: `KM log is already ${rows[0].status}` });
    }

    await db.query(`
      UPDATE km_logs SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?
    `, [adminUserId, id]);

    return res.status(200).json({ message: 'KM log approved successfully' });
  } catch (err) {
    console.error('approveKmLog error:', err);
    return res.status(500).json({ error: 'Failed to approve' });
  }
}

// POST /api/admin/km-log/reject
async function rejectKmLog(req, res) {
  try {
    const { id, admin_user_id, reason } = req.body;
    const adminUserId = admin_user_id || (req.user ? req.user.user_id : null);

    if (!id || !adminUserId) {
      return res.status(400).json({ error: 'id and admin_user_id required' });
    }

    const [adminRows] = await db.query(
      "SELECT full_name FROM users WHERE id = ? AND role = 'ADMIN'",
      [adminUserId]
    );
    if (!adminRows || adminRows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    const [rows] = await db.query(
      "SELECT COALESCE(status, 'approved') as status FROM km_logs WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'KM log not found' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: `KM log is already ${rows[0].status}` });
    }

    const rejectReason = reason || 'Rejected by admin';
    await db.query(`
      UPDATE km_logs SET status = 'rejected', approved_by = ?, approved_at = NOW(), 
             remarks = CONCAT(COALESCE(remarks, ''), ' [Rejected: ', ?, ']')
      WHERE id = ?
    `, [adminUserId, rejectReason, id]);

    return res.status(200).json({ message: 'KM log rejected' });
  } catch (err) {
    console.error('rejectKmLog error:', err);
    return res.status(500).json({ error: 'Failed to reject' });
  }
}

// GET /api/admin/km-logs/pending-count
async function getPendingKmLogsCount(req, res) {
  try {
    const [rows] = await db.query("SELECT COUNT(*) as count FROM km_logs WHERE status = 'pending'");
    return res.status(200).json({ count: rows[0].count });
  } catch (err) {
    console.error('getPendingKmLogsCount error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/km-logs/fuel-by-vehicle
async function getFuelByVehicle(req, res) {
  try {
    const period = req.query.period || 'month';

    let dateFilter = 'AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    switch (period) {
      case 'today':
        dateFilter = 'AND kl.date = CURDATE()';
        break;
      case 'week':
        dateFilter = 'AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateFilter = 'AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        break;
      case 'year':
        dateFilter = 'AND kl.date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)';
        break;
    }

    const [rows] = await db.query(`
      SELECT 
        v.id as vehicle_id,
        COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number) as vehicle_name,
        v.vehicle_number,
        COALESCE(vt.type, 'UNKNOWN') as vehicle_type,
        COALESCE(v.fuel_type, 'Unknown') as fuel_type,
        COALESCE(SUM(kl.fuel_consumed), 0) as total_fuel,
        COALESCE(SUM(kl.total_km), 0) as total_km,
        COUNT(*) as trip_count
      FROM km_logs kl
      JOIN vehicles v ON kl.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE kl.status = 'approved'
      AND kl.fuel_consumed IS NOT NULL AND kl.fuel_consumed > 0
      AND COALESCE(vt.type, '') NOT IN ('EV', 'ELECTRIC', 'BATTERY_VEHICLE')
      ${dateFilter}
      GROUP BY v.id, v.vehicle_name, v.vehicle_number, COALESCE(vt.type, 'UNKNOWN'), v.fuel_type
      ORDER BY total_fuel DESC
    `);

    let grandTotalFuel = 0;
    let grandTotalKm = 0;

    const results = (rows || []).map(r => {
      const tf = parseFloat(r.total_fuel || 0);
      const tk = parseFloat(r.total_km || 0);
      grandTotalFuel += tf;
      grandTotalKm += tk;
      return {
        ...r,
        total_fuel: tf,
        total_km: tk,
        trip_count: parseInt(r.trip_count || 0, 10),
        mileage: tf > 0 ? tk / tf : 0
      };
    });

    return res.status(200).json({
      vehicles: results,
      grand_total_fuel: grandTotalFuel,
      grand_total_km: grandTotalKm
    });
  } catch (err) {
    console.error('getFuelByVehicle error:', err);
    return res.status(500).json({ error: 'Failed to fetch fuel data' });
  }
}

// GET /api/admin/km-datewise-tracker
async function getDatewiseKmTracker(req, res) {
  try {
    const dateParam = req.query.date;
    const dateSql = dateParam ? '?' : 'CURDATE()';
    const dateArg = dateParam || null;

    const query = `
      SELECT
        a.id AS assignment_id,
        a.driver_id,
        COALESCE(u.full_name, u.username, '') AS driver_name,
        a.vehicle_id,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        COALESCE(vt.type, '') AS vehicle_type,
        COALESCE(s.name, '') AS shift_name,
        a.shift_id,
        COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '') AS shift_start_time,
        COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '') AS shift_end_time,
        CASE WHEN kl.id IS NOT NULL THEN 1 ELSE 0 END AS km_entered,
        COALESCE(kl.id, 0) AS km_log_id,
        COALESCE(kl.start_km, 0) AS start_km,
        COALESCE(kl.end_km, 0) AS end_km,
        COALESCE(kl.total_km, 0) AS total_km,
        COALESCE(kl.status, '') AS km_status
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN shifts s ON a.shift_id = s.id
      LEFT JOIN km_logs kl ON kl.driver_id = a.driver_id
        AND kl.vehicle_id = a.vehicle_id
        AND kl.date = ${dateSql}
        AND kl.status IN ('pending','approved')
        AND (kl.shift_id = a.shift_id OR kl.shift_id IS NULL)
      WHERE a.status IN ('assigned','active')
        AND ${dateSql} BETWEEN a.start_date AND a.end_date
      ORDER BY u.full_name, s.name
    `;

    const args = dateParam ? [dateParam, dateParam] : [];
    const [rows] = await db.query(query, args);

    let enteredCount = 0;
    const results = (rows || []).map(r => {
      const entered = r.km_entered === 1;
      if (entered) enteredCount++;
      return {
        ...r,
        km_entered: entered,
        start_km: parseFloat(r.start_km || 0),
        end_km: parseFloat(r.end_km || 0),
        total_km: parseFloat(r.total_km || 0)
      };
    });

    return res.status(200).json({
      date: dateParam || 'today',
      assignments: results,
      total_assignments: results.length,
      entered_count: enteredCount,
      pending_count: results.length - enteredCount
    });
  } catch (err) {
    console.error('getDatewiseKmTracker error:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}

// GET /api/admin/drivers/km-suggestions
async function getDriverKmSuggestions(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT d.id, u.full_name as name, 
             COALESCE(SUM(k.total_km), 0) as total_km_driven,
             COUNT(k.id) as trips_count,
             COALESCE(att.status, 'absent') as status
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN km_logs k ON k.driver_id = d.id
      LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
      GROUP BY d.id, u.full_name, att.status
      ORDER BY total_km_driven ASC, trips_count ASC
    `);

    const suggestions = (rows || []).map(s => ({
      id: s.id,
      name: s.name,
      total_km_driven: parseFloat(s.total_km_driven || 0),
      trips_count: parseInt(s.trips_count || 0, 10),
      status: s.status
    }));

    return res.status(200).json(suggestions);
  } catch (err) {
    console.error('getDriverKmSuggestions error:', err);
    return res.status(500).json({ error: 'Error fetching suggestions' });
  }
}

module.exports = {
  getDriverAssignedVehicles,
  getKmFilterMeta,
  adminAddKmLog,
  getAdminKmLogs,
  getKMSummary,
  getVehicleKmSummary,
  getDriverKmHistory,
  approveKmLog,
  rejectKmLog,
  getPendingKmLogsCount,
  getFuelByVehicle,
  getDatewiseKmTracker,
  getDriverKmSuggestions
};
