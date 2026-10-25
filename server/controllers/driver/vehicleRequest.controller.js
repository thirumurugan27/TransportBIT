const db = require('../../config/db');
const { createAdminNotification } = require('../../services/notification.service');
const { syncVehicleStatus } = require('../../services/vehicleSync.service');

async function getDriverIDFromReq(req) {
  let driverID = req.query.driver_id;
  if (!driverID && req.userId) {
    const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
    if (drv && drv.length > 0) driverID = drv[0].id;
  }
  return driverID ? parseInt(driverID, 10) : null;
}

async function getDriverVehicleRequests(req, res) {
  try {
    const driverID = await getDriverIDFromReq(req);
    if (!driverID) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const [rows] = await db.query(`
      SELECT 
        vr.id, COALESCE(vr.faculty_id, 0) as faculty_id,
        COALESCE(vr.BookingType, 'faculty') as BookingType,
        COALESCE(vr.TripType, 'one_way') as TripType,
        'official' as TripMode,
        COALESCE(vr.RequestUnder, '') as RequestUnder,
        COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose,
        COALESCE(vr.Vertical, '') as Vertical,
        0 as OralApproval,
        COALESCE(vr.CountPerson, 1) as CountPerson,
        COALESCE(vrt.from_place, vr.OnwardFromPlace, '') as OnwardFromPlace,
        COALESCE(vrt.to_place, vr.OnwardToPlace, '') as OnwardToPlace,
        COALESCE(DATE_FORMAT(COALESCE(vrt.from_datetime, vr.OnwardFromDateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardFromDateTime,
        COALESCE(DATE_FORMAT(COALESCE(vrt.to_datetime, vr.OnwardTodateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardTodateTime,
        '' as ReturnFromPlace, '' as ReturnToPlace, '' as ReturnFromDateTime, '' as ReturnTodateTime,
        COALESCE(vr.ContactName, '') as ContactName,
        COALESCE(vr.ContactPhone, '') as ContactPhone,
        COALESCE(vr.MobileNumber, '') as MobileNumber,
        COALESCE(vr.TravellerName, vr.Guestname, '') as TravellerName,
        COALESCE(vr.Address, '') as Address,
        vr.status,
        COALESCE(vr.admin_remarks, '') as admin_remarks,
        COALESCE(ru.full_name, '') as faculty_name,
        COALESCE(ru.email, '') as faculty_email,
        COALESCE(ru.phone, '') as faculty_phone,
        COALESCE(rf.department, '') as faculty_department,
        COALESCE(v.vehicle_number, '') as vehicle_number,
        '' as vehicle_type,
        COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
        DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p') as created_at,
        COALESCE(DATE_FORMAT(vr.trip_started_at, '%d-%m-%Y %h:%i %p'), '') as trip_started_at,
        COALESCE(DATE_FORMAT(vr.trip_ended_at, '%d-%m-%Y %h:%i %p'), '') as trip_ended_at
      FROM vehiclerequests vr
      LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty rf ON rf.user_id = ru.id
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      WHERE vr.driver_id = ?
      ORDER BY COALESCE(vrt.from_datetime, vr.created_at) DESC
    `, [driverID]);

    const requests = [];
    for (const r of rows || []) {
      const [tripRows] = await db.query(`
        SELECT trip_order, COALESCE(from_place, '') as from_place, COALESCE(to_place, '') as to_place,
          from_latitude, from_longitude, to_latitude, to_longitude,
          COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') as dep_date,
          COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') as dep_time,
          COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') as arr_date,
          COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') as arr_time
        FROM vehicle_request_trips
        WHERE request_id = ?
        ORDER BY trip_order ASC
      `, [r.id]);

      r.trips = (tripRows || []).map(t => ({
        trip_order: t.trip_order,
        departure_location: t.from_place,
        arrival_location: t.to_place,
        departure_latitude: t.from_latitude,
        departure_longitude: t.from_longitude,
        arrival_latitude: t.to_latitude,
        arrival_longitude: t.to_longitude,
        departure_date: t.dep_date,
        departure_time: t.dep_time,
        arrival_date: t.arr_date,
        arrival_time: t.arr_time
      }));

      requests.push(r);
    }

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Error fetching driver vehicle requests:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

async function getDriverUpcomingVehicleRequests(req, res) {
  try {
    const driverID = await getDriverIDFromReq(req);
    if (!driverID) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const [rows] = await db.query(`
      SELECT 
        vr.id, COALESCE(vr.faculty_id, 0) as faculty_id,
        COALESCE(vr.BookingType, 'faculty') as BookingType,
        COALESCE(vr.TripType, 'one_way') as TripType,
        'official' as TripMode,
        COALESCE(vr.RequestUnder, '') as RequestUnder,
        COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose,
        COALESCE(vr.Vertical, '') as Vertical,
        0 as OralApproval,
        COALESCE(vr.CountPerson, 1) as CountPerson,
        COALESCE(vrt.from_place, vr.OnwardFromPlace, '') as OnwardFromPlace,
        COALESCE(vrt.to_place, vr.OnwardToPlace, '') as OnwardToPlace,
        COALESCE(DATE_FORMAT(COALESCE(vrt.from_datetime, vr.OnwardFromDateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardFromDateTime,
        COALESCE(DATE_FORMAT(COALESCE(vrt.to_datetime, vr.OnwardTodateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardTodateTime,
        '' as ReturnFromPlace, '' as ReturnToPlace, '' as ReturnFromDateTime, '' as ReturnTodateTime,
        COALESCE(vr.ContactName, '') as ContactName,
        COALESCE(vr.ContactPhone, '') as ContactPhone,
        COALESCE(vr.MobileNumber, '') as MobileNumber,
        COALESCE(vr.TravellerName, vr.Guestname, '') as GuestName,
        COALESCE(vr.Address, '') as Address,
        vr.status,
        COALESCE(vr.admin_remarks, '') as admin_remarks,
        COALESCE(ru.full_name, '') as faculty_name,
        COALESCE(ru.email, '') as faculty_email,
        COALESCE(ru.phone, '') as faculty_phone,
        COALESCE(rf.department, '') as faculty_department,
        COALESCE(v.vehicle_number, '') as vehicle_number,
        '' as vehicle_type,
        COALESCE(v.vehicle_name, v.vehicle_number, '') as vehicle_name,
        DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p') as created_at,
        COALESCE(DATE_FORMAT(vr.trip_started_at, '%d-%m-%Y %h:%i %p'), '') as trip_started_at,
        COALESCE(DATE_FORMAT(vr.trip_ended_at, '%d-%m-%Y %h:%i %p'), '') as trip_ended_at
      FROM vehiclerequests vr
      LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN faculty rf ON rf.user_id = ru.id
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      WHERE vr.driver_id = ? 
        AND vr.status IN ('assigned', 'trip_started')
        AND DATE(COALESCE(vrt.from_datetime, vr.OnwardFromDateTime)) >= CURDATE()
      ORDER BY COALESCE(vrt.from_datetime, vr.OnwardFromDateTime) ASC
    `, [driverID]);

    const requests = [];
    for (const r of rows || []) {
      const [tripRows] = await db.query(`
        SELECT trip_order, COALESCE(from_place, '') as from_place, COALESCE(to_place, '') as to_place,
          from_latitude, from_longitude, to_latitude, to_longitude,
          COALESCE(DATE_FORMAT(from_datetime, '%d-%m-%Y'), '') as dep_date,
          COALESCE(DATE_FORMAT(from_datetime, '%h:%i %p'), '') as dep_time,
          COALESCE(DATE_FORMAT(to_datetime, '%d-%m-%Y'), '') as arr_date,
          COALESCE(DATE_FORMAT(to_datetime, '%h:%i %p'), '') as arr_time
        FROM vehicle_request_trips
        WHERE request_id = ?
        ORDER BY trip_order ASC
      `, [r.id]);

      r.trips = (tripRows || []).map(t => ({
        trip_order: t.trip_order,
        departure_location: t.from_place,
        arrival_location: t.to_place,
        departure_latitude: t.from_latitude,
        departure_longitude: t.from_longitude,
        arrival_latitude: t.to_latitude,
        arrival_longitude: t.to_longitude,
        departure_date: t.dep_date,
        departure_time: t.dep_time,
        arrival_date: t.arr_date,
        arrival_time: t.arr_time
      }));

      requests.push(r);
    }

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Error fetching upcoming vehicle requests:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

async function verifyStartOTP(req, res) {
  try {
    const driverID = await getDriverIDFromReq(req);
    if (!driverID) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const { request_id, otp } = req.body;
    if (!request_id || !otp) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [rows] = await db.query(`
      SELECT vr.status, COALESCE(vr.start_otp, '') as start_otp, COALESCE(ru.full_name, 'Requester') as faculty_name
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      WHERE vr.id = ? AND vr.driver_id = ?
    `, [request_id, driverID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }

    const { status, start_otp, faculty_name } = rows[0];

    if (status !== 'assigned') {
      return res.status(400).json({ error: 'Trip can only be started from assigned status' });
    }

    if (!start_otp) {
      return res.status(400).json({ error: 'No start OTP has been generated for this request' });
    }

    if (String(otp).trim() !== String(start_otp).trim()) {
      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    const endOTP = String(Math.floor(100000 + Math.random() * 900000));

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'trip_started', trip_started_at = NOW(),
          end_otp = ?, end_otp_generated_at = NOW()
      WHERE id = ?
    `, [endOTP, request_id]);

    await createAdminNotification('trip_started', 'Trip Started',
      `Trip for request #${request_id} by ${faculty_name} has started.`);

    return res.status(200).json({
      message: 'Trip started successfully. End OTP has been sent to the requester.'
    });
  } catch (err) {
    console.error('Error starting trip:', err);
    return res.status(500).json({ error: 'Failed to start trip' });
  }
}

async function verifyEndOTP(req, res) {
  try {
    const driverID = await getDriverIDFromReq(req);
    if (!driverID) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const { request_id, otp } = req.body;
    if (!request_id || !otp) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [rows] = await db.query(`
      SELECT vr.status, COALESCE(vr.end_otp, '') as end_otp, COALESCE(ru.full_name, 'Requester') as faculty_name, vr.vehicle_id
      FROM vehiclerequests vr
      LEFT JOIN users ru ON vr.requester_id = ru.id
      WHERE vr.id = ? AND vr.driver_id = ?
    `, [request_id, driverID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }

    const { status, end_otp, faculty_name, vehicle_id } = rows[0];

    if (status !== 'trip_started') {
      return res.status(400).json({ error: 'Trip can only be ended from trip_started status' });
    }

    if (!end_otp) {
      return res.status(400).json({ error: 'No end OTP has been generated for this request' });
    }

    if (String(otp).trim() !== String(end_otp).trim()) {
      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    await db.query(`
      UPDATE vehiclerequests 
      SET status = 'completed', trip_ended_at = NOW()
      WHERE id = ?
    `, [request_id]);

    await createAdminNotification('trip_completed', 'Trip Completed',
      `Trip for request #${request_id} by ${faculty_name} has been completed.`);

    if (vehicle_id) {
      syncVehicleStatus(vehicle_id);
    }

    return res.status(200).json({ message: 'Trip completed successfully!' });
  } catch (err) {
    console.error('Error ending trip:', err);
    return res.status(500).json({ error: 'Failed to end trip' });
  }
}

module.exports = {
  getDriverVehicleRequests,
  getDriverUpcomingVehicleRequests,
  verifyStartOTP,
  verifyEndOTP
};
