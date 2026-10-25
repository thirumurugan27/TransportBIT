const db = require('../../config/db');

function normalizeDateTime(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // If format is like 'YYYY-MM-DD HH:mm:ss'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
    return str + ':00';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
    return str.replace('T', ' ') + ':00';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return str.substring(0, 19).replace('T', ' ');
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (dmyMatch) {
    const [_, d, m, y, hh, mm, ss, ampm] = dmyMatch;
    let hour = hh ? parseInt(hh, 10) : 0;
    const min = mm ? parseInt(mm, 10) : 0;
    const sec = ss ? parseInt(ss, 10) : 0;
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    const pad = n => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)} ${pad(hour)}:${pad(min)}:${pad(sec)}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return str;
}

async function createVehicleRequest(req, res) {
  try {
    const userID = req.userId;
    if (!userID) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    let [facultyRows] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [userID]);
    let facultyID;
    if (!facultyRows || facultyRows.length === 0) {
      const [facRes] = await db.query(
        'INSERT INTO faculty (user_id, department, designation) VALUES (?, ?, ?)',
        [userID, 'General', 'Faculty']
      );
      facultyID = facRes.insertId;
    } else {
      facultyID = facultyRows[0].id;
    }

    const [facDetails] = await db.query(`
      SELECT COALESCE(u.full_name, '') as full_name, COALESCE(u.phone, '') as phone, 
             COALESCE(f.department, '') as department, COALESCE(f.designation, '') as designation
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [facultyID]);

    const facultyName = facDetails[0]?.full_name || '';
    const facultyPhone = facDetails[0]?.phone || '';

    const body = req.body;
    const trips = body.trips || body.Trips || [];

    let purpose = (body.purpose || body.Purpose || body.purpose_of_visit || body.PurposeOfVisit || '').trim();
    let contactPhone = (body.contact_phone || body.ContactPhone || body.mobile_number || body.MobileNumber || facultyPhone || '').trim();
    let contactName = (body.contact_name || body.ContactName || facultyName || '').trim();

    let onwardFromPlace = (body.onward_from_place || body.OnwardFromPlace || '').trim();
    let onwardToPlace = (body.onward_to_place || body.OnwardToPlace || '').trim();
    let onwardFromDateTime = normalizeDateTime(body.onward_from_datetime || body.onward_from_date_time || body.OnwardFromDateTime);
    let onwardToDateTime = normalizeDateTime(body.onward_to_datetime || body.onward_to_date_time || body.OnwardTodateTime || body.OnwardToDateTime);

    // Fallback to first trip if onward details are in trips[0]
    if (Array.isArray(trips) && trips.length > 0) {
      const firstTrip = trips[0];
      if (!onwardFromPlace) {
        onwardFromPlace = (firstTrip.departure_location || firstTrip.from_place || '').trim();
      }
      if (!onwardToPlace) {
        onwardToPlace = (firstTrip.arrival_location || firstTrip.to_place || '').trim();
      }
      if (!onwardFromDateTime) {
        const fromDT = (firstTrip.departure_date && firstTrip.departure_time)
          ? `${firstTrip.departure_date} ${firstTrip.departure_time}`
          : (firstTrip.from_datetime || '');
        onwardFromDateTime = normalizeDateTime(fromDT);
      }
      if (!onwardToDateTime) {
        const toDT = (firstTrip.arrival_date && firstTrip.arrival_time)
          ? `${firstTrip.arrival_date} ${firstTrip.arrival_time}`
          : (firstTrip.to_datetime || '');
        onwardToDateTime = normalizeDateTime(toDT);
      }
    }

    if (!onwardToDateTime) {
      onwardToDateTime = onwardFromDateTime;
    }

    let bookingType = body.booking_type || body.BookingType || 'faculty';
    let tripType = body.trip_type || body.TripType || 'guest_pickup';
    let countPerson = parseInt(body.count_person || body.total_passengers || body.CountPerson || 1, 10);
    if (isNaN(countPerson) || countPerson < 1) countPerson = 1;
    let requestUnder = (body.request_under || body.RequestUnder || '').trim();
    let vertical = (body.vertical || body.Vertical || '').trim();
    let guestName = (body.traveller_name || body.guest_name || body.Guestname || body.TravellerName || '').trim();
    let travellerMobile = (body.traveller_mobile || body.mobile_number || body.MobileNumber || '').trim();
    let address = (body.traveller_address || body.address || body.Address || '').trim();
    let taskID = (body.task_id || body.TaskID || '').trim();

    if (!purpose) {
      return res.status(400).json({ error: 'Purpose of trip is required' });
    }
    if (!onwardFromPlace || !onwardToPlace) {
      return res.status(400).json({ error: 'Onward journey departure and arrival locations are required' });
    }
    if (!onwardFromDateTime) {
      return res.status(400).json({ error: 'Departure date and time are required' });
    }

    const [result] = await db.query(`
      INSERT INTO vehiclerequests (
        requester_id, faculty_id, BookingType, TripType, RequestUnder, Vertical,
        OnwardFromPlace, OnwardToPlace, OnwardFromDateTime, OnwardTodateTime,
        CountPerson, Purpose, PurposeOfVisit, ContactName, ContactPhone,
        MobileNumber, TravellerName, Guestname, Address, TaskID, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      userID, facultyID, bookingType, tripType, requestUnder, vertical,
      onwardFromPlace, onwardToPlace, onwardFromDateTime, onwardToDateTime,
      countPerson, purpose, purpose, contactName, contactPhone,
      travellerMobile, guestName, guestName, address, taskID
    ]);

    const requestID = result.insertId;

    if (Array.isArray(trips) && trips.length > 0) {
      for (let i = 0; i < trips.length; i++) {
        const trip = trips[i];
        let fromDT = trip.departure_date && trip.departure_time ? `${trip.departure_date} ${trip.departure_time}` : (trip.from_datetime || '');
        let toDT = trip.arrival_date && trip.arrival_time ? `${trip.arrival_date} ${trip.arrival_time}` : (trip.to_datetime || '');
        fromDT = normalizeDateTime(fromDT) || onwardFromDateTime;
        toDT = normalizeDateTime(toDT) || fromDT;

        const fromPlace = (trip.departure_location || trip.from_place || onwardFromPlace).trim();
        const toPlace = (trip.arrival_location || trip.to_place || onwardToPlace).trim();

        await db.query(`
          INSERT INTO vehicle_request_trips (
            request_id, trip_order, from_place, to_place, from_datetime, to_datetime,
            from_latitude, from_longitude, to_latitude, to_longitude
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          requestID, i + 1,
          fromPlace, toPlace,
          fromDT, toDT,
          trip.departure_latitude != null ? trip.departure_latitude : null,
          trip.departure_longitude != null ? trip.departure_longitude : null,
          trip.arrival_latitude != null ? trip.arrival_latitude : null,
          trip.arrival_longitude != null ? trip.arrival_longitude : null
        ]);
      }
    } else {
      await db.query(`
        INSERT INTO vehicle_request_trips (
          request_id, trip_order, from_place, to_place, from_datetime, to_datetime
        ) VALUES (?, 1, ?, ?, ?, ?)
      `, [requestID, onwardFromPlace, onwardToPlace, onwardFromDateTime, onwardToDateTime]);
    }

    return res.status(200).json({ message: 'Vehicle request submitted successfully', id: requestID });
  } catch (err) {
    console.error('Error creating vehicle request:', err);
    return res.status(500).json({ error: 'Failed to create request: ' + err.message });
  }
}

async function getMyVehicleRequests(req, res) {
  try {
    const userID = req.userId;
    if (!userID) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    let [facultyRows] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [userID]);
    let facultyID = 0;
    if (facultyRows && facultyRows.length > 0) {
      facultyID = facultyRows[0].id;
    } else {
      try {
        const [facRes] = await db.query(
          'INSERT INTO faculty (user_id, department, designation) VALUES (?, ?, ?)',
          [userID, 'General', 'Faculty']
        );
        facultyID = facRes.insertId;
      } catch (e) {
        console.warn('Could not auto-create faculty record:', e);
      }
    }

    const [rows] = await db.query(`
      SELECT 
        vr.id, COALESCE(vr.requester_id, 0) as requester_id, COALESCE(vr.faculty_id, f.id, 0) as faculty_id,
        COALESCE(vr.BookingType, 'faculty') as BookingType, COALESCE(vr.TripType, '') as TripType,
        'official' as TripMode, COALESCE(vr.RequestUnder, '') as RequestUnder,
        COALESCE(vr.Purpose, vr.PurposeOfVisit, '') as Purpose,
        COALESCE(vr.Vertical, '') as Vertical, 0 as OralApproval,
        COALESCE(vr.CountPerson, 1) as CountPerson,
        COALESCE(vrt.from_place, vr.OnwardFromPlace, '') as OnwardFromPlace,
        COALESCE(vrt_last.to_place, vrt.to_place, vr.OnwardToPlace, '') as OnwardToPlace,
        COALESCE(DATE_FORMAT(COALESCE(vrt.from_datetime, vr.OnwardFromDateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardFromDateTime,
        COALESCE(DATE_FORMAT(COALESCE(vrt_last.to_datetime, vrt.to_datetime, vr.OnwardTodateTime), '%d-%m-%Y %h:%i %p'), '') as OnwardTodateTime,
        '' as ReturnFromPlace, '' as ReturnToPlace, '' as ReturnFromDateTime, '' as ReturnTodateTime,
        COALESCE(vr.ContactName, '') as ContactName, COALESCE(vr.ContactPhone, '') as ContactPhone,
        COALESCE(vr.TaskID, '') as TaskID, '' as OutcomeExpected, '' as OutcomeAuditable,
        COALESCE(vr.TravellerName, vr.Guestname, '') as TravellerName,
        COALESCE(vr.MobileNumber, '') as MobileNumber, COALESCE(vr.Address, '') as Address,
        COALESCE(vr.status, 'pending') as status, COALESCE(vr.admin_remarks, '') as admin_remarks,
        COALESCE(v.vehicle_number, '') as vehicle_number, '' as vehicle_type,
        COALESCE(IFNULL(v.vehicle_name, v.vehicle_number), '') as vehicle_name,
        COALESCE(ud.full_name, '') as driver_name, COALESCE(ud.phone, '') as driver_phone,
        COALESCE(ru.full_name, uf.full_name, '') as requester_name,
        COALESCE(ru.email, uf.email, '') as requester_email,
        COALESCE(ru.phone, uf.phone, '') as requester_phone,
        'FACULTY' as requester_role,
        COALESCE(uf.full_name, ru.full_name, '') as faculty_name,
        COALESCE(uf.phone, ru.phone, '') as faculty_phone,
        COALESCE(f.department, '') as faculty_department,
        COALESCE(ua.full_name, '') as approved_by_name,
        DATE_FORMAT(COALESCE(vr.created_at, NOW()), '%d-%m-%Y %h:%i %p') as created_at,
        DATE_FORMAT(vr.trip_started_at, '%d-%m-%Y %h:%i %p') as trip_started_at,
        DATE_FORMAT(vr.trip_ended_at, '%d-%m-%Y %h:%i %p') as trip_ended_at
      FROM vehiclerequests vr
      LEFT JOIN vehicle_request_trips vrt ON vrt.request_id = vr.id AND vrt.trip_order = 1
      LEFT JOIN vehicle_request_trips vrt_last ON vrt_last.request_id = vr.id AND vrt_last.trip_order = (
        SELECT MAX(trip_order) FROM vehicle_request_trips WHERE request_id = vr.id AND trip_order > 1
      )
      LEFT JOIN vehicles v ON vr.vehicle_id = v.id
      LEFT JOIN drivers d ON vr.driver_id = d.id
      LEFT JOIN users ud ON d.user_id = ud.id
      LEFT JOIN users ru ON vr.requester_id = ru.id
      LEFT JOIN users ua ON vr.approved_by = ua.id
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users uf ON f.user_id = uf.id
      WHERE (vr.requester_id = ? OR vr.faculty_id = ?)
      ORDER BY COALESCE(vrt.from_datetime, vr.created_at) DESC
    `, [userID, facultyID]);

    const requests = [];
    for (const r of rows) {
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

      // Enrich row with both snake_case and PascalCase so every component can access them
      r.booking_type = r.BookingType;
      r.trip_type = r.TripType;
      r.trip_mode = r.TripMode;
      r.request_under = r.RequestUnder;
      r.purpose = r.Purpose;
      r.vertical = r.Vertical;
      r.count_person = r.CountPerson;
      r.total_passengers = r.CountPerson;
      r.onward_from_place = r.OnwardFromPlace;
      r.onward_to_place = r.OnwardToPlace;
      r.onward_from_datetime = r.OnwardFromDateTime;
      r.onward_to_datetime = r.OnwardTodateTime;
      r.OnwardToDateTime = r.OnwardTodateTime;
      r.return_from_place = r.ReturnFromPlace;
      r.return_to_place = r.ReturnToPlace;
      r.return_from_datetime = r.ReturnFromDateTime;
      r.return_to_datetime = r.ReturnTodateTime;
      r.contact_name = r.ContactName;
      r.contact_phone = r.ContactPhone;
      r.task_id = r.TaskID;
      r.traveller_name = r.TravellerName;
      r.guest_name = r.TravellerName;
      r.traveller_mobile = r.MobileNumber;
      r.mobile_number = r.MobileNumber;
      r.traveller_address = r.Address;
      r.address = r.Address;

      // Fallback from trips if onward details were not populated at root
      if (!r.onward_from_place && r.trips.length > 0) {
        r.onward_from_place = r.trips[0].departure_location;
        r.OnwardFromPlace = r.trips[0].departure_location;
      }
      if (!r.onward_to_place && r.trips.length > 0) {
        r.onward_to_place = r.trips[r.trips.length - 1].arrival_location;
        r.OnwardToPlace = r.trips[r.trips.length - 1].arrival_location;
      }
      if (!r.onward_from_datetime && r.trips.length > 0) {
        const t0 = r.trips[0];
        if (t0.departure_date && t0.departure_time) {
          r.onward_from_datetime = `${t0.departure_date} ${t0.departure_time}`;
          r.OnwardFromDateTime = r.onward_from_datetime;
        }
      }
      if (!r.onward_to_datetime && r.trips.length > 0) {
        const tLast = r.trips[r.trips.length - 1];
        if (tLast.arrival_date && tLast.arrival_time) {
          r.onward_to_datetime = `${tLast.arrival_date} ${tLast.arrival_time}`;
          r.OnwardTodateTime = r.onward_to_datetime;
          r.OnwardToDateTime = r.onward_to_datetime;
        }
      }

      requests.push(r);
    }

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Error fetching vehicle requests:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
}

async function cancelVehicleRequest(req, res) {
  try {
    const userID = req.userId;
    const requestID = req.body.request_id || req.body.id;

    if (!requestID) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [facultyRows] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [userID]);
    const facultyID = facultyRows[0]?.id || 0;

    const [rows] = await db.query(`
      SELECT status FROM vehiclerequests WHERE id = ? AND (requester_id = ? OR faculty_id = ?)
    `, [requestID, userID, facultyID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }

    await db.query("UPDATE vehiclerequests SET status = 'cancelled' WHERE id = ?", [requestID]);
    return res.status(200).json({ message: 'Request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling vehicle request:', err);
    return res.status(500).json({ error: 'Failed to cancel request' });
  }
}

async function getVehicleRequestOTP(req, res) {
  try {
    const userID = req.userId;
    const requestID = req.params.id;

    const [facultyRows] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [userID]);
    const facultyID = facultyRows[0]?.id || 0;

    const [rows] = await db.query(`
      SELECT status, start_otp, end_otp
      FROM vehiclerequests
      WHERE id = ? AND (requester_id = ? OR faculty_id = ?)
    `, [requestID, userID, facultyID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const row = rows[0];
    const result = { status: row.status };

    if (row.status === 'assigned' && row.start_otp) {
      result.start_otp = row.start_otp;
      result.otp_type = 'start';
      result.message = 'Share this OTP with the driver to start the trip';
    }

    if (row.status === 'trip_started' && row.end_otp) {
      result.end_otp = row.end_otp;
      result.otp_type = 'end';
      result.message = 'Share this OTP with the driver to end the trip';
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error getting OTP:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

module.exports = {
  createVehicleRequest,
  getMyVehicleRequests,
  cancelVehicleRequest,
  getVehicleRequestOTP
};
