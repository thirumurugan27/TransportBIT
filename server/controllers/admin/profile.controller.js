const db = require('../../config/db');

async function getAdminProfile(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT username, full_name, COALESCE(phone,'') as phone, 
             COALESCE(email,'') as email, COALESCE(profile_image,'') as profile_image
      FROM users WHERE username='admin'
    `);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function updateAdminProfile(req, res) {
  try {
    const { full_name, phone, email, profile_image } = req.body;
    await db.query(`
      UPDATE users
      SET full_name=?, phone=?, email=?, profile_image=?
      WHERE username='admin'
    `, [full_name || '', phone || '', email || '', profile_image || '']);

    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update admin profile error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function uploadAdminProfileImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    const filename = req.file.filename;
    const fullName = req.body.full_name || '';
    const phone = req.body.phone || '';
    const email = req.body.email || '';

    await db.query(`
      UPDATE users
      SET full_name=?, phone=?, email=?, profile_image=?
      WHERE username='admin'
    `, [fullName, phone, email, filename]);

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile_image: filename
    });
  } catch (err) {
    console.error('Upload admin profile image error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function changeAdminPassword(req, res) {
  try {
    const { new_password } = req.body;
    if (!new_password) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await db.query("UPDATE users SET password=? WHERE username='admin'", [new_password]);
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change admin password error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAdminProfile,
  updateAdminProfile,
  uploadAdminProfileImage,
  changeAdminPassword
};
