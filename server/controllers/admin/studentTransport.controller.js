const db = require('../../config/db');

/**
 * GET /api/admin/students - Get all students (for dropdown)
 */
async function getAllStudents(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id AS user_id, u.id, u.full_name, COALESCE(u.email, '') AS email, COALESCE(u.phone, '') AS phone,
        CASE WHEN st.id IS NOT NULL THEN 1 ELSE 0 END AS has_transport
      FROM users u
      LEFT JOIN student_transport st ON st.user_id = u.id AND st.status = 'active'
      WHERE u.role = 'STUDENT'
      ORDER BY u.full_name
    `);

    const students = (rows || []).map(s => ({
      id: s.user_id,
      user_id: s.user_id,
      full_name: s.full_name,
      email: s.email,
      phone: s.phone,
      has_transport: Boolean(s.has_transport)
    }));

    return res.status(200).json(students);
  } catch (err) {
    console.error('Error fetching students:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
}

/**
 * POST /api/admin/students/create - Create a new student
 */
async function createStudent(req, res) {
  try {
    const { username, password, full_name, phone, email, department, year, roll_number } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    const [exists] = await db.query(`SELECT id FROM users WHERE username = ?`, [username]);
    if (exists && exists.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const [result] = await db.query(`
      INSERT INTO users (username, password, full_name, phone, email, department, year, roll_number, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STUDENT', 'active')
    `, [username, password, full_name, phone || null, email || null, department || null, year ? parseInt(year, 10) : null, roll_number || null]);

    return res.status(200).json({
      message: 'Student created successfully',
      user_id: result.insertId
    });
  } catch (err) {
    console.error('Error creating student:', err);
    return res.status(500).json({ error: 'Failed to create student' });
  }
}

/**
 * DELETE /api/admin/students/delete - Delete a student
 */
async function deleteStudent(req, res) {
  try {
    const userID = req.query.id;
    if (!userID) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    await db.query(`DELETE FROM users WHERE id = ? AND role = 'STUDENT'`, [userID]);
    return res.status(200).json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    return res.status(500).json({ error: 'Failed to delete student' });
  }
}

/**
 * GET /api/admin/student-transport - Get all student transport assignments
 */
async function getAllStudentTransport(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        st.id, st.user_id, COALESCE(u.full_name, u.username, '') AS student_name, COALESCE(u.email, '') AS student_email,
        COALESCE(u.department, '') AS department, COALESCE(u.year, 0) AS year, COALESCE(u.roll_number, '') AS roll_number,
        st.bus_id, COALESCE(v.vehicle_name, '') AS vehicle_name, COALESCE(v.vehicle_number, '') AS bus_number, 
        COALESCE(b.start_point, '') AS route_start, COALESCE(b.end_point, '') AS route_end,
        st.stop_id, COALESCE(bs.stop_name, '') AS stop_name, '' AS stop_location,
        st.total_fee, st.paid_amount, st.balance,
        st.academic_year, st.status,
        '' AS arrival_time, '' AS departure_time
      FROM student_transport st
      JOIN users u ON st.user_id = u.id
      LEFT JOIN buses b ON st.bus_id = b.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN bus_stops bs ON st.stop_id = bs.id
      ORDER BY u.full_name
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching student transport:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}

/**
 * POST /api/admin/student-transport/assign - Assign bus and stop to student
 */
async function assignStudentTransport(req, res) {
  try {
    let { user_id, bus_id, stop_id, academic_year } = req.body;
    if (!user_id || !bus_id || !stop_id) {
      return res.status(400).json({ error: 'user_id, bus_id, and stop_id are required' });
    }

    if (!academic_year) {
      academic_year = '2025-2026';
    }

    // Resolve vehicle_id to actual buses table ID if needed
    let actualBusID = parseInt(bus_id, 10);
    const [busRows] = await db.query(`SELECT id FROM buses WHERE vehicle_id = ?`, [actualBusID]);
    if (busRows && busRows.length > 0) {
      actualBusID = busRows[0].id;
    }

    // Fee resolution
    let feeAmount = 0;
    const [fee1] = await db.query(`
      SELECT fee_amount FROM transport_fees 
      WHERE stop_id = ? AND academic_year = ? AND is_active = TRUE
    `, [stop_id, academic_year]);

    if (fee1 && fee1.length > 0) {
      feeAmount = parseFloat(fee1[0].fee_amount) || 0;
    } else {
      const [fee2] = await db.query(`
        SELECT fee_amount FROM transport_fees 
        WHERE stop_id = ? AND is_active = TRUE
        ORDER BY id DESC LIMIT 1
      `, [stop_id]);
      if (fee2 && fee2.length > 0) {
        feeAmount = parseFloat(fee2[0].fee_amount) || 0;
      } else {
        const [fee3] = await db.query(`
          SELECT COALESCE(fee, 0) AS fee FROM bus_stops WHERE id = ?
        `, [stop_id]);
        if (fee3 && fee3.length > 0) {
          feeAmount = parseFloat(fee3[0].fee) || 0;
        }
      }
    }

    // Get transport_fee_id
    let feeID = null;
    const [tfRow] = await db.query(`
      SELECT id FROM transport_fees 
      WHERE stop_id = ? AND is_active = TRUE
      ORDER BY id DESC LIMIT 1
    `, [stop_id]);
    if (tfRow && tfRow.length > 0) {
      feeID = tfRow[0].id;
    }

    const [existing] = await db.query(`
      SELECT id FROM student_transport 
      WHERE user_id = ? AND academic_year = ?
    `, [user_id, academic_year]);

    if (!existing || existing.length === 0) {
      await db.query(`
        INSERT INTO student_transport 
        (user_id, bus_id, stop_id, transport_fee_id, total_fee, paid_amount, academic_year, status)
        VALUES (?, ?, ?, ?, ?, 0, ?, 'active')
      `, [user_id, actualBusID, stop_id, feeID, feeAmount, academic_year]);
      return res.status(200).json({ message: 'Student transport assigned successfully', fee: feeAmount });
    } else {
      await db.query(`
        UPDATE student_transport 
        SET bus_id = ?, stop_id = ?, total_fee = ?, status = 'active'
        WHERE id = ?
      `, [actualBusID, stop_id, feeAmount, existing[0].id]);
      return res.status(200).json({ message: 'Student transport updated successfully', fee: feeAmount });
    }
  } catch (err) {
    console.error('Error assigning student transport:', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

/**
 * POST /api/admin/student-transport/update - Update student transport
 */
async function updateStudentTransport(req, res) {
  try {
    const { id, bus_id, stop_id, status } = req.body;

    let newFee = 0;
    const [tf] = await db.query(`
      SELECT tf.fee_amount FROM transport_fees tf
      WHERE tf.stop_id = ? AND tf.is_active = TRUE
      ORDER BY tf.id DESC LIMIT 1
    `, [stop_id]);

    if (tf && tf.length > 0) {
      newFee = parseFloat(tf[0].fee_amount) || 0;
    } else {
      const [bs] = await db.query(`SELECT COALESCE(fee, 0) AS fee FROM bus_stops WHERE id = ?`, [stop_id]);
      if (bs && bs.length > 0) {
        newFee = parseFloat(bs[0].fee) || 0;
      }
    }

    await db.query(`
      UPDATE student_transport 
      SET bus_id = ?, stop_id = ?, total_fee = ?, status = ?
      WHERE id = ?
    `, [bus_id, stop_id, newFee, status || 'active', id]);

    return res.status(200).json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('Error updating student transport:', err);
    return res.status(500).json({ error: 'Failed to update' });
  }
}

/**
 * DELETE /api/admin/student-transport/delete - Remove student transport
 */
async function deleteStudentTransport(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    await db.query(`DELETE FROM student_transport WHERE id = ?`, [id]);
    return res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting student transport:', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}

/**
 * GET /api/admin/transport-payments - Get all payments
 */
async function getAllTransportPayments(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id, p.student_transport_id, u.full_name AS student_name,
        p.amount, DATE_FORMAT(p.payment_date, '%d-%m-%Y') AS payment_date,
        p.payment_method, COALESCE(p.transaction_id, '') AS transaction_id,
        COALESCE(p.receipt_number, '') AS receipt_number, COALESCE(p.remarks, '') AS remarks,
        COALESCE(p.recorded_by, 0) AS recorded_by, COALESCE(admin.full_name, 'System') AS recorded_by_name,
        COALESCE(p.payment_type, 'payment') AS payment_type
      FROM transport_payments p
      JOIN student_transport st ON p.student_transport_id = st.id
      JOIN users u ON st.user_id = u.id
      LEFT JOIN users admin ON p.recorded_by = admin.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching payments:', err);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
}

/**
 * POST /api/admin/transport-payments/record - Record a payment
 */
async function recordTransportPayment(req, res) {
  try {
    const adminID = req.userId || 1;
    let { student_transport_id, amount, payment_date, payment_method, transaction_id, receipt_number, remarks, payment_type } = req.body;
    if (!student_transport_id || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'student_transport_id and amount are required' });
    }

    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      return res.status(400).json({ error: 'amount must be greater than zero' });
    }
    if (!payment_date) {
      const now = new Date();
      payment_date = now.toISOString().slice(0, 10);
    }
    if (!payment_type) {
      payment_type = 'payment';
    }
    if (payment_type !== 'payment' && payment_type !== 'refund') {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    await db.query(`
      INSERT INTO transport_payments 
      (student_transport_id, amount, payment_date, payment_method, transaction_id, receipt_number, remarks, recorded_by, payment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [student_transport_id, amt, payment_date, payment_method, transaction_id || '', receipt_number || '', remarks || '', adminID, payment_type]);

    if (payment_type === 'refund') {
      await db.query(`
        UPDATE student_transport 
        SET paid_amount = paid_amount - ?
        WHERE id = ?
      `, [amt, student_transport_id]);
    } else {
      await db.query(`
        UPDATE student_transport 
        SET paid_amount = paid_amount + ?
        WHERE id = ?
      `, [amt, student_transport_id]);
    }

    const msg = payment_type === 'refund' ? 'Refund recorded successfully' : 'Payment recorded successfully';
    return res.status(200).json({ message: msg });
  } catch (err) {
    console.error('Error recording payment:', err);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
}

/**
 * GET /api/admin/stop-change-requests - Get all stop change requests
 */
async function getAllStopChangeRequests(req, res) {
  try {
    const status = req.query.status || 'pending';

    let query = `
      SELECT 
        scr.id, COALESCE(scr.student_transport_id, 0) AS student_transport_id,
        COALESCE(u.full_name, 'Unknown Student') AS student_name, COALESCE(u.email, '') AS student_email,
        COALESCE(scr.current_stop_id, 0) AS current_stop_id, COALESCE(cs.stop_name, gs.stop_name, 'Unknown Stop') AS current_stop_name,
        COALESCE(scr.requested_stop_id, 0) AS requested_stop_id, COALESCE(rs.stop_name, 'Unknown Stop') AS requested_stop_name,
        COALESCE(scr.current_fee, 0) AS current_fee, COALESCE(scr.new_fee, 0) AS new_fee, COALESCE(scr.fee_difference, 0) AS fee_difference,
        COALESCE(scr.reason, '') AS reason, scr.status,
        COALESCE(scr.admin_remarks, '') AS admin_remarks,
        scr.processed_by, COALESCE(admin.full_name, '') AS processed_by_name,
        DATE_FORMAT(scr.processed_at, '%d-%m-%Y %h:%i %p') AS processed_at, 
        DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p') AS created_at
      FROM stop_change_requests scr
      LEFT JOIN student_transport st ON scr.student_transport_id = st.id
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
      LEFT JOIN stops gs ON scr.current_stop_id = gs.id
      LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
      LEFT JOIN users admin ON scr.processed_by = admin.id
    `;

    const args = [];
    if (status && status !== 'all') {
      query += ` WHERE scr.status = ?`;
      args.push(status);
    }
    query += ` ORDER BY scr.created_at DESC`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching stop change requests:', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

/**
 * POST /api/admin/stop-change-requests/process - Process stop change request
 */
async function processStopChangeRequest(req, res) {
  try {
    const adminID = req.userId || 1;
    const { request_id, status, admin_remarks } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    const [reqRows] = await db.query(`
      SELECT scr.student_transport_id, scr.requested_stop_id, scr.new_fee, st.paid_amount
      FROM stop_change_requests scr
      JOIN student_transport st ON scr.student_transport_id = st.id
      WHERE scr.id = ?
    `, [request_id]);

    if (!reqRows || reqRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { student_transport_id, requested_stop_id, new_fee } = reqRows[0];

    const [busRows] = await db.query(`
      SELECT b.id
      FROM bus_stops bs
      JOIN buses b ON b.vehicle_id = bs.vehicle_id
      WHERE bs.id = ?
    `, [requested_stop_id]);

    if (!busRows || busRows.length === 0) {
      return res.status(400).json({ error: 'Requested stop is not linked to any bus' });
    }

    const requestedBusID = busRows[0].id;

    await db.query(`
      UPDATE stop_change_requests 
      SET status = ?, admin_remarks = ?, processed_by = ?, processed_at = NOW()
      WHERE id = ?
    `, [status, admin_remarks || null, adminID, request_id]);

    if (status === 'approved') {
      await db.query(`
        UPDATE student_transport 
        SET stop_id = ?, bus_id = ?, total_fee = ?
        WHERE id = ?
      `, [requested_stop_id, requestedBusID, new_fee, student_transport_id]);
    }

    const [scrFee] = await db.query(`
      SELECT COALESCE(current_fee, 0) AS current_fee, COALESCE(new_fee, 0) AS new_fee 
      FROM stop_change_requests WHERE id = ?
    `, [request_id]);

    const curFee = parseFloat(scrFee?.[0]?.current_fee) || 0;
    const nFee = parseFloat(scrFee?.[0]?.new_fee) || 0;
    const feeDiff = nFee - curFee;

    let settlementMsg = 'No fee change';
    if (feeDiff > 0) {
      settlementMsg = `Student needs to pay additional ₹${Math.round(feeDiff)}`;
    } else if (feeDiff < 0) {
      settlementMsg = `Student is eligible for a refund of ₹${Math.round(-feeDiff)}`;
    }

    const [balRow] = await db.query(`SELECT COALESCE(total_fee - paid_amount, 0) AS balance FROM student_transport WHERE id = ?`, [student_transport_id]);
    const balance = balRow?.[0]?.balance || 0;

    return res.status(200).json({
      message: `Request ${status} successfully`,
      current_fee: curFee,
      new_fee: nFee,
      fee_difference: feeDiff,
      balance,
      settlement: settlementMsg
    });
  } catch (err) {
    console.error('Error processing stop change request:', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

/**
 * GET /api/admin/stop-change-requests/pending-count
 */
async function getPendingStopChangeCount(req, res) {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM stop_change_requests WHERE status = 'pending'`);
    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching pending stop change count:', err);
    return res.status(200).json({ count: 0 });
  }
}

/**
 * GET /api/admin/transport-requests - Get all transport requests
 */
async function getAllTransportRequests(req, res) {
  try {
    const status = req.query.status;

    let query = `
      SELECT 
        tr.id, COALESCE(tr.user_id, 0) AS user_id, COALESCE(tr.bus_id, 0) AS bus_id, COALESCE(tr.stop_id, 0) AS stop_id, 
        tr.academic_year, COALESCE(tr.reason, '') AS reason,
        tr.status, COALESCE(tr.admin_remarks, '') AS admin_remarks, tr.processed_by, tr.processed_at,
        tr.created_at,
        COALESCE(u.full_name, u.username, '') AS student_name, 
        COALESCE(u.email, '') AS email,
        COALESCE(u.phone, '') AS phone,
        COALESCE(u.department, '') AS department,
        COALESCE(u.year, 0) AS year,
        COALESCE(u.roll_number, '') AS roll_number,
        COALESCE(v.vehicle_name, '') AS vehicle_name, 
        COALESCE(CONCAT(b.start_point, ' → ', b.end_point), '') AS route,
        COALESCE(bs.stop_name, '') AS stop_name, 
        COALESCE(bs.fee, 0) AS fee
      FROM transport_requests tr
      LEFT JOIN users u ON tr.user_id = u.id
      LEFT JOIN buses b ON tr.bus_id = b.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
    `;

    const args = [];
    if (status && status !== 'all') {
      query += ` WHERE tr.status = ?`;
      args.push(status);
    }
    query += ` ORDER BY tr.created_at DESC`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching transport requests:', err);
    return res.status(500).json({ error: 'Failed to fetch transport requests' });
  }
}

/**
 * POST /api/admin/transport-requests/process - Process transport request
 */
async function processTransportRequest(req, res) {
  try {
    const adminID = req.userId || 1;
    const { request_id, status, admin_remarks } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    const [trRows] = await db.query(`
      SELECT tr.user_id, tr.bus_id, tr.stop_id, tr.academic_year, COALESCE(bs.fee, 0) AS fee, tr.status
      FROM transport_requests tr
      LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
      WHERE tr.id = ?
    `, [request_id]);

    if (!trRows || trRows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { user_id, bus_id, stop_id, academic_year, fee, status: currentStatus } = trRows[0];

    if (currentStatus !== 'pending' && status === 'approved') {
      const [ex] = await db.query(`SELECT id FROM student_transport WHERE user_id = ? AND academic_year = ?`, [user_id, academic_year]);
      if (ex && ex.length > 0) {
        return res.status(400).json({ error: 'Request already processed and transport assigned' });
      }
    }

    await db.query(`
      UPDATE transport_requests 
      SET status = ?, admin_remarks = ?, processed_by = ?, processed_at = NOW()
      WHERE id = ?
    `, [status, admin_remarks || null, adminID, request_id]);

    if (status === 'approved') {
      const [existing] = await db.query(`
        SELECT id FROM student_transport 
        WHERE user_id = ? AND academic_year = ?
      `, [user_id, academic_year]);

      if (!existing || existing.length === 0) {
        await db.query(`
          INSERT INTO student_transport (user_id, bus_id, stop_id, academic_year, total_fee, paid_amount, status)
          VALUES (?, ?, ?, ?, ?, 0, 'active')
        `, [user_id, bus_id, stop_id, academic_year, fee]);
      } else {
        await db.query(`
          UPDATE student_transport 
          SET bus_id = ?, stop_id = ?, total_fee = ?, status = 'active'
          WHERE id = ?
        `, [bus_id, stop_id, fee, existing[0].id]);
      }
    }

    return res.status(200).json({ message: `Transport request ${status} successfully` });
  } catch (err) {
    console.error('Error processing transport request:', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

/**
 * POST /api/admin/transport-requests/fix-approved
 */
async function fixApprovedRequests(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT tr.id, tr.user_id, tr.bus_id, tr.stop_id, tr.academic_year, COALESCE(bs.fee, 0) AS fee
      FROM transport_requests tr
      LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
      LEFT JOIN student_transport st ON tr.user_id = st.user_id AND tr.academic_year = st.academic_year
      WHERE tr.status = 'approved' AND st.id IS NULL
    `);

    let fixedCount = 0;
    for (const r of (rows || [])) {
      try {
        await db.query(`
          INSERT INTO student_transport (user_id, bus_id, stop_id, academic_year, total_fee, paid_amount, status)
          VALUES (?, ?, ?, ?, ?, 0, 'active')
        `, [r.user_id, r.bus_id, r.stop_id, r.academic_year, r.fee]);
        fixedCount++;
      } catch (e) {
        console.error('Fix approved request error:', e);
      }
    }

    return res.status(200).json({
      message: `Fixed ${fixedCount} approved requests`,
      fixed_count: fixedCount
    });
  } catch (err) {
    console.error('Error finding approved requests:', err);
    return res.status(500).json({ error: 'Failed to find requests' });
  }
}

/**
 * GET /api/admin/transport-requests/pending-count
 */
async function getPendingTransportRequestCount(req, res) {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM transport_requests WHERE status = 'pending'`);
    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching pending transport request count:', err);
    return res.status(200).json({ count: 0 });
  }
}

/**
 * GET /api/admin/student-transport/:id/fee-summary
 */
async function getStudentFeeSummary(req, res) {
  try {
    const stID = req.params.id;

    const [rows] = await db.query(`
      SELECT st.total_fee, st.paid_amount, st.balance, COALESCE(bs.fee, 0) AS stop_fee, COALESCE(bs.stop_name, '-') AS stop_name, st.status
      FROM student_transport st
      LEFT JOIN bus_stops bs ON st.stop_id = bs.id
      WHERE st.id = ?
    `, [stID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Student transport not found' });
    }

    const { total_fee, paid_amount, balance, stop_fee, stop_name, status } = rows[0];

    const [changes] = await db.query(`
      SELECT 
        COALESCE(cs.stop_name, '-') AS from_stop, COALESCE(rs.stop_name, '-') AS to_stop,
        COALESCE(scr.current_fee, 0) AS old_fee, COALESCE(scr.new_fee, 0) AS new_fee, COALESCE(scr.fee_difference, 0) AS difference,
        scr.status,
        DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p') AS requested_at,
        DATE_FORMAT(scr.processed_at, '%d-%m-%Y %h:%i %p') AS processed_at
      FROM stop_change_requests scr
      LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
      LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
      WHERE scr.student_transport_id = ?
      ORDER BY scr.created_at DESC
    `, [stID]);

    return res.status(200).json({
      current_stop: stop_name,
      current_stop_fee: stop_fee,
      total_fee,
      paid_amount,
      balance,
      status,
      stop_changes: changes || []
    });
  } catch (err) {
    console.error('Error fetching student fee summary:', err);
    return res.status(500).json({ error: 'Failed to fetch fee summary' });
  }
}

/**
 * GET /api/admin/buses/:id/students
 */
async function getStudentsByBus(req, res) {
  try {
    const busID = req.params.id;

    const [rows] = await db.query(`
      SELECT 
        st.id, st.user_id, COALESCE(u.full_name, u.username, '') AS name, COALESCE(u.email, '') AS email,
        COALESCE(u.department, '') AS department,
        COALESCE(u.year, 0) AS year,
        COALESCE(u.roll_number, '') AS roll_number,
        COALESCE(bs.stop_name, '') AS stop_name, COALESCE(bs.fee, 0) AS stop_fee,
        st.total_fee, st.paid_amount, st.status,
        st.academic_year, st.created_at
      FROM student_transport st
      JOIN users u ON st.user_id = u.id
      LEFT JOIN bus_stops bs ON st.stop_id = bs.id
      WHERE st.bus_id = ? AND st.status = 'active'
      ORDER BY bs.stop_name, u.full_name
    `, [busID]);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching students by bus:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
}

/**
 * GET /api/admin/buses/with-students
 */
async function getBusesWithStudentCounts(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.id, b.vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number, '') AS name, 
        CONCAT(COALESCE(b.start_point, ''), ' → ', COALESCE(b.end_point, '')) AS route, 
        COALESCE(v.seating_capacity, 50) AS capacity,
        0 AS driver_id,
        'Unassigned' AS driver_name,
        COUNT(DISTINCT st.user_id) AS student_count
      FROM buses b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN student_transport st ON b.id = st.bus_id AND st.status = 'active'
      GROUP BY b.id, b.vehicle_id, COALESCE(v.vehicle_name, v.vehicle_number, ''), b.start_point, b.end_point, v.seating_capacity
      ORDER BY COALESCE(v.vehicle_name, v.vehicle_number) ASC
    `);

    const buses = (rows || []).map(b => ({
      ...b,
      stop_names: []
    }));

    for (const b of buses) {
      const [stops] = await db.query(`
        SELECT COALESCE(stop_name, '') AS stop_name 
        FROM bus_stops 
        WHERE vehicle_id = ? 
        ORDER BY stop_order, stop_name
      `, [b.vehicle_id]);
      b.stop_names = (stops || []).map(s => s.stop_name).filter(Boolean);
    }

    return res.status(200).json(buses);
  } catch (err) {
    console.error('Error fetching buses with students:', err);
    return res.status(500).json({ error: 'Failed to fetch buses' });
  }
}

module.exports = {
  getAllStudents,
  createStudent,
  deleteStudent,
  getAllStudentTransport,
  assignStudentTransport,
  updateStudentTransport,
  deleteStudentTransport,
  getAllTransportPayments,
  recordTransportPayment,
  getAllStopChangeRequests,
  processStopChangeRequest,
  getPendingStopChangeCount,
  getAllTransportRequests,
  processTransportRequest,
  fixApprovedRequests,
  getPendingTransportRequestCount,
  getStudentFeeSummary,
  getStudentsByBus,
  getBusesWithStudentCounts
};
