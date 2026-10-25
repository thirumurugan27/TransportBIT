const db = require('../../config/db');

async function getDriverNotifications(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const [rows] = await db.query(`
      SELECT id, recipient_id as driver_id, title, message, type, reference_id as related_id, is_read, 
             DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM notifications
      WHERE recipient_role = 'DRIVER' AND recipient_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [driverID]);

    const notifications = (rows || []).map(n => ({
      id: n.id,
      driver_id: n.driver_id,
      title: n.title,
      message: n.message,
      type: n.type,
      related_id: n.related_id,
      is_read: Boolean(n.is_read),
      created_at: n.created_at
    }));

    return res.status(200).json(notifications);
  } catch (err) {
    console.error('Get driver notifications error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function getUnreadNotificationCount(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    const [rows] = await db.query(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE recipient_role = 'DRIVER' AND recipient_id = ? AND is_read = FALSE
    `, [driverID]);

    return res.status(200).json({ count: rows[0]?.count || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function markNotificationRead(req, res) {
  try {
    const notificationID = req.params.id;
    if (!notificationID) {
      return res.status(400).json({ error: 'notification id required' });
    }

    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [notificationID]);
    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    let driverID = req.query.driver_id;
    if (!driverID && req.userId) {
      const [drv] = await db.query('SELECT id FROM drivers WHERE user_id = ?', [req.userId]);
      if (drv && drv.length > 0) driverID = drv[0].id;
    }

    if (!driverID) {
      return res.status(400).json({ error: 'driver_id required' });
    }

    await db.query(`
      UPDATE notifications SET is_read = TRUE 
      WHERE recipient_role = 'DRIVER' AND recipient_id = ?
    `, [driverID]);

    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDriverNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead
};
