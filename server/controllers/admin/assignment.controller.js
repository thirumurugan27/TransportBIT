const db = require('../../config/db');
const { syncVehicleStatus } = require('../../services/vehicleSync.service');
const { createTemporaryAssignment } = require('./temporaryAssignment.controller');

function timeToSeconds(tStr) {
  if (!tStr) return 0;
  let s = String(tStr).trim();
  if (s.length === 5) s += ':00';
  const parts = s.split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function timesOverlap(start1, end1, start2, end2) {
  const s1 = timeToSeconds(start1);
  const e1 = timeToSeconds(end1);
  const s2 = timeToSeconds(start2);
  const e2 = timeToSeconds(end2);
  return s1 < e2 && e1 > s2;
}

function parseDate(s) {
  if (!s) return new Date();
  const parts = String(s).split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function checkDriverTimeConflict(driverId, shiftStartTime, shiftEndTime, checkDate) {
  const query = `
    SELECT s.start_time, s.end_time
    FROM assignments a
    JOIN shifts s ON a.shift_id = s.id
    WHERE a.driver_id = ?
    AND ? BETWEEN a.start_date AND a.end_date
    AND a.status IN ('assigned','active')
    
    UNION ALL
    
    SELECT s.start_time, s.end_time
    FROM temporary_assignments ta
    JOIN shifts s ON ta.shift_id = s.id
    WHERE ta.replacement_driver_id = ?
    AND ? BETWEEN ta.start_date AND ta.end_date
    AND ta.status = 'active'

    UNION ALL

    SELECT s.start_time, s.end_time
    FROM ev_assignments ev
    JOIN driver_clusters dc ON ev.cluster_id = dc.id
    JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
    JOIN drivers d ON d.id = dcm.driver_id
    JOIN shifts s ON ev.shift_id = s.id
    WHERE d.id = ?
    AND ? BETWEEN ev.start_date AND ev.end_date
    AND ev.status IN ('active')
  `;

  const [rows] = await db.query(query, [
    driverId, checkDate,
    driverId, checkDate,
    checkDate, driverId, checkDate
  ]);

  for (const r of rows || []) {
    if (r.start_time && r.end_time) {
      if (timesOverlap(shiftStartTime, shiftEndTime, r.start_time, r.end_time)) {
        return true;
      }
    }
  }

  // Check vehicle requests
  try {
    const [vrRows] = await db.query(`
      SELECT vr.OnwardFromDateTime, 
             COALESCE(NULLIF(vr.OnwardTodateTime,''), vr.OnwardFromDateTime) as end_dt
      FROM vehiclerequests vr
      WHERE vr.driver_id = ?
      AND vr.status IN ('assigned','trip_started')
      AND vr.OnwardFromDateTime IS NOT NULL
      AND TRIM(vr.OnwardFromDateTime) != ''
      AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
      AND SUBSTRING(TRIM(vr.OnwardFromDateTime), 1, 10) <= ?
      AND SUBSTRING(COALESCE(NULLIF(TRIM(vr.OnwardTodateTime),''), TRIM(vr.OnwardFromDateTime)), 1, 10) >= ?
    `, [driverId, checkDate, checkDate]);

    for (const vr of vrRows || []) {
      let vrStartTime = '00:00';
      let vrEndTime = '23:59';
      if (vr.OnwardFromDateTime && vr.OnwardFromDateTime.length > 11) {
        vrStartTime = vr.OnwardFromDateTime.substring(11, 16);
      }
      if (vr.end_dt && vr.end_dt.length > 11) {
        vrEndTime = vr.end_dt.substring(11, 16);
      }
      if (timesOverlap(shiftStartTime, shiftEndTime, vrStartTime, vrEndTime)) {
        return true;
      }
    }
  } catch (vrErr) {
    console.error('Error checking vehicle request time conflict:', vrErr.message);
  }

  return false;
}

async function checkVehicleTimeConflict(vehicleId, checkStart, checkEnd, checkDate) {
  const [rows] = await db.query(`
    SELECT a.id, s.name AS shift_name,
           s.start_time, s.end_time,
           DATE_FORMAT(a.start_date,'%d-%m-%Y') AS start_date,
           DATE_FORMAT(a.end_date,'%d-%m-%Y') AS end_date,
           u.full_name AS driver_name,
           'assignment' AS assignment_type
    FROM assignments a
    JOIN shifts s ON a.shift_id = s.id
    JOIN drivers d ON a.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    WHERE a.vehicle_id = ?
      AND a.status IN ('active','assigned')
      AND ? BETWEEN a.start_date AND a.end_date

    UNION ALL

    SELECT ta.id, s.name AS shift_name,
           s.start_time, s.end_time,
           DATE_FORMAT(ta.start_date,'%d-%m-%Y') AS start_date,
           DATE_FORMAT(ta.end_date,'%d-%m-%Y') AS end_date,
           u.full_name AS driver_name,
           'temporary' AS assignment_type
    FROM temporary_assignments ta
    JOIN shifts s ON ta.shift_id = s.id
    JOIN drivers d ON ta.replacement_driver_id = d.id
    JOIN users u ON d.user_id = u.id
    WHERE ta.vehicle_id = ?
      AND ta.status IN ('active','assigned')
      AND ? BETWEEN ta.start_date AND ta.end_date
  `, [vehicleId, checkDate, vehicleId, checkDate]);

  let hasConflict = false;
  const conflicts = [];
  const seen = new Set();

  for (const r of rows || []) {
    if (!r.start_time || !r.end_time) continue;
    if (timesOverlap(checkStart, checkEnd, r.start_time, r.end_time)) {
      const key = `${r.assignment_type}_${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hasConflict = true;
      conflicts.push({
        assignment_id: r.id,
        shift_name: r.shift_name,
        start_time: r.start_time,
        end_time: r.end_time,
        start_date: r.start_date,
        end_date: r.end_date,
        driver_name: r.driver_name,
        assignment_type: r.assignment_type
      });
    }
  }

  return { hasConflict, conflicts };
}

async function getDriverConflictsDetails(driverId, checkDate, checkRanges) {
  const out = [];
  const seen = new Set();

  const [rows] = await db.query(`
    SELECT a.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, s.name as shift_name,
           s.start_time, s.end_time,
           DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
           DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date, 'REGULAR' as assignment_type
    FROM assignments a
    JOIN vehicles v ON a.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN shifts s ON a.shift_id = s.id
    WHERE a.driver_id = ?
    AND ? BETWEEN a.start_date AND a.end_date
    AND a.status IN ('assigned','active')
    
    UNION ALL
    
    SELECT ta.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, CONCAT(s.name, ' (Temp)') as shift_name,
           s.start_time, s.end_time,
           DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
           DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date, 'TEMP_REPLACEMENT' as assignment_type
    FROM temporary_assignments ta
    JOIN vehicles v ON ta.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN shifts s ON ta.shift_id = s.id
    WHERE ta.replacement_driver_id = ?
    AND ? BETWEEN ta.start_date AND ta.end_date
    AND ta.status = 'active'
    
    UNION ALL
    
    SELECT ev.id, COALESCE(vg.name, 'EV Group') as vehicle_number, 'EV' as vehicle_type, CONCAT('EV: ', dc.name) as shift_name,
           s.start_time, s.end_time,
           DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
           DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date, 'EV_CLUSTER' as assignment_type
    FROM ev_assignments ev
    LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
    JOIN driver_clusters dc ON ev.cluster_id = dc.id
    JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND ? BETWEEN dcm.valid_from AND dcm.valid_to
    JOIN drivers d ON d.id = dcm.driver_id
    JOIN shifts s ON ev.shift_id = s.id
    WHERE d.id = ?
    AND ? BETWEEN ev.start_date AND ev.end_date
    AND ev.status IN ('active')
  `, [
    driverId, checkDate,
    driverId, checkDate,
    checkDate, driverId, checkDate
  ]);

  for (const r of rows || []) {
    if (!r.start_time || !r.end_time) continue;
    let conflicted = false;
    for (const cr of checkRanges) {
      if (timesOverlap(cr.start, cr.end, r.start_time, r.end_time)) {
        conflicted = true;
        break;
      }
    }
    if (conflicted) {
      const key = `${r.assignment_type}_${r.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          assignment_id: r.id,
          vehicle_number: r.vehicle_number,
          vehicle_type: r.vehicle_type,
          shift_name: r.shift_name,
          start_time: r.start_time,
          end_time: r.end_time,
          start_date: r.start_date,
          end_date: r.end_date,
          assignment_type: r.assignment_type
        });
      }
    }
  }

  // Check vehicle requests
  try {
    const [vrRows] = await db.query(`
      SELECT vr.id, COALESCE(v.vehicle_number,'N/A') as vehicle_number, 
             COALESCE(vt.type,'') as vehicle_type,
             vr.OnwardFromDateTime, COALESCE(vr.OnwardTodateTime,'') as onward_to,
             COALESCE(u.full_name,'') as faculty_name, COALESCE(vr.Purpose,'') as purpose
      FROM vehiclerequests vr
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE vr.driver_id = ?
      AND vr.status IN ('assigned','trip_started')
      AND vr.OnwardFromDateTime IS NOT NULL
      AND TRIM(vr.OnwardFromDateTime) != ''
      AND CHAR_LENGTH(TRIM(vr.OnwardFromDateTime)) >= 10
      AND SUBSTRING(TRIM(vr.OnwardFromDateTime), 1, 10) <= ?
      AND SUBSTRING(COALESCE(NULLIF(TRIM(vr.OnwardTodateTime),''), TRIM(vr.OnwardFromDateTime)), 1, 10) >= ?
    `, [driverId, checkDate, checkDate]);

    for (const vr of vrRows || []) {
      let vrStartTime = '00:00';
      let vrEndTime = '23:59';
      if (vr.OnwardFromDateTime && vr.OnwardFromDateTime.length > 11) {
        vrStartTime = vr.OnwardFromDateTime.substring(11, 16);
      }
      const endDT = vr.onward_to || vr.OnwardFromDateTime;
      if (endDT && endDT.length > 11) {
        vrEndTime = endDT.substring(11, 16);
      }

      let conflicted = false;
      for (const cr of checkRanges) {
        if (timesOverlap(cr.start, cr.end, vrStartTime, vrEndTime)) {
          conflicted = true;
          break;
        }
      }

      if (conflicted) {
        let shiftName = `Vehicle Request #${vr.id}`;
        if (vr.purpose) {
          shiftName = `VR #${vr.id}: ${vr.purpose}`;
          if (shiftName.length > 40) {
            shiftName = shiftName.substring(0, 37) + '...';
          }
        }
        out.push({
          assignment_id: vr.id,
          vehicle_number: vr.vehicle_number,
          vehicle_type: vr.vehicle_type,
          shift_name: shiftName,
          start_time: vrStartTime,
          end_time: vrEndTime,
          start_date: vr.OnwardFromDateTime.substring(0, 10),
          end_date: endDT.substring(0, 10),
          assignment_type: 'VEHICLE_REQUEST',
          faculty_name: vr.faculty_name
        });
      }
    }
  } catch (vrErr) {
    console.error('Error fetching VR conflict details:', vrErr.message);
  }

  return out;
}

// GET /api/admin/assignments
async function getAllAssignments(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.shift_id, a.vehicle_id, a.driver_id, 
             DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
             DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
             a.status,
             a.is_temporary_replacement,
             a.original_driver_id,
             a.created_by,
             s.name AS shift_name, 
             TIME_FORMAT(s.start_time, '%h:%i %p') as start_time, 
             TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
             v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
             COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
             u.full_name AS driver_name,
             COALESCE(u_orig.full_name, '') as original_driver_name,
             COALESCE(u_created.full_name, '') as created_by_name,
             CASE 
                 WHEN a.start_date > CURDATE() THEN 'scheduled'
                 WHEN EXISTS(SELECT 1 FROM leave_requests lr 
                             WHERE lr.driver_id = a.driver_id 
                             AND lr.status = 'admin_approved'
                             AND CURDATE() BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
                 WHEN att.status = 'present' THEN 'present'
                 WHEN att.status = 'absent' THEN 'absent'
                 ELSE 'not_marked'
             END AS driver_status,
             v.status as vehicle_status,
             COALESCE((SELECT rv.vehicle_number FROM vehicle_replacements vr 
                       JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id 
                       WHERE vr.vehicle_id = a.vehicle_id AND vr.status = 'approved' 
                       ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_number
      FROM assignments a
      JOIN shifts s ON a.shift_id = s.id
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON v.id = b.vehicle_id
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
      LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
      LEFT JOIN users u_created ON a.created_by = u_created.id
      LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
      ORDER BY a.start_date DESC, a.id DESC
    `);

    const list = (rows || []).map(a => ({
      ...a,
      is_temporary_replacement: a.is_temporary_replacement === 1
    }));

    // Fetch active temporary assignments
    const [tempRows] = await db.query(`
      SELECT ta.id, COALESCE(ta.shift_id, 0) as shift_id, ta.vehicle_id, ta.replacement_driver_id as driver_id, 
             DATE_FORMAT(ta.start_date, '%d-%m-%Y') as assigned_date,
             DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
             ta.status,
             ta.original_driver_id,
             COALESCE(s.name, 'EV Cluster') AS shift_name, 
             COALESCE(TIME_FORMAT(s.start_time, '%h:%i %p'), '08:00 AM') as start_time, 
             COALESCE(TIME_FORMAT(s.end_time, '%h:%i %p'), '05:00 PM') as end_time,
             v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
             COALESCE(v.vehicle_name, '') as vehicle_name,
             u.full_name AS driver_name,
             COALESCE(u_orig.full_name, '') as original_driver_name,
             v.status as vehicle_status,
             COALESCE((SELECT rv.vehicle_number FROM vehicle_replacements vr 
                       JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id 
                       WHERE vr.vehicle_id = ta.vehicle_id AND vr.status = 'approved' 
                       ORDER BY vr.created_at DESC LIMIT 1), '') as replacement_vehicle_number
      FROM temporary_assignments ta
      LEFT JOIN shifts s ON ta.shift_id = s.id
      JOIN vehicles v ON ta.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      JOIN drivers d ON ta.replacement_driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
      LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
      WHERE ta.status = 'active'
      ORDER BY ta.start_date DESC, ta.id DESC
    `);

    (tempRows || []).forEach(ta => {
      list.push({
        ...ta,
        driver_status: 'active',
        is_temporary_replacement: true
      });
    });

    return res.status(200).json(list);
  } catch (err) {
    console.error('getAllAssignments error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/assignments/create
async function createAssignment(req, res) {
  try {
    const {
      driver_id,
      vehicle_id,
      shift_id,
      shift_ids,
      start_date,
      end_date,
      is_temporary_replacement,
      original_driver_id,
      force_assign,
      description
    } = req.body;

    const createdBy = req.user ? req.user.user_id : (req.body.created_by || null);

    let shiftIDList = Array.isArray(shift_ids) ? shift_ids : [];
    if (shiftIDList.length === 0 && shift_id > 0) {
      shiftIDList = [parseInt(shift_id, 10)];
    }

    if (is_temporary_replacement && original_driver_id) {
      req.tempReq = {
        original_driver_id,
        replacement_driver_id: driver_id,
        shift_id: shiftIDList.length > 0 ? shiftIDList[0] : null,
        vehicle_id,
        start_date,
        end_date,
        reason: 'Temporary replacement',
        created_by: createdBy
      };
      return createTemporaryAssignment(req, res);
    }

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    if (shiftIDList.length === 0) {
      return res.status(400).json({ error: 'At least one shift is required' });
    }

    if (!vehicle_id) {
      return res.status(400).json({ error: 'Vehicle is required' });
    }

    const [vRows] = await db.query(`
      SELECT vt.type
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.id = ?
    `, [vehicle_id]);

    if (!vRows || vRows.length === 0) {
      return res.status(400).json({ error: 'Invalid vehicle' });
    }

    // Gather time ranges for all selected shifts
    const allRanges = {};
    for (const sid of shiftIDList) {
      const [slotRows] = await db.query(
        'SELECT start_time, end_time FROM shift_slots WHERE shift_id = ? ORDER BY slot_order ASC',
        [sid]
      );
      let ranges = [];
      if (slotRows && slotRows.length > 0) {
        ranges = slotRows.map(s => ({ start: s.start_time, end: s.end_time }));
      } else {
        const [sRows] = await db.query('SELECT start_time, end_time FROM shifts WHERE id = ?', [sid]);
        if (sRows && sRows.length > 0 && sRows[0].start_time && sRows[0].end_time) {
          ranges.push({ start: sRows[0].start_time, end: sRows[0].end_time });
        }
      }
      allRanges[sid] = ranges;
    }

    // Check inter-shift conflicts
    if (shiftIDList.length > 1) {
      for (let i = 0; i < shiftIDList.length; i++) {
        for (let j = i + 1; j < shiftIDList.length; j++) {
          for (const r1 of allRanges[shiftIDList[i]] || []) {
            for (const r2 of allRanges[shiftIDList[j]] || []) {
              if (timesOverlap(r1.start, r1.end, r2.start, r2.end)) {
                const [n1Rows] = await db.query('SELECT name FROM shifts WHERE id = ?', [shiftIDList[i]]);
                const [n2Rows] = await db.query('SELECT name FROM shifts WHERE id = ?', [shiftIDList[j]]);
                const name1 = n1Rows[0] ? n1Rows[0].name : '';
                const name2 = n2Rows[0] ? n2Rows[0].name : '';
                return res.status(409).json({
                  error: 'time_conflict',
                  message: `Selected shifts have overlapping times: "${name1}" conflicts with "${name2}"`
                });
              }
            }
          }
        }
      }
    }

    // Check driver conflict across date range
    let hasConflict = false;
    let conflictDate = '';
    let conflictRanges = [];

    const startD = parseDate(start_date);
    const endD = parseDate(end_date);

    for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
      const checkDate = formatDate(cur);
      for (const sid of shiftIDList) {
        for (const r of allRanges[sid] || []) {
          const hc = await checkDriverTimeConflict(driver_id, r.start, r.end, checkDate);
          if (hc) {
            hasConflict = true;
            conflictDate = checkDate;
            conflictRanges = allRanges[sid];
            break;
          }
        }
        if (hasConflict) break;
      }
      if (hasConflict) break;
    }

    if (hasConflict && !force_assign) {
      const conflicts = await getDriverConflictsDetails(driver_id, conflictDate, conflictRanges);
      return res.status(409).json({
        error: 'time_conflict',
        message: `Driver is already assigned during this time range (conflict on ${conflictDate})`,
        conflicts
      });
    }

    // Check vehicle conflict across date range
    if (!force_assign) {
      let vehicleConflictFound = false;
      let vehicleConflictDate = '';
      let vehicleConflictDetails = [];

      for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
        const checkDate = formatDate(cur);
        for (const sid of shiftIDList) {
          for (const r of allRanges[sid] || []) {
            const { hasConflict: vcHas, conflicts: vcList } = await checkVehicleTimeConflict(vehicle_id, r.start, r.end, checkDate);
            if (vcHas) {
              vehicleConflictFound = true;
              vehicleConflictDate = checkDate;
              vehicleConflictDetails = vcList;
              break;
            }
          }
          if (vehicleConflictFound) break;
        }
        if (vehicleConflictFound) break;
      }

      if (vehicleConflictFound) {
        return res.status(409).json({
          error: 'vehicle_conflict',
          message: `Vehicle is already assigned during this time range (conflict on ${vehicleConflictDate})`,
          conflicts: vehicleConflictDetails
        });
      }
    }

    // Create assignments
    for (const sid of shiftIDList) {
      if (force_assign) {
        await db.query(`
          INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, created_by, description)
          VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?)
          ON DUPLICATE KEY UPDATE driver_id=VALUES(driver_id), start_date=VALUES(start_date), end_date=VALUES(end_date), status='assigned', created_by=VALUES(created_by), description=VALUES(description)
        `, [sid, vehicle_id, driver_id, start_date, start_date, end_date, createdBy, description || null]);
      } else {
        await db.query(`
          INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, created_by, description)
          VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?)
        `, [sid, vehicle_id, driver_id, start_date, start_date, end_date, createdBy, description || null]);
      }
    }

    const msg = shiftIDList.length > 1
      ? `${shiftIDList.length} assignments created successfully (one per shift)`
      : 'Assignment created successfully';

    syncVehicleStatus(vehicle_id).catch(() => {});
    return res.status(200).json({ message: msg });
  } catch (err) {
    console.error('createAssignment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/assignments/update
async function updateAssignment(req, res) {
  try {
    const { id, shift_id, vehicle_id, driver_id, assigned_date, status } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    await db.query(`
      UPDATE assignments SET shift_id=?, vehicle_id=?, driver_id=?, assigned_date=?, status=?
      WHERE id=?
    `, [shift_id, vehicle_id, driver_id, assigned_date, status, id]);

    if (vehicle_id > 0) {
      syncVehicleStatus(vehicle_id).catch(() => {});
    }

    return res.status(200).json({ message: 'Assignment updated successfully' });
  } catch (err) {
    console.error('updateAssignment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/assignments/cancel
async function cancelAssignment(req, res) {
  try {
    let id = req.query.id || (req.body ? req.body.id : null);
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    id = parseInt(id, 10);
    const [rows] = await db.query('SELECT vehicle_id, COALESCE(status, \'\') as status FROM assignments WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const st = String(rows[0].status || '').trim().toLowerCase();
    if (st === 'cancelled') {
      return res.status(200).json({ message: 'Assignment already cancelled' });
    }
    if (st === 'completed') {
      return res.status(400).json({ error: 'Completed assignments cannot be cancelled' });
    }

    await db.query('UPDATE assignments SET status = \'cancelled\', updated_at = NOW() WHERE id = ?', [id]);

    if (rows[0].vehicle_id > 0) {
      syncVehicleStatus(rows[0].vehicle_id).catch(() => {});
    }

    return res.status(200).json({ message: 'Assignment cancelled successfully' });
  } catch (err) {
    console.error('cancelAssignment error:', err);
    return res.status(500).json({ error: 'Failed to cancel assignment' });
  }
}

// DELETE /api/admin/assignments/delete?id=X
async function deleteAssignment(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const [rows] = await db.query('SELECT vehicle_id FROM assignments WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await db.query('DELETE FROM assignments WHERE id = ?', [id]);

    if (rows[0].vehicle_id > 0) {
      syncVehicleStatus(rows[0].vehicle_id).catch(() => {});
    }

    return res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('deleteAssignment error:', err);
    return res.status(500).json({ error: 'Failed to delete assignment' });
  }
}

// POST /api/admin/assignments/reassign-for-leave
async function reassignForLeave(req, res) {
  try {
    const { assignment_id, new_driver_id, start_date, end_date } = req.body;
    const createdBy = req.user ? req.user.user_id : null;

    const [rows] = await db.query(`
      SELECT shift_id, vehicle_id, driver_id, 
        DATE_FORMAT(start_date, '%d-%m-%Y') as originalStart,
        DATE_FORMAT(end_date, '%d-%m-%Y') as originalEnd
      FROM assignments WHERE id = ?
    `, [assignment_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { shift_id, vehicle_id, driver_id: originalDriverID, originalStart, originalEnd } = rows[0];

    if (start_date > originalStart) {
      await db.query(`
        UPDATE assignments SET end_date = DATE_SUB(?, INTERVAL 1 DAY)
        WHERE id = ?
      `, [start_date, assignment_id]);
    } else if (start_date === originalStart) {
      await db.query(`
        UPDATE assignments SET start_date = ?
        WHERE id = ?
      `, [end_date, assignment_id]);
    }

    await db.query(`
      INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, is_temporary_replacement, original_driver_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'assigned', 1, ?, ?)
    `, [shift_id, vehicle_id, new_driver_id, start_date, start_date, end_date, originalDriverID, createdBy]);

    if (end_date < originalEnd) {
      await db.query(`
        INSERT INTO assignments (shift_id, vehicle_id, driver_id, assigned_date, start_date, end_date, status, created_by)
        VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 1 DAY), DATE_ADD(?, INTERVAL 1 DAY), ?, 'assigned', ?)
      `, [shift_id, vehicle_id, originalDriverID, end_date, end_date, originalEnd, createdBy]);
    }

    return res.status(200).json({ message: 'Assignment reassigned successfully' });
  } catch (err) {
    console.error('reassignForLeave error:', err);
    return res.status(500).json({ error: 'Failed to reassign assignment' });
  }
}

// GET /api/admin/assignments/check-driver-conflict
async function checkDriverConflictAPI(req, res) {
  try {
    const driverIdStr = req.query.driver_id;
    const shiftIdStr = req.query.shift_id;
    const shiftIdsStr = req.query.shift_ids;
    let startDate = req.query.start_date || req.query.date;
    let endDate = req.query.end_date || startDate;

    if (!driverIdStr || !startDate) {
      return res.status(400).json({ error: 'driver_id and date (or start_date) are required' });
    }

    const driverId = parseInt(driverIdStr, 10);
    const shiftIds = [];
    if (shiftIdsStr) {
      shiftIdsStr.split(',').forEach(p => {
        const id = parseInt(p.trim(), 10);
        if (id > 0) shiftIds.push(id);
      });
    } else if (shiftIdStr) {
      const id = parseInt(shiftIdStr, 10);
      if (id > 0) shiftIds.push(id);
    }

    if (shiftIds.length === 0) {
      return res.status(400).json({ error: 'shift_id or shift_ids is required' });
    }

    const ranges = [];
    for (const sid of shiftIds) {
      const [sRows] = await db.query('SELECT start_time, end_time FROM shifts WHERE id = ?', [sid]);
      if (sRows && sRows.length > 0 && sRows[0].start_time && sRows[0].end_time) {
        ranges.push({ start: sRows[0].start_time, end: sRows[0].end_time });
      }
    }

    if (ranges.length === 0) {
      return res.status(400).json({ error: 'Could not determine shift times' });
    }

    const startD = parseDate(startDate);
    const endD = parseDate(endDate);

    let hasConflict = false;
    let conflictDate = '';

    for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
      const checkDate = formatDate(cur);
      for (const r of ranges) {
        const c = await checkDriverTimeConflict(driverId, r.start, r.end, checkDate);
        if (c) {
          hasConflict = true;
          conflictDate = checkDate;
          break;
        }
      }
      if (hasConflict) break;
    }

    let conflicts = [];
    if (hasConflict) {
      conflicts = await getDriverConflictsDetails(driverId, conflictDate, ranges);
    }

    return res.status(200).json({
      conflict: hasConflict,
      conflict_date: conflictDate,
      conflicts
    });
  } catch (err) {
    console.error('checkDriverConflictAPI error:', err);
    return res.status(500).json({ error: 'Error checking conflict' });
  }
}

// GET /api/admin/assignments/check-vehicle-conflict
async function checkVehicleConflictAPI(req, res) {
  try {
    const vehicleIdStr = req.query.vehicle_id;
    const shiftIdStr = req.query.shift_id;
    const shiftIdsStr = req.query.shift_ids;
    let startDate = req.query.start_date || req.query.date;
    let endDate = req.query.end_date || startDate;

    if (!vehicleIdStr || !startDate) {
      return res.status(400).json({ error: 'vehicle_id and date (or start_date) are required' });
    }

    const vehicleId = parseInt(vehicleIdStr, 10);
    const shiftIds = [];
    if (shiftIdsStr) {
      shiftIdsStr.split(',').forEach(p => {
        const id = parseInt(p.trim(), 10);
        if (id > 0) shiftIds.push(id);
      });
    } else if (shiftIdStr) {
      const id = parseInt(shiftIdStr, 10);
      if (id > 0) shiftIds.push(id);
    }

    if (shiftIds.length === 0) {
      return res.status(400).json({ error: 'shift_id or shift_ids is required' });
    }

    const ranges = [];
    for (const sid of shiftIds) {
      const [sRows] = await db.query('SELECT start_time, end_time FROM shifts WHERE id = ?', [sid]);
      if (sRows && sRows.length > 0 && sRows[0].start_time && sRows[0].end_time) {
        ranges.push({ start: sRows[0].start_time, end: sRows[0].end_time });
      }
    }

    if (ranges.length === 0) {
      return res.status(400).json({ error: 'Could not determine shift times' });
    }

    const startD = parseDate(startDate);
    const endD = parseDate(endDate);

    let hasConflict = false;
    let conflictDate = '';
    let conflicts = [];

    for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
      const checkDate = formatDate(cur);
      for (const r of ranges) {
        const { hasConflict: vcHas, conflicts: vcList } = await checkVehicleTimeConflict(vehicleId, r.start, r.end, checkDate);
        if (vcHas) {
          hasConflict = true;
          conflictDate = checkDate;
          conflicts = vcList;
          break;
        }
      }
      if (hasConflict) break;
    }

    return res.status(200).json({
      conflict: hasConflict,
      conflict_date: conflictDate,
      conflicts
    });
  } catch (err) {
    console.error('checkVehicleConflictAPI error:', err);
    return res.status(500).json({ error: 'Error checking vehicle conflict' });
  }
}

// GET /api/admin/assignments/:id
async function getAssignmentDetails(req, res) {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    if (!assignmentId) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const isTemp = req.query.is_temp === 'true';

    if (isTemp) {
      const [rows] = await db.query(`
        SELECT ta.id, ta.shift_id, ta.vehicle_id, ta.original_driver_id, ta.replacement_driver_id,
               DATE_FORMAT(ta.start_date, '%d-%m-%Y') as start_date,
               DATE_FORMAT(ta.end_date, '%d-%m-%Y') as end_date,
               COALESCE(ta.reason, '') as reason,
               ta.status,
               ta.created_by,
               s.name AS shift_name,
               TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
               TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
               v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
               COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
               u_orig.full_name as original_driver_name,
               u_repl.full_name as replacement_driver_name,
               COALESCE(u_created.full_name, '') as created_by_name
        FROM temporary_assignments ta
        JOIN shifts s ON ta.shift_id = s.id
        JOIN vehicles v ON ta.vehicle_id = v.id
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        JOIN drivers d_orig ON ta.original_driver_id = d_orig.id
        JOIN users u_orig ON d_orig.user_id = u_orig.id
        JOIN drivers d_repl ON ta.replacement_driver_id = d_repl.id
        JOIN users u_repl ON d_repl.user_id = u_repl.id
        LEFT JOIN users u_created ON ta.created_by = u_created.id
        WHERE ta.id = ?
      `, [assignmentId]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Temporary assignment not found' });
      }

      const a = rows[0];
      const [slotRows] = await db.query(`
        SELECT TIME_FORMAT(start_time, '%h:%i %p') as start_time, TIME_FORMAT(end_time, '%h:%i %p') as end_time
        FROM shift_slots
        WHERE shift_id = ?
        ORDER BY slot_order ASC
      `, [a.shift_id]);

      return res.status(200).json({
        assignment: a,
        slots: slotRows || [],
        is_temporary: true,
        assignment_type: 'temporary'
      });
    }

    const [rows] = await db.query(`
      SELECT a.id, a.shift_id, a.vehicle_id, a.driver_id,
             DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
             DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
             a.status,
             CASE
                 WHEN a.status = 'cancelled' THEN COALESCE(DATE_FORMAT(a.updated_at, '%d-%m-%Y %h:%i %p'), '')
                 ELSE ''
             END as cancelled_at,
             a.is_temporary_replacement,
             a.original_driver_id,
             a.created_by,
             s.name AS shift_name,
             TIME_FORMAT(s.start_time, '%h:%i %p') as start_time,
             TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
             v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
             COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
             u.full_name AS driver_name,
             COALESCE(u_orig.full_name, '') as original_driver_name,
             COALESCE(u_created.full_name, '') as created_by_name,
             COALESCE(a.description, '') as description
      FROM assignments a
      JOIN shifts s ON a.shift_id = s.id
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON v.id = b.vehicle_id
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN drivers d_orig ON a.original_driver_id = d_orig.id
      LEFT JOIN users u_orig ON d_orig.user_id = u_orig.id
      LEFT JOIN users u_created ON a.created_by = u_created.id
      WHERE a.id = ?
    `, [assignmentId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const a = {
      ...rows[0],
      is_temporary_replacement: rows[0].is_temporary_replacement === 1
    };

    const [slotRows] = await db.query(`
      SELECT TIME_FORMAT(start_time, '%h:%i %p') as start_time, TIME_FORMAT(end_time, '%h:%i %p') as end_time
      FROM shift_slots
      WHERE shift_id = ?
      ORDER BY slot_order ASC
    `, [a.shift_id]);

    return res.status(200).json({
      assignment: a,
      slots: slotRows || [],
      is_temporary: a.is_temporary_replacement,
      assignment_type: 'regular'
    });
  } catch (err) {
    console.error('getAssignmentDetails error:', err);
    return res.status(500).json({ error: 'Failed to fetch assignment details' });
  }
}

// GET /api/admin/assignments/by-category
async function getAssignmentsByCategory(req, res) {
  try {
    const category = req.query.category || 'BUS';
    const legacyDate = String(req.query.date || '').trim();
    let filterRange = String(req.query.range || 'today').trim().toLowerCase();
    const customStartDate = String(req.query.start_date || '').trim();
    const customEndDate = String(req.query.end_date || '').trim();

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let attendanceDate = today;
    let rangeStart = '';
    let rangeEnd = '';

    if (legacyDate) {
      rangeStart = legacyDate;
      rangeEnd = legacyDate;
      attendanceDate = legacyDate;
    } else {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      switch (filterRange) {
        case 'today':
          rangeStart = formatDate(dayStart);
          rangeEnd = rangeStart;
          break;
        case 'week': {
          let weekday = dayStart.getDay();
          if (weekday === 0) weekday = 7;
          const weekStart = new Date(dayStart);
          weekStart.setDate(weekStart.getDate() - (weekday - 1));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          rangeStart = formatDate(weekStart);
          rangeEnd = formatDate(weekEnd);
          break;
        }
        case 'month': {
          const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
          const monthEnd = new Date(dayStart.getFullYear(), dayStart.getMonth() + 1, 0);
          rangeStart = formatDate(monthStart);
          rangeEnd = formatDate(monthEnd);
          break;
        }
        case 'all':
          break;
        case 'custom':
          rangeStart = customStartDate || formatDate(dayStart);
          rangeEnd = customEndDate || rangeStart;
          break;
        default:
          rangeStart = formatDate(dayStart);
          rangeEnd = rangeStart;
      }

      if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
        const tmp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = tmp;
      }
    }

    const args = [attendanceDate];
    let whereClause = '';
    if (category === 'OTHER') {
      whereClause = "COALESCE(vt.type, '') NOT IN ('BUS', 'CAR', 'BATTERY_VEHICLE')";
    } else {
      whereClause = "COALESCE(vt.type, '') = ?";
      args.push(category);
    }

    if (rangeStart && rangeEnd) {
      whereClause += ' AND a.start_date <= ? AND a.end_date >= ?';
      args.push(rangeEnd, rangeStart);
    }

    const query = `
      SELECT a.id, DATE_FORMAT(a.assigned_date, '%d-%m-%Y') as assigned_date,
             DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
             DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
             a.status,
             d.id as driver_id, u.full_name as driver_name, 
             CASE 
                 WHEN a.assigned_date > CURDATE() THEN 'scheduled'
                 WHEN EXISTS(SELECT 1 FROM leave_requests lr 
                             WHERE lr.driver_id = a.driver_id 
                             AND lr.status = 'admin_approved'
                             AND a.assigned_date BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
                 WHEN att.status = 'present' THEN 'present'
                 WHEN att.status = 'absent' THEN 'absent'
                 ELSE 'not_marked'
             END as driver_status,
             v.id as vehicle_id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, v.fuel_type,
             COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
             s.id as shift_id, s.name as shift_name, 
             TIME_FORMAT(s.start_time, '%h:%i %p') as start_time, 
             TIME_FORMAT(s.end_time, '%h:%i %p') as end_time,
             a.original_driver_id, a.is_temporary_replacement,
             CASE WHEN a.original_driver_id IS NOT NULL THEN 
                 (SELECT u2.full_name FROM drivers d2 JOIN users u2 ON d2.user_id = u2.id WHERE d2.id = a.original_driver_id)
             ELSE NULL END as original_driver_name
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON v.id = b.vehicle_id
      JOIN shifts s ON a.shift_id = s.id
      LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = ?
      WHERE ${whereClause}
      ORDER BY a.assigned_date DESC, s.start_time
    `;

    const [rows] = await db.query(query, args);

    const assignments = [];
    for (const a of rows || []) {
      const [slotRows] = await db.query(`
        SELECT TIME_FORMAT(start_time, '%h:%i %p') as start_time, TIME_FORMAT(end_time, '%h:%i %p') as end_time
        FROM shift_slots
        WHERE shift_id = ?
        ORDER BY slot_order ASC
      `, [a.shift_id]);

      assignments.push({
        ...a,
        is_temporary_replacement: a.is_temporary_replacement === 1,
        slots: slotRows || []
      });
    }

    return res.status(200).json(assignments);
  } catch (err) {
    console.error('getAssignmentsByCategory error:', err);
    return res.status(500).json({ error: 'Error fetching assignments' });
  }
}

// GET /api/admin/assignments/absent-alerts
async function getAbsentDriverAlerts(req, res) {
  try {
    const date = req.query.date;
    const dateSql = date ? '?' : 'CURDATE()';
    const args = date ? [date] : [];

    const query = `
      SELECT a.id as assignment_id, a.assigned_date, 
             d.id as driver_id, u.full_name as driver_name, 
             v.id as vehicle_id, v.vehicle_number,
             s.id as shift_id, s.name as shift_name, s.start_time, s.end_time,
             COALESCE(dc.id, 0) as cluster_id, COALESCE(dc.name, '') as cluster_name,
             a.original_driver_id, a.is_temporary_replacement
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      JOIN vehicles v ON a.vehicle_id = v.id
      JOIN shifts s ON a.shift_id = s.id
      LEFT JOIN driver_cluster_members dcm ON dcm.driver_id = d.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN driver_clusters dc ON dcm.cluster_id = dc.id
      WHERE a.assigned_date = ${dateSql}
        AND a.status IN ('absent', 'on_leave')
      ORDER BY s.start_time
    `;

    const [rows] = await db.query(query, args);
    const list = (rows || []).map(a => ({
      ...a,
      is_temporary_replacement: a.is_temporary_replacement === 1
    }));

    return res.status(200).json(list);
  } catch (err) {
    console.error('getAbsentDriverAlerts error:', err);
    return res.status(500).json({ error: 'Error fetching alerts' });
  }
}

// GET /api/admin/available-drivers
async function getAvailableDrivers(req, res) {
  try {
    const date = req.query.date;
    const shiftID = req.query.shift_id;
    const dateSql = date ? '?' : 'CURDATE()';

    let query = `
      SELECT d.id as driver_id, u.full_name as driver_name, d.license_type, d.experience_years, COALESCE(u.status, 'active') as status,
             COALESCE(km.total_km, 0) as total_km_driven,
             CASE 
                 WHEN EXISTS(SELECT 1 FROM leave_requests lr 
                             WHERE lr.driver_id = d.id 
                             AND lr.status = 'admin_approved'
                             AND ${dateSql} BETWEEN lr.start_date AND lr.end_date) 
                 THEN 1 ELSE 0 
             END as on_leave,
             CASE 
                 WHEN EXISTS(
                     SELECT 1 FROM assignments a
                     JOIN shifts s ON a.shift_id = s.id
                     WHERE a.driver_id = d.id
                     AND ${dateSql} BETWEEN a.start_date AND a.end_date
                     AND a.status NOT IN ('cancelled', 'completed')
    `;

    const args = [];
    if (date) args.push(date); // for leave_requests
    if (date) args.push(date); // for assignments

    if (shiftID) {
      query += ` AND EXISTS (
                     SELECT 1 FROM shifts ns
                     WHERE ns.id = ?
                     AND (
                         (s.start_time < ns.end_time AND s.end_time > ns.start_time)
                     )
                 )`;
      args.push(shiftID);
    }

    query += `)
                 THEN 1 ELSE 0 
             END as already_assigned
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN (
        SELECT driver_id, SUM(total_km) as total_km
        FROM km_logs
        WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())
        GROUP BY driver_id
      ) km ON km.driver_id = d.id
      WHERE u.status = 'active'
      ORDER BY on_leave ASC, already_assigned ASC, total_km_driven ASC, d.experience_years DESC
    `;

    const [rows] = await db.query(query, args);

    const drivers = (rows || []).map(d => {
      const onLeave = d.on_leave === 1;
      const alreadyAssigned = d.already_assigned === 1;
      return {
        driver_id: d.driver_id,
        driver_name: d.driver_name,
        license_type: d.license_type,
        experience_years: d.experience_years,
        status: d.status,
        total_km_driven: parseFloat(d.total_km_driven || 0),
        on_leave: onLeave,
        already_assigned: alreadyAssigned,
        available: !onLeave && !alreadyAssigned
      };
    });

    return res.status(200).json(drivers);
  } catch (err) {
    console.error('getAvailableDrivers error:', err);
    return res.status(500).json({ error: 'Error fetching available drivers' });
  }
}

module.exports = {
  getAllAssignments,
  getAssignmentDetails,
  createAssignment,
  cancelAssignment,
  updateAssignment,
  deleteAssignment,
  reassignForLeave,
  checkDriverConflictAPI,
  checkVehicleConflictAPI,
  getAssignmentsByCategory,
  getAbsentDriverAlerts,
  getAvailableDrivers
};
