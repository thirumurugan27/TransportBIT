const db = require('../../config/db');

function parseDateAny(str) {
  if (!str) return new Date();
  const s = String(str).trim();
  // DD-MM-YYYY
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  // YYYY-MM-DD
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

async function markAttendanceForLeave(driverId, startDateStr, endDateStr) {
  try {
    const [uRows] = await db.query('SELECT user_id FROM drivers WHERE id = ?', [driverId]);
    if (!uRows || uRows.length === 0) return;
    const userId = uRows[0].user_id;

    const startDate = parseDateAny(startDateStr);
    const endDate = parseDateAny(endDateStr);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    for (let cur = new Date(startDate); cur <= endDate; cur.setDate(cur.getDate() + 1)) {
      const dateStr = formatDateISO(cur);
      const [attRows] = await db.query('SELECT status FROM attendance WHERE user_id = ? AND date = ?', [userId, dateStr]);

      if (!attRows || attRows.length === 0) {
        await db.query(`
          INSERT INTO attendance (user_id, date, status, checkin_time)
          VALUES (?, ?, 'absent', NULL)
        `, [userId, dateStr]);
      } else {
        const curStatus = attRows[0].status;
        if (curStatus === 'not_marked' || !curStatus) {
          await db.query('UPDATE attendance SET status = \'absent\' WHERE user_id = ? AND date = ?', [userId, dateStr]);
        }
      }
    }
  } catch (err) {
    console.error('markAttendanceForLeave error:', err);
  }
}

// GET /api/admin/leave/history and /api/admin/leave/all
async function getLeaveHistory(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT lr.id, lr.driver_id, u.full_name as driver_name, lr.leave_type,
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
      JOIN drivers d ON lr.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
      ORDER BY lr.created_at DESC
      LIMIT 200
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getLeaveHistory error:', err);
    return res.status(500).json({ error: 'Error fetching leave history' });
  }
}

async function getAllLeaveRequests(req, res) {
  return getLeaveHistory(req, res);
}

// GET /api/admin/leave/stats
async function getLeaveStats(req, res) {
  try {
    const stats = {
      pending: 0,
      admin_approved: 0,
      rejected: 0,
      total: 0
    };

    const [rows] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM leave_requests
      GROUP BY status
    `);

    (rows || []).forEach(r => {
      stats[r.status] = r.count;
      stats.total += r.count;
    });

    return res.status(200).json(stats);
  } catch (err) {
    console.error('getLeaveStats error:', err);
    return res.status(500).json({ error: 'Error fetching stats' });
  }
}

// GET /api/admin/leave/pending
async function getPendingLeaveRequests(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT lr.id, lr.driver_id, u.full_name as driver_name, lr.leave_type, 
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
      JOIN drivers d ON lr.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN users u_adm ON lr.admin_id = u_adm.id
      WHERE lr.status = 'pending'
      ORDER BY lr.created_at DESC
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getPendingLeaveRequests error:', err);
    return res.status(500).json({ error: 'Error fetching leave requests' });
  }
}

// POST /api/admin/leave/approve
async function approveLeave(req, res) {
  try {
    const { leave_id, status: rawStatus, approver_id, remarks } = req.body;
    const st = String(rawStatus || '').trim().toLowerCase();
    if (st !== 'approved' && st !== 'rejected') {
      return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'" });
    }

    const [rows] = await db.query(`
      SELECT status, driver_id, 
        DATE_FORMAT(start_date, '%Y-%m-%d') as raw_start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as raw_end_date,
        DATE_FORMAT(start_date, '%d-%m-%Y') as start_date, 
        DATE_FORMAT(end_date, '%d-%m-%Y') as end_date,
        admin_approved_at
      FROM leave_requests 
      WHERE id = ?
    `, [leave_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const current = rows[0];
    if (current.admin_approved_at) {
      return res.status(400).json({ error: 'This leave request has already been processed by admin' });
    }

    const newStatus = st === 'rejected' ? 'rejected' : 'approved';
    const adminId = approver_id > 0 ? approver_id : (req.user ? req.user.user_id : null);

    const [result] = await db.query(`
      UPDATE leave_requests 
      SET status = ?, 
          admin_id = ?, 
          admin_approved_at = NOW(), 
          admin_remarks = ?
      WHERE id = ?
    `, [newStatus, adminId, remarks || null, leave_id]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ error: 'Failed to update leave request' });
    }

    if (newStatus === 'approved') {
      await markAttendanceForLeave(current.driver_id, current.start_date, current.end_date);
    }

    // Send notification to driver
    const notifTitle = newStatus === 'rejected' ? 'Leave Request Rejected' : 'Leave Request Approved';
    const notifMessage = newStatus === 'rejected'
      ? `Your leave request from ${current.start_date} to ${current.end_date} has been rejected. Reason: ${remarks || 'None'}`
      : `Your leave request from ${current.start_date} to ${current.end_date} has been approved. Attendance will be automatically marked as absent.`;

    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
      VALUES ('DRIVER', ?, ?, ?, 'leave', ?)
    `, [current.driver_id, notifTitle, notifMessage, leave_id]);

    if (newStatus === 'approved') {
      // Find affected assignments
      const [affectedRows] = await db.query(`
        SELECT a.id, a.shift_id, a.vehicle_id, 
          DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
          DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
          s.name as shift_name, v.vehicle_number
        FROM assignments a
        JOIN shifts s ON a.shift_id = s.id
        JOIN vehicles v ON a.vehicle_id = v.id
        WHERE a.driver_id = ? 
        AND (
          (a.start_date <= ? AND a.end_date >= ?) OR
          (a.start_date <= ? AND a.end_date >= ?) OR
          (a.start_date >= ? AND a.end_date <= ?)
        )
        AND a.status = 'active'
      `, [
        current.driver_id,
        current.raw_end_date, current.raw_start_date,
        current.raw_start_date, current.raw_end_date,
        current.raw_start_date, current.raw_end_date
      ]);

      const affectedAssignments = [];
      for (const a of affectedRows || []) {
        const [driverRows] = await db.query(`
          SELECT d.id, u.full_name as name, u.phone, d.license_number as license
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE u.status = 'active'
          AND d.id != ?
          AND d.id NOT IN (
            SELECT driver_id FROM assignments
            WHERE (
              (start_date <= ? AND end_date >= ?) OR
              (start_date <= ? AND end_date >= ?) OR
              (start_date >= ? AND end_date <= ?)
            )
            AND status = 'active'
          )
          AND d.id NOT IN (
            SELECT driver_id FROM leave_requests
            WHERE status = 'admin_approved'
            AND (
              (start_date <= ? AND end_date >= ?) OR
              (start_date <= ? AND end_date >= ?) OR
              (start_date >= ? AND end_date <= ?)
            )
          )
          LIMIT 10
        `, [
          current.driver_id,
          current.raw_end_date, current.raw_start_date,
          current.raw_start_date, current.raw_end_date,
          current.raw_start_date, current.raw_end_date,
          current.raw_end_date, current.raw_start_date,
          current.raw_start_date, current.raw_end_date,
          current.raw_start_date, current.raw_end_date
        ]);

        affectedAssignments.push({
          ...a,
          available_drivers: driverRows || []
        });
      }

      return res.status(200).json({
        message: 'Leave request approved successfully. Attendance will be automatically marked as absent.',
        affected_assignments: affectedAssignments
      });
    }

    return res.status(200).json({ message: 'Leave request updated successfully' });
  } catch (err) {
    console.error('approveLeave error:', err);
    return res.status(500).json({ error: `Error processing leave request: ${err.message}` });
  }
}

// GET /api/admin/leave/:id/affected-assignments
async function getLeaveAffectedAssignments(req, res) {
  try {
    const leaveId = req.params.id;
    if (!leaveId) {
      return res.status(400).json({ error: 'Leave ID required' });
    }

    const [rows] = await db.query(`
      SELECT driver_id, 
        DATE_FORMAT(start_date, '%Y-%m-%d') as raw_start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as raw_end_date,
        DATE_FORMAT(start_date, '%d-%m-%Y') as start_date, 
        DATE_FORMAT(end_date, '%d-%m-%Y') as end_date
      FROM leave_requests 
      WHERE id = ?
    `, [leaveId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const { driver_id, raw_start_date, raw_end_date, start_date, end_date } = rows[0];

    const [regRows] = await db.query(`
      SELECT a.id, a.shift_id, a.vehicle_id, 
        DATE_FORMAT(a.start_date, '%d-%m-%Y') as start_date,
        DATE_FORMAT(a.end_date, '%d-%m-%Y') as end_date,
        s.name as shift_name,
        TIME_FORMAT(s.start_time, '%h:%i %p') as shift_start_time,
        TIME_FORMAT(s.end_time, '%h:%i %p') as shift_end_time,
        v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        COALESCE(v.vehicle_name, '') as vehicle_name,
        0 as is_ev_cluster, 0 as cluster_id, '' as cluster_name
      FROM assignments a
      JOIN shifts s ON a.shift_id = s.id
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON v.id = b.vehicle_id
      WHERE a.driver_id = ? 
      AND a.status IN ('active', 'assigned')
      AND (
        (a.start_date <= ? AND a.end_date >= ?) OR
        (a.start_date <= ? AND a.end_date >= ?) OR
        (a.start_date >= ? AND a.end_date <= ?)
      )
      ORDER BY a.start_date, s.start_time
    `, [driver_id, raw_start_date, raw_start_date, raw_end_date, raw_end_date, raw_start_date, raw_end_date]);

    const assignments = [...(regRows || []).map(r => ({ ...r, is_ev_cluster: false }))];

    const [evRows] = await db.query(`
      SELECT ev.id, 0 as shift_id, v.id as vehicle_id,
        DATE_FORMAT(ev.start_date, '%d-%m-%Y') as start_date,
        DATE_FORMAT(ev.end_date, '%d-%m-%Y') as end_date,
        COALESCE(dc.name, 'EV Assignment') as shift_name,
        COALESCE(TIME_FORMAT(dc.start_time, '%h:%i %p'), '') as shift_start_time,
        COALESCE(TIME_FORMAT(dc.end_time, '%h:%i %p'), '') as shift_end_time,
        v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
        COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
        1 as is_ev_cluster, dc.id as cluster_id, dc.name as cluster_name
      FROM ev_assignments ev
      JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
      JOIN vehicles v ON v.id = vgm.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      JOIN driver_clusters dc ON ev.cluster_id = dc.id
      JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
      JOIN drivers d ON d.id = dcm.driver_id
      WHERE d.id = ?
      AND ev.status = 'active'
      AND (
        (ev.start_date <= ? AND ev.end_date >= ?) OR
        (ev.start_date <= ? AND ev.end_date >= ?) OR
        (ev.start_date >= ? AND ev.end_date <= ?)
      )
      AND (vgm.valid_from IS NULL OR ev.end_date >= vgm.valid_from)
      AND (vgm.valid_to IS NULL OR ev.start_date <= vgm.valid_to)
      ORDER BY ev.start_date
    `, [driver_id, raw_start_date, raw_start_date, raw_end_date, raw_end_date, raw_start_date, raw_end_date]);

    (evRows || []).forEach(r => {
      assignments.push({ ...r, is_ev_cluster: true });
    });

    const [driverRows] = await db.query(`
      SELECT d.id, u.full_name, COALESCE(u.phone, '') as phone, 
             COALESCE(d.license_number, '') as license_number, 
             COALESCE(d.license_type, '') as license_type
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.id != ?
      AND d.id NOT IN (
        SELECT lr.driver_id FROM leave_requests lr
        WHERE lr.status IN ('approved', 'admin_approved')
        AND (
          (lr.start_date <= ? AND lr.end_date >= ?) OR
          (lr.start_date <= ? AND lr.end_date >= ?) OR
          (lr.start_date >= ? AND lr.end_date <= ?)
        )
      )
      ORDER BY u.full_name
    `, [driver_id, raw_start_date, raw_start_date, raw_end_date, raw_end_date, raw_start_date, raw_end_date]);

    return res.status(200).json({
      driver_id,
      start_date,
      end_date,
      assignments,
      available_drivers: driverRows || []
    });
  } catch (err) {
    console.error('getLeaveAffectedAssignments error:', err);
    return res.status(500).json({ error: 'Error fetching assignments' });
  }
}

// POST /api/admin/leave/approve-with-assignments
async function approveLeaveWithAssignments(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { leave_id, approver_id, remarks, temporary_assignments } = req.body;

    const [rows] = await db.query(`
      SELECT driver_id, 
        DATE_FORMAT(start_date, '%d-%m-%Y') as start_date, 
        DATE_FORMAT(end_date, '%d-%m-%Y') as end_date,
        status, admin_approved_at
      FROM leave_requests 
      WHERE id = ?
    `, [leave_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const { driver_id, start_date, end_date, status: currentStatus, admin_approved_at } = rows[0];

    if (admin_approved_at) {
      return res.status(400).json({ error: 'Leave request already processed by admin' });
    }
    if (currentStatus === 'rejected') {
      return res.status(400).json({ error: 'Cannot approve a rejected leave request' });
    }

    await connection.beginTransaction();

    const tempAssignments = Array.isArray(temporary_assignments) ? temporary_assignments : [];

    for (const ta of tempAssignments) {
      if (!ta.replacement_driver_id) continue;

      const taStart = ta.start_date || start_date;
      const taEnd = ta.end_date || end_date;
      const shiftIdVal = ta.shift_id && ta.shift_id > 0 ? ta.shift_id : null;

      await connection.query(`
        INSERT INTO temporary_assignments (
          original_driver_id, replacement_driver_id, shift_id, vehicle_id,
          start_date, end_date, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `, [driver_id, ta.replacement_driver_id, shiftIdVal, ta.vehicle_id, taStart, taEnd, 'Leave replacement']);

      // Notify replacement driver
      const [vRows] = await connection.query('SELECT vehicle_number FROM vehicles WHERE id = ?', [ta.vehicle_id]);
      const vNum = vRows[0] ? vRows[0].vehicle_number : '';

      let shiftInfo = ' - EV Cluster';
      if (ta.shift_id > 0) {
        const [sRows] = await connection.query('SELECT name FROM shifts WHERE id = ?', [ta.shift_id]);
        if (sRows[0]) shiftInfo = ` - ${sRows[0].name}`;
      }

      await connection.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type)
        VALUES ('DRIVER', ?, ?, ?, 'assignment')
      `, [
        ta.replacement_driver_id,
        'Temporary Assignment Created',
        `You have been assigned to vehicle ${vNum}${shiftInfo} from ${taStart} to ${taEnd} (covering for another driver on leave)`
      ]);
    }

    const adminId = approver_id > 0 ? approver_id : (req.user ? req.user.user_id : null);

    await connection.query(`
      UPDATE leave_requests 
      SET status = 'approved', 
          admin_id = ?, 
          admin_approved_at = NOW(), 
          admin_remarks = ?
      WHERE id = ?
    `, [adminId, remarks || null, leave_id]);

    await connection.commit();

    await markAttendanceForLeave(driver_id, start_date, end_date);

    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
      VALUES ('DRIVER', ?, ?, ?, 'leave', ?)
    `, [
      driver_id,
      'Leave Request Approved',
      `Your leave request from ${start_date} to ${end_date} has been approved. Attendance will be automatically marked as absent.`,
      leave_id
    ]);

    return res.status(200).json({
      message: 'Leave approved and temporary assignments created successfully',
      status: 'approved',
      assignments_created: tempAssignments.length
    });
  } catch (err) {
    await connection.rollback();
    console.error('approveLeaveWithAssignments error:', err);
    return res.status(500).json({ error: `Error approving leave: ${err.message}` });
  } finally {
    connection.release();
  }
}

// POST /api/admin/leave/apply
async function adminApplyLeave(req, res) {
  try {
    const { driver_id, leave_type, start_date, start_time, end_date, end_time, reason } = req.body;

    if (!driver_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields: driver_id, start_date, end_date' });
    }

    const sTime = start_time || '09:00:00';
    const eTime = end_time || '17:00:00';
    const lType = leave_type || 'Leave';

    const [dRows] = await db.query('SELECT COUNT(*) as count FROM drivers WHERE id = ?', [driver_id]);
    if (!dRows || dRows[0].count === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const [result] = await db.query(`
      INSERT INTO leave_requests
      (driver_id, leave_type, start_date, start_time, end_date, end_time, reason, status, admin_approved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'admin_approved', NOW(), NOW())
    `, [driver_id, lType, start_date, sTime, end_date, eTime, reason || null]);

    const id = result.insertId;

    await markAttendanceForLeave(driver_id, start_date, end_date);

    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
      VALUES ('DRIVER', ?, ?, ?, 'leave', ?)
    `, [
      driver_id,
      'Leave Applied by Admin',
      `Admin has applied ${lType} leave on your behalf from ${start_date} to ${end_date}. Reason: ${reason || 'None'}`,
      id
    ]);

    return res.status(200).json({
      message: 'Leave applied successfully by admin',
      id
    });
  } catch (err) {
    console.error('adminApplyLeave error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllLeaveRequests,
  getLeaveHistory,
  getLeaveStats,
  getPendingLeaveRequests,
  approveLeave,
  getLeaveAffectedAssignments,
  approveLeaveWithAssignments,
  adminApplyLeave
};
