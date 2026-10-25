const db = require('../../config/db');

async function getBusFleet(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        v.id, v.vehicle_number, vt.type as vehicle_type, v.fuel_type, v.seating_capacity, v.status,
        (SELECT d2.id FROM assignments a2 
         JOIN drivers d2 ON a2.driver_id = d2.id 
         WHERE a2.vehicle_id = v.id AND a2.status = 'assigned' AND DATE(a2.assigned_date) = CURDATE() 
         LIMIT 1) as driver_id,
        (SELECT u2.full_name FROM assignments a2 
         JOIN drivers d2 ON a2.driver_id = d2.id 
         JOIN users u2 ON d2.user_id = u2.id
         WHERE a2.vehicle_id = v.id AND a2.status = 'assigned' AND DATE(a2.assigned_date) = CURDATE() 
         LIMIT 1) as driver_name,
        COALESCE(b.start_point, '') as start_point, 
        COALESCE(b.end_point, '') as end_point,
        COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
        (SELECT COUNT(*) FROM bus_stops bs WHERE bs.vehicle_id = v.id) as total_stops
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON b.vehicle_id = v.id
      WHERE vt.type = 'BUS'
      ORDER BY COALESCE(v.vehicle_name, v.vehicle_number) ASC
    `);

    const buses = (rows || []).map(b => ({
      id: b.id,
      vehicle_number: b.vehicle_number,
      vehicle_type: b.vehicle_type,
      fuel_type: b.fuel_type,
      seating_capacity: b.seating_capacity,
      status: b.status,
      driver_id: b.driver_id,
      driver_name: b.driver_name,
      start_point: b.start_point,
      end_point: b.end_point,
      vehicle_name: b.vehicle_name,
      total_stops: b.total_stops
    }));

    return res.status(200).json(buses);
  } catch (err) {
    console.error('Get bus fleet error:', err);
    return res.status(500).json({ error: 'Error fetching bus fleet' });
  }
}

async function getBusStops(req, res) {
  try {
    const busID = req.params.id;
    if (!busID) {
      return res.status(400).json({ error: 'Bus ID required' });
    }

    const [rows] = await db.query(`
      SELECT id, vehicle_id, stop_name, stop_order, fee, distance_km,
        COALESCE(TIME_FORMAT(arrival_time, '%h:%i %p'), '') as arrival_time
      FROM bus_stops
      WHERE vehicle_id = ?
      ORDER BY stop_order ASC
    `, [busID]);

    const stops = (rows || []).map(s => ({
      id: s.id,
      stop_id: s.id,
      vehicle_id: s.vehicle_id,
      stop_name: s.stop_name,
      stop_order: s.stop_order,
      fee: Number(s.fee || 0),
      distance_km: Number(s.distance_km || 0),
      arrival_time: s.arrival_time
    }));

    return res.status(200).json(stops);
  } catch (err) {
    console.error('Get bus stops error:', err);
    return res.status(500).json({ error: 'Error fetching stops' });
  }
}

async function addBusStop(req, res) {
  try {
    const { vehicle_id, stop_name, fee, distance_km, arrival_time } = req.body;
    let busID = req.body.bus_id || vehicle_id;

    if (!busID) {
      return res.status(400).json({ error: 'Bus ID is required' });
    }

    let stopOrder = req.body.stop_order;
    if (!stopOrder || stopOrder === 0) {
      const [maxRows] = await db.query(
        'SELECT COALESCE(MAX(stop_order), 0) AS max_order FROM bus_stops WHERE vehicle_id = ?',
        [busID]
      );
      stopOrder = (maxRows[0]?.max_order || 0) + 1;
    }

    const arrivalValue = arrival_time && String(arrival_time).trim() ? String(arrival_time).trim() : null;

    await db.query(`
      INSERT INTO bus_stops (vehicle_id, stop_name, stop_order, fee, distance_km, arrival_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [busID, stop_name, stopOrder, fee || 0, distance_km || 0, arrivalValue]);

    return res.status(200).json({ message: 'Stop added successfully' });
  } catch (err) {
    console.error('Add bus stop error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function updateBusStop(req, res) {
  try {
    const { id, stop_name, stop_order, fee, distance_km, arrival_time } = req.body;
    const arrivalValue = arrival_time && String(arrival_time).trim() ? String(arrival_time).trim() : null;

    await db.query(`
      UPDATE bus_stops 
      SET stop_name=?, stop_order=?, fee=?, distance_km=?, arrival_time=?
      WHERE id=?
    `, [stop_name, stop_order, fee || 0, distance_km || 0, arrivalValue, id]);

    return res.status(200).json({ message: 'Stop updated successfully' });
  } catch (err) {
    console.error('Update bus stop error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function deleteBusStop(req, res) {
  try {
    const { id } = req.body;
    await db.query('DELETE FROM bus_stops WHERE id=?', [id]);
    return res.status(200).json({ message: 'Stop deleted successfully' });
  } catch (err) {
    console.error('Delete bus stop error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function updateBusRoute(req, res) {
  try {
    let vehicleID = req.body.vehicle_id || req.body.id;
    if (!vehicleID) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    const { start_point, end_point } = req.body;

    await db.query(`
      INSERT INTO buses (vehicle_id, start_point, end_point)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE start_point=VALUES(start_point), end_point=VALUES(end_point)
    `, [vehicleID, start_point || '', end_point || '']);

    return res.status(200).json({ message: 'Route updated successfully' });
  } catch (err) {
    console.error('Update bus route error:', err);
    return res.status(500).json({ error: 'Failed to update bus route' });
  }
}

async function getAllStops(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT id, stop_name, location, created_at
      FROM stops
      WHERE is_deleted = 0
      ORDER BY stop_name ASC
    `);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAllStops error:', err);
    return res.status(500).json({ error: 'Failed to fetch stops' });
  }
}

module.exports = {
  getBusFleet,
  getBusStops,
  addBusStop,
  updateBusStop,
  deleteBusStop,
  updateBusRoute,
  getAllStops
};
