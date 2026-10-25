const db = require('../../config/db');
const { createAdminNotification } = require('../../services/notification.service');
const { syncVehicleStatus } = require('../../services/vehicleSync.service');

/**
 * Generate 6-digit random OTP string
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if two time ranges overlap
 */
function timesOverlap(start1, end1, start2, end2) {
  const s1 = (start1 || '00:00').slice(0, 5);
  const e1 = (end1 || '23:59').slice(0, 5);
  const s2 = (start2 || '00:00').slice(0, 5);
  const e2 = (end2 || '23:59').slice(0, 5);
  return s1 < e2 && s2 < e1;
}

/**
 * Split DateTime into Date and Time
 */
function splitDateTime(dtStr) {
  if (!dtStr) return { date: '', time: '' };
  if (dtStr.length >= 10) {
    const date = dtStr.slice(0, 10);
    const time = dtStr.length > 11 ? dtStr.slice(11) : '';
    return { date, time };
  }
  return { date: dtStr, time: '' };
}

/**
 * Load Vehicle Request Schedule from trips or main table
 */
async function loadVehicleRequestSchedule(requestID) {
  try {
    const [trips] = await db.query(`
      SELECT
        DATE_FORMAT(first_leg.from_datetime, '%Y-%m-%d %H:%i:%s') AS onward_from,
        DATE_FORMAT(COALESCE(last_leg.to_datetime, first_leg.to_datetime), '%Y-%m-%d %H:%i:%s') AS onward_to
      FROM vehicle_request_trips first_leg
      LEFT JOIN (
        SELECT request_id, to_datetime
        FROM vehicle_request_trips vrt_inner
        WHERE vrt_inner.request_id = ? AND vrt_inner.trip_order = (
          SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vrt_inner.request_id
        )
      ) last_leg ON last_leg.request_id = first_leg.request_id
      WHERE first_leg.request_id = ? AND first_leg.trip_order = 1
    `, [requestID, requestID]);

    if (trips && trips.length > 0 && trips[0].onward_from) {
      return {
        onwardFrom: trips[0].onward_from,
        onwardTo: trips[0].onward_to,
        returnFrom: '',
        returnTo: ''
      };
    }

    const [vrRows] = await db.query(`
      SELECT 
        DATE_FORMAT(OnwardFromDateTime, '%Y-%m-%d %H:%i:%s') AS onward_from,
        DATE_FORMAT(OnwardTodateTime, '%Y-%m-%d %H:%i:%s') AS onward_to
      FROM vehiclerequests
      WHERE id = ?
    `, [requestID]);

    if (vrRows && vrRows.length > 0) {
      return {
        onwardFrom: vrRows[0].onward_from || '',
        onwardTo: vrRows[0].onward_to || '',
        returnFrom: '',
        returnTo: ''
      };
    }

    return { onwardFrom: '', onwardTo: '', returnFrom: '', returnTo: '' };
  } catch (e) {
    console.error('loadVehicleRequestSchedule error:', e);
    return { onwardFrom: '', onwardTo: '', returnFrom: '', returnTo: '' };
  }
}

async function getVehicleRequestRequesterName(requestID) {
  try {
    const [rows] = await db.query(`
      SELECT COALESCE(ru.full_name, u.full_name, 'Requester') AS name
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE vr.id = ?
    `, [requestID]);
    return rows?.[0]?.name || 'Requester';
  } catch (e) {
    return 'Requester';
  }
}

/**
 * Check Driver Conflict
 */
async function checkDriverConflict(driverID, onwardFrom, onwardTo, returnFrom, returnTo) {
  let tripStart = (onwardFrom || '').trim();
  let tripEnd = (onwardTo || '').trim();
  if (!tripEnd) tripEnd = tripStart;
  if ((returnTo || '').trim()) tripEnd = returnTo.trim();
  else if ((returnFrom || '').trim()) tripEnd = returnFrom.trim();

  if (!tripStart) return { hasConflict: false, conflicts: [] };

  const conflicts = [];
  const seen = new Set();

  let tripDate = tripStart.slice(0, 10);
  let tripStartTime = tripStart.length > 11 ? tripStart.slice(11, 16) : '00:00';
  let tripEndTime = tripEnd.length > 11 ? tripEnd.slice(11, 16) : '23:59';

  // 1. Conflicting vehicle requests
  const [vrRows] = await db.query(`
    SELECT vr.id, COALESCE(v.vehicle_number, 'N/A') AS vehicle_number, COALESCE(vt.type, '') AS vehicle_type,
           COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) AS onward_from,
           COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime) AS onward_to,
           COALESCE(u.full_name, '') AS faculty_name
    FROM vehiclerequests vr
    LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
    LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
      SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
    )
    LEFT JOIN vehicles v ON vr.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN faculty f ON vr.faculty_id = f.id
    LEFT JOIN users u ON f.user_id = u.id
    WHERE vr.driver_id = ?
    AND vr.status IN ('assigned', 'trip_started')
    AND COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) IS NOT NULL
    AND (
      COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) <= ?
      AND COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime, vrt.from_datetime, vr.OnwardFromDateTime) >= ?
    )
  `, [driverID, tripEnd, tripStart]);

  for (const vr of (vrRows || [])) {
    conflicts.push({
      assignment_type: 'VEHICLE_REQUEST',
      shift_name: `Vehicle Request #${vr.id}`,
      vehicle_number: vr.vehicle_number,
      vehicle_type: vr.vehicle_type,
      start_time: vr.onward_from,
      end_time: vr.onward_to,
      start_date: vr.onward_from,
      end_date: vr.onward_to,
      faculty_name: vr.faculty_name
    });
  }

  // 2. Regular assignments
  const [regRows] = await db.query(`
    SELECT a.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, s.name AS shift_name,
           s.start_time, s.end_time,
           a.start_date, a.end_date
    FROM assignments a
    JOIN vehicles v ON a.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN shifts s ON a.shift_id = s.id
    WHERE a.driver_id = ?
    AND ? BETWEEN a.start_date AND a.end_date
    AND a.status IN ('assigned', 'active')
  `, [driverID, tripDate]);

  for (const a of (regRows || [])) {
    if (a.start_time && a.end_time && timesOverlap(tripStartTime, tripEndTime, a.start_time, a.end_time)) {
      const key = `REGULAR_${a.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({
          assignment_type: 'REGULAR',
          assignment_id: a.id,
          shift_name: a.shift_name,
          vehicle_number: a.vehicle_number,
          vehicle_type: a.vehicle_type,
          start_time: a.start_time,
          end_time: a.end_time,
          start_date: a.start_date,
          end_date: a.end_date
        });
      }
    }
  }

  // 3. Temporary assignments
  const [tempRows] = await db.query(`
    SELECT ta.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, s.name AS shift_name,
           s.start_time, s.end_time,
           ta.start_date, ta.end_date
    FROM temporary_assignments ta
    JOIN vehicles v ON ta.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN shifts s ON ta.shift_id = s.id
    WHERE ta.replacement_driver_id = ?
    AND ? BETWEEN ta.start_date AND ta.end_date
  `, [driverID, tripDate]);

  for (const ta of (tempRows || [])) {
    if (ta.start_time && ta.end_time && timesOverlap(tripStartTime, tripEndTime, ta.start_time, ta.end_time)) {
      const key = `TEMP_${ta.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({
          assignment_type: 'TEMP_REPLACEMENT',
          assignment_id: ta.id,
          shift_name: ta.shift_name + ' (Temp)',
          vehicle_number: ta.vehicle_number,
          vehicle_type: ta.vehicle_type,
          start_time: ta.start_time,
          end_time: ta.end_time,
          start_date: ta.start_date,
          end_date: ta.end_date
        });
      }
    }
  }

  // 4. EV assignments
  const [evRows] = await db.query(`
    SELECT ev.id, COALESCE(vg.name, 'EV Group') AS vehicle_number, 'EV' AS vehicle_type, dc.name AS cluster_name,
           s.start_time, s.end_time,
           ev.start_date, ev.end_date
    FROM ev_assignments ev
    LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
    JOIN driver_clusters dc ON ev.cluster_id = dc.id
    JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
      AND ? BETWEEN dcm.valid_from AND dcm.valid_to
    JOIN drivers d ON d.id = dcm.driver_id
    JOIN shifts s ON ev.shift_id = s.id
    WHERE d.id = ?
    AND ? BETWEEN ev.start_date AND ev.end_date
    AND ev.status IN ('active')
  `, [tripDate, driverID, tripDate]);

  for (const ev of (evRows || [])) {
    if (ev.start_time && ev.end_time && timesOverlap(tripStartTime, tripEndTime, ev.start_time, ev.end_time)) {
      const key = `EV_${ev.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({
          assignment_type: 'EV_CLUSTER',
          assignment_id: ev.id,
          shift_name: 'EV: ' + ev.cluster_name,
          vehicle_number: ev.vehicle_number,
          vehicle_type: ev.vehicle_type,
          start_time: ev.start_time,
          end_time: ev.end_time,
          start_date: ev.start_date,
          end_date: ev.end_date
        });
      }
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

/**
 * Check Vehicle Conflict
 */
async function checkVehicleConflict(vehicleID, onwardFrom, onwardTo, returnFrom, returnTo) {
  let tripStart = (onwardFrom || '').trim();
  let tripEnd = (onwardTo || '').trim();
  if (!tripEnd) tripEnd = tripStart;
  if ((returnTo || '').trim()) tripEnd = returnTo.trim();
  else if ((returnFrom || '').trim()) tripEnd = returnFrom.trim();

  if (!tripStart) return { hasConflict: false, conflicts: [] };

  const conflicts = [];
  let tripDate = tripStart.slice(0, 10);
  let tripStartTime = tripStart.length > 11 ? tripStart.slice(11, 16) : '00:00';
  let tripEndTime = tripEnd.length > 11 ? tripEnd.slice(11, 16) : '23:59';

  // 1. Conflicting vehicle requests
  const [vrRows] = await db.query(`
    SELECT vr.id,
           COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) AS onward_from,
           COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime) AS onward_to,
           COALESCE(d.full_name, '') AS driver_name,
           COALESCE(u.full_name, '') AS faculty_name
    FROM vehiclerequests vr
    LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
    LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
      SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
    )
    LEFT JOIN drivers dr ON vr.driver_id = dr.id
    LEFT JOIN users d ON dr.user_id = d.id
    LEFT JOIN faculty f ON vr.faculty_id = f.id
    LEFT JOIN users u ON f.user_id = u.id
    WHERE vr.vehicle_id = ?
    AND vr.status IN ('assigned', 'trip_started')
    AND COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) IS NOT NULL
    AND (
      COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) <= ?
      AND COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime, vrt.from_datetime, vr.OnwardFromDateTime) >= ?
    )
  `, [vehicleID, tripEnd, tripStart]);

  for (const vr of (vrRows || [])) {
    conflicts.push({
      assignment_type: 'VEHICLE_REQUEST',
      shift_name: `Vehicle Request #${vr.id}`,
      start_time: vr.onward_from,
      end_time: vr.onward_to,
      start_date: vr.onward_from,
      end_date: vr.onward_to,
      driver_name: vr.driver_name,
      faculty_name: vr.faculty_name
    });
  }

  // 2. Regular assignments
  const [regRows] = await db.query(`
    SELECT a.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, s.name AS shift_name,
           s.start_time, s.end_time,
           a.start_date, a.end_date, COALESCE(u.full_name, '') AS driver_name
    FROM assignments a
    JOIN vehicles v ON a.vehicle_id = v.id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN shifts s ON a.shift_id = s.id
    LEFT JOIN drivers d ON a.driver_id = d.id
    LEFT JOIN users u ON d.user_id = u.id
    WHERE a.vehicle_id = ?
    AND ? BETWEEN a.start_date AND a.end_date
    AND a.status IN ('assigned', 'active')
  `, [vehicleID, tripDate]);

  for (const a of (regRows || [])) {
    if (a.start_time && a.end_time && timesOverlap(tripStartTime, tripEndTime, a.start_time, a.end_time)) {
      conflicts.push({
        assignment_type: 'REGULAR',
        assignment_id: a.id,
        shift_name: a.shift_name,
        vehicle_number: a.vehicle_number,
        vehicle_type: a.vehicle_type,
        start_time: a.start_time,
        end_time: a.end_time,
        start_date: a.start_date,
        end_date: a.end_date,
        driver_name: a.driver_name
      });
    }
  }

  // 3. EV assignments
  const [evRows] = await db.query(`
    SELECT ev.id, COALESCE(vg.name, 'EV Group') AS vehicle_number, 'EV' AS vehicle_type, dc.name AS cluster_name,
           s.start_time, s.end_time,
           ev.start_date, ev.end_date
    FROM ev_assignments ev
    LEFT JOIN vehicle_groups vg ON ev.vehicle_group_id = vg.id
    JOIN vehicle_group_members vgm ON vg.id = vgm.group_id
    JOIN driver_clusters dc ON ev.cluster_id = dc.id
    JOIN shifts s ON ev.shift_id = s.id
    WHERE vgm.vehicle_id = ?
    AND ? BETWEEN ev.start_date AND ev.end_date
    AND ev.status IN ('active')
  `, [vehicleID, tripDate]);

  for (const ev of (evRows || [])) {
    if (ev.start_time && ev.end_time && timesOverlap(tripStartTime, tripEndTime, ev.start_time, ev.end_time)) {
      conflicts.push({
        assignment_type: 'EV_CLUSTER',
        assignment_id: ev.id,
        shift_name: 'EV: ' + ev.cluster_name,
        vehicle_number: ev.vehicle_number,
        vehicle_type: ev.vehicle_type,
        start_time: ev.start_time,
        end_time: ev.end_time,
        start_date: ev.start_date,
        end_date: ev.end_date
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

/**
 * Get Available Drivers for Request
 */
async function getAvailableDriversForRequest(excludeDriverID, onwardFrom, onwardTo, returnFrom, returnTo) {
  const drivers = [];
  try {
    const [rows] = await db.query(`
      SELECT d.id, u.full_name
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE u.status != 'inactive'
      ORDER BY u.full_name ASC
    `);

    for (const r of (rows || [])) {
      if (r.id === excludeDriverID) continue;
      const { hasConflict } = await checkDriverConflict(r.id, onwardFrom, onwardTo, returnFrom, returnTo);
      drivers.push({
        id: r.id,
        full_name: r.full_name,
        available: !hasConflict
      });
    }
  } catch (e) {
    console.error('getAvailableDriversForRequest error:', e);
  }
  return drivers;
}

/**
 * GET /api/admin/vehicle-requests
 */
async function getAllVehicleRequests(req, res) {
  try {
    const statusFilter = req.query.status;

    let query = `
      SELECT 
        vr.id, COALESCE(vr.requester_id, 0) AS requester_id, COALESCE(vr.faculty_id, 0) AS faculty_id,
        COALESCE(vr.BookingType, '') AS BookingType, COALESCE(vr.TripType, '') AS TripType, '' AS TripMode,
        COALESCE(vr.RequestUnder, '') AS RequestUnder, COALESCE(vr.Purpose, vr.PurposeOfVisit, '') AS Purpose,
        COALESCE(vr.Vertical, '') AS Vertical, 0 AS OralApproval, COALESCE(vr.CountPerson, 1) AS CountPerson,
        COALESCE(vr.OnwardFromPlace, '') AS OnwardFromPlace, COALESCE(vr.OnwardToPlace, '') AS OnwardToPlace,
        COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %h:%i %p'), '') AS OnwardFromDateTime,
        COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%d-%m-%Y %h:%i %p'), '') AS OnwardToDateTime,
        '' AS ReturnFromPlace, '' AS ReturnToPlace, '' AS ReturnFromDateTime, '' AS ReturnToDateTime,
        COALESCE(vr.ContactName, '') AS ContactName, COALESCE(vr.ContactPhone, '') AS ContactPhone,
        COALESCE(vr.TaskID, '') AS TaskID, '' AS OutcomeExpected, '' AS OutcomeAuditable,
        COALESCE(vr.TravellerName, '') AS GuestName, COALESCE(vr.MobileNumber, '') AS MobileNumber, COALESCE(vr.Address, '') AS Address,
        COALESCE(vr.status, '') AS status, COALESCE(vr.admin_remarks, '') AS admin_remarks,
        vr.approved_by, 
        DATE_FORMAT(vr.approved_at, '%d-%m-%Y %h:%i %p') AS approved_at,
        DATE_FORMAT(vr.assigned_at, '%d-%m-%Y %h:%i %p') AS assigned_at,
        COALESCE(vr.start_otp, '') AS start_otp, COALESCE(vr.end_otp, '') AS end_otp,
        DATE_FORMAT(vr.start_otp_generated_at, '%d-%m-%Y %h:%i %p') AS start_otp_generated_at,
        DATE_FORMAT(vr.end_otp_generated_at, '%d-%m-%Y %h:%i %p') AS end_otp_generated_at,
        DATE_FORMAT(vr.trip_started_at, '%d-%m-%Y %h:%i %p') AS trip_started_at,
        DATE_FORMAT(vr.trip_ended_at, '%d-%m-%Y %h:%i %p') AS trip_ended_at,
        COALESCE(ru.full_name, u.full_name, '') AS requester_name,
        COALESCE(ru.email, u.email, '') AS requester_email,
        COALESCE(ru.phone, u.phone, '') AS requester_phone,
        'FACULTY' AS requester_role,
        COALESCE(u.full_name, ru.full_name, '') AS faculty_name,
        COALESCE(u.email, ru.email, '') AS faculty_email,
        COALESCE(u.phone, ru.phone, '') AS faculty_phone,
        COALESCE(f.department, rf.department, '') AS faculty_department,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        '' AS vehicle_type,
        COALESCE(v.vehicle_name, v.vehicle_number, '') AS vehicle_name,
        COALESCE(ud.full_name, '') AS driver_name,
        COALESCE(ud.phone, '') AS driver_phone,
        COALESCE(DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p'), '') AS created_at
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty rf ON rf.user_id = ru.id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      LEFT JOIN drivers d ON vr.driver_id = d.id
      LEFT JOIN users ud ON d.user_id = ud.id
    `;

    const args = [];
    if (statusFilter && statusFilter !== 'all') {
      query += ` WHERE vr.status = ?`;
      args.push(statusFilter);
    }
    query += ` ORDER BY vr.created_at DESC`;

    const [rows] = await db.query(query, args);

    const requests = [];
    for (const r of (rows || [])) {
      const [tripRows] = await db.query(`
        SELECT trip_order, COALESCE(from_place, '') AS departure_location, COALESCE(to_place, '') AS arrival_location,
               from_latitude, from_longitude, to_latitude, to_longitude,
               COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') AS departure_date,
               COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') AS departure_time,
               COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') AS arrival_date,
               COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') AS arrival_time
        FROM vehicle_request_trips
        WHERE request_id = ?
        ORDER BY trip_order ASC
      `, [r.id]);

      requests.push({
        ...r,
        trips: tripRows || []
      });
    }

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Error fetching vehicle requests:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

/**
 * GET /api/admin/vehicle-request/:id
 */
async function getVehicleRequestDetails(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const query = `
      SELECT 
        vr.id, COALESCE(vr.requester_id, 0) AS requester_id, COALESCE(vr.faculty_id, 0) AS faculty_id,
        COALESCE(vr.BookingType, '') AS BookingType, COALESCE(vr.TripType, '') AS TripType, '' AS TripMode,
        COALESCE(vr.RequestUnder, '') AS RequestUnder, COALESCE(vr.Purpose, vr.PurposeOfVisit, '') AS Purpose,
        COALESCE(vr.Vertical, '') AS Vertical, 0 AS OralApproval, COALESCE(vr.CountPerson, 1) AS CountPerson,
        COALESCE(vr.OnwardFromPlace, '') AS OnwardFromPlace, COALESCE(vr.OnwardToPlace, '') AS OnwardToPlace,
        COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%d-%m-%Y %h:%i %p'), '') AS OnwardFromDateTime,
        COALESCE(DATE_FORMAT(vr.OnwardTodateTime, '%d-%m-%Y %h:%i %p'), '') AS OnwardToDateTime,
        '' AS ReturnFromPlace, '' AS ReturnToPlace, '' AS ReturnFromDateTime, '' AS ReturnToDateTime,
        COALESCE(vr.ContactName, '') AS ContactName, COALESCE(vr.ContactPhone, '') AS ContactPhone,
        COALESCE(vr.TaskID, '') AS TaskID, '' AS OutcomeExpected, '' AS OutcomeAuditable,
        COALESCE(vr.TravellerName, '') AS GuestName, COALESCE(vr.MobileNumber, '') AS MobileNumber, COALESCE(vr.Address, '') AS Address,
        COALESCE(vr.status, '') AS status, COALESCE(vr.admin_remarks, '') AS admin_remarks,
        vr.approved_by, 
        DATE_FORMAT(vr.approved_at, '%d-%m-%Y %h:%i %p') AS approved_at,
        DATE_FORMAT(vr.assigned_at, '%d-%m-%Y %h:%i %p') AS assigned_at,
        COALESCE(vr.start_otp, '') AS start_otp, COALESCE(vr.end_otp, '') AS end_otp,
        DATE_FORMAT(vr.start_otp_generated_at, '%d-%m-%Y %h:%i %p') AS start_otp_generated_at,
        DATE_FORMAT(vr.end_otp_generated_at, '%d-%m-%Y %h:%i %p') AS end_otp_generated_at,
        DATE_FORMAT(vr.trip_started_at, '%d-%m-%Y %h:%i %p') AS trip_started_at,
        DATE_FORMAT(vr.trip_ended_at, '%d-%m-%Y %h:%i %p') AS trip_ended_at,
        COALESCE(ru.full_name, u.full_name, '') AS requester_name,
        COALESCE(ru.email, u.email, '') AS requester_email,
        COALESCE(ru.phone, u.phone, '') AS requester_phone,
        'FACULTY' AS requester_role,
        COALESCE(u.full_name, ru.full_name, '') AS faculty_name,
        COALESCE(u.email, ru.email, '') AS faculty_email,
        COALESCE(u.phone, ru.phone, '') AS faculty_phone,
        COALESCE(f.department, rf.department, '') AS faculty_department,
        COALESCE(v.vehicle_number, '') AS vehicle_number,
        '' AS vehicle_type,
        COALESCE(v.vehicle_name, v.vehicle_number, '') AS vehicle_name,
        COALESCE(ud.full_name, '') AS driver_name,
        COALESCE(ud.phone, '') AS driver_phone,
        COALESCE(DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p'), '') AS created_at
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty rf ON rf.user_id = ru.id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      LEFT JOIN drivers d ON vr.driver_id = d.id
      LEFT JOIN users ud ON d.user_id = ud.id
      WHERE vr.id = ?
    `;

    const [rows] = await db.query(query, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const r = rows[0];

    const [tripRows] = await db.query(`
      SELECT trip_order, COALESCE(from_place, '') AS departure_location, COALESCE(to_place, '') AS arrival_location,
             from_latitude, from_longitude, to_latitude, to_longitude,
             COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') AS departure_date,
             COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') AS departure_time,
             COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') AS arrival_date,
             COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') AS arrival_time
      FROM vehicle_request_trips
      WHERE request_id = ?
      ORDER BY trip_order ASC
    `, [id]);

    let trips = tripRows || [];

    if (trips.length === 0) {
      if (r.OnwardFromPlace || r.OnwardToPlace) {
        const { date: oDate, time: oTime } = splitDateTime(r.OnwardFromDateTime);
        const { date: oaDate, time: oaTime } = splitDateTime(r.OnwardToDateTime);
        trips.push({
          departure_location: r.OnwardFromPlace,
          arrival_location: r.OnwardToPlace,
          departure_date: oDate,
          departure_time: oTime,
          arrival_date: oaDate,
          arrival_time: oaTime
        });
      }
    }

    return res.status(200).json({
      ...r,
      trips
    });
  } catch (err) {
    console.error('Error fetching vehicle request details:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

/**
 * POST /api/admin/vehicle-request/approve
 */
async function approveVehicleRequest(req, res) {
  try {
    const adminID = req.userId || 1;
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;
    const { admin_remarks, vehicle_id, driver_id, force_assign } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be approved' });
    }

    const vId = parseInt(vehicle_id, 10);
    const dId = parseInt(driver_id, 10);

    if (vId > 0 && dId > 0) {
      const { onwardFrom, onwardTo, returnFrom, returnTo } = await loadVehicleRequestSchedule(request_id);

      if (onwardFrom && !force_assign) {
        const { hasConflict: driverConflict, conflicts: driverConflicts } = await checkDriverConflict(dId, onwardFrom, onwardTo, returnFrom, returnTo);
        if (driverConflict) {
          const availableDrivers = await getAvailableDriversForRequest(dId, onwardFrom, onwardTo, returnFrom, returnTo);
          const conflictDate = onwardFrom.slice(0, 10);
          return res.status(409).json({
            error: 'driver_conflict',
            message: `Driver is already assigned during this time range (conflict on ${conflictDate})`,
            conflicts: driverConflicts,
            available_drivers: availableDrivers
          });
        }

        const { hasConflict: vehicleConflict, conflicts: vehicleConflicts } = await checkVehicleConflict(vId, onwardFrom, onwardTo, returnFrom, returnTo);
        if (vehicleConflict) {
          return res.status(409).json({
            error: 'vehicle_conflict',
            message: 'Vehicle has a conflicting assignment during this time interval',
            conflicts: vehicleConflicts
          });
        }
      }

      const startOTP = generateOTP();

      await db.query(`
        UPDATE vehiclerequests 
        SET status = 'assigned', admin_remarks = ?, vehicle_id = ?, driver_id = ?,
            start_otp = ?, start_otp_generated_at = NOW(), approved_by = ?, approved_at = NOW(), assigned_at = NOW()
        WHERE id = ?
      `, [admin_remarks || null, vId, dId, startOTP, adminID, request_id]);

      const facultyName = await getVehicleRequestRequesterName(request_id);
      await createAdminNotification('vehicle_assigned', 'Vehicle Assigned', `Vehicle assigned to request #${request_id} by ${facultyName}. Start OTP sent to requester.`);

      syncVehicleStatus(vId);

      return res.status(200).json({
        message: 'Request approved and vehicle assigned successfully',
        start_otp: startOTP
      });
    }

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'approved', admin_remarks = ?, approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [admin_remarks || null, adminID, request_id]);

    return res.status(200).json({ message: 'Request approved successfully' });
  } catch (err) {
    console.error('Approve vehicle request error:', err);
    return res.status(500).json({ error: 'Failed to approve request' });
  }
}

/**
 * POST /api/admin/vehicle-request/reject
 */
async function rejectVehicleRequest(req, res) {
  try {
    const adminID = req.userId || 1;
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;
    const { admin_remarks } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'pending' && rows[0].status !== 'approved') {
      return res.status(400).json({ error: 'This request cannot be rejected' });
    }

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'rejected', admin_remarks = ?, approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [admin_remarks || null, adminID, request_id]);

    return res.status(200).json({ message: 'Request rejected' });
  } catch (err) {
    console.error('Reject vehicle request error:', err);
    return res.status(500).json({ error: 'Failed to reject request' });
  }
}

/**
 * POST /api/admin/vehicle-request/cancel
 */
async function cancelVehicleRequestByAdmin(req, res) {
  try {
    const adminID = req.userId || 1;
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;
    const { admin_remarks } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`
      SELECT status, driver_id, vehicle_id, faculty_id, requester_id,
             COALESCE(Purpose, '') AS purpose, COALESCE(BookingType, 'faculty') AS booking_type
      FROM vehiclerequests WHERE id = ?
    `, [request_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { status, driver_id, vehicle_id, faculty_id, requester_id, purpose } = rows[0];

    if (status !== 'pending' && status !== 'approved' && status !== 'assigned') {
      return res.status(400).json({ error: `This request cannot be cancelled (status: ${status})` });
    }

    if (status === 'assigned') {
      await db.query(`
        UPDATE vehiclerequests 
        SET status = 'cancelled', admin_remarks = ?, approved_by = ?, driver_id = NULL, vehicle_id = NULL
        WHERE id = ?
      `, [admin_remarks || null, adminID, request_id]);
    } else {
      await db.query(`
        UPDATE vehiclerequests 
        SET status = 'cancelled', admin_remarks = ?, approved_by = ?
        WHERE id = ?
      `, [admin_remarks || null, adminID, request_id]);
    }

    const remarkText = admin_remarks ? ` Reason: ${admin_remarks}` : '';
    const purposeText = purpose ? ` for "${purpose}"` : '';

    if (driver_id) {
      let vehicleNumber = '';
      if (vehicle_id) {
        const [v] = await db.query("SELECT COALESCE(vehicle_name, vehicle_number) AS num FROM vehicles WHERE id = ?", [vehicle_id]);
        vehicleNumber = v?.[0]?.num || '';
      }
      const driverMsg = `Vehicle request #${request_id}${purposeText} has been cancelled by admin. Your assignment to vehicle ${vehicleNumber} has been removed.${remarkText}`;
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
        VALUES ('DRIVER', ?, ?, ?, 'warning', ?)
      `, [driver_id, 'Vehicle Request Cancelled', driverMsg, request_id]);
    }

    let requesterUserID = requester_id;
    if (!requesterUserID && faculty_id) {
      const [f] = await db.query("SELECT user_id FROM faculty WHERE id = ?", [faculty_id]);
      requesterUserID = f?.[0]?.user_id;
    }

    if (requesterUserID) {
      const facultyMsg = `Your vehicle request #${request_id}${purposeText} has been cancelled by admin.${remarkText}`;
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
        VALUES ('FACULTY', ?, ?, ?, 'warning', ?)
      `, [requesterUserID, 'Vehicle Request Cancelled', facultyMsg, request_id]);
    }

    if (vehicle_id && status === 'assigned') {
      syncVehicleStatus(vehicle_id);
    }

    return res.status(200).json({ message: 'Request cancelled' });
  } catch (err) {
    console.error('Cancel vehicle request error:', err);
    return res.status(500).json({ error: 'Failed to cancel request' });
  }
}

/**
 * POST /api/admin/vehicle-request/assign
 */
async function assignVehicleToRequest(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;
    const { vehicle_id, driver_id, force_assign } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const vId = parseInt(vehicle_id, 10);
    const dId = parseInt(driver_id, 10);

    if (!vId || !dId) {
      return res.status(400).json({ error: 'Vehicle and driver are required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'approved') {
      return res.status(400).json({ error: 'Only approved requests can be assigned a vehicle' });
    }

    const { onwardFrom, onwardTo, returnFrom, returnTo } = await loadVehicleRequestSchedule(request_id);

    if (onwardFrom && !force_assign) {
      const { hasConflict: driverConflict, conflicts: driverConflicts } = await checkDriverConflict(dId, onwardFrom, onwardTo, returnFrom, returnTo);
      if (driverConflict) {
        const availableDrivers = await getAvailableDriversForRequest(dId, onwardFrom, onwardTo, returnFrom, returnTo);
        const conflictDate = onwardFrom.slice(0, 10);
        return res.status(409).json({
          error: 'driver_conflict',
          message: `Driver is already assigned during this time range (conflict on ${conflictDate})`,
          conflicts: driverConflicts,
          available_drivers: availableDrivers
        });
      }

      const { hasConflict: vehicleConflict, conflicts: vehicleConflicts } = await checkVehicleConflict(vId, onwardFrom, onwardTo, returnFrom, returnTo);
      if (vehicleConflict) {
        return res.status(409).json({
          error: 'vehicle_conflict',
          message: 'Vehicle has a conflicting assignment during this time interval',
          conflicts: vehicleConflicts
        });
      }
    }

    const startOTP = generateOTP();

    await db.query(`
      UPDATE vehiclerequests 
      SET vehicle_id = ?, driver_id = ?, status = 'assigned', assigned_at = NOW(),
          start_otp = ?, start_otp_generated_at = NOW()
      WHERE id = ?
    `, [vId, dId, startOTP, request_id]);

    const facultyName = await getVehicleRequestRequesterName(request_id);
    await createAdminNotification('vehicle_assigned', 'Vehicle Assigned', `Vehicle assigned to request #${request_id} by ${facultyName}. Start OTP sent to requester.`);

    syncVehicleStatus(vId);

    return res.status(200).json({
      message: 'Vehicle and driver assigned successfully',
      start_otp: startOTP
    });
  } catch (err) {
    console.error('Assign vehicle error:', err);
    return res.status(500).json({ error: 'Failed to assign vehicle' });
  }
}

/**
 * POST /api/admin/vehicle-request/start-trip
 */
async function startVehicleRequestTripByAdmin(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'assigned') {
      return res.status(400).json({ error: 'Trip can only be started from assigned status' });
    }

    const endOTP = generateOTP();

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'trip_started', trip_started_at = NOW(), end_otp = ?, end_otp_generated_at = NOW()
      WHERE id = ?
    `, [endOTP, request_id]);

    const facultyName = await getVehicleRequestRequesterName(request_id);
    await createAdminNotification('trip_started', 'Trip Started', `Vehicle request #${request_id} trip started by admin override for ${facultyName}.`);

    return res.status(200).json({ message: 'Trip started successfully (admin override)' });
  } catch (err) {
    console.error('Start trip error:', err);
    return res.status(500).json({ error: 'Failed to start trip' });
  }
}

/**
 * POST /api/admin/vehicle-request/end-trip
 */
async function endVehicleRequestTripByAdmin(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'trip_started') {
      return res.status(400).json({ error: 'Trip can only be ended from trip_started status' });
    }

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'completed', trip_started_at = COALESCE(trip_started_at, NOW()), trip_ended_at = NOW()
      WHERE id = ?
    `, [request_id]);

    const facultyName = await getVehicleRequestRequesterName(request_id);
    await createAdminNotification('trip_completed', 'Trip Completed', `Vehicle request #${request_id} trip ended by admin override for ${facultyName}.`);

    return res.status(200).json({ message: 'Trip ended successfully (admin override)' });
  } catch (err) {
    console.error('End trip error:', err);
    return res.status(500).json({ error: 'Failed to end trip' });
  }
}

/**
 * POST /api/admin/vehicle-request/complete
 */
async function completeVehicleRequest(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`SELECT status FROM vehiclerequests WHERE id = ?`, [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'assigned' && rows[0].status !== 'trip_started') {
      return res.status(400).json({ error: 'Only assigned or in-progress requests can be marked as completed' });
    }

    await db.query(`UPDATE vehiclerequests SET status = 'completed', trip_ended_at = NOW() WHERE id = ?`, [request_id]);

    await createAdminNotification('trip_completed', 'Trip Completed', `Vehicle request #${request_id} has been manually marked as completed by admin.`);

    return res.status(200).json({ message: 'Request marked as completed' });
  } catch (err) {
    console.error('Complete vehicle request error:', err);
    return res.status(500).json({ error: 'Failed to complete request' });
  }
}

/**
 * GET /api/admin/vehicle-requests/pending-count
 */
async function getPendingVehicleRequestCount(req, res) {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM vehiclerequests WHERE status = 'pending'`);
    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('Get pending vehicle request count error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

module.exports = {
  getAllVehicleRequests,
  getVehicleRequestDetails,
  approveVehicleRequest,
  rejectVehicleRequest,
  cancelVehicleRequestByAdmin,
  assignVehicleToRequest,
  startVehicleRequestTripByAdmin,
  endVehicleRequestTripByAdmin,
  completeVehicleRequest,
  getPendingVehicleRequestCount
};
