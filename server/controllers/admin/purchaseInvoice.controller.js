const db = require('../../config/db');
const path = require('path');
const fs = require('fs');

/**
 * Helper to fetch invoice data for a given order
 */
async function getPurchaseInvoiceByOrderID(orderID) {
  const [rows] = await db.query(`
    SELECT id, purchase_order_id, file_name, original_name, file_type, file_size, file_path,
           uploaded_by, 
           DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p') AS created_at,
           COALESCE(DATE_FORMAT(updated_at, '%d-%m-%Y %h:%i %p'), '') AS updated_at
    FROM purchase_invoices WHERE purchase_order_id = ?
  `, [orderID]);

  if (!rows || rows.length === 0) return null;

  const inv = rows[0];
  return {
    id: inv.id,
    purchase_order_id: inv.purchase_order_id,
    file_name: inv.file_name,
    original_name: inv.original_name,
    file_type: inv.file_type,
    file_size: inv.file_size,
    file_path: inv.file_path,
    file_url: '/documents/Purchase/' + inv.file_name,
    uploaded_by: inv.uploaded_by,
    created_at: inv.created_at,
    updated_at: inv.updated_at
  };
}

/**
 * Helper to batch load invoices for orders
 */
async function getInvoiceForOrders(orders) {
  if (!orders || orders.length === 0) return;

  const ids = orders.map(o => o.id);
  const placeholders = ids.map(() => '?').join(',');

  const [rows] = await db.query(`
    SELECT id, purchase_order_id, file_name, original_name, file_type, file_size, file_path,
           uploaded_by,
           DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p') AS created_at,
           COALESCE(DATE_FORMAT(updated_at, '%d-%m-%Y %h:%i %p'), '') AS updated_at
    FROM purchase_invoices WHERE purchase_order_id IN (${placeholders})
  `, ids);

  const invMap = {};
  for (const inv of (rows || [])) {
    invMap[inv.purchase_order_id] = {
      id: inv.id,
      purchase_order_id: inv.purchase_order_id,
      file_name: inv.file_name,
      original_name: inv.original_name,
      file_type: inv.file_type,
      file_size: inv.file_size,
      file_path: inv.file_path,
      file_url: '/documents/Purchase/' + inv.file_name,
      uploaded_by: inv.uploaded_by,
      created_at: inv.created_at,
      updated_at: inv.updated_at
    };
  }

  for (const o of orders) {
    if (invMap[o.id]) {
      o.invoice_file = invMap[o.id];
    } else {
      o.invoice_file = null;
    }
  }
}

/**
 * POST /api/admin/purchase-orders/:id/invoice
 */
async function uploadPurchaseInvoice(req, res) {
  try {
    const orderID = req.params.id;
    if (!orderID) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const [exists] = await db.query(`SELECT COUNT(*) AS count FROM purchase_orders WHERE id = ?`, [orderID]);
    if (!exists || exists[0].count === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const allowedTypes = {
      'application/pdf': 'pdf',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/png': 'image',
      'image/webp': 'image'
    };

    const fileType = allowedTypes[file.mimetype];
    if (!fileType) {
      return res.status(400).json({ error: 'Only PDF and image files (JPEG, PNG, WebP) are allowed' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'Documents', 'Purchase');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      ext = fileType === 'pdf' ? '.pdf' : '.jpg';
    }

    const uniqueName = `invoice_${orderID}_${Date.now()}${ext}`;
    const savePath = path.join(uploadDir, uniqueName);

    // Delete old invoice if exists
    const [oldRows] = await db.query(`SELECT id, file_path FROM purchase_invoices WHERE purchase_order_id = ?`, [orderID]);
    if (oldRows && oldRows.length > 0) {
      const old = oldRows[0];
      if (old.file_path && fs.existsSync(old.file_path)) {
        try {
          fs.unlinkSync(old.file_path);
        } catch (e) {
          console.error('Error removing old invoice file:', e);
        }
      }
      await db.query(`DELETE FROM purchase_invoices WHERE id = ?`, [old.id]);
    }

    if (file.buffer) {
      fs.writeFileSync(savePath, file.buffer);
    } else if (file.path) {
      fs.renameSync(file.path, savePath);
    }

    const adminID = req.userId || 1;

    const [result] = await db.query(`
      INSERT INTO purchase_invoices 
      (purchase_order_id, file_name, original_name, file_type, file_size, file_path, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [orderID, uniqueName, file.originalname, fileType, file.size, savePath, adminID]);

    return res.status(200).json({
      message: 'Invoice uploaded successfully',
      invoice: {
        id: result.insertId,
        purchase_order_id: parseInt(orderID, 10),
        file_name: uniqueName,
        original_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        file_path: savePath,
        file_url: '/documents/Purchase/' + uniqueName
      }
    });
  } catch (err) {
    console.error('UploadPurchaseInvoice error:', err);
    return res.status(500).json({ error: 'Failed to upload invoice: ' + err.message });
  }
}

/**
 * GET /api/admin/purchase-orders/:id/invoice
 */
async function getPurchaseInvoice(req, res) {
  try {
    const orderID = req.params.id;
    const inv = await getPurchaseInvoiceByOrderID(orderID);
    if (!inv) {
      return res.status(404).json({ error: 'No invoice found for this order' });
    }
    return res.status(200).json(inv);
  } catch (err) {
    console.error('GetPurchaseInvoice error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/admin/purchase-orders/:id/invoice
 */
async function deletePurchaseInvoice(req, res) {
  try {
    const orderID = req.params.id;
    const [rows] = await db.query(`SELECT id, file_path FROM purchase_invoices WHERE purchase_order_id = ?`, [orderID]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No invoice found for this order' });
    }

    const { id, file_path } = rows[0];
    if (file_path && fs.existsSync(file_path)) {
      try {
        fs.unlinkSync(file_path);
      } catch (e) {
        console.error('Error removing invoice file:', e);
      }
    }

    await db.query(`DELETE FROM purchase_invoices WHERE id = ?`, [id]);
    return res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    console.error('DeletePurchaseInvoice error:', err);
    return res.status(500).json({ error: 'Failed to delete invoice: ' + err.message });
  }
}

module.exports = {
  uploadPurchaseInvoice,
  getPurchaseInvoice,
  deletePurchaseInvoice,
  getPurchaseInvoiceByOrderID,
  getInvoiceForOrders
};
