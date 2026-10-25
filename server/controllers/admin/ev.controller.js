const db = require('../../config/db');

function parseDateAny(str) {
  if (!str) return new Date();
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  return new Date(s);
}

function formatDateISO(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function splitInitials(name) {
  if (!name) return '';
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  let init = '';
  for (const w of words) {
    if (w.length > 0) init += w[0].toUpperCase();
  }
  return init.substring(0, 2);
}

// GET /api/admin/ev-vehicles
async function getEVVehicles(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.fuel_type, v.seating_capacity, v.status,
             COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      WHERE v.fuel_type = 'EV'
      ORDER BY v.vehicle_number
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getEVVehicles error:', err);
    return res.status(500).json({ error: 'Error fetching EV vehicles' });
  }
}

// GET /api/admin/ev-assignments
async function getEVAssignments(req, res) {
  try {
    const legacyDate = String(req.query.date || '').trim();
    let filterRange = String(req.query.range || 'today').trim().toLowerCase();
    const customStartDate = String(req.query.start_date || '').trim();
    const customEndDate = String(req.query.end_date || '').trim();

    const now = new Date();
    const today = formatDateISO(now);

    let rangeStart = '';
    let rangeEnd = '';

    if (legacyDate) {
      rangeStart = legacyDate;
      rangeEnd = legacyDate;
    } else {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      switch (filterRange) {
        case 'today':
          rangeStart = formatDateISO(dayStart);
          rangeEnd = rangeStart;
          break;
        case 'week': {
          let weekday = dayStart.getDay();
          if (weekday === 0) weekday = 7;
          const weekStart = new Date(dayStart);
          weekStart.setDate(weekStart.getDate() - (weekday - 1));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          rangeStart = formatDateISO(weekStart);
          rangeEnd = formatDateISO(weekEnd);
          break;
        }
        case 'month': {
          const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
          const monthEnd = new Date(dayStart.getFullYear(), dayStart.getMonth() + 1, 0);
          rangeStart = formatDateISO(monthStart);
          rangeEnd = formatDateISO(monthEnd);
          break;
        }
        case 'all':
          break;
        case 'custom':
          rangeStart = customStartDate || formatDateISO(dayStart);
          rangeEnd = customEndDate || rangeStart;
          break;
        default:
          rangeStart = formatDateISO(dayStart);
          rangeEnd = rangeStart;
      }

      if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
        const tmp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = tmp;
      }
    }

    let query = `
      SELECT 
        ea.id, 
        ea.vehicle_group_id,
        COALESCE(vg.name, 'Unknown Group') as vehicle_group_name,
        ea.cluster_id, 
        c.name as cluster_name,
        DATE_FORMAT(ea.start_date, '%d-%m-%Y') as start_date, 
        DATE_FORMAT(ea.end_date, '%d-%m-%Y') as end_date, 
        ea.status,
        ea.shift_id,
        COALESCE(s.name, 'Default') as shift_name,
        TIME_FORMAT(s.start_time, '%h:%i %p') as shift_start_time,
        TIME_FORMAT(s.end_time, '%h:%i %p') as shift_end_time,
        DATE_FORMAT(ea.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM ev_assignments ea
      LEFT JOIN vehicle_groups vg ON ea.vehicle_group_id = vg.id
      JOIN driver_clusters c ON ea.cluster_id = c.id
      LEFT JOIN shifts s ON ea.shift_id = s.id
    `;

    const args = [];
    if (rangeStart && rangeEnd) {
      query += ' WHERE ea.start_date <= ? AND ea.end_date >= ?';
      args.push(rangeEnd, rangeStart);
    }
    query += ' ORDER BY ea.start_date DESC, ea.id DESC';

    const [rows] = await db.query(query, args);

    const assignments = [];
    for (const a of rows || []) {
      const item = {
        id: a.id,
        vehicle_group_id: a.vehicle_group_id,
        vehicle_group_name: a.vehicle_group_name,
        cluster_id: a.cluster_id,
        cluster_name: a.cluster_name,
        start_date: a.start_date,
        end_date: a.end_date,
        status: a.status,
        shift_id: a.shift_id || null,
        shift_name: a.shift_name || 'Default',
        shift_start_time: a.shift_start_time || '',
        shift_end_time: a.shift_end_time || '',
        created_at: a.created_at,
        vehicles: [],
        drivers: [],
        driver_count: 0,
        driver_status: 'not_marked'
      };

      // Vehicles in group
      const [vRows] = await db.query(`
        SELECT v.id, v.vehicle_number, vt.type as vehicle_type 
        FROM vehicle_group_members vgm
        JOIN vehicles v ON v.id = vgm.vehicle_id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        WHERE vgm.group_id = ? AND ? BETWEEN vgm.valid_from AND vgm.valid_to
      `, [a.vehicle_group_id, today]);

      (vRows || []).forEach(v => {
        item.vehicles.push({
          id: v.id,
          vehicle_number: v.vehicle_number,
          vehicle_type: v.vehicle_type,
          group_id: a.vehicle_group_id
        });
      });

      // Drivers in cluster
      const [dCountRows] = await db.query(
        'SELECT COUNT(DISTINCT dcm.driver_id) as count FROM driver_cluster_members dcm WHERE dcm.cluster_id = ? AND ? BETWEEN dcm.valid_from AND dcm.valid_to',
        [a.cluster_id, today]
      );
      item.driver_count = dCountRows[0] ? dCountRows[0].count : 0;

      const [driverRows] = await db.query(`
        SELECT d.id as driver_id, u.full_name as driver_name,
               CASE WHEN EXISTS(
                     SELECT 1 FROM leave_requests lr
                     WHERE lr.driver_id = d.id
                       AND lr.status = 'admin_approved'
                       AND ? BETWEEN lr.start_date AND lr.end_date
                   ) THEN 'on_leave'
                  ELSE COALESCE((
                     SELECT att.status FROM attendance att
                     WHERE att.user_id = d.user_id AND att.date = ?
                   ), 'active')
               END as status,
               EXISTS(SELECT 1 FROM leave_requests lr
                      WHERE lr.driver_id = d.id
                      AND lr.status = 'admin_approved'
                      AND ? BETWEEN lr.start_date AND lr.end_date) as on_leave
        FROM driver_cluster_members dcm
        JOIN drivers d ON d.id = dcm.driver_id
        JOIN users u ON d.user_id = u.id
        WHERE dcm.cluster_id = ? AND ? BETWEEN dcm.valid_from AND dcm.valid_to
      `, [today, today, today, a.cluster_id, today]);

      let hasPresent = false;
      let hasAbsent = false;
      let hasActive = false;

      (driverRows || []).forEach(d => {
        const onLeave = d.on_leave === 1;
        item.drivers.push({
          driver_id: d.driver_id,
          driver_name: d.driver_name,
          status: d.status,
          on_leave: onLeave
        });
        if (d.status === 'present') hasPresent = true;
        else if (d.status === 'absent') hasAbsent = true;
        else if (d.status === 'active') hasActive = true;
      });

      const parsedStart = parseDateAny(a.start_date);
      const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (parsedStart > todayMorning) {
        item.driver_status = 'scheduled';
      } else if (hasPresent) {
        item.driver_status = 'present';
      } else if (hasAbsent && !hasActive) {
        item.driver_status = 'absent';
      }

      assignments.push(item);
    }

    return res.status(200).json(assignments);
  } catch (err) {
    console.error('getEVAssignments error:', err);
    return res.status(500).json({ error: 'Error fetching EV assignments' });
  }
}

// POST /api/admin/ev-assignments/create
async function createEVAssignment(req, res) {
  try {
    const { vehicle_group_id, cluster_id, shift_id, shift_ids, start_date, end_date, force_assign } = req.body;

    if (!vehicle_group_id || !cluster_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Vehicle Group, Cluster, and Dates are required' });
    }

    const [clusterRows] = await db.query('SELECT 1 FROM driver_clusters WHERE id = ?', [cluster_id]);
    if (!clusterRows || clusterRows.length === 0) {
      return res.status(400).json({ error: 'Invalid cluster' });
    }

    const [drivers] = await db.query(`
      SELECT d.id, u.full_name 
      FROM driver_cluster_members dcm
      JOIN drivers d ON d.id = dcm.driver_id
      JOIN users u ON d.user_id = u.id 
      WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
    `, [cluster_id]);

    if (!drivers || drivers.length === 0) {
      return res.status(400).json({ error: 'Cluster has no drivers' });
    }

    let shiftIDList = Array.isArray(shift_ids) ? shift_ids : [];
    if (shiftIDList.length === 0 && shift_id > 0) {
      shiftIDList = [parseInt(shift_id, 10)];
    }

    const primaryShiftId = shiftIDList.length > 0 ? shiftIDList[0] : null;

    const [result] = await db.query(`
      INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status, shift_id)
      VALUES (?, ?, ?, ?, 'active', ?)
    `, [vehicle_group_id, cluster_id, start_date, end_date, primaryShiftId]);

    const msg = force_assign
      ? 'EV assignment created successfully (forced)'
      : 'EV assignment created successfully';

    return res.status(200).json({ message: msg, id: result.insertId });
  } catch (err) {
    console.error('createEVAssignment error:', err);
    return res.status(500).json({ error: 'Error creating EV assignment' });
  }
}

// DELETE /api/admin/ev-assignments/delete
async function deleteEVAssignment(req, res) {
  try {
    let id = req.query.id || (req.body ? req.body.id : null);
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    id = parseInt(id, 10);

    const [rows] = await db.query('SELECT id FROM ev_assignments WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await db.query('DELETE FROM ev_assignments WHERE id = ?', [id]);
    return res.status(200).json({ message: 'EV assignment deleted' });
  } catch (err) {
    console.error('deleteEVAssignment error:', err);
    return res.status(500).json({ error: 'Failed to delete EV assignment' });
  }
}

// GET /api/admin/ev-assignments/:id/details
async function getEVAssignmentDetails(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const [rows] = await db.query(`
      SELECT ea.id, ea.vehicle_group_id,
             COALESCE(vg.name, 'Unknown Group') as vehicle_group_name,
             ea.cluster_id, c.name as cluster_name,
             DATE_FORMAT(ea.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(ea.end_date, '%d-%m-%Y') as end_date,
             DATE_FORMAT(ea.start_date, '%Y-%m-%d') as raw_start_date,
             DATE_FORMAT(ea.end_date, '%Y-%m-%d') as raw_end_date,
             ea.status,
             COALESCE(s.name, 'Default') as shift_name,
             COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '') as shift_start_time,
             COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '') as shift_end_time,
             DATE_FORMAT(ea.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM ev_assignments ea
      LEFT JOIN vehicle_groups vg ON ea.vehicle_group_id = vg.id
      JOIN driver_clusters c ON ea.cluster_id = c.id
      LEFT JOIN shifts s ON ea.shift_id = s.id
      WHERE ea.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = rows[0];

    const [vRows] = await db.query(`
      SELECT v.id, v.vehicle_number, vt.type as vehicle_type 
      FROM vehicle_group_members vgm
      JOIN vehicles v ON v.id = vgm.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE vgm.group_id = ? AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
    `, [assignment.vehicle_group_id]);

    const vehicles = (vRows || []).map(v => ({
      id: v.id,
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      group_id: assignment.vehicle_group_id
    }));
    const vehicleIds = vehicles.map(v => v.id);

    // Calculate days
    const startDate = parseDateAny(assignment.start_date);
    const endDate = parseDateAny(assignment.end_date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysTotal = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    let daysRemaining = 0;
    let daysCompleted = 0;

    if (today < startDate) {
      daysRemaining = daysTotal;
      daysCompleted = 0;
    } else if (today > endDate) {
      daysRemaining = 0;
      daysCompleted = daysTotal;
    } else {
      daysCompleted = Math.round((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
      daysRemaining = daysTotal - daysCompleted;
    }

    // Drivers
    const [driverRows] = await db.query(`
      SELECT d.id as driver_id, u.full_name as driver_name,
             CASE WHEN EXISTS(
                     SELECT 1 FROM leave_requests lr
                     WHERE lr.driver_id = d.id
                       AND lr.status = 'admin_approved'
                       AND CURDATE() BETWEEN lr.start_date AND lr.end_date
                 ) THEN 'on_leave'
                ELSE COALESCE((
                   SELECT att.status FROM attendance att
                   WHERE att.user_id = d.user_id AND att.date = CURDATE()
                 ), 'active')
             END as status,
             EXISTS(SELECT 1 FROM leave_requests lr
                    WHERE lr.driver_id = d.id
                    AND lr.status = 'admin_approved'
                    AND CURDATE() BETWEEN lr.start_date AND lr.end_date) as on_leave
      FROM driver_cluster_members dcm
      JOIN drivers d ON d.id = dcm.driver_id
      JOIN users u ON d.user_id = u.id
      WHERE dcm.cluster_id = ? AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      ORDER BY u.full_name
    `, [assignment.cluster_id]);

    const drivers = [];
    for (const d of driverRows || []) {
      let driverTotalKm = 0;
      if (vehicleIds.length > 0) {
        const placeholders = vehicleIds.map(() => '?').join(',');
        const [kmRows] = await db.query(`
          SELECT COALESCE(SUM(total_km), 0) as total
          FROM km_logs 
          WHERE driver_id = ? 
          AND date BETWEEN ? AND ?
          AND vehicle_id IN (${placeholders})
        `, [d.driver_id, assignment.raw_start_date, assignment.raw_end_date, ...vehicleIds]);
        driverTotalKm = kmRows[0] ? parseFloat(kmRows[0].total || 0) : 0;
      }

      drivers.push({
        driver_id: d.driver_id,
        driver_name: d.driver_name,
        initials: splitInitials(d.driver_name),
        status: d.status,
        on_leave: d.on_leave === 1,
        total_km: driverTotalKm
      });
    }

    // Total KM across all group vehicles
    let totalKm = 0;
    if (vehicleIds.length > 0) {
      const placeholders = vehicleIds.map(() => '?').join(',');
      const [allKm] = await db.query(`
        SELECT COALESCE(SUM(total_km), 0) as total
        FROM km_logs
        WHERE date BETWEEN ? AND ?
        AND vehicle_id IN (${placeholders})
      `, [assignment.raw_start_date, assignment.raw_end_date, ...vehicleIds]);
      totalKm = allKm[0] ? parseFloat(allKm[0].total || 0) : 0;
    }

    // Recent KM logs
    const kmLogs = [];
    if (vehicleIds.length > 0) {
      const placeholders = vehicleIds.map(() => '?').join(',');
      const [logRows] = await db.query(`
        SELECT kl.id, DATE_FORMAT(kl.date, '%d-%m-%Y') as date, 
               u.full_name as driver_name, kl.start_km, kl.end_km, kl.total_km, v.vehicle_number
        FROM km_logs kl
        JOIN drivers d ON kl.driver_id = d.id
        JOIN users u ON d.user_id = u.id
        JOIN vehicles v ON kl.vehicle_id = v.id
        WHERE kl.vehicle_id IN (${placeholders})
        AND kl.date BETWEEN ? AND ?
        ORDER BY kl.date DESC, kl.id DESC
        LIMIT 10
      `, [...vehicleIds, assignment.raw_start_date, assignment.raw_end_date]);

      (logRows || []).forEach(l => {
        kmLogs.push({
          id: l.id,
          date: l.date,
          driver_name: l.driver_name,
          start_km: parseFloat(l.start_km || 0),
          end_km: parseFloat(l.end_km || 0),
          total_km: parseFloat(l.total_km || 0),
          vehicle_number: l.vehicle_number
        });
      });
    }

    return res.status(200).json({
      id: assignment.id,
      vehicle_group_id: assignment.vehicle_group_id,
      vehicle_group_name: assignment.vehicle_group_name,
      cluster_id: assignment.cluster_id,
      cluster_name: assignment.cluster_name,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      status: assignment.status,
      shift_name: assignment.shift_name,
      shift_start_time: assignment.shift_start_time,
      shift_end_time: assignment.shift_end_time,
      created_at: assignment.created_at,
      days_total: daysTotal,
      days_remaining: daysRemaining,
      days_completed: daysCompleted,
      vehicles,
      drivers,
      km_logs: kmLogs,
      total_km: totalKm
    });
  } catch (err) {
    console.error('getEVAssignmentDetails error:', err);
    return res.status(500).json({ error: 'Failed to fetch assignment details' });
  }
}

// POST /api/admin/ev-assignments/reassign
async function reassignEVAssignment(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { assignment_id, new_cluster_id, start_date, end_date, reason } = req.body;

    if (!assignment_id || !new_cluster_id || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const [rows] = await db.query(`
      SELECT vehicle_group_id, cluster_id, 
             DATE_FORMAT(start_date, '%Y-%m-%d') as orig_start,
             DATE_FORMAT(end_date, '%Y-%m-%d') as orig_end,
             status
      FROM ev_assignments 
      WHERE id = ?
    `, [assignment_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { vehicle_group_id, cluster_id: origClusterId, orig_start: origStart, orig_end: origEnd } = rows[0];

    await connection.beginTransaction();

    if (start_date > origStart) {
      const dayBefore = new Date(parseDateAny(start_date));
      dayBefore.setDate(dayBefore.getDate() - 1);
      await connection.query('UPDATE ev_assignments SET end_date = ? WHERE id = ?', [formatDateISO(dayBefore), assignment_id]);
    } else {
      const dayAfter = new Date(parseDateAny(end_date));
      dayAfter.setDate(dayAfter.getDate() + 1);
      await connection.query('UPDATE ev_assignments SET start_date = ? WHERE id = ?', [formatDateISO(dayAfter), assignment_id]);
    }

    await connection.query(`
      INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'active')
    `, [vehicle_group_id, new_cluster_id, start_date, end_date]);

    if (end_date < origEnd) {
      const dayAfter = new Date(parseDateAny(end_date));
      dayAfter.setDate(dayAfter.getDate() + 1);
      await connection.query(`
        INSERT INTO ev_assignments (vehicle_group_id, cluster_id, start_date, end_date, status)
        VALUES (?, ?, ?, ?, 'active')
      `, [vehicle_group_id, origClusterId, formatDateISO(dayAfter), origEnd]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'EV assignment reassigned successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('reassignEVAssignment error:', err);
    return res.status(500).json({ error: 'Failed to complete reassignment' });
  } finally {
    connection.release();
  }
}

module.exports = {
  getEVVehicles,
  getEVAssignments,
  createEVAssignment,
  deleteEVAssignment,
  getEVAssignmentDetails,
  reassignEVAssignment
};
