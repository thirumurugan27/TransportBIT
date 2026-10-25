const db = require('../../config/db');
const { createAdminNotification } = require('../../services/notification.service');

/**
 * Helper: activateVehicleReplacement
 */
async function activateVehicleReplacement(requestID, req) {
  try {
    // 1. Set original vehicle to under_maintenance
    await db.query("UPDATE vehicles SET status = 'under_maintenance' WHERE id = ?", [req.vehicle_id]);

    // 2. Find driver's shift (from regular or EV assignment)
    let shiftID = 0;
    const [regShifts] = await db.query(`
      SELECT a.shift_id AS id FROM assignments a
      WHERE a.driver_id = ? AND a.vehicle_id = ?
      AND CURDATE() BETWEEN a.start_date AND a.end_date
      LIMIT 1
    `, [req.driver_id, req.vehicle_id]);

    if (regShifts && regShifts.length > 0) {
      shiftID = regShifts[0].id;
    } else {
      const [evShifts] = await db.query(`
        SELECT COALESCE(ev.shift_id, 0) AS id
        FROM ev_assignments ev
        JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
        JOIN driver_clusters dc ON ev.cluster_id = dc.id
        JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
        WHERE vgm.vehicle_id = ? AND dcm.driver_id = ?
        AND CURDATE() BETWEEN ev.start_date AND ev.end_date
        AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
        AND (vgm.valid_from IS NULL OR CURDATE() >= vgm.valid_from)
        AND (vgm.valid_to IS NULL OR CURDATE() <= vgm.valid_to)
        LIMIT 1
      `, [req.vehicle_id, req.driver_id]);
      if (evShifts && evShifts.length > 0) {
        shiftID = evShifts[0].id;
      }
    }

    if (!shiftID) {
      const [dShift] = await db.query("SELECT id FROM shifts LIMIT 1");
      if (dShift && dShift.length > 0) {
        shiftID = dShift[0].id;
      }
    }

    // 3. Create temporary assignment with replacement vehicle
    if (req.replacement_vehicle_id && shiftID > 0) {
      await db.query(`
        INSERT INTO temporary_assignments 
        (original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        req.driver_id,
        req.driver_id,
        req.replacement_vehicle_id,
        shiftID,
        req.start_date,
        req.end_date,
        "Replacement: " + (req.reason || '')
      ]);
    }

    // 4. Auto-add replacement vehicle to same vehicle groups temporarily
    if (req.replacement_vehicle_id) {
      const [groups] = await db.query(`
        SELECT group_id, valid_from, valid_to FROM vehicle_group_members 
        WHERE vehicle_id = ? AND CURDATE() BETWEEN valid_from AND valid_to
      `, [req.vehicle_id]);

      if (groups && groups.length > 0) {
        for (const g of groups) {
          await db.query(`
            INSERT IGNORE INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
            VALUES (?, ?, ?, ?)
          `, [g.group_id, req.replacement_vehicle_id, req.start_date, req.end_date]);
        }
      }
    }

    // 5. Notifications
    const [vRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [req.vehicle_id]);
    const vehicleNumber = vRow?.[0]?.vehicle_number || '';

    let replacementVehicleNumber = '';
    if (req.replacement_vehicle_id) {
      const [rvRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [req.replacement_vehicle_id]);
      replacementVehicleNumber = rvRow?.[0]?.vehicle_number || '';
    }

    const start = new Date(req.start_date);
    const end = new Date(req.end_date);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    let message = `Your vehicle ${vehicleNumber} is going for ${req.reason} from ${req.start_date} to ${req.end_date}. `;
    if (replacementVehicleNumber) {
      message += `You have been assigned ${replacementVehicleNumber} for ${days} days. Your original vehicle will be reassigned after this period.`;
    }

    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
      VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
    `, [req.driver_id, "Vehicle Replacement", message, requestID]);

    await db.query("UPDATE vehicle_replacements SET driver_notified = TRUE WHERE id = ?", [requestID]);
  } catch (err) {
    console.error('activateVehicleReplacement error:', err);
  }
}

/**
 * Helper: activateDriverReplacement
 */
async function activateDriverReplacement(requestID, req) {
  try {
    // 1. Find original driver's shift
    let shiftID = 0;
    const [regShifts] = await db.query(`
      SELECT a.shift_id AS id FROM assignments a
      WHERE a.driver_id = ? AND a.vehicle_id = ?
      AND CURDATE() BETWEEN a.start_date AND a.end_date
      LIMIT 1
    `, [req.driver_id, req.vehicle_id]);

    if (regShifts && regShifts.length > 0) {
      shiftID = regShifts[0].id;
    } else {
      const [evShifts] = await db.query(`
        SELECT COALESCE(ev.shift_id, 0) AS id
        FROM ev_assignments ev
        JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
        JOIN driver_clusters dc ON ev.cluster_id = dc.id
        JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
        WHERE vgm.vehicle_id = ? AND dcm.driver_id = ?
        AND CURDATE() BETWEEN ev.start_date AND ev.end_date
        AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
        AND (vgm.valid_from IS NULL OR CURDATE() >= vgm.valid_from)
        AND (vgm.valid_to IS NULL OR CURDATE() <= vgm.valid_to)
        LIMIT 1
      `, [req.vehicle_id, req.driver_id]);
      if (evShifts && evShifts.length > 0) {
        shiftID = evShifts[0].id;
      }
    }

    if (!shiftID) {
      const [dShift] = await db.query("SELECT id FROM shifts LIMIT 1");
      if (dShift && dShift.length > 0) {
        shiftID = dShift[0].id;
      }
    }

    // 2. Create temporary assignment: replacement driver takes over the vehicle
    if (req.replacement_driver_id && shiftID > 0) {
      await db.query(`
        INSERT INTO temporary_assignments 
        (original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        req.driver_id,
        req.replacement_driver_id,
        req.vehicle_id,
        shiftID,
        req.start_date,
        req.end_date,
        "Driver Replacement: " + (req.reason || '')
      ]);
    }

    // 3. Notifications
    const [vRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [req.vehicle_id]);
    const vehicleNumber = vRow?.[0]?.vehicle_number || '';

    const [dRow] = await db.query(`
      SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
    `, [req.driver_id]);
    const driverName = dRow?.[0]?.full_name || '';

    let replacementDriverName = '';
    if (req.replacement_driver_id) {
      const [rdRow] = await db.query(`
        SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
      `, [req.replacement_driver_id]);
      replacementDriverName = rdRow?.[0]?.full_name || '';
    }

    const start = new Date(req.start_date);
    const end = new Date(req.end_date);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Notify original driver
    const origMsg = `You have been replaced by ${replacementDriverName} on vehicle ${vehicleNumber} for ${days} days (${req.start_date} to ${req.end_date}). Reason: ${req.reason}`;
    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
      VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
    `, [req.driver_id, "Driver Replacement", origMsg, requestID]);

    // Notify replacement driver
    if (req.replacement_driver_id) {
      const replMsg = `You have been assigned to vehicle ${vehicleNumber} replacing driver ${driverName} for ${days} days (${req.start_date} to ${req.end_date}). Reason: ${req.reason}`;
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
        VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
      `, [req.replacement_driver_id, "Driver Replacement Assignment", replMsg, requestID]);
    }

    await db.query("UPDATE vehicle_replacements SET driver_notified = TRUE WHERE id = ?", [requestID]);
  } catch (err) {
    console.error('activateDriverReplacement error:', err);
  }
}

/**
 * GET /api/admin/vehicle-replacements
 */
async function getVehicleReplacements(req, res) {
  try {
    const status = req.query.status;

    let query = `
      SELECT 
        r.id, r.vehicle_id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
        r.replacement_vehicle_id, rv.vehicle_number AS replacement_vehicle_number, COALESCE(rv.vehicle_name, rv.vehicle_number) AS replacement_vehicle_name,
        r.driver_id, u.full_name AS driver_name,
        r.reason, r.service_record_id, sr.title AS service_title,
        DATE_FORMAT(r.start_date, '%d-%m-%Y') AS start_date,
        DATE_FORMAT(r.end_date, '%d-%m-%Y') AS end_date,
        r.status, r.notes, r.requested_by_role, r.requested_by_id,
        r.approved_by_id, r.driver_notified,
        DATE_FORMAT(r.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
        DATEDIFF(r.end_date, CURDATE()) AS days_remaining,
        r.replacement_type, r.replacement_driver_id, ru.full_name AS replacement_driver_name
      FROM vehicle_replacements r
      JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN vehicles rv ON r.replacement_vehicle_id = rv.id
      LEFT JOIN drivers d ON r.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN service_records sr ON r.service_record_id = sr.id
      LEFT JOIN drivers rd ON r.replacement_driver_id = rd.id
      LEFT JOIN users ru ON rd.user_id = ru.id
    `;

    const params = [];
    if (status && status !== 'all') {
      query += ` WHERE r.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY r.created_at DESC`;

    const [rows] = await db.query(query, params);
    const requests = (rows || []).map(r => ({
      ...r,
      driver_notified: Boolean(r.driver_notified)
    }));

    return res.status(200).json(requests);
  } catch (err) {
    console.error('Get vehicle replacements error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/create
 */
async function createVehicleReplacement(req, res) {
  try {
    const {
      vehicle_id,
      replacement_vehicle_id,
      driver_id,
      start_date,
      end_date,
      reason,
      service_record_id,
      notes,
      requested_by_role,
      requested_by_id,
      replacement_type,
      replacement_driver_id
    } = req.body;

    const vId = parseInt(vehicle_id, 10);
    const dId = parseInt(driver_id, 10);
    const rvId = replacement_vehicle_id ? parseInt(replacement_vehicle_id, 10) : null;
    const rdId = replacement_driver_id ? parseInt(replacement_driver_id, 10) : null;
    const srId = service_record_id ? parseInt(service_record_id, 10) : null;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const isAdminRole = (requested_by_role || '').toLowerCase() === 'admin';
    let status = isAdminRole ? 'approved' : 'pending';

    const type = replacement_type || 'vehicle';

    const [result] = await db.query(`
      INSERT INTO vehicle_replacements 
      (vehicle_id, replacement_vehicle_id, driver_id, reason, service_record_id, start_date, end_date, status, notes, requested_by_role, requested_by_id, replacement_type, replacement_driver_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vId,
      rvId,
      dId,
      reason || '',
      srId,
      start_date,
      end_date,
      status,
      notes || null,
      requested_by_role || 'admin',
      requested_by_id || req.userId || 1,
      type,
      rdId
    ]);

    const requestID = result.insertId;

    if (isAdminRole) {
      if (type === 'driver' && rdId) {
        await activateDriverReplacement(requestID, {
          vehicle_id: vId,
          driver_id: dId,
          replacement_driver_id: rdId,
          start_date,
          end_date,
          reason,
          service_record_id: srId,
          replacement_type: 'driver'
        });
      } else if (type === 'vehicle' && rvId) {
        await activateVehicleReplacement(requestID, {
          vehicle_id: vId,
          replacement_vehicle_id: rvId,
          driver_id: dId,
          start_date,
          end_date,
          reason,
          service_record_id: srId,
          replacement_type: 'vehicle'
        });
      }
    }

    return res.status(200).json({
      message: 'Vehicle replacement request created successfully',
      id: requestID,
      status
    });
  } catch (err) {
    console.error('Create vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/approve
 */
async function approveVehicleReplacement(req, res) {
  try {
    const { request_id, replacement_vehicle_id, replacement_driver_id, approved_by_id } = req.body;
    const reqID = parseInt(request_id, 10);
    if (!reqID || isNaN(reqID)) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    const rvID = parseInt(replacement_vehicle_id, 10);
    const rdID = replacement_driver_id ? parseInt(replacement_driver_id, 10) : null;
    const adminID = approved_by_id ? parseInt(approved_by_id, 10) : (req.userId || 1);

    const [rows] = await db.query(`
      SELECT vehicle_id, driver_id, start_date, end_date, reason, service_record_id, replacement_type
      FROM vehicle_replacements WHERE id = ?
    `, [reqID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { vehicle_id, driver_id, start_date, end_date, reason, service_record_id, replacement_type } = rows[0];

    if (replacement_type === 'driver') {
      if (!rdID) {
        return res.status(400).json({ error: 'Replacement driver is required' });
      }
      await db.query(`
        UPDATE vehicle_replacements 
        SET status = 'approved', replacement_driver_id = ?, approved_by_id = ?
        WHERE id = ?
      `, [rdID, adminID, reqID]);

      await activateDriverReplacement(reqID, {
        vehicle_id,
        driver_id,
        replacement_driver_id: rdID,
        start_date,
        end_date,
        reason,
        service_record_id,
        replacement_type: 'driver'
      });
    } else {
      if (!rvID) {
        return res.status(400).json({ error: 'Replacement vehicle is required' });
      }
      await db.query(`
        UPDATE vehicle_replacements 
        SET status = 'approved', replacement_vehicle_id = ?, approved_by_id = ?
        WHERE id = ?
      `, [rvID, adminID, reqID]);

      await activateVehicleReplacement(reqID, {
        vehicle_id,
        replacement_vehicle_id: rvID,
        driver_id,
        start_date,
        end_date,
        reason,
        service_record_id,
        replacement_type: 'vehicle'
      });
    }

    return res.status(200).json({ message: 'Replacement approved and activated' });
  } catch (err) {
    console.error('Approve vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/complete
 */
async function completeVehicleReplacement(req, res) {
  try {
    const { request_id } = req.body;
    const reqID = parseInt(request_id, 10);
    if (!reqID || isNaN(reqID)) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const [rows] = await db.query(`
      SELECT vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id
      FROM vehicle_replacements WHERE id = ?
    `, [reqID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id } = rows[0];

    await db.query("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", [reqID]);

    const [vRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [vehicle_id]);
    const vehicleNumber = vRow?.[0]?.vehicle_number || '';

    const [dRow] = await db.query(`
      SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
    `, [driver_id]);
    const driverName = dRow?.[0]?.full_name || '';

    if (replacement_type === 'driver') {
      await db.query(`
        UPDATE temporary_assignments SET status = 'completed' 
        WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
      `, [driver_id, vehicle_id]);

      const driverMessage = `Your replacement period on vehicle ${vehicleNumber} has ended. You are back on duty. Reason: ${reason}`;
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
        VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
      `, [driver_id, "Driver Replacement Ended", driverMessage, reqID]);

      if (replacement_driver_id) {
        const replMsg = `Your temporary assignment on vehicle ${vehicleNumber} has ended. Original driver ${driverName} is back.`;
        await db.query(`
          INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
          VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
        `, [replacement_driver_id, "Temporary Assignment Ended", replMsg, reqID]);
      }

      await createAdminNotification("replacement_completed", "Driver Replacement Completed", `Driver replacement completed. Driver ${driverName} is back on vehicle ${vehicleNumber}.`);
    } else {
      await db.query("UPDATE vehicles SET status = 'available' WHERE id = ?", [vehicle_id]);

      if (replacement_vehicle_id) {
        await db.query(`
          UPDATE temporary_assignments SET status = 'completed' 
          WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
        `, [driver_id, replacement_vehicle_id]);

        await db.query(`
          DELETE FROM vehicle_group_members 
          WHERE vehicle_id = ? AND valid_to <= CURDATE()
        `, [replacement_vehicle_id]);
      }

      const driverMessage = `Your original vehicle ${vehicleNumber} is back from ${reason}. The temporary replacement has ended.`;
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
        VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
      `, [driver_id, "Vehicle Back - Replacement Ended", driverMessage, reqID]);

      await createAdminNotification("replacement_completed", "Vehicle Replacement Completed", `Vehicle ${vehicleNumber} is back from ${reason}. Driver ${driverName} reassigned to original vehicle.`);
    }

    return res.status(200).json({ message: 'Replacement completed successfully' });
  } catch (err) {
    console.error('Complete vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Auto-complete expired vehicle replacements
 */
async function autoCompleteExpiredVehicleReplacements() {
  try {
    const [rows] = await db.query(`
      SELECT id, vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id
      FROM vehicle_replacements 
      WHERE status = 'approved' AND end_date < CURDATE()
    `);

    for (const row of (rows || [])) {
      const { id, vehicle_id, driver_id, replacement_vehicle_id, reason, replacement_type, replacement_driver_id } = row;

      await db.query("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", [id]);

      const [vRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [vehicle_id]);
      const vehicleNumber = vRow?.[0]?.vehicle_number || '';

      const [dRow] = await db.query(`
        SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?
      `, [driver_id]);
      const driverName = dRow?.[0]?.full_name || '';

      if (replacement_type === 'driver') {
        await db.query(`
          UPDATE temporary_assignments SET status = 'completed' 
          WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
        `, [driver_id, vehicle_id]);

        await db.query(`
          INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
          VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
        `, [driver_id, "Driver Replacement Ended", `Your driver replacement period on vehicle ${vehicleNumber} has ended.`, id]);

        await createAdminNotification("replacement_completed", "Driver Replacement Auto-Completed", `Driver replacement auto-completed. Driver ${driverName} back on vehicle ${vehicleNumber}.`);
      } else {
        await db.query("UPDATE vehicles SET status = 'available' WHERE id = ?", [vehicle_id]);
        if (replacement_vehicle_id) {
          await db.query(`
            UPDATE temporary_assignments SET status = 'completed' 
            WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
          `, [driver_id, replacement_vehicle_id]);
        }

        await db.query(`
          INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id)
          VALUES ('DRIVER', ?, ?, ?, 'vehicle_change', ?)
        `, [driver_id, "Vehicle Back - Replacement Ended", `Your original vehicle ${vehicleNumber} is back from ${reason}. The temporary replacement has ended.`, id]);

        await createAdminNotification("replacement_completed", "Replacement Auto-Completed", `Vehicle ${vehicleNumber} auto-completed from ${reason}. Driver ${driverName} reassigned.`);
      }
    }
  } catch (err) {
    console.error('AutoCompleteExpiredVehicleReplacements error:', err);
  }
}

/**
 * GET /api/admin/vehicle-replacements/available-vehicles
 */
async function getAvailableReplacementVehiclesNew(req, res) {
  try {
    const { start_date, end_date, vehicle_type, exclude_vehicle_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }

    let query = `
      SELECT v.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, v.seating_capacity, v.fuel_type, v.status,
             COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.status IN ('active', 'available')
      AND v.id NOT IN (
        SELECT DISTINCT vr.replacement_vehicle_id FROM vehicle_replacements vr
        WHERE vr.replacement_vehicle_id IS NOT NULL
        AND vr.status IN ('approved')
        AND vr.start_date <= ? AND vr.end_date >= ?
      )
      AND v.id NOT IN (
        SELECT DISTINCT vr.vehicle_id FROM vehicle_replacements vr
        WHERE vr.status IN ('pending', 'approved')
        AND vr.start_date <= ? AND vr.end_date >= ?
      )
    `;

    const args = [end_date, start_date, end_date, start_date];

    if (exclude_vehicle_id) {
      query += ` AND v.id != ?`;
      args.push(exclude_vehicle_id);
    }

    if (vehicle_type) {
      query += ` AND COALESCE(vt.type, '') = ?`;
      args.push(vehicle_type);
    }

    query += ` ORDER BY COALESCE(vt.type, ''), v.vehicle_number`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Get available vehicles error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/vehicle-replacements/vehicle-drivers
 */
async function getVehicleDriversNew(req, res) {
  try {
    const vehicleID = req.query.vehicle_id;
    if (!vehicleID) {
      return res.status(400).json({ error: 'vehicle_id required' });
    }

    const drivers = [];

    // Regular assignments
    const [regRows] = await db.query(`
      SELECT DISTINCT d.id, u.full_name,
             a.shift_id, COALESCE(s.name, '') AS shift_name,
             COALESCE(CONCAT(TIME_FORMAT(s.start_time, '%h:%i %p'), ' - ', TIME_FORMAT(s.end_time, '%h:%i %p')), '') AS shift_time,
             FALSE AS is_ev
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.vehicle_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
    `, [vehicleID]);

    for (const r of (regRows || [])) {
      drivers.push({
        id: r.id,
        full_name: r.full_name,
        shift_id: r.shift_id,
        shift_name: r.shift_name,
        shift_time: r.shift_time,
        is_ev: false
      });
    }

    // EV cluster assignments
    const [evRows] = await db.query(`
      SELECT DISTINCT d.id, u.full_name,
             ev.shift_id, COALESCE(s.name, 'EV Duty') AS shift_name,
             COALESCE(CONCAT(TIME_FORMAT(s.start_time, '%h:%i %p'), ' - ', TIME_FORMAT(s.end_time, '%h:%i %p')), '') AS shift_time,
             TRUE AS is_ev
      FROM ev_assignments ev
      JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
      JOIN driver_clusters dc ON ev.cluster_id = dc.id
      JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      JOIN drivers d ON d.id = dcm.driver_id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN shifts s ON ev.shift_id = s.id
      WHERE vgm.vehicle_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date AND ev.status = 'active'
      AND (vgm.valid_from IS NULL OR CURDATE() >= vgm.valid_from)
      AND (vgm.valid_to IS NULL OR CURDATE() <= vgm.valid_to)
    `, [vehicleID]);

    for (const r of (evRows || [])) {
      drivers.push({
        id: r.id,
        full_name: r.full_name,
        shift_id: r.shift_id,
        shift_name: r.shift_name,
        shift_time: r.shift_time,
        is_ev: true
      });
    }

    return res.status(200).json(drivers);
  } catch (err) {
    console.error('Get vehicle drivers error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/reject
 */
async function rejectVehicleReplacement(req, res) {
  try {
    const { request_id, reason } = req.body;
    await db.query(`
      UPDATE vehicle_replacements 
      SET status = 'rejected', notes = CONCAT(COALESCE(notes, ''), ' | Rejected: ', ?)
      WHERE id = ?
    `, [reason || '', request_id]);

    return res.status(200).json({ message: 'Vehicle replacement request rejected' });
  } catch (err) {
    console.error('Reject vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/update
 */
async function updateVehicleReplacement(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.params?.id;
    const { start_date, end_date, reason, notes } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query("SELECT status FROM vehicle_replacements WHERE id = ?", [request_id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const status = rows[0].status;
    if (status !== 'pending' && status !== 'approved') {
      return res.status(400).json({ error: 'Cannot edit completed or rejected requests' });
    }

    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (end < start) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }

    await db.query(`
      UPDATE vehicle_replacements SET start_date = ?, end_date = ?, reason = ?, notes = ? WHERE id = ?
    `, [start_date, end_date, reason, notes, request_id]);

    if (status === 'approved') {
      await db.query(`
        UPDATE temporary_assignments ta
        JOIN vehicle_replacements vr ON ta.original_driver_id = vr.driver_id AND ta.status = 'active'
        SET ta.start_date = ?, ta.end_date = ?
        WHERE vr.id = ?
      `, [start_date, end_date, request_id]);
    }

    return res.status(200).json({ message: 'Vehicle replacement updated successfully' });
  } catch (err) {
    console.error('Update vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/vehicle-replacements/delete
 */
async function deleteVehicleReplacement(req, res) {
  try {
    const request_id = req.body?.request_id || req.body?.id || req.query?.request_id || req.query?.id || req.params?.id;

    if (!request_id) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    const [rows] = await db.query(`
      SELECT status, vehicle_id, replacement_vehicle_id, driver_id, replacement_type
      FROM vehicle_replacements WHERE id = ?
    `, [request_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { status, vehicle_id, replacement_vehicle_id, driver_id, replacement_type } = rows[0];

    if (status === 'approved') {
      if (replacement_type === 'driver') {
        await db.query(`
          DELETE FROM temporary_assignments 
          WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
        `, [driver_id, vehicle_id]);
      } else {
        await db.query("UPDATE vehicles SET status = 'available' WHERE id = ?", [vehicle_id]);
        if (replacement_vehicle_id) {
          await db.query(`
            DELETE FROM temporary_assignments 
            WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
          `, [driver_id, replacement_vehicle_id]);
        }
      }

      const [vRow] = await db.query("SELECT vehicle_number FROM vehicles WHERE id = ?", [vehicle_id]);
      const vehicleNumber = vRow?.[0]?.vehicle_number || '';
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, title, message, type)
        VALUES ('DRIVER', ?, ?, ?, 'info')
      `, [driver_id, "Replacement Cancelled", `The replacement for ${vehicleNumber} has been cancelled by admin.`]);
    }

    await db.query("DELETE FROM vehicle_replacements WHERE id = ?", [request_id]);

    return res.status(200).json({ message: 'Replacement deleted successfully' });
  } catch (err) {
    console.error('Delete vehicle replacement error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/vehicle-replacements/pending-count
 */
async function getPendingVehicleReplacementsCount(req, res) {
  try {
    const [rows] = await db.query("SELECT COUNT(*) AS count FROM vehicle_replacements WHERE status = 'pending'");
    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('GetPendingVehicleReplacementsCount error:', err);
    return res.status(200).json({ count: 0 });
  }
}

/**
 * POST /api/admin/vehicle-replacements/check-expired
 */
async function checkExpiredVehicleReplacements(req, res) {
  try {
    await autoCompleteExpiredVehicleReplacements();
    return res.status(200).json({ message: 'Expired vehicle replacements checked and auto-completed' });
  } catch (err) {
    console.error('CheckExpiredVehicleReplacements error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/vehicle-replacements/stats
 */
async function getVehicleReplacementStats(req, res) {
  try {
    const [tot] = await db.query("SELECT COUNT(*) AS total FROM vehicle_replacements");
    const [act] = await db.query("SELECT COUNT(*) AS active FROM vehicle_replacements WHERE status = 'approved'");
    const [pen] = await db.query("SELECT COUNT(*) AS pending FROM vehicle_replacements WHERE status = 'pending'");
    const [com] = await db.query("SELECT COUNT(*) AS completed FROM vehicle_replacements WHERE status = 'completed'");
    const [mon] = await db.query(`
      SELECT COUNT(*) AS this_month FROM vehicle_replacements 
      WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
    `);

    return res.status(200).json({
      total: tot[0]?.total || 0,
      active: act[0]?.active || 0,
      pending: pen[0]?.pending || 0,
      completed: com[0]?.completed || 0,
      this_month: mon[0]?.this_month || 0
    });
  } catch (err) {
    console.error('GetVehicleReplacementStats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/vehicle-replacements/available-drivers
 */
async function getAvailableReplacementDrivers(req, res) {
  try {
    const { start_date, end_date, exclude_driver_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }

    let query = `
      SELECT d.id, u.full_name, u.phone, d.license_type
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE u.status = 'active'
      AND d.id NOT IN (
        SELECT lr.driver_id FROM leave_requests lr
        WHERE lr.status = 'admin_approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
      )
      AND d.id NOT IN (
        SELECT ta.replacement_driver_id FROM temporary_assignments ta
        WHERE ta.status = 'active'
        AND ta.start_date <= ? AND ta.end_date >= ?
      )
      AND d.id NOT IN (
        SELECT vr.replacement_driver_id FROM vehicle_replacements vr
        WHERE vr.status IN ('pending', 'approved')
        AND vr.replacement_type = 'driver'
        AND vr.replacement_driver_id IS NOT NULL
        AND vr.start_date <= ? AND vr.end_date >= ?
      )
    `;

    const args = [end_date, start_date, end_date, start_date, end_date, start_date];

    if (exclude_driver_id) {
      query += ` AND d.id != ?`;
      args.push(exclude_driver_id);
    }

    query += ` ORDER BY u.full_name`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('Get available replacement drivers error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/vehicle-replacements/driver-vehicle
 */
async function getDriverVehicle(req, res) {
  try {
    const driverID = req.query.driver_id;
    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const vehicles = [];

    // Regular assignments
    const [regRows] = await db.query(`
      SELECT DISTINCT v.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
             a.shift_id, COALESCE(s.name, '') AS shift_name, FALSE AS is_ev
      FROM assignments a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.driver_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
    `, [driverID]);

    for (const vi of (regRows || [])) {
      vehicles.push({
        id: vi.id,
        vehicle_number: vi.vehicle_number,
        vehicle_type: vi.vehicle_type,
        vehicle_name: vi.vehicle_name,
        shift_id: vi.shift_id,
        shift_name: vi.shift_name,
        is_ev: false
      });
    }

    // EV cluster assignments
    const [evRows] = await db.query(`
      SELECT DISTINCT v.id, v.vehicle_number, COALESCE(vt.type, '') AS vehicle_type, COALESCE(v.vehicle_name, v.vehicle_number) AS vehicle_name,
             ev.shift_id, COALESCE(s.name, 'EV Duty') AS shift_name, TRUE AS is_ev
      FROM ev_assignments ev
      JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
      JOIN vehicles v ON v.id = vgm.vehicle_id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      JOIN driver_clusters dc ON ev.cluster_id = dc.id
      JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
      LEFT JOIN shifts s ON ev.shift_id = s.id
      WHERE dcm.driver_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date AND ev.status = 'active'
      AND (vgm.valid_from IS NULL OR CURDATE() >= vgm.valid_from)
      AND (vgm.valid_to IS NULL OR CURDATE() <= vgm.valid_to)
    `, [driverID]);

    for (const vi of (evRows || [])) {
      vehicles.push({
        id: vi.id,
        vehicle_number: vi.vehicle_number,
        vehicle_type: vi.vehicle_type,
        vehicle_name: vi.vehicle_name,
        shift_id: vi.shift_id,
        shift_name: vi.shift_name,
        is_ev: true
      });
    }

    return res.status(200).json(vehicles);
  } catch (err) {
    console.error('GetDriverVehicle error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getVehicleReplacements,
  createVehicleReplacement,
  approveVehicleReplacement,
  completeVehicleReplacement,
  autoCompleteExpiredVehicleReplacements,
  getAvailableReplacementVehiclesNew,
  getVehicleDriversNew,
  rejectVehicleReplacement,
  updateVehicleReplacement,
  deleteVehicleReplacement,
  getPendingVehicleReplacementsCount,
  checkExpiredVehicleReplacements,
  getVehicleReplacementStats,
  getAvailableReplacementDrivers,
  getDriverVehicle
};
