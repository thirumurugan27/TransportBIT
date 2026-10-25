const db = require('../../config/db');

async function getFacultyProfile(req, res) {
  try {
    const userID = req.userId;
    const [rows] = await db.query(`
      SELECT f.id, f.user_id, u.full_name, COALESCE(u.email, '') as email, 
             COALESCE(u.phone, '') as phone, COALESCE(f.department, '') as department,
             COALESCE(f.designation, '') as designation
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      WHERE f.user_id = ?
    `, [userID]);

    if (!rows || rows.length === 0) {
      const [uRows] = await db.query('SELECT full_name, email, phone FROM users WHERE id = ?', [userID]);
      if (uRows && uRows.length > 0) {
        const [ins] = await db.query(
          'INSERT INTO faculty (user_id, department, designation) VALUES (?, ?, ?)',
          [userID, 'General', 'Faculty']
        );
        return res.status(200).json({
          id: ins.insertId,
          user_id: userID,
          full_name: uRows[0].full_name || '',
          email: uRows[0].email || '',
          phone: uRows[0].phone || '',
          department: 'General',
          designation: 'Faculty'
        });
      }
      return res.status(404).json({ error: 'Faculty profile not found' });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching faculty profile:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

async function updateFacultyProfile(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const userID = req.userId;
    const { full_name, email, phone, department, designation } = req.body;

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    await connection.beginTransaction();

    await connection.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
      [full_name, email || '', phone || '', userID]
    );

    const [facCheck] = await connection.query('SELECT id FROM faculty WHERE user_id = ?', [userID]);
    if (facCheck && facCheck.length > 0) {
      await connection.query(
        'UPDATE faculty SET department = ?, designation = ? WHERE user_id = ?',
        [department || '', designation || '', userID]
      );
    } else {
      await connection.query(
        'INSERT INTO faculty (user_id, department, designation) VALUES (?, ?, ?)',
        [userID, department || 'General', designation || 'Faculty']
      );
    }

    await connection.commit();
    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating faculty profile:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    connection.release();
  }
}

module.exports = {
  getFacultyProfile,
  updateFacultyProfile
};
