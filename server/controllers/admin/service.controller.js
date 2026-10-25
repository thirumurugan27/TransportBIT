const db = require('../../config/db');

/**
 * Recalculate parts_cost and total_cost for a service record
 */
async function recalcServiceCost(serviceRecordID) {
  if (!serviceRecordID || serviceRecordID <= 0) return;
  try {
    const [pRows] = await db.query(`SELECT COALESCE(SUM(total_price), 0) AS parts_cost FROM parts_purchased WHERE service_record_id = ?`, [serviceRecordID]);
    const partsCost = parseFloat(pRows?.[0]?.parts_cost) || 0;

    const [sRows] = await db.query(`SELECT labor_cost FROM service_records WHERE id = ?`, [serviceRecordID]);
    const laborCost = parseFloat(sRows?.[0]?.labor_cost) || 0;

    const totalCost = laborCost + partsCost;
    await db.query(`UPDATE service_records SET parts_cost = ?, total_cost = ? WHERE id = ?`, [partsCost, totalCost, serviceRecordID]);
  } catch (e) {
    console.error('recalcServiceCost error:', e);
  }
}

/**
 * Notify drivers assigned to a vehicle about service
 */
async function notifyDriversOfService(serviceID, vehicleID, serviceTitle, notifType) {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT d.user_id FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      WHERE a.vehicle_id = ? AND a.status = 'active' AND (a.end_date IS NULL OR a.end_date >= CURDATE())
    `, [vehicleID]);

    let titleText = 'Service Update';
    let messageText = `Update for service: ${serviceTitle}`;

    switch (notifType) {
      case 'service_scheduled':
        titleText = 'Vehicle Service Scheduled';
        messageText = `Service '${serviceTitle}' has been scheduled for your assigned vehicle.`;
        break;
      case 'service_approved':
        titleText = 'Service Request Approved';
        messageText = `Your service request '${serviceTitle}' has been approved.`;
        break;
      case 'service_completed':
        titleText = 'Service Completed';
        messageText = `Service '${serviceTitle}' for your vehicle has been completed. Vehicle is now available.`;
        break;
    }

    for (const r of (rows || [])) {
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, type, title, message, reference_id, is_read)
        VALUES ('DRIVER', ?, ?, ?, ?, ?, FALSE)
      `, [r.user_id, notifType, titleText, messageText, serviceID]);
    }
  } catch (e) {
    console.error('notifyDriversOfService error:', e);
  }
}

/**
 * GET /api/admin/services
 */
async function getAllServiceRecords(req, res) {
  try {
    const { status, vehicle_id, severity, date_from, date_to } = req.query;

    let query = `
      SELECT 
        sr.id, sr.vehicle_id, sr.reported_by, sr.assigned_to_admin,
        sr.title, COALESCE(sr.description, '') AS description, sr.severity, sr.status,
        sr.odometer_at_service, 
        DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y') AS scheduled_date, 
        DATE_FORMAT(sr.started_at, '%d-%m-%Y %h:%i %p') AS started_at, 
        DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p') AS completed_at,
        COALESCE(sr.workshop_name, '') AS workshop_name, COALESCE(sr.mechanic_name, '') AS mechanic_name, COALESCE(sr.mechanic_contact, '') AS mechanic_contact,
        sr.labor_cost, sr.parts_cost, sr.total_cost,
        DATE_FORMAT(sr.next_service_date, '%d-%m-%Y') AS next_service_date, sr.next_service_km,
        COALESCE(sr.admin_remarks, '') AS admin_remarks, COALESCE(sr.rejection_reason, '') AS rejection_reason,
        DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p') AS created_at, 
        DATE_FORMAT(sr.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
        COALESCE(v.vehicle_number, '') AS vehicle_number, COALESCE(v.vehicle_name, '') AS vehicle_name, COALESCE(vt.type, '') AS vehicle_type,
        COALESCE(reporter.full_name, '') AS reported_by_name, COALESCE(adm.full_name, '') AS admin_name
      FROM service_records sr
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN users reporter ON sr.reported_by = reporter.id
      LEFT JOIN users adm ON sr.assigned_to_admin = adm.id
      WHERE 1=1
    `;

    const args = [];

    if (status) {
      query += ` AND sr.status = ?`;
      args.push(status);
    }
    if (vehicle_id) {
      query += ` AND sr.vehicle_id = ?`;
      args.push(vehicle_id);
    }
    if (severity) {
      query += ` AND sr.severity = ?`;
      args.push(severity);
    }
    if (date_from) {
      query += ` AND sr.created_at >= ?`;
      args.push(date_from);
    }
    if (date_to) {
      query += ` AND sr.created_at <= ?`;
      args.push(date_to + ' 23:59:59');
    }

    query += ` ORDER BY sr.created_at DESC`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetAllServiceRecords error:', err);
    return res.status(200).json([]);
  }
}

/**
 * GET /api/admin/services/:id
 */
async function getServiceRecordByID(req, res) {
  try {
    const id = req.params.id;

    const [rows] = await db.query(`
      SELECT 
        sr.id, sr.vehicle_id, sr.reported_by, sr.assigned_to_admin,
        sr.title, COALESCE(sr.description, '') AS description, sr.severity, sr.status,
        sr.odometer_at_service, 
        DATE_FORMAT(sr.scheduled_date, '%d-%m-%Y') AS scheduled_date, 
        DATE_FORMAT(sr.started_at, '%d-%m-%Y %h:%i %p') AS started_at, 
        DATE_FORMAT(sr.completed_at, '%d-%m-%Y %h:%i %p') AS completed_at,
        COALESCE(sr.workshop_name, '') AS workshop_name, COALESCE(sr.mechanic_name, '') AS mechanic_name, COALESCE(sr.mechanic_contact, '') AS mechanic_contact,
        sr.labor_cost, sr.parts_cost, sr.total_cost,
        DATE_FORMAT(sr.next_service_date, '%d-%m-%Y') AS next_service_date, sr.next_service_km,
        COALESCE(sr.admin_remarks, '') AS admin_remarks, COALESCE(sr.rejection_reason, '') AS rejection_reason,
        DATE_FORMAT(sr.created_at, '%d-%m-%Y %h:%i %p') AS created_at, 
        DATE_FORMAT(sr.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
        COALESCE(v.vehicle_number, '') AS vehicle_number, COALESCE(v.vehicle_name, '') AS vehicle_name, COALESCE(vt.type, '') AS vehicle_type,
        COALESCE(reporter.full_name, '') AS reported_by_name, COALESCE(adm.full_name, '') AS admin_name
      FROM service_records sr
      LEFT JOIN vehicles v ON sr.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN users reporter ON sr.reported_by = reporter.id
      LEFT JOIN users adm ON sr.assigned_to_admin = adm.id
      WHERE sr.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Service record not found' });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('GetServiceRecordByID error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/services
 */
async function createServiceRecord(req, res) {
  try {
    const {
      vehicle_id, title, description, severity,
      odometer_at_service, scheduled_date, workshop_name, mechanic_name, mechanic_contact, labor_cost
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const vId = parseInt(vehicle_id, 10);
    if (!vId) {
      return res.status(400).json({ error: 'Vehicle is required' });
    }

    const adminID = req.userId || 1;
    const sev = severity || 'medium';

    const [result] = await db.query(`
      INSERT INTO service_records 
      (vehicle_id, assigned_to_admin, title, description, severity, status,
       odometer_at_service, scheduled_date, workshop_name, mechanic_name, mechanic_contact, labor_cost)
      VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)
    `, [
      vId, adminID, title, description || null, sev,
      odometer_at_service || null, scheduled_date || null, workshop_name || null, mechanic_name || null, mechanic_contact || null, parseFloat(labor_cost) || 0
    ]);

    const id = result.insertId;
    notifyDriversOfService(id, vId, title, 'service_scheduled');

    return res.status(200).json({ message: 'Service record created successfully', id });
  } catch (err) {
    console.error('CreateServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to create service record: ' + err.message });
  }
}

/**
 * PUT /api/admin/services
 */
async function updateServiceRecord(req, res) {
  try {
    const {
      id, title, description, severity,
      odometer_at_service, scheduled_date, workshop_name, mechanic_name, mechanic_contact,
      labor_cost, admin_remarks
    } = req.body;

    await db.query(`
      UPDATE service_records SET
        title = ?, description = ?, severity = ?,
        odometer_at_service = ?, scheduled_date = ?,
        workshop_name = ?, mechanic_name = ?, mechanic_contact = ?,
        labor_cost = ?, admin_remarks = ?
      WHERE id = ?
    `, [
      title, description || null, severity || 'medium',
      odometer_at_service || null, scheduled_date || null,
      workshop_name || null, mechanic_name || null, mechanic_contact || null,
      parseFloat(labor_cost) || 0, admin_remarks || null, id
    ]);

    await recalcServiceCost(id);

    return res.status(200).json({ message: 'Service record updated successfully' });
  } catch (err) {
    console.error('UpdateServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to update service record: ' + err.message });
  }
}

/**
 * POST /api/admin/services/:id/approve
 */
async function approveServiceRequest(req, res) {
  try {
    const id = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid service record ID required' });
    }
    const adminID = req.userId || 1;
    const { scheduled_date, admin_remarks } = req.body;

    await db.query(`
      UPDATE service_records SET status = 'approved', assigned_to_admin = ?, scheduled_date = ?, admin_remarks = ?
      WHERE id = ? AND status = 'reported'
    `, [adminID, scheduled_date || null, admin_remarks || null, id]);

    const [sRow] = await db.query(`SELECT vehicle_id, title FROM service_records WHERE id = ?`, [id]);
    if (sRow && sRow.length > 0) {
      notifyDriversOfService(id, sRow[0].vehicle_id, sRow[0].title, 'service_approved');
    }

    return res.status(200).json({ message: 'Service request approved' });
  } catch (err) {
    console.error('ApproveServiceRequest error:', err);
    return res.status(500).json({ error: 'Failed to approve service request: ' + err.message });
  }
}

/**
 * POST /api/admin/services/:id/reject
 */
async function rejectServiceRequest(req, res) {
  try {
    const id = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid service record ID required' });
    }
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    await db.query(`
      UPDATE service_records SET status = 'rejected', rejection_reason = ?
      WHERE id = ? AND status = 'reported'
    `, [rejection_reason.trim(), id]);

    const [sRow] = await db.query(`SELECT reported_by, title FROM service_records WHERE id = ?`, [id]);
    if (sRow && sRow.length > 0 && sRow[0].reported_by) {
      await db.query(`
        INSERT INTO notifications (recipient_role, recipient_id, type, title, message, is_read)
        VALUES ('DRIVER', ?, 'service_rejected', ?, ?, FALSE)
      `, [
        sRow[0].reported_by,
        'Service Request Rejected',
        `Your service request '${sRow[0].title}' has been rejected. Reason: ${rejection_reason.trim()}`
      ]);
    }

    return res.status(200).json({ message: 'Service request rejected' });
  } catch (err) {
    console.error('RejectServiceRequest error:', err);
    return res.status(500).json({ error: 'Failed to reject service request: ' + err.message });
  }
}

/**
 * POST /api/admin/services/:id/start
 */
async function startServiceRecord(req, res) {
  let conn;
  try {
    const id = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid service record ID required' });
    }
    const { replacement_vehicle_id, replacement_end_date, workshop_name, mechanic_name, mechanic_contact, labor_cost } = req.body;

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(`
      UPDATE service_records SET status = 'in_progress', started_at = NOW(),
        workshop_name = ?, mechanic_name = ?, mechanic_contact = ?, labor_cost = ?
      WHERE id = ? AND status = 'approved'
    `, [workshop_name || null, mechanic_name || null, mechanic_contact || null, parseFloat(labor_cost) || 0, id]);

    const [sRow] = await conn.query(`SELECT vehicle_id FROM service_records WHERE id = ?`, [id]);
    const vehicleID = sRow?.[0]?.vehicle_id;

    if (vehicleID) {
      await conn.query(`UPDATE vehicles SET status = 'under_maintenance' WHERE id = ?`, [vehicleID]);
    }

    await conn.commit();
    conn.release();
    conn = null;

    // Handle replacement vehicle if selected
    if (replacement_vehicle_id && parseInt(replacement_vehicle_id, 10) > 0 && vehicleID) {
      const rvID = parseInt(replacement_vehicle_id, 10);
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      let endDate = replacement_end_date;
      if (!endDate) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        endDate = d.toISOString().slice(0, 10);
      }

      let driverID = 0;
      const [regD] = await db.query(`
        SELECT d.id FROM assignments a 
        JOIN drivers d ON a.driver_id = d.id
        WHERE a.vehicle_id = ? AND CURDATE() BETWEEN a.start_date AND a.end_date
        LIMIT 1
      `, [vehicleID]);

      if (regD && regD.length > 0) {
        driverID = regD[0].id;
      } else {
        const [evD] = await db.query(`
          SELECT dcm.driver_id FROM ev_assignments ev
          JOIN vehicle_group_members vgm ON vgm.group_id = ev.vehicle_group_id
          JOIN driver_clusters dc ON ev.cluster_id = dc.id
          JOIN driver_cluster_members dcm ON dcm.cluster_id = dc.id
          WHERE vgm.vehicle_id = ? AND CURDATE() BETWEEN ev.start_date AND ev.end_date
          AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
          AND (vgm.valid_from IS NULL OR CURDATE() >= vgm.valid_from)
          AND (vgm.valid_to IS NULL OR CURDATE() <= vgm.valid_to)
          LIMIT 1
        `, [vehicleID]);
        if (evD && evD.length > 0) {
          driverID = evD[0].driver_id;
        }
      }

      if (driverID > 0) {
        const adminID = req.userId || 1;
        const [rRes] = await db.query(`
          INSERT INTO vehicle_replacements 
          (vehicle_id, replacement_vehicle_id, driver_id, reason, service_record_id, start_date, end_date, status, requested_by_role, requested_by_id)
          VALUES (?, ?, ?, 'service_repair', ?, ?, ?, 'approved', 'admin', ?)
        `, [vehicleID, rvID, driverID, id, startDate, endDate, adminID]);

        // Create temp assignment
        const [sRows] = await db.query("SELECT id FROM shifts LIMIT 1");
        const shiftID = sRows?.[0]?.id || 1;

        await db.query(`
          INSERT INTO temporary_assignments 
          (original_driver_id, replacement_driver_id, vehicle_id, shift_id, start_date, end_date, reason, status)
          VALUES (?, ?, ?, ?, ?, ?, 'service_repair', 'active')
        `, [driverID, driverID, rvID, shiftID, startDate, endDate]);
      }
    }

    return res.status(200).json({ message: 'Service started, vehicle marked under maintenance' });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('StartServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to start service: ' + err.message });
  }
}

/**
 * POST /api/admin/services/:id/complete
 */
async function completeServiceRecord(req, res) {
  let conn;
  try {
    const id = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid service record ID required' });
    }
    const { admin_remarks, next_service_date, next_service_km, labor_cost } = req.body;

    conn = await db.getConnection();
    await conn.beginTransaction();

    if (labor_cost && parseFloat(labor_cost) > 0) {
      await conn.query(`UPDATE service_records SET labor_cost = ? WHERE id = ?`, [parseFloat(labor_cost), id]);
    }

    const [pRows] = await conn.query(`SELECT COALESCE(SUM(total_price), 0) AS parts_cost FROM parts_purchased WHERE service_record_id = ?`, [id]);
    const partsCost = parseFloat(pRows?.[0]?.parts_cost) || 0;

    const [sRows] = await conn.query(`SELECT labor_cost, vehicle_id, title FROM service_records WHERE id = ?`, [id]);
    const laborCost = parseFloat(sRows?.[0]?.labor_cost) || 0;
    const vehicleID = sRows?.[0]?.vehicle_id;
    const title = sRows?.[0]?.title || '';
    const totalCost = laborCost + partsCost;

    const nextDate = (next_service_date && next_service_date.trim()) ? next_service_date.trim() : null;

    await conn.query(`
      UPDATE service_records SET 
        status = 'completed', completed_at = NOW(), admin_remarks = ?,
        next_service_date = ?, next_service_km = ?,
        parts_cost = ?, total_cost = ?
      WHERE id = ? AND (status = 'in_progress' OR status = 'approved')
    `, [admin_remarks || null, nextDate, next_service_km || null, partsCost, totalCost, id]);

    if (vehicleID) {
      await conn.query(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [vehicleID]);

      let currentKm = 0;
      const [kmRows] = await conn.query(`SELECT COALESCE(MAX(end_km), 0) AS current_km FROM km_logs WHERE vehicle_id = ?`, [vehicleID]);
      currentKm = kmRows?.[0]?.current_km || 0;

      const [srOdo] = await conn.query(`SELECT odometer_at_service FROM service_records WHERE id = ?`, [id]);
      if (srOdo?.[0]?.odometer_at_service && srOdo[0].odometer_at_service > currentKm) {
        currentKm = srOdo[0].odometer_at_service;
      }

      await conn.query(`
        UPDATE vehicle_service_tracking SET last_serviced_km = ?, last_service_date = CURDATE(), updated_at = NOW()
        WHERE vehicle_id = ?
      `, [currentKm, vehicleID]);
    }

    await conn.commit();
    conn.release();
    conn = null;

    if (vehicleID) {
      notifyDriversOfService(id, vehicleID, title, 'service_completed');

      // Auto-complete any linked vehicle replacements
      const [repRows] = await db.query(`
        SELECT id, driver_id, replacement_vehicle_id FROM vehicle_replacements 
        WHERE service_record_id = ? AND status IN ('approved', 'pending')
      `, [id]);

      for (const rep of (repRows || [])) {
        await db.query("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", [rep.id]);
        if (rep.replacement_vehicle_id) {
          await db.query(`
            UPDATE temporary_assignments SET status = 'completed' 
            WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
          `, [rep.driver_id, rep.replacement_vehicle_id]);
        }
      }
    }

    return res.status(200).json({ message: 'Service completed, vehicle status set to available' });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('CompleteServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to complete service: ' + err.message });
  }
}

/**
 * POST /api/admin/services/:id/cancel
 */
async function cancelServiceRecord(req, res) {
  let conn;
  try {
    const id = parseInt(req.params.id || req.body?.id || req.query?.id, 10);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid service record ID required' });
    }
    const { reason } = req.body;

    const [rows] = await db.query(`SELECT status, vehicle_id FROM service_records WHERE id = ?`, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Service record not found' });
    }

    const { status: currentStatus, vehicle_id: vehicleID } = rows[0];

    if (currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'rejected') {
      return res.status(400).json({ error: `Cannot cancel a service that is already ${currentStatus}` });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(`
      UPDATE service_records SET status = 'cancelled', admin_remarks = ?
      WHERE id = ?
    `, [reason || null, id]);

    if (currentStatus === 'in_progress' && vehicleID) {
      await conn.query(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [vehicleID]);
    }

    await conn.commit();
    conn.release();
    conn = null;

    // Cleanup linked vehicle replacements
    const [reps] = await db.query(`
      SELECT id, driver_id, replacement_vehicle_id FROM vehicle_replacements 
      WHERE service_record_id = ? AND status IN ('approved', 'pending')
    `, [id]);

    for (const r of (reps || [])) {
      await db.query("UPDATE vehicle_replacements SET status = 'completed' WHERE id = ?", [r.id]);
      if (r.replacement_vehicle_id) {
        await db.query(`
          UPDATE temporary_assignments SET status = 'completed' 
          WHERE original_driver_id = ? AND vehicle_id = ? AND status = 'active'
        `, [r.driver_id, r.replacement_vehicle_id]);
      }
    }

    return res.status(200).json({ message: 'Service cancelled successfully' });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('CancelServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to cancel service: ' + err.message });
  }
}

/**
 * GET /api/admin/services/:id/purchases
 */
async function getLinkedPurchases(req, res) {
  try {
    const id = req.params.id;

    const [rows] = await db.query(`
      SELECT po.id, COALESCE(po.invoice_number, '') AS invoice_number,
             COALESCE(SUM(p.total_price), 0) AS total, COUNT(p.id) AS product_count
      FROM purchase_orders po
      LEFT JOIN parts_purchased p ON p.purchase_order_id = po.id
      WHERE po.service_record_id = ?
      GROUP BY po.id, po.invoice_number
    `, [id]);

    return res.status(200).json({ count: rows.length, orders: rows || [] });
  } catch (err) {
    console.error('GetLinkedPurchases error:', err);
    return res.status(200).json({ count: 0, orders: [] });
  }
}

/**
 * DELETE /api/admin/services
 */
async function deleteServiceRecord(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Service record ID is required' });
    }

    const deletePurchases = req.query.delete_purchases === 'true';

    const [sRow] = await db.query(`SELECT status, vehicle_id FROM service_records WHERE id = ?`, [id]);
    if (sRow && sRow.length > 0 && sRow[0].status === 'in_progress') {
      await db.query(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [sRow[0].vehicle_id]);
    }

    if (deletePurchases) {
      await db.query(`
        DELETE pi FROM purchase_invoices pi
        INNER JOIN purchase_orders po ON pi.purchase_order_id = po.id
        WHERE po.service_record_id = ?
      `, [id]);
      await db.query(`
        DELETE p FROM parts_purchased p
        INNER JOIN purchase_orders po ON p.purchase_order_id = po.id
        WHERE po.service_record_id = ?
      `, [id]);
      await db.query(`DELETE FROM parts_purchased WHERE service_record_id = ?`, [id]);
      await db.query(`DELETE FROM purchase_orders WHERE service_record_id = ?`, [id]);
    } else {
      await db.query(`UPDATE purchase_orders SET service_record_id = NULL WHERE service_record_id = ?`, [id]);
      await db.query(`UPDATE parts_purchased SET service_record_id = NULL WHERE service_record_id = ?`, [id]);
    }

    await db.query(`DELETE FROM service_records WHERE id = ?`, [id]);

    return res.status(200).json({ message: 'Service record deleted successfully' });
  } catch (err) {
    console.error('DeleteServiceRecord error:', err);
    return res.status(500).json({ error: 'Failed to delete service record: ' + err.message });
  }
}

/**
 * GET /api/admin/services/stats
 */
async function getServiceStats(req, res) {
  try {
    const [tot] = await db.query(`SELECT COUNT(*) AS total FROM service_records`);
    const [act] = await db.query(`SELECT COUNT(*) AS active FROM service_records WHERE status IN ('approved', 'in_progress')`);
    const [pen] = await db.query(`SELECT COUNT(*) AS pending FROM service_records WHERE status = 'reported'`);
    const [com] = await db.query(`
      SELECT COUNT(*) AS completed FROM service_records 
      WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const [cst] = await db.query(`
      SELECT COALESCE(SUM(total_cost), 0) AS total_cost FROM service_records 
      WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const [ovd] = await db.query(`
      SELECT COUNT(*) AS overdue FROM vehicle_service_tracking vst
      WHERE vst.next_service_km <= COALESCE((SELECT MAX(k.end_km) FROM km_logs k WHERE k.vehicle_id = vst.vehicle_id), 0)
    `);

    return res.status(200).json({
      total_services: tot[0]?.total || 0,
      active_services: act[0]?.active || 0,
      pending_requests: pen[0]?.pending || 0,
      completed_month: com[0]?.completed || 0,
      total_cost_month: parseFloat(cst[0]?.total_cost) || 0,
      overdue_reminders: ovd[0]?.overdue || 0
    });
  } catch (err) {
    console.error('GetServiceStats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/services/tracking
 */
async function getServiceTracking(req, res) {
  try {
    await db.query(`
      INSERT IGNORE INTO vehicle_service_tracking (vehicle_id, last_serviced_km, next_service_km)
      SELECT v.id, 0, 10000
      FROM vehicles v
      WHERE v.id NOT IN (SELECT vehicle_id FROM vehicle_service_tracking)
    `);

    const [rows] = await db.query(`
      SELECT 
        vst.id, vst.vehicle_id, vst.last_serviced_km, vst.next_service_km,
        COALESCE(DATE_FORMAT(vst.last_service_date, '%d-%m-%Y'), '') AS last_service_date,
        COALESCE(DATE_FORMAT(vst.next_service_date, '%d-%m-%Y'), '') AS next_service_date,
        COALESCE(vst.notes, '') AS notes,
        DATE_FORMAT(vst.created_at, '%d-%m-%Y %h:%i %p') AS created_at, 
        DATE_FORMAT(vst.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
        COALESCE(v.vehicle_number, '') AS vehicle_number, COALESCE(v.vehicle_name, '') AS vehicle_name,
        COALESCE(vt.type, '') AS vehicle_type,
        CAST(COALESCE((SELECT MAX(k.end_km) FROM km_logs k WHERE k.vehicle_id = vst.vehicle_id), 0) AS SIGNED) AS current_km
      FROM vehicle_service_tracking vst
      LEFT JOIN vehicles v ON vst.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      ORDER BY vt.type, v.vehicle_number
    `);

    const list = (rows || []).map(r => {
      const remaining_km = r.next_service_km - r.current_km;
      let status = 'on_track';
      if (remaining_km <= 0) {
        status = 'overdue';
      } else if (remaining_km <= 100) {
        status = 'danger';
      } else if (remaining_km <= 300) {
        status = 'warning';
      }
      return {
        ...r,
        remaining_km,
        status
      };
    });

    return res.status(200).json(list);
  } catch (err) {
    console.error('GetServiceTracking error:', err);
    return res.status(200).json([]);
  }
}

/**
 * PUT /api/admin/services/tracking
 */
async function updateServiceTracking(req, res) {
  try {
    const { vehicle_id, last_serviced_km, next_service_km, last_service_date, next_service_date, notes } = req.body;

    const vId = parseInt(vehicle_id, 10);
    if (!vId) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    const nextKm = parseInt(next_service_km, 10);
    if (!nextKm || nextKm <= 0) {
      return res.status(400).json({ error: 'Next service KM must be greater than 0' });
    }

    const lastDate = last_service_date || null;
    const nextDate = next_service_date || null;

    const [result] = await db.query(`
      UPDATE vehicle_service_tracking 
      SET last_serviced_km = ?, next_service_km = ?, 
          last_service_date = ?, next_service_date = ?,
          notes = ?, updated_at = NOW()
      WHERE vehicle_id = ?
    `, [parseInt(last_serviced_km, 10) || 0, nextKm, lastDate, nextDate, notes || '', vId]);

    if (result.affectedRows === 0) {
      await db.query(`
        INSERT INTO vehicle_service_tracking (vehicle_id, last_serviced_km, next_service_km, last_service_date, next_service_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [vId, parseInt(last_serviced_km, 10) || 0, nextKm, lastDate, nextDate, notes || '']);
    }

    return res.status(200).json({ message: 'Service tracking updated successfully' });
  } catch (err) {
    console.error('UpdateServiceTracking error:', err);
    return res.status(500).json({ error: 'Failed to update: ' + err.message });
  }
}

module.exports = {
  getAllServiceRecords,
  getServiceRecordByID,
  createServiceRecord,
  updateServiceRecord,
  approveServiceRequest,
  rejectServiceRequest,
  startServiceRecord,
  completeServiceRecord,
  cancelServiceRecord,
  getLinkedPurchases,
  deleteServiceRecord,
  getServiceStats,
  GetServiceTracking: getServiceTracking,
  getServiceTracking,
  updateServiceTracking,
  recalcServiceCost
};
