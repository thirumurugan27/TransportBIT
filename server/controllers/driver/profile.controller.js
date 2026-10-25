const db = require('../../config/db');

async function getDriverProfile(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) {
        driverID = drv[0].id;
      }
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const [rows] = await db.query(`
      SELECT 
        d.id, d.user_id, u.full_name, 
        COALESCE(u.phone, '') as phone,
        COALESCE(u.email, '') as email,
        d.license_number, d.license_type, 
        DATE_FORMAT(d.license_expiry, '%d-%m-%Y') as license_expiry,
        d.experience_years, 
        DATE_FORMAT(d.date_of_joining, '%d-%m-%Y') as date_of_joining,
        DATE_FORMAT(d.date_of_relieving, '%d-%m-%Y') as date_of_relieving,
        CASE 
          WHEN EXISTS(SELECT 1 FROM leave_requests lr 
                      WHERE lr.driver_id = d.id 
                      AND lr.status = 'admin_approved'
                      AND CURDATE() BETWEEN lr.start_date AND lr.end_date) THEN 'on_leave'
          WHEN att.status = 'present' THEN 'present'
          WHEN att.status = 'absent' THEN 'absent'
          ELSE 'not_marked'
        END as status
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN attendance att ON att.user_id = d.user_id AND att.date = CURDATE()
      WHERE d.id = ?
    `, [driverID]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Get driver profile error:', err);
    return res.status(500).json({ error: 'Driver not found' });
  }
}

module.exports = {
  getDriverProfile
};
