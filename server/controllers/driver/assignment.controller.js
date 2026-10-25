const db = require('../../config/db');

async function getGroupVehicles(groupID, date) {
  try {
    const [rows] = await db.query(`
      SELECT 
        v.id,
        COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
        v.vehicle_number,
        COALESCE(vt.type, 'EV') as vehicle_type,
        v.fuel_type
      FROM vehicle_group_members vgm
      JOIN vehicles v ON vgm.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE vgm.group_id = ?
        AND ? BETWEEN vgm.valid_from AND vgm.valid_to
      ORDER BY v.vehicle_number ASC
    `, [groupID, date]);

    return (rows || []).map(r => ({
      id: r.id,
      vehicle_name: r.vehicle_name,
      vehicle_number: r.vehicle_number,
      vehicle_type: r.vehicle_type,
      fuel_type: r.fuel_type
    }));
  } catch (err) {
    console.error('getGroupVehicles error:', err);
    return [];
  }
}

async function getGroupDrivers(groupID, date) {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.id,
        u.full_name as name
      FROM driver_cluster_members dcm
      JOIN drivers d ON dcm.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE dcm.cluster_id = ?
        AND ? BETWEEN dcm.valid_from AND dcm.valid_to
      ORDER BY u.full_name ASC
    `, [groupID, date]);

    return (rows || []).map(r => ({
      id: r.id,
      name: r.name
    }));
  } catch (err) {
    console.error('getGroupDrivers error:', err);
    return [];
  }
}

async function hydrateEVAssignmentDetails(assignment, date) {
  if (assignment.vehicle_group_id) {
    assignment.group_vehicles = await getGroupVehicles(assignment.vehicle_group_id, date);
  }
  if (assignment.driver_group_id) {
    assignment.group_drivers = await getGroupDrivers(assignment.driver_group_id, date);
  }

  if (assignment.shift_name || assignment.start_time || assignment.end_time) {
    assignment.shifts = [{
      shift_id: assignment.shift_id || 0,
      shift_name: assignment.shift_name,
      start_time: assignment.start_time,
      end_time: assignment.end_time
    }];
  }

  if (!assignment.vehicle_name) {
    assignment.vehicle_name = assignment.vehicle_group_name || '';
  }
  if (!assignment.vehicle_number) {
    assignment.vehicle_number = assignment.vehicle_group_name || '';
  }
}

async function getDriverTodayAssignment(req, res) {
  try {
    let driverID = req.query.driver_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID || !date) {
      return res.status(400).json({ error: 'driver_id and date required' });
    }

    const [rows] = await db.query(`
      SELECT 
        a.id, v.id as vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        s.name as shift_name, 
        TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
        TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
        DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
        a.status,
        COALESCE((SELECT rv.vehicle_number FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_number,
        COALESCE((SELECT COALESCE(rv.vehicle_name, rv.vehicle_number) FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_name,
        COALESCE(b.start_point, '') as route_from,
        COALESCE(b.end_point, '') as route_to
      FROM assignments a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      JOIN shifts s ON a.shift_id = s.id
      WHERE a.driver_id = ? AND ? BETWEEN a.start_date AND a.end_date
      LIMIT 1
    `, [driverID, date]);

    if (rows && rows.length > 0) {
      const a = rows[0];
      return res.status(200).json({
        id: a.id,
        vehicle_id: a.vehicle_id,
        vehicle_name: a.vehicle_name,
        vehicle_number: a.vehicle_number,
        vehicle_type: a.vehicle_type,
        shift_name: a.shift_name,
        start_time: a.start_time,
        end_time: a.end_time,
        assigned_date: a.assigned_date,
        status: a.status,
        replacement_vehicle_number: a.replacement_vehicle_number,
        replacement_vehicle_name: a.replacement_vehicle_name,
        route_from: a.route_from,
        route_to: a.route_to
      });
    }

    // Try temporary assignments
    const [tempRows] = await db.query(`
      SELECT 
        ta.id, v.id as vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        COALESCE(s.name, 'EV Duty') as shift_name, 
        COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '08:00 AM') as start_time,
        COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '05:00 PM') as end_time,
        DATE_FORMAT(?, '%d-%m-%Y') as assigned_date,
        ta.status,
        '' as replacement_vehicle_number,
        '' as replacement_vehicle_name,
        COALESCE(b.start_point, '') as route_from,
        COALESCE(b.end_point, '') as route_to
      FROM temporary_assignments ta
      JOIN vehicles v ON ta.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      LEFT JOIN shifts s ON ta.shift_id = s.id
      WHERE ta.replacement_driver_id = ? AND ta.status = 'active'
        AND ? BETWEEN ta.start_date AND ta.end_date
      LIMIT 1
    `, [date, driverID, date]);

    if (tempRows && tempRows.length > 0) {
      return res.status(200).json(tempRows[0]);
    }

    // Try EV assignments
    const [evRows] = await db.query(`
      SELECT 
        ev.id, 
        COALESCE(s.name, 'EV Duty') as shift_name, 
        COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '08:00 AM') as start_time,
        COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '05:00 PM') as end_time,
        DATE_FORMAT(?, '%d-%m-%Y') as assigned_date,
        ev.status,
        dc.id as driver_group_id,
        dc.name as driver_group_name,
        vg.id as vehicle_group_id,
        vg.name as vehicle_group_name
      FROM ev_assignments ev
      JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
      JOIN driver_clusters dc ON ev.cluster_id = dc.id
      JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN shifts s ON s.id = ev.shift_id
      WHERE dcm.driver_id = ? 
        AND ? BETWEEN ev.start_date AND ev.end_date
        AND ev.status = 'active'
      LIMIT 1
    `, [date, date, driverID, date]);

    if (evRows && evRows.length > 0) {
      const a = {
        id: evRows[0].id,
        vehicle_id: 0,
        vehicle_name: evRows[0].vehicle_group_name,
        vehicle_number: evRows[0].vehicle_group_name,
        vehicle_type: 'EV',
        shift_name: evRows[0].shift_name,
        start_time: evRows[0].start_time,
        end_time: evRows[0].end_time,
        assigned_date: evRows[0].assigned_date,
        status: evRows[0].status,
        driver_group_id: evRows[0].driver_group_id,
        driver_group_name: evRows[0].driver_group_name,
        vehicle_group_id: evRows[0].vehicle_group_id,
        vehicle_group_name: evRows[0].vehicle_group_name,
        is_ev_assignment: true
      };
      await hydrateEVAssignmentDetails(a, date);
      return res.status(200).json(a);
    }

    return res.status(200).json(null);
  } catch (err) {
    console.error('Get driver today assignment error:', err);
    return res.status(500).json({ error: 'Error fetching assignment' });
  }
}

async function getDriverTodayAssignments(req, res) {
  try {
    let driverID = req.query.driver_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID || !date) {
      return res.status(400).json({ error: 'driver_id and date required' });
    }

    const assignments = [];

    // 1. Regular assignments
    const [rows] = await db.query(`
      SELECT 
        a.id, v.id as vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        s.name as shift_name, 
        TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
        TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
        DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
        DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
        DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
        a.status,
        a.is_temporary_replacement,
        a.original_driver_id,
        COALESCE(u_orig.full_name, '') as original_driver_name,
        COALESCE((SELECT rv.vehicle_number FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_number,
        COALESCE((SELECT COALESCE(rv.vehicle_name, rv.vehicle_number) FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_name,
        COALESCE(b.start_point, '') as route_from,
        COALESCE(b.end_point, '') as route_to
      FROM assignments a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      JOIN shifts s ON a.shift_id = s.id
      LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
      LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
      WHERE a.driver_id = ? 
        AND ? BETWEEN a.start_date AND a.end_date
      ORDER BY s.start_time ASC
    `, [driverID, date]);

    for (const r of rows || []) {
      assignments.push({
        id: r.id,
        vehicle_id: r.vehicle_id,
        vehicle_name: r.vehicle_name,
        vehicle_number: r.vehicle_number,
        vehicle_type: r.vehicle_type,
        shift_name: r.shift_name,
        start_time: r.start_time,
        end_time: r.end_time,
        assigned_date: r.assigned_date,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
        is_temporary_replacement: Boolean(r.is_temporary_replacement),
        original_driver_id: r.original_driver_id,
        original_driver_name: r.original_driver_name,
        replacement_vehicle_number: r.replacement_vehicle_number,
        replacement_vehicle_name: r.replacement_vehicle_name,
        route_from: r.route_from,
        route_to: r.route_to
      });
    }

    // 2. EV cluster assignments
    try {
      const [evRows] = await db.query(`
        SELECT 
          ev.id, 
          COALESCE(s.name, 'EV Duty') as shift_name, 
          COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '08:00 AM') as start_time,
          COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '05:00 PM') as end_time,
          ? as assigned_date,
          DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
          DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date,
          ev.status,
          dc.id as driver_group_id,
          dc.name as driver_group_name,
          vg.id as vehicle_group_id,
          vg.name as vehicle_group_name
        FROM ev_assignments ev
        JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
        JOIN driver_clusters dc ON ev.cluster_id = dc.id
        JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
        LEFT JOIN shifts s ON s.id = ev.shift_id
        WHERE dcm.driver_id = ? 
          AND ? BETWEEN ev.start_date AND ev.end_date
          AND ev.status = 'active'
        GROUP BY ev.id
      `, [date, date, driverID, date]);

      for (const ev of evRows || []) {
        const a = {
          id: ev.id,
          vehicle_id: 0,
          vehicle_name: ev.vehicle_group_name,
          vehicle_number: ev.vehicle_group_name,
          vehicle_type: 'EV',
          shift_name: ev.shift_name,
          start_time: ev.start_time,
          end_time: ev.end_time,
          assigned_date: ev.assigned_date,
          start_date: ev.start_date,
          end_date: ev.end_date,
          status: ev.status,
          is_temporary_replacement: false,
          original_driver_id: null,
          original_driver_name: '',
          driver_group_id: ev.driver_group_id,
          driver_group_name: ev.driver_group_name,
          vehicle_group_id: ev.vehicle_group_id,
          vehicle_group_name: ev.vehicle_group_name,
          is_ev_assignment: true
        };
        await hydrateEVAssignmentDetails(a, date);
        assignments.push(a);
      }
    } catch (evErr) {
      console.error('EV assignment query error:', evErr);
    }

    // 3. Temporary assignments
    try {
      const [tempRows] = await db.query(`
        SELECT 
          ta.id, v.id as vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
          COALESCE(s.name, 'EV Duty') as shift_name, 
          COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '08:00 AM') as start_time,
          COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '05:00 PM') as end_time,
          DATE_FORMAT(?, '%d-%m-%Y') as assigned_date,
          DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
          DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
          ta.status,
          1 as is_temporary_replacement,
          ta.original_driver_id,
          COALESCE(u_orig.full_name, '') as original_driver_name,
          COALESCE(b.start_point, '') as route_from,
          COALESCE(b.end_point, '') as route_to
        FROM temporary_assignments ta
        JOIN vehicles v ON ta.vehicle_id = v.id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        LEFT JOIN buses b ON b.vehicle_id = v.id
        LEFT JOIN shifts s ON ta.shift_id = s.id
        LEFT JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
        LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
        WHERE ta.replacement_driver_id = ? AND ta.status = 'active'
          AND ? BETWEEN ta.start_date AND ta.end_date
      `, [date, driverID, date]);

      for (const t of tempRows || []) {
        assignments.push({
          id: t.id,
          vehicle_id: t.vehicle_id,
          vehicle_name: t.vehicle_name,
          vehicle_number: t.vehicle_number,
          vehicle_type: t.vehicle_type,
          shift_name: t.shift_name,
          start_time: t.start_time,
          end_time: t.end_time,
          assigned_date: t.assigned_date,
          start_date: t.start_date,
          end_date: t.end_date,
          status: t.status,
          is_temporary_replacement: true,
          original_driver_id: t.original_driver_id,
          original_driver_name: t.original_driver_name,
          route_from: t.route_from,
          route_to: t.route_to
        });
      }
    } catch (tempErr) {
      console.error('Temp assignment query error:', tempErr);
    }

    return res.status(200).json(assignments);
  } catch (err) {
    console.error('Get today assignments error:', err);
    return res.status(500).json({ error: 'Error fetching assignments' });
  }
}

async function getDriverAssignments(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const filterDate = req.query.date;
    const queryArgs = [driverID];
    let dateFilter = '';
    if (filterDate) {
      dateFilter = 'AND ? BETWEEN a.start_date AND a.end_date';
      queryArgs.push(filterDate);
    }

    const [rows] = await db.query(`
      SELECT 
        a.id, v.id as vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        s.name as shift_name, 
        COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '') as start_time,
        COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '') as end_time,
        DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
        DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
        DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
        a.status,
        a.is_temporary_replacement,
        a.original_driver_id,
        COALESCE(u_orig.full_name, '') as original_driver_name,
        COALESCE(a.description, '') as description,
        COALESCE((SELECT rv.vehicle_number FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_number,
        COALESCE((SELECT COALESCE(rv.vehicle_name, rv.vehicle_number) FROM vehicle_replacements vr
                  JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
                  WHERE vr.vehicle_id = a.vehicle_id AND vr.status IN ('approved', 'active')
                  ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_name,
        COALESCE(b.start_point, '') as route_from,
        COALESCE(b.end_point, '') as route_to
      FROM assignments a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      JOIN shifts s ON a.shift_id = s.id
      LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
      LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
      WHERE a.driver_id = ? ${dateFilter}
      ORDER BY a.start_date DESC
    `, queryArgs);

    const assignments = (rows || []).map(r => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      vehicle_name: r.vehicle_name,
      vehicle_number: r.vehicle_number,
      vehicle_type: r.vehicle_type,
      shift_name: r.shift_name,
      start_time: r.start_time,
      end_time: r.end_time,
      assigned_date: r.assigned_date,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      is_temporary_replacement: Boolean(r.is_temporary_replacement),
      original_driver_id: r.original_driver_id,
      original_driver_name: r.original_driver_name,
      description: r.description,
      replacement_vehicle_number: r.replacement_vehicle_number,
      replacement_vehicle_name: r.replacement_vehicle_name,
      route_from: r.route_from,
      route_to: r.route_to
    }));

    return res.status(200).json(assignments);
  } catch (err) {
    console.error('Get driver assignments error:', err);
    return res.status(500).json({ error: 'Error fetching assignments' });
  }
}

async function getBusRouteInfo(req, res) {
  try {
    const vehicleID = req.params.vehicle_id;
    if (!vehicleID) {
      return res.status(400).json({ error: 'vehicle_id required' });
    }

    const [buses] = await db.query(`
      SELECT COALESCE(b.start_point, '') as start_point, COALESCE(b.end_point, '') as end_point
      FROM buses b WHERE b.vehicle_id = ?
    `, [vehicleID]);

    const routeFrom = buses[0]?.start_point || '';
    const routeTo = buses[0]?.end_point || '';

    const [rows] = await db.query(`
      SELECT 
        bs.id, bs.stop_name, bs.stop_order, 
        COALESCE(bs.fee, 0) as fee, COALESCE(bs.distance_km, 0) as distance_km,
        COALESCE(TIME_FORMAT(bs.arrival_time, '%h:%i %p'), '') as arrival_time,
        COUNT(st.id) as student_count
      FROM bus_stops bs
      LEFT JOIN buses b ON b.vehicle_id = bs.vehicle_id
      LEFT JOIN student_transport st ON st.bus_id = b.id AND st.stop_id = bs.id AND st.status = 'active'
      WHERE bs.vehicle_id = ?
      GROUP BY bs.id, bs.stop_name, bs.stop_order, bs.fee, bs.distance_km, bs.arrival_time
      ORDER BY bs.stop_order ASC
    `, [vehicleID]);

    let totalStudents = 0;
    const stops = (rows || []).map(s => {
      const count = Number(s.student_count || 0);
      totalStudents += count;
      return {
        id: s.id,
        stop_name: s.stop_name,
        stop_order: s.stop_order,
        fee: Number(s.fee || 0),
        distance_km: Number(s.distance_km || 0),
        arrival_time: s.arrival_time,
        student_count: count
      };
    });

    return res.status(200).json({
      vehicle_id: parseInt(vehicleID, 10),
      route_from: routeFrom,
      route_to: routeTo,
      total_students: totalStudents,
      stops: stops
    });
  } catch (err) {
    console.error('Get bus route info error:', err);
    return res.status(500).json({ error: 'Error fetching route info' });
  }
}

module.exports = {
  getDriverTodayAssignment,
  getDriverTodayAssignments,
  getDriverAssignments,
  getBusRouteInfo
};
