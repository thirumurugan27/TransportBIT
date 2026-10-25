const db = require('../../config/db');
const { recalcServiceCost } = require('./service.controller');
const { getInvoiceForOrders, getPurchaseInvoiceByOrderID } = require('./purchaseInvoice.controller');

const purchaseOrderSelectColumns = `
  po.id, po.category, po.vehicle_id, po.service_record_id, po.vendor_id,
  COALESCE(vdr.name, '') AS vendor_name,
  COALESCE(vdr.contact, '') AS vendor_contact,
  COALESCE(vdr.address, '') AS vendor_address,
  COALESCE(vdr.gst_number, '') AS vendor_gst,
  COALESCE(po.invoice_number, '') AS invoice_number,
  COALESCE(DATE_FORMAT(po.purchased_date, '%d-%m-%Y'), '') AS purchased_date,
  po.status,
  COALESCE(DATE_FORMAT(po.ordered_date, '%d-%m-%Y'), '') AS ordered_date,
  COALESCE(DATE_FORMAT(po.received_date, '%d-%m-%Y'), '') AS received_date,
  COALESCE(DATE_FORMAT(po.returned_date, '%d-%m-%Y'), '') AS returned_date,
  COALESCE(DATE_FORMAT(po.cancelled_date, '%d-%m-%Y'), '') AS cancelled_date,
  COALESCE(po.notes, '') AS notes,
  po.added_by,
  COALESCE(u.full_name, '') AS added_by_name,
  DATE_FORMAT(po.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
  DATE_FORMAT(po.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
  COALESCE(COALESCE(v.vehicle_number, dv.vehicle_number), '') AS vehicle_number,
  COALESCE(COALESCE(v.vehicle_name, dv.vehicle_name), '') AS vehicle_name,
  COALESCE(sr.title, '') AS service_title,
  COALESCE(SUM(p.total_price), 0) AS total_amount,
  COUNT(p.id) AS product_count
`;

const purchaseOrderFromJoins = `
  FROM purchase_orders po
  LEFT JOIN vendors vdr ON po.vendor_id = vdr.id
  LEFT JOIN service_records sr ON po.service_record_id = sr.id
  LEFT JOIN vehicles v ON sr.vehicle_id = v.id
  LEFT JOIN vehicles dv ON po.vehicle_id = dv.id
  LEFT JOIN users u ON po.added_by = u.id
  LEFT JOIN parts_purchased p ON p.purchase_order_id = po.id
`;

const purchaseOrderGroupBy = `
  GROUP BY po.id, po.category, po.vehicle_id, po.service_record_id, po.vendor_id,
           vdr.name, vdr.contact, vdr.address, vdr.gst_number,
           po.invoice_number, po.purchased_date, po.status,
           po.ordered_date, po.received_date, po.returned_date, po.cancelled_date, po.notes,
           po.added_by, u.full_name,
           po.created_at, po.updated_at, v.vehicle_number, v.vehicle_name, dv.vehicle_number, dv.vehicle_name, sr.title
`;

/**
 * Helper to fetch products for an order
 */
async function getProductsForOrder(orderID) {
  const [rows] = await db.query(`
    SELECT 
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
    FROM parts_purchased p
    LEFT JOIN service_records sr ON p.service_record_id = sr.id
    LEFT JOIN vehicles v ON sr.vehicle_id = v.id
    LEFT JOIN vehicles dv ON p.vehicle_id = dv.id
    LEFT JOIN users u ON p.added_by = u.id
    LEFT JOIN vendors vdr ON p.vendor_id = vdr.id
    WHERE p.purchase_order_id = ?
    ORDER BY p.id ASC
  `, [orderID]);

  return rows || [];
}

/**
 * GET /api/admin/purchase-orders
 */
async function getAllPurchaseOrders(req, res) {
  try {
    const { vendor_id, vehicle_id, status, category, date_from, date_to, search } = req.query;

    let query = `SELECT ${purchaseOrderSelectColumns} ${purchaseOrderFromJoins} WHERE 1=1`;
    const args = [];

    if (category) {
      query += ` AND po.category = ?`;
      args.push(category);
    }
    if (vendor_id) {
      query += ` AND po.vendor_id = ?`;
      args.push(vendor_id);
    }
    if (vehicle_id) {
      query += ` AND (sr.vehicle_id = ? OR po.vehicle_id = ?)`;
      args.push(vehicle_id, vehicle_id);
    }
    if (status) {
      query += ` AND po.status = ?`;
      args.push(status);
    }
    if (date_from) {
      query += ` AND po.purchased_date >= ?`;
      args.push(date_from);
    }
    if (date_to) {
      query += ` AND po.purchased_date <= ?`;
      args.push(date_to);
    }
    if (search) {
      query += ` AND (po.invoice_number LIKE ? OR vdr.name LIKE ? OR COALESCE(v.vehicle_number, dv.vehicle_number, '') LIKE ? OR EXISTS(SELECT 1 FROM parts_purchased pp WHERE pp.purchase_order_id = po.id AND pp.part_name LIKE ?))`;
      const s = `%${search}%`;
      args.push(s, s, s, s);
    }

    query += ` ${purchaseOrderGroupBy} ORDER BY po.created_at DESC`;

    const [rows] = await db.query(query, args);
    const orders = rows || [];

    for (const o of orders) {
      o.products = await getProductsForOrder(o.id);
    }

    await getInvoiceForOrders(orders);

    return res.status(200).json(orders);
  } catch (err) {
    console.error('GetAllPurchaseOrders error:', err);
    return res.status(200).json([]);
  }
}

/**
 * GET /api/admin/purchase-orders/:id
 */
async function getPurchaseOrderByID(req, res) {
  try {
    const orderID = req.params.id;

    const query = `SELECT ${purchaseOrderSelectColumns} ${purchaseOrderFromJoins} WHERE po.id = ? ${purchaseOrderGroupBy}`;
    const [rows] = await db.query(query, [orderID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = rows[0];
    order.products = await getProductsForOrder(order.id);
    order.invoice_file = await getPurchaseInvoiceByOrderID(orderID);

    return res.status(200).json(order);
  } catch (err) {
    console.error('GetPurchaseOrderByID error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/purchase-orders
 */
async function createPurchaseOrder(req, res) {
  let conn;
  try {
    let { category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, notes, parts } = req.body;

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
      (category, vehicle_id, service_record_id, vendor_id, invoice_number, purchased_date, status, ordered_date, notes, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [category, vId, sId, vndId, invoice_number || null, purDate, stat, purDate, notes || null, adminID]);

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
        qty, price, total, parseInt(p.warranty_months, 10) || 0,
        invoice_number || null, purDate,
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
      message: `Order created with ${insertedIDs.length} products`,
      order_id: orderID,
      ids: insertedIDs
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('CreatePurchaseOrder error:', err);
    return res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
}

/**
 * PUT /api/admin/purchase-orders
 */
async function updatePurchaseOrder(req, res) {
  try {
    const { id, vendor_id, invoice_number, purchased_date, notes } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const vndId = vendor_id ? parseInt(vendor_id, 10) : null;
    const purDate = purchased_date || null;

    await db.query(`
      UPDATE purchase_orders SET
        vendor_id = ?, invoice_number = ?, purchased_date = ?, notes = ?
      WHERE id = ?
    `, [vndId, invoice_number || null, purDate, notes || null, id]);

    await db.query(`
      UPDATE parts_purchased SET
        vendor_id = ?, invoice_number = ?, purchased_date = ?
      WHERE purchase_order_id = ?
    `, [vndId, invoice_number || null, purDate, id]);

    return res.status(200).json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('UpdatePurchaseOrder error:', err);
    return res.status(500).json({ error: 'Failed to update order: ' + err.message });
  }
}

/**
 * PUT /api/admin/purchase-orders/status
 */
async function updatePurchaseOrderStatus(req, res) {
  try {
    const { id, status, cascade } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'ID and status are required' });
    }

    let dateCol = 'ordered_date';
    if (status === 'received') dateCol = 'received_date';
    else if (status === 'returned') dateCol = 'returned_date';
    else if (status === 'cancelled') dateCol = 'cancelled_date';

    await db.query(`UPDATE purchase_orders SET status = ?, ${dateCol} = CURDATE() WHERE id = ?`, [status, id]);

    if (cascade) {
      await db.query(`UPDATE parts_purchased SET status = ?, ${dateCol} = CURDATE() WHERE purchase_order_id = ?`, [status, id]);
    }

    return res.status(200).json({ message: `Order status updated to ${status}` });
  } catch (err) {
    console.error('UpdatePurchaseOrderStatus error:', err);
    return res.status(500).json({ error: 'Failed to update order status: ' + err.message });
  }
}

/**
 * DELETE /api/admin/purchase-orders
 */
async function deletePurchaseOrder(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const [rows] = await db.query(`SELECT service_record_id FROM purchase_orders WHERE id = ?`, [id]);
    const serviceRecordID = rows?.[0]?.service_record_id;

    await db.query(`DELETE FROM purchase_orders WHERE id = ?`, [id]);

    if (serviceRecordID) {
      await recalcServiceCost(serviceRecordID);
    }

    return res.status(200).json({ message: 'Order and all products deleted successfully' });
  } catch (err) {
    console.error('DeletePurchaseOrder error:', err);
    return res.status(500).json({ error: 'Failed to delete order: ' + err.message });
  }
}

/**
 * POST /api/admin/purchase-orders/product
 */
async function addProductToOrder(req, res) {
  try {
    const { purchase_order_id, part_name, quantity, unit_price, warranty_months } = req.body;
    if (!purchase_order_id || !part_name || !part_name.trim()) {
      return res.status(400).json({ error: 'Order ID and product name are required' });
    }

    const [ordRows] = await db.query(`
      SELECT category, service_record_id, vehicle_id, vendor_id, COALESCE(invoice_number, '') AS invoice_number, 
             DATE_FORMAT(purchased_date, '%Y-%m-%d') AS purchased_date, status
      FROM purchase_orders WHERE id = ?
    `, [purchase_order_id]);

    if (!ordRows || ordRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const ord = ordRows[0];
    const qty = parseInt(quantity, 10) || 1;
    const price = parseFloat(unit_price) || 0;
    const total = qty * price;
    const adminID = req.userId || 1;

    const [result] = await db.query(`
      INSERT INTO parts_purchased 
      (purchase_order_id, category, vehicle_id, service_record_id, part_name, vendor_id,
       quantity, unit_price, total_price, warranty_months, invoice_number, purchased_date, 
       status, ordered_date, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      purchase_order_id, ord.category, ord.vehicle_id, ord.service_record_id, part_name.trim(), ord.vendor_id,
      qty, price, total, parseInt(warranty_months, 10) || 0,
      ord.invoice_number || null, ord.purchased_date || null,
      ord.status, ord.purchased_date || null, adminID
    ]);

    if (ord.service_record_id) {
      await recalcServiceCost(ord.service_record_id);
    }

    return res.status(200).json({ message: 'Product added to order', id: result.insertId });
  } catch (err) {
    console.error('AddProductToOrder error:', err);
    return res.status(500).json({ error: 'Failed to add product: ' + err.message });
  }
}

/**
 * DELETE /api/admin/purchase-orders/product
 */
async function removeProductFromOrder(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const [pRows] = await db.query(`SELECT service_record_id, COALESCE(purchase_order_id, 0) AS purchase_order_id FROM parts_purchased WHERE id = ?`, [id]);
    const serviceRecordID = pRows?.[0]?.service_record_id;
    const orderID = pRows?.[0]?.purchase_order_id;

    await db.query(`DELETE FROM parts_purchased WHERE id = ?`, [id]);

    if (orderID > 0) {
      const [rem] = await db.query(`SELECT COUNT(*) AS count FROM parts_purchased WHERE purchase_order_id = ?`, [orderID]);
      if (rem?.[0]?.count === 0) {
        await db.query(`DELETE FROM purchase_orders WHERE id = ?`, [orderID]);
      }
    }

    if (serviceRecordID) {
      await recalcServiceCost(serviceRecordID);
    }

    return res.status(200).json({ message: 'Product removed from order' });
  } catch (err) {
    console.error('RemoveProductFromOrder error:', err);
    return res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
}

module.exports = {
  getAllPurchaseOrders,
  getPurchaseOrderByID,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  addProductToOrder,
  removeProductFromOrder
};
