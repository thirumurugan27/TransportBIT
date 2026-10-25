const db = require('../config/db');
const { createAdminNotification, createDriverNotification } = require('./notification.service');

async function vehicleHasActiveWork(vehicleID) {
  try {
    const [assignments] = await db.query(`
      SELECT COUNT(*) AS count FROM assignments
      WHERE vehicle_id = ?
        AND status IN ('assigned', 'active')
        AND CURDATE() BETWEEN start_date AND end_date
    `, [vehicleID]);
    if (assignments[0]?.count > 0) return true;

    const [tempAssignments] = await db.query(`
      SELECT COUNT(*) AS count FROM temporary_assignments
      WHERE vehicle_id = ?
        AND status = 'active'
        AND CURDATE() BETWEEN start_date AND end_date
    `, [vehicleID]);
    if (tempAssignments[0]?.count > 0) return true;

    const [requests] = await db.query(`
      SELECT COUNT(*) AS count FROM vehiclerequests
      WHERE vehicle_id = ?
        AND status IN ('assigned', 'trip_started')
    `, [vehicleID]);
    return (requests[0]?.count || 0) > 0;
  } catch (err) {
    console.error('vehicleHasActiveWork error:', err);
    return false;
  }
}

async function syncVehicleStatus(vehicleID) {
  try {
    const [rows] = await db.query('SELECT status FROM vehicles WHERE id = ?', [vehicleID]);
    if (!rows || rows.length === 0) return;

    const currentStatus = rows[0].status;
    if (currentStatus !== 'active' && currentStatus !== 'available') {
      return;
    }

    const hasWork = await vehicleHasActiveWork(vehicleID);
    if (hasWork) {
      if (currentStatus !== 'active') {
        await db.query("UPDATE vehicles SET status = 'active' WHERE id = ?", [vehicleID]);
        console.log(`[VehicleStatus] vehicle ${vehicleID} → active`);
      }
    } else {
      if (currentStatus === 'active') {
        await db.query("UPDATE vehicles SET status = 'available' WHERE id = ?", [vehicleID]);
        console.log(`[VehicleStatus] vehicle ${vehicleID} → available`);
      }
    }
  } catch (err) {
    console.error(`[VehicleStatus] sync error for vehicle ${vehicleID}:`, err);
  }
}

async function syncAllVehicleStatuses() {
  console.log('[VehicleStatus] starting bulk status sync …');
  try {
    await db.query(`
      UPDATE vehicles v
      SET v.status = 'active'
      WHERE v.status = 'available'
        AND (
          EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.vehicle_id = v.id
              AND a.status IN ('assigned', 'active')
              AND CURDATE() BETWEEN a.start_date AND a.end_date
          )
          OR EXISTS (
            SELECT 1 FROM temporary_assignments ta
            WHERE ta.vehicle_id = v.id
              AND ta.status = 'active'
              AND CURDATE() BETWEEN ta.start_date AND ta.end_date
          )
          OR EXISTS (
            SELECT 1 FROM vehiclerequests vr
            WHERE vr.vehicle_id = v.id
              AND vr.status IN ('assigned', 'trip_started')
          )
        )
    `);

    await db.query(`
      UPDATE vehicles v
      SET v.status = 'available'
      WHERE v.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.vehicle_id = v.id
            AND a.status IN ('assigned', 'active')
            AND CURDATE() BETWEEN a.start_date AND a.end_date
        )
        AND NOT EXISTS (
          SELECT 1 FROM temporary_assignments ta
          WHERE ta.vehicle_id = v.id
            AND ta.status = 'active'
            AND CURDATE() BETWEEN ta.start_date AND ta.end_date
        )
        AND NOT EXISTS (
          SELECT 1 FROM vehiclerequests vr
          WHERE vr.vehicle_id = v.id
            AND vr.status IN ('assigned', 'trip_started')
        )
    `);
    console.log('[VehicleStatus] bulk status sync complete');
  } catch (err) {
    console.error('[VehicleStatus] bulk status sync error:', err);
  }
}

async function autoCompleteExpiredVehicleReplacements() {
  try {
    const [rows] = await db.query(`
      SELECT id, vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id
      FROM vehicle_replacements 
      WHERE status = 'approved' AND end_date < CURDATE()
    `);

    if (!rows || rows.length === 0) return;

    for (const r of rows) {
      await db.query("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", [r.id]);

      if (r.replacement_type === 'driver') {
        await db.query(`
          UPDATE temporary_assignments SET status = 'completed' 
          WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
        `, [r.driver_id, r.vehicle_id]);
      } else {
        await db.query("UPDATE vehicles SET status = 'available' WHERE id = ?", [r.vehicle_id]);
        if (r.replacement_vehicle_id) {
          await db.query(`
            UPDATE temporary_assignments SET status = 'completed' 
            WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
          `, [r.driver_id, r.replacement_vehicle_id]);
        }
      }

      const [veh] = await db.query('SELECT vehicle_number FROM vehicles WHERE id = ?', [r.vehicle_id]);
      const vehicleNumber = veh[0]?.vehicle_number || '';

      const [drv] = await db.query(`
        SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
      `, [r.driver_id]);
      const driverName = drv[0]?.full_name || '';

      if (r.replacement_type === 'driver') {
        const driverMessage = `Your driver replacement period on vehicle ${vehicleNumber} has ended.`;
        await createDriverNotification(r.driver_id, 'Driver Replacement Ended', driverMessage, 'vehicle_change', r.id);

        const adminMessage = `Driver replacement auto-completed. Driver ${driverName} back on vehicle ${vehicleNumber}.`;
        await createAdminNotification('replacement_completed', 'Driver Replacement Auto-Completed', adminMessage);
      } else {
        const driverMessage = `Your original vehicle ${vehicleNumber} is back from ${r.reason || 'maintenance'}. The temporary replacement has ended.`;
        await createDriverNotification(r.driver_id, 'Vehicle Back - Replacement Ended', driverMessage, 'vehicle_change', r.id);

        const adminMessage = `Vehicle ${vehicleNumber} auto-completed from ${r.reason || 'maintenance'}. Driver ${driverName} reassigned.`;
        await createAdminNotification('replacement_completed', 'Replacement Auto-Completed', adminMessage);
      }

      console.log(`Replacement Auto-Completed: type=${r.replacement_type}, id=${r.id}`);
    }
  } catch (err) {
    console.error('Auto-complete vehicle replacements error:', err);
  }
}

module.exports = {
  syncVehicleStatus,
  syncAllVehicleStatuses,
  autoCompleteExpiredVehicleReplacements,
  vehicleHasActiveWork
};
