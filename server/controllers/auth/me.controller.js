const db = require('../../config/db');

async function getMe(req, res) {
  try {
    const userId = req.userId;
    const username = req.username;
    const role = req.role;

    const response = {
      user_id: userId,
      username: username,
      role: role,
      full_name: username,
      email: ''
    };

    const [users] = await db.query(
      'SELECT full_name, COALESCE(email, "") AS email FROM users WHERE id = ?',
      [userId]
    );

    if (users && users.length > 0) {
      if (users[0].full_name) {
        response.full_name = users[0].full_name;
      }
      response.email = users[0].email || '';
    }

    if (role === 'DRIVER') {
      const [drivers] = await db.query(
        'SELECT id FROM drivers WHERE user_id = ?',
        [userId]
      );
      if (drivers && drivers.length > 0) {
        response.driver_id = drivers[0].id;
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error in getMe:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getMe,
  me: getMe
};
