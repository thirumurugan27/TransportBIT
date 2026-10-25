const db = require('../../config/db');

/**
 * GET /api/admin/vendors
 */
async function getVendors(req, res) {
  try {
    const { search, include_inactive } = req.query;

    let query = `
      SELECT v.id, v.name, COALESCE(v.address, '') AS address, COALESCE(v.contact, '') AS contact,
             COALESCE(v.gst_number, '') AS gst_number, COALESCE(v.email, '') AS email, v.is_active,
             DATE_FORMAT(v.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
             DATE_FORMAT(v.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
             COALESCE(stats.total_spent, 0) AS total_spent, COALESCE(stats.parts_count, 0) AS parts_count
      FROM vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(total_price) AS total_spent, COUNT(*) AS parts_count
        FROM parts_purchased
        WHERE vendor_id IS NOT NULL
        GROUP BY vendor_id
      ) stats ON v.id = stats.vendor_id
      WHERE 1=1
    `;

    const args = [];

    if (include_inactive !== 'true') {
      query += ` AND v.is_active = 1`;
    }

    if (search) {
      query += ` AND (v.name LIKE ? OR v.contact LIKE ? OR v.email LIKE ? OR v.gst_number LIKE ?)`;
      const s = `%${search}%`;
      args.push(s, s, s, s);
    }

    query += ` ORDER BY v.name ASC`;

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GetVendors error:', err);
    return res.status(200).json([]);
  }
}

/**
 * GET /api/admin/vendors/:id
 */
async function getVendorByID(req, res) {
  try {
    const id = req.params.id;

    const [rows] = await db.query(`
      SELECT v.id, v.name, COALESCE(v.address, '') AS address, COALESCE(v.contact, '') AS contact,
             COALESCE(v.gst_number, '') AS gst_number, COALESCE(v.email, '') AS email, v.is_active,
             DATE_FORMAT(v.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
             DATE_FORMAT(v.updated_at, '%d-%m-%Y %h:%i %p') AS updated_at,
             COALESCE(stats.total_spent, 0) AS total_spent, COALESCE(stats.parts_count, 0) AS parts_count
      FROM vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(total_price) AS total_spent, COUNT(*) AS parts_count
        FROM parts_purchased
        WHERE vendor_id IS NOT NULL
        GROUP BY vendor_id
      ) stats ON v.id = stats.vendor_id
      WHERE v.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('GetVendorByID error:', err);
    return res.status(500).json({ error: 'Failed to fetch vendor' });
  }
}

/**
 * POST /api/admin/vendors
 */
async function createVendor(req, res) {
  try {
    let { name, address, contact, gst_number, email } = req.body;
    name = (name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const [result] = await db.query(`
      INSERT INTO vendors (name, address, contact, gst_number, email)
      VALUES (?, ?, ?, ?, ?)
    `, [name, address || null, contact || null, gst_number || null, email || null]);

    return res.status(200).json({ message: 'Vendor created successfully', id: result.insertId });
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate') || err.message.includes('uk_vendor_name'))) {
      return res.status(409).json({ error: 'A vendor with this name already exists' });
    }
    console.error('CreateVendor error:', err);
    return res.status(500).json({ error: 'Failed to create vendor: ' + err.message });
  }
}

/**
 * PUT /api/admin/vendors
 */
async function updateVendor(req, res) {
  try {
    let { id, name, address, contact, gst_number, email } = req.body;
    name = (name || '').trim();
    if (!id || !name) {
      return res.status(400).json({ error: 'Vendor ID and name are required' });
    }

    await db.query(`
      UPDATE vendors SET name = ?, address = ?, contact = ?, gst_number = ?, email = ?
      WHERE id = ?
    `, [name, address || null, contact || null, gst_number || null, email || null, id]);

    return res.status(200).json({ message: 'Vendor updated successfully' });
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate') || err.message.includes('uk_vendor_name'))) {
      return res.status(409).json({ error: 'A vendor with this name already exists' });
    }
    console.error('UpdateVendor error:', err);
    return res.status(500).json({ error: 'Failed to update vendor: ' + err.message });
  }
}

/**
 * DELETE /api/admin/vendors
 */
async function deleteVendor(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Vendor ID is required' });
    }

    await db.query(`UPDATE vendors SET is_active = 0 WHERE id = ?`, [id]);
    return res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('DeleteVendor error:', err);
    return res.status(500).json({ error: 'Failed to delete vendor: ' + err.message });
  }
}

module.exports = {
  getVendors,
  getVendorByID,
  createVendor,
  updateVendor,
  deleteVendor
};
