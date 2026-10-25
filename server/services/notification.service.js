const db = require('../config/db');

async function createAdminNotification(type, title, message) {
  try {
    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, type, title, message, is_read)
      VALUES ('ADMIN', 0, ?, ?, ?, FALSE)
    `, [type, title, message]);
  } catch (err) {
    console.error('Error creating admin notification:', err);
  }
}

async function createDriverNotification(driverId, title, message, type = 'vehicle_change', referenceId = null) {
  try {
    await db.query(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, type, reference_id, is_read)
      VALUES ('DRIVER', ?, ?, ?, ?, ?, FALSE)
    `, [driverId, title, message, type, referenceId]);
  } catch (err) {
    console.error('Error creating driver notification:', err);
  }
}

async function notificationExistsToday(title) {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS count FROM notifications
      WHERE recipient_role = 'ADMIN' AND title = ? AND DATE(created_at) = CURDATE()
    `, [title]);
    return (rows[0]?.count || 0) > 0;
  } catch (err) {
    console.error('Error checking notificationExistsToday:', err);
    return false;
  }
}

module.exports = {
  createAdminNotification,
  createDriverNotification,
  notificationExistsToday
};
