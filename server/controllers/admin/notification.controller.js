const db = require('../../config/db');
const { createAdminNotification } = require('../../services/notification.service');

/**
 * Get all notifications for admin
 */
async function getAdminNotifications(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT id, type, title, message, reference_id, is_read, created_at
      FROM notifications
      WHERE recipient_role = 'ADMIN'
      ORDER BY created_at DESC
    `);

    const notifs = (rows || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      reference_id: n.reference_id,
      is_read: Boolean(n.is_read),
      created_at: n.created_at
    }));

    return res.status(200).json(notifs);
  } catch (err) {
    console.error('GetAdminNotifications error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Mark a single notification as read
 */
async function markAdminNotificationRead(req, res) {
  try {
    const id = req.params.id;
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_role = 'ADMIN'`, [id]);
    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('MarkAdminNotificationRead error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Mark all admin notifications as read
 */
async function markAllAdminNotificationsRead(req, res) {
  try {
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE recipient_role = 'ADMIN'`);
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('MarkAllAdminNotificationsRead error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Check if a notification with given title exists today
 */
async function notificationExistsToday(title) {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) AS count FROM notifications
      WHERE recipient_role = 'ADMIN' AND title = ? AND DATE(created_at) = CURDATE()
    `, [title]);
    return (rows?.[0]?.count || 0) > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Check for expiring/expired driver and vehicle groups
 */
async function checkGroupExpiry(req, res) {
  try {
    const alerts = [];
    let created = 0;

    // Driver groups expiring within 7 days
    const [driverExpiring] = await db.query(`
      SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y') AS valid_to
      FROM driver_clusters
      WHERE valid_to IS NOT NULL
      AND valid_to >= CURDATE()
      AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    `);

    for (const r of (driverExpiring || [])) {
      alerts.push({ group_type: 'Driver Group', name: r.name, valid_to: r.valid_to, status: 'expiring' });
      const title = `Driver Group Expiring: ${r.name}`;
      if (!(await notificationExistsToday(title))) {
        await createAdminNotification('group_expiry', title, `Driver group '${r.name}' validity expires on ${r.valid_to}. Please review and renew.`);
        created++;
      }
    }

    // Driver groups already expired (last 30 days)
    const [driverExpired] = await db.query(`
      SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y') AS valid_to
      FROM driver_clusters
      WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
      AND valid_to >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);

    for (const r of (driverExpired || [])) {
      alerts.push({ group_type: 'Driver Group', name: r.name, valid_to: r.valid_to, status: 'expired' });
      const title = `Driver Group Expired: ${r.name}`;
      if (!(await notificationExistsToday(title))) {
        await createAdminNotification('group_expiry', title, `Driver group '${r.name}' validity expired on ${r.valid_to}. Immediate attention required.`);
        created++;
      }
    }

    // Vehicle groups expiring within 7 days
    const [vehExpiring] = await db.query(`
      SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y') AS valid_to
      FROM vehicle_groups
      WHERE valid_to IS NOT NULL
      AND valid_to >= CURDATE()
      AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    `);

    for (const r of (vehExpiring || [])) {
      alerts.push({ group_type: 'Vehicle Group', name: r.name, valid_to: r.valid_to, status: 'expiring' });
      const title = `Vehicle Group Expiring: ${r.name}`;
      if (!(await notificationExistsToday(title))) {
        await createAdminNotification('group_expiry', title, `Vehicle group '${r.name}' validity expires on ${r.valid_to}. Please review and renew.`);
        created++;
      }
    }

    // Vehicle groups already expired (last 30 days)
    const [vehExpired] = await db.query(`
      SELECT name, DATE_FORMAT(valid_to, '%d-%m-%Y') AS valid_to
      FROM vehicle_groups
      WHERE valid_to IS NOT NULL AND valid_to < CURDATE()
      AND valid_to >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);

    for (const r of (vehExpired || [])) {
      alerts.push({ group_type: 'Vehicle Group', name: r.name, valid_to: r.valid_to, status: 'expired' });
      const title = `Vehicle Group Expired: ${r.name}`;
      if (!(await notificationExistsToday(title))) {
        await createAdminNotification('group_expiry', title, `Vehicle group '${r.name}' validity expired on ${r.valid_to}. Immediate attention required.`);
        created++;
      }
    }

    if (res) {
      return res.status(200).json({
        alerts,
        total: alerts.length,
        notifications_created: created
      });
    }
  } catch (err) {
    console.error('CheckGroupExpiry error:', err);
    if (res) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  checkGroupExpiry
};
