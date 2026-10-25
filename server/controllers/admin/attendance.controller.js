const db = require('../../config/db');

// Helper to upsert single attendance record
async function upsertAttendanceRecord(userId, date, status, checkinTime, markedBy, conn = db) {
  let finalCheckin = null;
  if (checkinTime) {
    finalCheckin = checkinTime;
  } else if (status === 'present') {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    finalCheckin = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  await conn.query(`
    INSERT INTO attendance (user_id, date, status, checkin_time, marked_by)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE status=VALUES(status), checkin_time=VALUES(checkin_time), marked_by=VALUES(marked_by)
  `, [userId, date, status, finalCheckin, markedBy || null]);

  await conn.query('UPDATE users SET status=? WHERE id=?', [status, userId]);
}

// GET /api/admin/attendance
async function getAttendance(req, res) {
  try {
    const { date, status, start_date, end_date } = req.query;

    if (start_date && end_date && start_date !== end_date) {
      // Range query
      const [rows] = await db.query(`
        WITH RECURSIVE date_range AS (
          SELECT ? AS d
          UNION ALL
          SELECT d + INTERVAL 1 DAY FROM date_range WHERE d < ?
        )
        SELECT
          COALESCE(a.id, 0) as id,
          u.id as user_id,
          DATE_FORMAT(dr.d, '%d-%m-%Y') as date,
          CASE
            WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved'
              AND dr.d BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
            WHEN a.status IS NOT NULL THEN a.status
            ELSE 'not_marked'
          END as status,
          a.checkin_time,
          a.checkout_time,
          a.marked_by,
          u.full_name,
          COALESCE(marker.full_name, '') as marked_by_name
        FROM date_range dr
        CROSS JOIN drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN attendance a ON a.user_id = u.id AND a.date = dr.d
        LEFT JOIN users marker ON a.marked_by = marker.id
        LEFT JOIN leave_requests lr ON lr.driver_id = d.id
          AND lr.status = 'admin_approved'
          AND dr.d BETWEEN lr.start_date AND lr.end_date
        ORDER BY dr.d DESC, u.full_name
      `, [start_date, end_date]);

      let list = rows || [];
      if (status && status !== 'all') {
        list = list.filter(item => item.status === status);
      }
      return res.status(200).json(list);
    }

    // Single day query
    let targetDateSql = 'CURDATE()';
    const targetDateStr = start_date || date;
    const args = [];
    if (targetDateStr) {
      targetDateSql = '?';
      args.push(targetDateStr);
    }

    const query = `
      SELECT 
        COALESCE(a.id, 0) as id,
        u.id as user_id,
        DATE_FORMAT(${targetDateSql}, '%d-%m-%Y') as date,
        CASE 
          WHEN lr.id IS NOT NULL AND lr.status = 'admin_approved' 
            AND ${targetDateSql} BETWEEN lr.start_date AND lr.end_date THEN 'on_leave'
          WHEN a.status IS NOT NULL THEN a.status
          ELSE 'not_marked'
        END as status,
        a.checkin_time,
        a.checkout_time,
        a.marked_by,
        u.full_name,
        COALESCE(marker.full_name, '') as marked_by_name
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ${targetDateSql}
      LEFT JOIN users marker ON a.marked_by = marker.id
      LEFT JOIN leave_requests lr ON lr.driver_id = d.id 
        AND lr.status = 'admin_approved'
        AND ${targetDateSql} BETWEEN lr.start_date AND lr.end_date
      ORDER BY u.full_name
    `;

    // Args need to be duplicated for each placeholder in the query if targetDateStr is supplied
    const fullArgs = targetDateStr ? [targetDateStr, targetDateStr, targetDateStr, targetDateStr] : [];
    const [rows] = await db.query(query, fullArgs);

    let list = rows || [];
    if (status && status !== 'all') {
      list = list.filter(item => item.status === status);
    }
    return res.status(200).json(list);
  } catch (err) {
    console.error('getAttendance error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/attendance/mark
async function markAttendance(req, res) {
  try {
    const { user_id, date, status, checkin_time } = req.body;
    if (!user_id || !date || !status) {
      return res.status(400).json({ error: 'user_id, date and status are required' });
    }

    const markedBy = req.user ? req.user.user_id : null;
    await upsertAttendanceRecord(user_id, date, status, checkin_time, markedBy);

    return res.status(200).json({ message: 'Attendance marked' });
  } catch (err) {
    console.error('markAttendance error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/attendance/mark-bulk
async function markAttendanceBulk(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { date, updates } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates cannot be empty' });
    }

    const markedBy = req.user ? req.user.user_id : null;

    await connection.beginTransaction();

    for (const item of updates) {
      if (!item.user_id || !item.status) {
        await connection.rollback();
        return res.status(400).json({ error: 'each update must include user_id and status' });
      }

      const st = item.status;
      if (!['present', 'absent', 'on_leave', 'not_marked'].includes(st)) {
        await connection.rollback();
        return res.status(400).json({ error: 'invalid status in updates' });
      }

      await upsertAttendanceRecord(item.user_id, date, st, item.checkin_time, markedBy, connection);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Attendance updates saved', updated_count: updates.length });
  } catch (err) {
    await connection.rollback();
    console.error('markAttendanceBulk error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  getAttendance,
  markAttendance,
  markAttendanceBulk
};
