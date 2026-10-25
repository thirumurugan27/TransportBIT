const db = require('../../config/db');

async function recordExists(table, id) {
  if (!id || id <= 0) return false;
  const [rows] = await db.query(`SELECT COUNT(1) as count FROM ${table} WHERE id = ?`, [id]);
  return rows[0].count > 0;
}

async function defaultMappingConflictExists(vehicleId, driverId, excludeId = 0) {
  let vehicleQuery = 'SELECT COUNT(1) as count FROM default_vehicle_drivers WHERE vehicle_id = ?';
  let driverQuery = 'SELECT COUNT(1) as count FROM default_vehicle_drivers WHERE driver_id = ?';
  const vehicleArgs = [vehicleId];
  const driverArgs = [driverId];

  if (excludeId > 0) {
    vehicleQuery += ' AND id <> ?';
    driverQuery += ' AND id <> ?';
    vehicleArgs.push(excludeId);
    driverArgs.push(excludeId);
  }

  const [vRows] = await db.query(vehicleQuery, vehicleArgs);
  const [dRows] = await db.query(driverQuery, driverArgs);

  return {
    vehicleInUse: vRows[0].count > 0,
    driverInUse: dRows[0].count > 0
  };
}

// GET /api/admin/default-vehicle-drivers
async function getDefaultVehicleDrivers(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT dvd.id,
             dvd.vehicle_id,
             dvd.driver_id,
             dvd.notes,
             dvd.created_by,
             DATE_FORMAT(dvd.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
             DATE_FORMAT(dvd.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
             COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
             v.vehicle_number,
             COALESCE(vt.type, '') AS vehicle_type,
             COALESCE(u.full_name, '') AS driver_name,
             COALESCE(u.phone, '') AS driver_phone
      FROM default_vehicle_drivers dvd
      JOIN vehicles v ON v.id = dvd.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      JOIN drivers d ON d.id = dvd.driver_id
      JOIN users u ON u.id = d.user_id
      ORDER BY v.vehicle_number ASC
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetDefaultVehicleDrivers error:', err);
    return res.status(500).json({ error: 'Failed to fetch default driver mappings' });
  }
}

// POST /api/admin/default-vehicle-drivers/create
async function createDefaultVehicleDriver(req, res) {
  try {
    const { vehicle_id, driver_id, notes } = req.body;
    const vehicleId = parseInt(vehicle_id, 10);
    const driverId = parseInt(driver_id, 10);
    const createdBy = req.user ? req.user.user_id : (req.body.created_by || null);

    if (!vehicleId || !driverId || vehicleId <= 0 || driverId <= 0) {
      return res.status(400).json({ error: 'vehicle_id and driver_id must be valid' });
    }

    if (!(await recordExists('vehicles', vehicleId))) {
      return res.status(400).json({ error: 'Vehicle not found' });
    }

    if (!(await recordExists('drivers', driverId))) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const { vehicleInUse, driverInUse } = await defaultMappingConflictExists(vehicleId, driverId, 0);
    if (vehicleInUse) {
      return res.status(409).json({ error: 'This vehicle already has a default driver mapping' });
    }
    if (driverInUse) {
      return res.status(409).json({ error: 'This driver is already mapped to another vehicle' });
    }

    await db.query(`
      INSERT INTO default_vehicle_drivers (vehicle_id, driver_id, notes, created_by)
      VALUES (?, ?, ?, ?)
    `, [vehicleId, driverId, notes || null, createdBy]);

    return res.status(200).json({ message: 'Default driver mapping created successfully' });
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate') || err.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: 'This vehicle already has a default driver mapping' });
    }
    console.error('CreateDefaultVehicleDriver error:', err);
    return res.status(500).json({ error: 'Failed to create default driver mapping' });
  }
}

// PUT /api/admin/default-vehicle-drivers/update
async function updateDefaultVehicleDriver(req, res) {
  try {
    const { id, vehicle_id, driver_id, notes } = req.body;
    const mappingId = parseInt(id, 10);
    const vehicleId = parseInt(vehicle_id, 10);
    const driverId = parseInt(driver_id, 10);

    if (!mappingId || !vehicleId || !driverId || mappingId <= 0 || vehicleId <= 0 || driverId <= 0) {
      return res.status(400).json({ error: 'id, vehicle_id and driver_id must be valid' });
    }

    if (!(await recordExists('default_vehicle_drivers', mappingId))) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    if (!(await recordExists('vehicles', vehicleId))) {
      return res.status(400).json({ error: 'Vehicle not found' });
    }

    if (!(await recordExists('drivers', driverId))) {
      return res.status(400).json({ error: 'Driver not found' });
    }

    const { vehicleInUse, driverInUse } = await defaultMappingConflictExists(vehicleId, driverId, mappingId);
    if (vehicleInUse) {
      return res.status(409).json({ error: 'This vehicle already has a default driver mapping' });
    }
    if (driverInUse) {
      return res.status(409).json({ error: 'This driver is already mapped to another vehicle' });
    }

    const [result] = await db.query(`
      UPDATE default_vehicle_drivers
      SET vehicle_id = ?,
          driver_id = ?,
          notes = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [vehicleId, driverId, notes || null, mappingId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    return res.status(200).json({ message: 'Default driver mapping updated successfully' });
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate') || err.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: 'This vehicle already has a default driver mapping' });
    }
    console.error('UpdateDefaultVehicleDriver error:', err);
    return res.status(500).json({ error: 'Failed to update default driver mapping' });
  }
}

// DELETE /api/admin/default-vehicle-drivers/delete?id={id}
async function deleteDefaultVehicleDriver(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'id is required' });
    }

    const [result] = await db.query('DELETE FROM default_vehicle_drivers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    return res.status(200).json({ message: 'Default driver mapping deleted successfully' });
  } catch (err) {
    console.error('DeleteDefaultVehicleDriver error:', err);
    return res.status(500).json({ error: 'Failed to delete default driver mapping' });
  }
}

module.exports = {
  getDefaultVehicleDrivers,
  createDefaultVehicleDriver,
  updateDefaultVehicleDriver,
  deleteDefaultVehicleDriver
};
