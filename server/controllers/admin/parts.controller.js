const db = require('../../config/db');
const { recalcServiceCost } = require('./service.controller');

const partsSelectColumns = `
  p.id, p.purchase_order_id, p.category, p.vehicle_id, p.service_record_id, p.part_name,
  p.vendor_id,
  COALESCE(vdr.name, '') AS vendor_name,
  COALESCE(vdr.contact, '') AS vendor_contact,
  COALESCE(vdr.address, '') AS vendor_address,
  COALESCE(vdr.gst_number, '') AS vendor_gst,
  p.quantity, p.unit_price, p.total_price, p.warranty_months,
  COALESCE(p.invoice_number, '') AS invoice_number, 
  COALESCE(DATE_FORMAT(p.purchased_date, '%d-%m-%Y'), '') AS purchased_date,
  p.status,
  COALESCE(DATE_FORMAT(p.ordered_date, '%d-%m-%Y'), '') AS ordered_date,
  COALESCE(DATE_FORMAT(p.received_date, '%d-%m-%Y'), '') AS received_date,
  COALESCE(DATE_FORMAT(p.returned_date, '%d-%m-%Y'), '') AS returned_date,
  COALESCE(DATE_FORMAT(p.cancelled_date, '%d-%m-%Y'), '') AS cancelled_date,
  p.added_by, 
  DATE_FORMAT(p.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
  COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), '') AS vehicle_number,
  COALESCE(COALESCE(v.vehicle_name, dv.vehicle_name), '') AS vehicle_name,
  COALESCE(sr.title, '') AS service_title,
  COALESCE(u.full_name, '') AS added_by_name
`;

const partsFromJoins = `
  FROM parts_purchased p
  LEFT JOIN service_records sr ON p.service_record_id = sr.id
  LEFT JOIN vehicles v ON sr.vehicle_id = v.id
  LEFT JOIN vehicles dv ON p.vehicle_id = dv.id
  LEFT JOIN users u ON p.added_by = u.id
  LEFT JOIN vendors vdr ON p.vendor_id = vdr.id
`;

/**
 * GET /api/admin/services/:id/parts
 */
async function getPartsByServiceRecord(req, res) {
  try {
    const serviceID = req.params.id;
    const query = `SELECT ${partsSelectColumns} ${partsFromJoins} WHERE p.service_record_id = ? ORDER BY p.created_at DESC`;
    const [rows] = await db.query(query, [serviceID]);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetPartsByServiceRecord error:', err);
    return res.status(200).json([]);
  }
}

/**
 * GET /api/admin/parts
 */
async function getAllParts(req, res) {
  try {
    const { vehicle_id, vendor, vendor_id, date_from, date_to } = req.query;

    let query = `SELECT ${partsSelectColumns} ${partsFromJoins} WHERE 1=1`;
    const args = [];

    if (vehicle_id) {
      query += ` AND sr.vehicle_id = ?`;
      args.push(vehicle_id);
    }
    if (vendor_id) {
      query += ` AND p.vendor_id = ?`;
      args.push(vendor_id);
    } else if (vendor) {
      query += ` AND vdr.name LIKE ?`;
      args.push(`%${vendor}%`);
    }
    if (date_from) {
      query += ` AND p.purchased_date >= ?`;
      args.push(date_from);
    }
    if (date_to) {
      query += ` AND p.purchased_date <= ?`;
      args.push(date_to);
    }

    query += ` ORDER BY p.created_at DESC`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetAllParts error:', err);
    return res.status(200).json([]);
  }
}

/**
 * POST /api/admin/parts
 */
async function addPart(req, res) {
  try {
    let {
      category, vehicle_id, service_record_id, part_name, vendor_id,
      quantity, unit_price, warranty_months, invoice_number, purchased_date,
      status, ordered_date
    } = req.body;

    if (!category) category = 'repair_service';
    if (!part_name || !part_name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const sId = service_record_id ? parseInt(service_record_id, 10) : null;
    let vId = vehicle_id ? parseInt(vehicle_id, 10) : null;
    const vndId = vendor_id ? parseInt(vendor_id, 10) : null;
    const qty = parseInt(quantity, 10) || 1;
    const price = parseFloat(unit_price) || 0;
    const total = qty * price;
    const stat = status || 'pending';

    if (category === 'repair_service') {
      if (!sId) {
        return res.status(400).json({ error: 'Service record is required for repair & service purchases' });
      }
      const [srV] = await db.query(`SELECT vehicle_id FROM service_records WHERE id = ?`, [sId]);
      if (srV && srV.length > 0 && srV[0].vehicle_id) {
        vId = srV[0].vehicle_id;
      }
    }

    const ordDate = ordered_date || purchased_date || null;
    const purDate = purchased_date || null;
    const adminID = req.userId || 1;

    // Create purchase order for this single part
    const [ordRes] = await db.query(`
      INSERT INTO purchase_orders 
      (category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [category, vId, sId, vndId, invoice_number || null, purDate, stat, ordDate, adminID]);

    const orderID = ordRes.insertId;

    const [partRes] = await db.query(`
      INSERT INTO parts_purchased 
      (purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
       quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
       status, ordered_date, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderID, category, vId, sId, part_name.trim(), vndId,
      qty, price, total, parseInt(warranty_months, 10) || 0, invoice_number || null, purDate,
      stat, ordDate, adminID
    ]);

    if (category === 'repair_service' && sId) {
      await recalcServiceCost(sId);
    }

    return res.status(200).json({ message: 'Part added successfully', id: partRes.insertId });
  } catch (err) {
    console.error('AddPart error:', err);
    return res.status(500).json({ error: 'Failed to add part: ' + err.message });
  }
}

/**
 * POST /api/admin/parts/bulk
 */
async function addBulkParts(req, res) {
  let conn;
  try {
    let { category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, parts } = req.body;

    if (!category) category = 'repair_service';
    const sId = service_record_id ? parseInt(service_record_id, 10) : null;
    let vId = vehicle_id ? parseInt(vehicle_id, 10) : null;
    const vndId = vendor_id ? parseInt(vendor_id, 10) : null;
    const stat = status || 'pending';
    const purDate = purchased_date || null;

    if (category === 'repair_service') {
      if (!sId) {
        return res.status(400).json({ error: 'Service record is required for repair & service purchases' });
      }
      const [srV] = await db.query(`SELECT vehicle_id FROM service_records WHERE id = ?`, [sId]);
      if (srV && srV.length > 0 && srV[0].vehicle_id) {
        vId = srV[0].vehicle_id;
      }
    }

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    const adminID = req.userId || 1;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [ordRes] = await conn.query(`
      INSERT INTO purchase_orders 
      (category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [category, vId, sId, vndId, invoice_number || null, purDate, stat, purDate, adminID]);

    const orderID = ordRes.insertId;
    const insertedIDs = [];

    for (const p of parts) {
      if (!p.part_name || !p.part_name.trim()) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'All products must have a name' });
      }
      const qty = parseInt(p.quantity, 10) || 1;
      const price = parseFloat(p.unit_price) || 0;
      const total = qty * price;

      const [pRes] = await conn.query(`
        INSERT INTO parts_purchased 
        (purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
         quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
         status, ordered_date, added_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderID, category, vId, sId, p.part_name.trim(), vndId,
        qty, price, total, parseInt(p.warranty_months, 10) || 0, invoice_number || null, purDate,
        stat, purDate, adminID
      ]);

      insertedIDs.push(pRes.insertId);
    }

    await conn.commit();
    conn.release();
    conn = null;

    if (category === 'repair_service' && sId) {
      await recalcServiceCost(sId);
    }

    return res.status(200).json({
      message: `${insertedIDs.length} parts added successfully`,
      order_id: orderID,
      ids: insertedIDs
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('AddBulkParts error:', err);
    return res.status(500).json({ error: 'Failed to add parts: ' + err.message });
  }
}

/**
 * PUT /api/admin/parts
 */
async function updatePart(req, res) {
  try {
    const {
      id, part_name, vendor_id, quantity, unit_price, warranty_months,
      invoice_number, purchased_date, status, ordered_date, received_date, returned_date, cancelled_date
    } = req.body;

    const qty = parseInt(quantity, 10) || 1;
    const price = parseFloat(unit_price) || 0;
    const total = qty * price;

    await db.query(`
      UPDATE parts_purchased SET
        part_name = ?, vendor_id = ?,
        quantity = ?, unit_price = ?, total_price = ?,
        warranty_months = ?, invoice_number = ?, purchased_date = COALESCE(?, purchased_date), status = ?,
        ordered_date = ?, received_date = ?, returned_date = ?, cancelled_date = ?
      WHERE id = ?
    `, [
      part_name, vendor_id || null,
      qty, price, total,
      parseInt(warranty_months, 10) || 0, invoice_number || null, purchased_date || null, status || 'pending',
      ordered_date || null, received_date || null, returned_date || null, cancelled_date || null,
      id
    ]);

    const [pRow] = await db.query(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, [id]);
    if (pRow?.[0]?.service_record_id) {
      await recalcServiceCost(pRow[0].service_record_id);
    }

    return res.status(200).json({ message: 'Part updated successfully' });
  } catch (err) {
    console.error('UpdatePart error:', err);
    return res.status(500).json({ error: 'Failed to update part: ' + err.message });
  }
}

/**
 * PUT /api/admin/parts/status
 */
async function updatePartStatus(req, res) {
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'ID and status are required' });
    }

    let dateCol = 'ordered_date';
    if (status === 'received') dateCol = 'received_date';
    else if (status === 'returned') dateCol = 'returned_date';
    else if (status === 'cancelled') dateCol = 'cancelled_date';

    await db.query(`UPDATE parts_purchased SET status = ?, ${dateCol} = CURDATE() WHERE id = ?`, [status, id]);

    return res.status(200).json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('UpdatePartStatus error:', err);
    return res.status(500).json({ error: 'Failed to update status: ' + err.message });
  }
}

/**
 * DELETE /api/admin/parts
 */
async function deletePart(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Part ID is required' });
    }

    const [pRow] = await db.query(`SELECT service_record_id FROM parts_purchased WHERE id = ?`, [id]);
    const serviceRecordID = pRow?.[0]?.service_record_id;

    await db.query(`DELETE FROM parts_purchased WHERE id = ?`, [id]);

    if (serviceRecordID) {
      await recalcServiceCost(serviceRecordID);
    }

    return res.status(200).json({ message: 'Part deleted successfully' });
  } catch (err) {
    console.error('DeletePart error:', err);
    return res.status(500).json({ error: 'Failed to delete part: ' + err.message });
  }
}

/**
 * GET /api/admin/parts/expenditure
 */
async function getPartsExpenditure(req, res) {
  try {
    const [gt] = await db.query(`SELECT COALESCE(SUM(total_price), 0) AS total_spent, COUNT(id) AS total_parts FROM parts_purchased`);
    const grandTotal = parseFloat(gt[0]?.total_spent) || 0;
    const grandParts = parseInt(gt[0]?.total_parts, 10) || 0;

    let vehicles = [];
    try {
      const [vRows] = await db.query(`
        SELECT 
          v_sub.vehicle_id,
          COALESCE(v.vehicle_number, '') AS vehicle_number,
          v_sub.total_spent,
          v_sub.parts_count
        FROM (
          SELECT 
            COALESCE(po.vehicle_id, sr.vehicle_id, p.vehicle_id) AS vehicle_id,
            COALESCE(SUM(p.total_price), 0) AS total_spent,
            COUNT(p.id) AS parts_count
          FROM parts_purchased p
          LEFT JOIN purchase_orders po ON p.purchase_order_id = po.id
          LEFT JOIN service_records sr ON COALESCE(po.service_record_id, p.service_record_id) = sr.id
          WHERE COALESCE(po.vehicle_id, sr.vehicle_id, p.vehicle_id) IS NOT NULL
          GROUP BY COALESCE(po.vehicle_id, sr.vehicle_id, p.vehicle_id)
        ) v_sub
        LEFT JOIN vehicles v ON v_sub.vehicle_id = v.id
        ORDER BY v_sub.total_spent DESC
      `);
      vehicles = vRows || [];
    } catch (e) {
      console.warn('Vehicle expenditure query warning:', e.message);
      vehicles = [];
    }

    const [vendorSpends] = await db.query(`
      SELECT COALESCE(p.vendor_id, 0) AS vendor_id, COALESCE(vdr.name, 'Unknown') AS vendor_name,
             COALESCE(SUM(p.total_price), 0) AS total_spent, COUNT(p.id) AS parts_count
      FROM parts_purchased p
      LEFT JOIN vendors vdr ON p.vendor_id = vdr.id
      WHERE p.vendor_id IS NOT NULL
      GROUP BY p.vendor_id, vdr.name
      ORDER BY SUM(p.total_price) DESC
    `);

    const [actV] = await db.query(`SELECT COUNT(*) AS active_vendors FROM vendors WHERE is_active = 1`);
    const activeVendors = actV[0]?.active_vendors || 0;

    const [totO] = await db.query(`SELECT COUNT(*) AS total_orders FROM purchase_orders`);
    const totalOrders = totO[0]?.total_orders || 0;

    const [categorySpends] = await db.query(`
      SELECT COALESCE(po.category, 'repair_service') AS category, 
             COALESCE(SUM(p.total_price), 0) AS total_spent, COUNT(p.id) AS parts_count, COUNT(DISTINCT po.id) AS order_count
      FROM parts_purchased p
      LEFT JOIN purchase_orders po ON p.purchase_order_id = po.id
      GROUP BY COALESCE(po.category, 'repair_service')
      ORDER BY SUM(p.total_price) DESC
    `);

    return res.status(200).json({
      by_vehicle: vehicles || [],
      by_vendor: vendorSpends || [],
      by_category: categorySpends || [],
      total_spent: grandTotal,
      total_parts: grandParts,
      total_orders: totalOrders,
      active_vendors: activeVendors
    });
  } catch (err) {
    console.error('GetPartsExpenditure error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getPartsByServiceRecord,
  getAllParts,
  addPart,
  addBulkParts,
  updatePart,
  updatePartStatus,
  deletePart,
  getPartsExpenditure
};
