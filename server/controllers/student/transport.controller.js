const db = require('../../config/db');

async function getMyTransport(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT 
        st.id, st.user_id, COALESCE(u.full_name, u.username) as student_name, COALESCE(u.email, '') as student_email,
        st.bus_id, COALESCE(v.vehicle_name, '') as vehicle_name, COALESCE(v.vehicle_number, '') as bus_number, 
        COALESCE(b.start_point, '') as route_start, COALESCE(b.end_point, '') as route_end,
        st.stop_id, COALESCE(bs.stop_name, '') as stop_name, '' as stop_location,
        st.total_fee, st.paid_amount, st.balance,
        st.academic_year, st.status,
        COALESCE(TIME_FORMAT(bs.arrival_time, '%h:%i %p'), '') as arrival_time,
        '' as departure_time
      FROM student_transport st
      JOIN users u ON st.user_id = u.id
      LEFT JOIN buses b ON st.bus_id = b.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN bus_stops bs ON st.stop_id = bs.id
      WHERE st.user_id = ? AND st.status = 'active'
      ORDER BY st.id DESC LIMIT 1
    `, [userID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'No transport assigned',
        message: 'You have not been assigned to any bus yet. Please contact the transport office.'
      });
    }

    const t = rows[0];
    return res.status(200).json({
      id: t.id,
      user_id: t.user_id,
      student_name: t.student_name,
      student_email: t.student_email,
      bus_id: t.bus_id,
      vehicle_name: t.vehicle_name,
      bus_number: t.bus_number,
      route_start: t.route_start,
      route_end: t.route_end,
      stop_id: t.stop_id,
      stop_name: t.stop_name,
      stop_location: t.stop_location,
      total_fee: Number(t.total_fee || 0),
      paid_amount: Number(t.paid_amount || 0),
      balance: Number(t.balance || 0),
      academic_year: t.academic_year,
      status: t.status,
      arrival_time: t.arrival_time,
      departure_time: t.departure_time
    });
  } catch (err) {
    console.error('Error fetching student transport:', err);
    return res.status(500).json({ error: 'Failed to fetch transport details' });
  }
}

async function getMyPayments(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT 
        p.id, p.student_transport_id, u.full_name as student_name,
        p.amount, DATE_FORMAT(p.payment_date, '%d-%m-%Y') as payment_date,
        p.payment_method, COALESCE(p.transaction_id, '') as transaction_id,
        COALESCE(p.receipt_number, '') as receipt_number, COALESCE(p.remarks, '') as remarks,
        COALESCE(p.recorded_by, 0) as recorded_by, COALESCE(admin.full_name, 'System') as recorded_by_name
      FROM transport_payments p
      JOIN student_transport st ON p.student_transport_id = st.id
      JOIN users u ON st.user_id = u.id
      LEFT JOIN users admin ON p.recorded_by = admin.id
      WHERE st.user_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
    `, [userID]);

    const payments = (rows || []).map(p => ({
      id: p.id,
      student_transport_id: p.student_transport_id,
      student_name: p.student_name,
      amount: Number(p.amount || 0),
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      transaction_id: p.transaction_id,
      receipt_number: p.receipt_number,
      remarks: p.remarks,
      recorded_by: p.recorded_by,
      recorded_by_name: p.recorded_by_name
    }));

    return res.status(200).json(payments);
  } catch (err) {
    console.error('Error fetching payments:', err);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
}

async function requestStopChange(req, res) {
  try {
    const userID = req.userId;
    const { requested_stop_id, reason } = req.body;

    const [transports] = await db.query(`
      SELECT st.id, st.stop_id, st.total_fee
      FROM student_transport st
      WHERE st.user_id = ? AND st.status = 'active'
      LIMIT 1
    `, [userID]);

    if (!transports || transports.length === 0) {
      return res.status(400).json({ error: 'No active transport assignment found' });
    }

    const current = transports[0];
    const currentStopID = current.stop_id;
    const currentFee = Number(current.total_fee || 0);

    if (currentStopID === requested_stop_id) {
      return res.status(400).json({ error: 'Requested stop is same as current stop' });
    }

    const [pending] = await db.query(`
      SELECT COUNT(*) AS count FROM stop_change_requests 
      WHERE student_transport_id = ? AND status = 'pending'
    `, [current.id]);

    if (pending[0].count > 0) {
      return res.status(400).json({ error: 'You already have a pending stop change request' });
    }

    const [stops] = await db.query(`
      SELECT COALESCE(fee, 0) AS fee 
      FROM bus_stops 
      WHERE id = ?
    `, [requested_stop_id]);

    if (!stops || stops.length === 0) {
      return res.status(400).json({ error: 'Selected stop was not found' });
    }

    const newFee = Number(stops[0].fee || 0);

    await db.query(`
      INSERT INTO stop_change_requests 
      (student_transport_id, current_stop_id, requested_stop_id, current_fee, new_fee, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [current.id, currentStopID, requested_stop_id, currentFee, newFee, reason || '']);

    return res.status(200).json({
      message: 'Stop change request submitted successfully',
      current_fee: currentFee,
      new_fee: newFee,
      fee_difference: newFee - currentFee
    });
  } catch (err) {
    console.error('Error creating stop change request:', err);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
}

async function cancelStopChangeRequest(req, res) {
  try {
    const userID = req.userId;
    const requestID = req.body.request_id || req.body.id;

    if (!requestID) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [rows] = await db.query(`
      SELECT scr.id 
      FROM stop_change_requests scr
      JOIN student_transport st ON scr.student_transport_id = st.id
      WHERE scr.id = ? AND st.user_id = ? AND scr.status = 'pending'
    `, [requestID, userID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    await db.query('DELETE FROM stop_change_requests WHERE id = ?', [rows[0].id]);
    return res.status(200).json({ message: 'Request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling stop change request:', err);
    return res.status(500).json({ error: 'Failed to cancel request' });
  }
}

async function getMyStopChangeRequests(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT 
        scr.id, COALESCE(scr.student_transport_id, 0) as student_transport_id,
        COALESCE(u.full_name, 'Unknown Student') as student_name, COALESCE(u.email, '') as student_email,
        COALESCE(scr.current_stop_id, 0) as current_stop_id, COALESCE(cs.stop_name, gs.stop_name, 'Unknown Stop') as current_stop_name,
        COALESCE(scr.requested_stop_id, 0) as requested_stop_id, COALESCE(rs.stop_name, 'Unknown Stop') as requested_stop_name,
        COALESCE(scr.current_fee, 0) as current_fee, COALESCE(scr.new_fee, 0) as new_fee, COALESCE(scr.fee_difference, 0) as fee_difference,
        COALESCE(scr.reason, '') as reason, scr.status,
        COALESCE(scr.admin_remarks, '') as admin_remarks,
        scr.processed_by, COALESCE(admin.full_name, '') as processed_by_name,
        DATE_FORMAT(scr.processed_at, '%d-%m-%Y %h:%i %p') as processed_at, 
        DATE_FORMAT(scr.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM stop_change_requests scr
      JOIN student_transport st ON scr.student_transport_id = st.id
      JOIN users u ON st.user_id = u.id
      LEFT JOIN bus_stops cs ON scr.current_stop_id = cs.id
      LEFT JOIN stops gs ON scr.current_stop_id = gs.id
      LEFT JOIN bus_stops rs ON scr.requested_stop_id = rs.id
      LEFT JOIN users admin ON scr.processed_by = admin.id
      WHERE st.user_id = ?
      ORDER BY scr.created_at DESC
    `, [userID]);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching stop change requests:', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

async function getBusStopsForStudent(req, res) {
  try {
    const paramID = req.params.id;
    let vehicleID = null;

    const [busRows] = await db.query('SELECT vehicle_id FROM buses WHERE id = ?', [paramID]);
    if (busRows && busRows.length > 0) {
      vehicleID = busRows[0].vehicle_id;
    } else {
      const vid = parseInt(paramID, 10);
      if (isNaN(vid)) {
        return res.status(400).json({ error: 'Invalid bus ID' });
      }
      vehicleID = vid;
    }

    const [rows] = await db.query(`
      SELECT 
        bs.id, bs.stop_name, bs.stop_order, bs.fee, COALESCE(bs.distance_km, 0) as distance_km,
        COALESCE(TIME_FORMAT(bs.arrival_time, '%h:%i %p'), '') as arrival_time
      FROM bus_stops bs
      WHERE bs.vehicle_id = ?
      ORDER BY bs.stop_order ASC
    `, [vehicleID]);

    const stops = (rows || []).map(s => ({
      id: s.id,
      stop_id: s.id,
      stop_name: s.stop_name,
      stop_order: s.stop_order,
      fee: Number(s.fee || 0),
      distance_km: Number(s.distance_km || 0),
      arrival_time: s.arrival_time
    }));

    return res.status(200).json(stops);
  } catch (err) {
    console.error('Error fetching bus stops for student:', err);
    return res.status(500).json({ error: 'Failed to fetch stops' });
  }
}

async function getAvailableStops(req, res) {
  try {
    const userID = req.userId;
    const [transports] = await db.query(`
      SELECT bus_id, stop_id FROM student_transport 
      WHERE user_id = ? AND status = 'active' LIMIT 1
    `, [userID]);

    if (!transports || transports.length === 0) {
      return res.status(400).json({ error: 'No active transport found' });
    }

    const { bus_id, stop_id } = transports[0];
    const [buses] = await db.query('SELECT vehicle_id FROM buses WHERE id = ?', [bus_id]);
    if (!buses || buses.length === 0) {
      return res.status(400).json({ error: 'Invalid bus assignment' });
    }

    const vehicleID = buses[0].vehicle_id;
    const [rows] = await db.query(`
      SELECT 
        bs.id as stop_id, bs.stop_name, bs.stop_order,
        COALESCE(bs.fee, 0) as fee,
        COALESCE(TIME_FORMAT(bs.arrival_time, '%h:%i %p'), '') as arrival_time
      FROM bus_stops bs
      WHERE bs.vehicle_id = ? AND bs.id != ?
      ORDER BY bs.stop_order ASC
    `, [vehicleID, stop_id]);

    const stops = (rows || []).map(s => ({
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      location: '',
      stop_order: s.stop_order,
      arrival_time: s.arrival_time,
      fee: Number(s.fee || 0)
    }));

    return res.status(200).json(stops);
  } catch (err) {
    console.error('Error fetching available stops:', err);
    return res.status(500).json({ error: 'Failed to fetch stops' });
  }
}

async function getAllBuses(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.id, COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name, v.vehicle_number, 
        COALESCE(b.start_point, '') as start_point, COALESCE(b.end_point, '') as end_point, COALESCE(v.seating_capacity, 0) as seating_capacity
      FROM buses b
      JOIN vehicles v ON b.vehicle_id = v.id
      ORDER BY COALESCE(v.vehicle_name, v.vehicle_number) ASC
    `);

    const buses = (rows || []).map(b => ({
      id: b.id,
      name: b.vehicle_name,
      vehicle_name: b.vehicle_name,
      vehicle_number: b.vehicle_number,
      route: `${b.start_point} → ${b.end_point}`,
      start_point: b.start_point,
      end_point: b.end_point,
      seating_capacity: b.seating_capacity
    }));

    return res.status(200).json(buses);
  } catch (err) {
    console.error('Error fetching buses:', err);
    return res.status(500).json({ error: 'Failed to fetch buses' });
  }
}

async function requestTransport(req, res) {
  try {
    const userID = req.userId;
    const { bus_id, stop_id, reason } = req.body;
    let academicYear = req.body.academic_year || '2025-2026';

    const [active] = await db.query(
      'SELECT COUNT(*) as count FROM student_transport WHERE user_id = ? AND status = "active"',
      [userID]
    );
    if (active[0].count > 0) {
      return res.status(400).json({ error: 'You already have an active transport assignment. Use stop change request instead.' });
    }

    const [pending] = await db.query(
      'SELECT COUNT(*) as count FROM transport_requests WHERE user_id = ? AND status = "pending"',
      [userID]
    );
    if (pending[0].count > 0) {
      return res.status(400).json({ error: 'You already have a pending transport request' });
    }

    await db.query(`
      INSERT INTO transport_requests (user_id, bus_id, stop_id, academic_year, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [userID, bus_id, stop_id, academicYear, reason || '']);

    return res.status(200).json({
      message: 'Transport request submitted successfully. Please wait for admin approval.'
    });
  } catch (err) {
    console.error('Error creating transport request:', err);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
}

async function getMyTransportRequests(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT 
        tr.id, tr.user_id,
        tr.bus_id, COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name, 
        CONCAT(COALESCE(b.start_point,''), ' → ', COALESCE(b.end_point,'')) as route,
        tr.stop_id, COALESCE(bs.stop_name, '') as stop_name, COALESCE(bs.fee, 0) as fee,
        tr.academic_year, COALESCE(tr.reason, '') as reason, tr.status,
        COALESCE(tr.admin_remarks, '') as admin_remarks,
        tr.processed_by,
        tr.processed_at, tr.created_at
      FROM transport_requests tr
      LEFT JOIN buses b ON tr.bus_id = b.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN bus_stops bs ON tr.stop_id = bs.id
      WHERE tr.user_id = ?
      ORDER BY tr.created_at DESC
    `, [userID]);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Error fetching transport requests:', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

module.exports = {
  getMyTransport,
  getMyPayments,
  requestStopChange,
  cancelStopChangeRequest,
  getMyStopChangeRequests,
  getBusStopsForStudent,
  getAvailableStops,
  getAllBuses,
  requestTransport,
  getMyTransportRequests
};
