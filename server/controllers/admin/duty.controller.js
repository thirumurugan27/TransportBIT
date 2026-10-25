const db = require('../../config/db');

// GET /api/admin/duties
async function getAllDuties(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT d.id, d.assignment_id, COALESCE(d.route_from,'') AS route_from, COALESCE(d.route_to,'') AS route_to,
             d.start_time, d.end_time, d.status, d.approved_by, d.approved_at
      FROM duties d
      ORDER BY d.id DESC
    `);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAllDuties error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/duties/create
async function createDuty(req, res) {
  try {
    const { assignment_id, route_from, route_to, start_time, end_time } = req.body;
    if (!assignment_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'assignment_id, start_time, and end_time are required' });
    }

    await db.query(`
      INSERT INTO duties (assignment_id, route_from, route_to, start_time, end_time)
      VALUES (?, ?, ?, ?, ?)
    `, [assignment_id, route_from || null, route_to || null, start_time, end_time]);

    return res.status(200).json({ message: 'Duty created successfully' });
  } catch (err) {
    console.error('createDuty error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/duties/approve
async function approveDuty(req, res) {
  try {
    const { duty_id, approved_by, action } = req.body;
    if (!duty_id) {
      return res.status(400).json({ error: 'duty_id is required' });
    }

    const approverId = approved_by || (req.user ? req.user.user_id : null);
    const status = action === 'reject' ? 'cancelled' : 'completed';

    await db.query(`
      UPDATE duties SET status=?, approved_by=?, approved_at=NOW()
      WHERE id=?
    `, [status, approverId, duty_id]);

    return res.status(200).json({ message: 'Duty status updated' });
  } catch (err) {
    console.error('approveDuty error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllDuties,
  createDuty,
  approveDuty
};
