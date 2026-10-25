const db = require('../../config/db');
const { generateToken } = require('../../utils/token');

async function unifiedLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    console.log(`Login attempt: username=${username}`);

    const [rows] = await db.query(
      'SELECT id, password, role, full_name, COALESCE(email, "") AS email FROM users WHERE username=?',
      [username]
    );

    if (!rows || rows.length === 0) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    if (user.password !== password) {
      console.log(`Password mismatch for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, username, user.role);

    const isProduction = process.env.ENV === 'production';
    res.cookie('TRANSPORT_AUTH', token, {
      maxAge: 3600 * 24 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/'
    });

    const response = {
      user_id: user.id,
      username: username,
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role,
      token: token
    };

    if (user.role === 'DRIVER') {
      const [driverRows] = await db.query(
        'SELECT id FROM drivers WHERE user_id = ?',
        [user.id]
      );
      if (driverRows && driverRows.length > 0) {
        response.driver_id = driverRows[0].id;
      } else {
        console.log(`Driver record not found for user ${user.id}`);
      }
    }

    console.log(`Login successful for user: ${username}, Role: ${user.role}`);
    return res.status(200).json(response);
  } catch (err) {
    console.error('Database error in unifiedLogin:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function setupAdminPassword(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [result] = await db.query(
      "UPDATE users SET password=? WHERE username='admin'",
      [password]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    return res.status(200).json({ message: 'Admin password updated successfully' });
  } catch (err) {
    console.error('Setup admin error:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
}

function logout(req, res) {
  const isProduction = process.env.ENV === 'production';
  res.cookie('TRANSPORT_AUTH', '', {
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  });
  return res.status(200).json({ message: 'Logged out successfully' });
}

module.exports = {
  unifiedLogin,
  setupAdminPassword,
  logout
};
