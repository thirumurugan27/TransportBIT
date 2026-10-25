const db = require('../../config/db');

// GET /api/admin/shifts
async function getAllShifts(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT id, name,
             TIME_FORMAT(start_time, '%h:%i %p') AS start_time,
             TIME_FORMAT(end_time, '%h:%i %p') AS end_time,
             COALESCE(description,'') AS description, created_by
      FROM shifts ORDER BY id DESC
    `);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAllShifts error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/shifts/create
async function createShift(req, res) {
  try {
    const { name, start_time, end_time, description } = req.body;
    const createdBy = req.user ? req.user.user_id : null;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: 'Name, start_time and end_time are required' });
    }

    await db.query(`
      INSERT INTO shifts (name, start_time, end_time, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [name, start_time, end_time, description || null, createdBy]);

    return res.status(200).json({ message: 'Shift created successfully' });
  } catch (err) {
    console.error('createShift error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/shifts/update
async function updateShift(req, res) {
  try {
    const { id, name, start_time, end_time, description } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    await db.query(`
      UPDATE shifts SET name=?, start_time=?, end_time=?, description=?
      WHERE id=?
    `, [name, start_time, end_time, description || null, id]);

    return res.status(200).json({ message: 'Shift updated successfully' });
  } catch (err) {
    console.error('updateShift error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/shifts/delete?id=X
async function deleteShift(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }

    await db.query('DELETE FROM shifts WHERE id=?', [id]);
    return res.status(200).json({ message: 'Shift deleted successfully' });
  } catch (err) {
    console.error('deleteShift error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift
};
