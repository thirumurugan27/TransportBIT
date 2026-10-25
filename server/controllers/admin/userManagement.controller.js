const db = require('../../config/db');

/**
 * Helper to parse CSV buffer or string into array of rows
 */
function parseCSV(bufferOrString) {
  const content = bufferOrString.toString('utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows = [];
  for (const line of lines) {
    // Basic CSV splitting handling commas
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

function headerMap(header) {
  const map = {};
  for (let i = 0; i < header.length; i++) {
    map[header[i].toLowerCase().trim()] = i;
  }
  return map;
}

function rowCell(row, hm, key) {
  const idx = hm[key];
  if (idx === undefined || idx < 0 || idx >= row.length) {
    return '';
  }
  return (row[idx] || '').trim();
}

/**
 * POST /api/admin/users/faculty/create - Create faculty user
 */
async function createFacultyUser(req, res) {
  let conn;
  try {
    const { full_name, email, username, phone, department, designation } = req.body;
    let password = req.body.password;

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password) {
      password = 'password';
    }

    const [existing] = await db.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [userRes] = await conn.query(`
      INSERT INTO users (username, password, full_name, phone, email, role, status)
      VALUES (?, ?, ?, ?, ?, 'FACULTY', 'active')
    `, [username, password, full_name, phone || null, email]);

    const userID = userRes.insertId;

    await conn.query(`
      INSERT INTO faculty (user_id, department, designation)
      VALUES (?, ?, ?)
    `, [userID, department || null, designation || null]);

    await conn.commit();
    conn.release();

    return res.status(200).json({ message: 'Faculty created successfully', user_id: userID });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('Error creating faculty user:', err);
    return res.status(500).json({ error: 'Failed to create faculty user' });
  }
}

/**
 * POST /api/admin/users/students/bulk-create-file
 */
async function bulkCreateStudentsFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'csv file is required' });
    }

    const rows = parseCSV(req.file.buffer || require('fs').readFileSync(req.file.path));
    if (rows.length < 2) {
      return res.status(400).json({ error: 'csv must include a header and at least one data row' });
    }

    const hm = headerMap(rows[0]);
    const result = {
      created_count: 0,
      failed_count: 0,
      errors: []
    };

    for (let i = 1; i < rows.length; i++) {
      const line = i + 1;
      const row = rows[i];

      const fullName = rowCell(row, hm, 'full_name');
      const email = rowCell(row, hm, 'email').toLowerCase();
      const phone = rowCell(row, hm, 'phone');
      const department = rowCell(row, hm, 'department');
      const year = rowCell(row, hm, 'year');
      const rollNumber = rowCell(row, hm, 'roll_number');
      let username = rowCell(row, hm, 'username');
      let password = rowCell(row, hm, 'password');

      if (!fullName || !email) {
        result.failed_count++;
        result.errors.push(`line ${line}: full_name and email are required`);
        continue;
      }
      if (!username) {
        username = email.split('@')[0];
      }
      if (!password) {
        password = 'password';
      }

      const [existing] = await db.query(`SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`, [email]);
      if (existing && existing.length > 0) {
        result.failed_count++;
        result.errors.push(`line ${line}: email already exists`);
        continue;
      }

      try {
        await db.query(`
          INSERT INTO users (username, password, full_name, phone, email, department, year, roll_number, role, status)
          VALUES (?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, 'STUDENT', 'active')
        `, [username, password, fullName, phone || null, email, department || null, year || null, rollNumber || null]);
        result.created_count++;
      } catch (e) {
        result.failed_count++;
        result.errors.push(`line ${line}: failed to create student`);
      }
    }

    if (result.errors.length > 20) {
      result.errors = result.errors.slice(0, 20);
    }

    return res.status(200).json({ message: 'Student bulk upload processed', result });
  } catch (err) {
    console.error('BulkCreateStudentsFile error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/users/faculty/bulk-create-file
 */
async function bulkCreateFacultyFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'csv file is required' });
    }

    const rows = parseCSV(req.file.buffer || require('fs').readFileSync(req.file.path));
    if (rows.length < 2) {
      return res.status(400).json({ error: 'csv must include a header and at least one data row' });
    }

    const hm = headerMap(rows[0]);
    const result = {
      created_count: 0,
      failed_count: 0,
      errors: []
    };

    for (let i = 1; i < rows.length; i++) {
      const line = i + 1;
      const row = rows[i];

      const fullName = rowCell(row, hm, 'full_name');
      const email = rowCell(row, hm, 'email').toLowerCase();
      const phone = rowCell(row, hm, 'phone');
      const department = rowCell(row, hm, 'department');
      const designation = rowCell(row, hm, 'designation');
      let username = rowCell(row, hm, 'username');
      let password = rowCell(row, hm, 'password');

      if (!fullName || !email) {
        result.failed_count++;
        result.errors.push(`line ${line}: full_name and email are required`);
        continue;
      }
      if (!username) {
        username = email.split('@')[0];
      }
      if (!password) {
        password = 'password';
      }

      const [existing] = await db.query(`SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`, [email]);
      if (existing && existing.length > 0) {
        result.failed_count++;
        result.errors.push(`line ${line}: email already exists`);
        continue;
      }

      let conn;
      try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [uRes] = await conn.query(`
          INSERT INTO users (username, password, full_name, phone, email, role, status)
          VALUES (?, ?, ?, ?, ?, 'FACULTY', 'active')
        `, [username, password, fullName, phone || null, email]);

        const uID = uRes.insertId;

        await conn.query(`
          INSERT INTO faculty (user_id, department, designation)
          VALUES (?, ?, ?)
        `, [uID, department || null, designation || null]);

        await conn.commit();
        conn.release();
        result.created_count++;
      } catch (e) {
        if (conn) {
          await conn.rollback();
          conn.release();
        }
        result.failed_count++;
        result.errors.push(`line ${line}: failed to create faculty user`);
      }
    }

    if (result.errors.length > 20) {
      result.errors = result.errors.slice(0, 20);
    }

    return res.status(200).json({ message: 'Faculty bulk upload processed', result });
  } catch (err) {
    console.error('BulkCreateFacultyFile error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createFacultyUser,
  bulkCreateStudentsFile,
  bulkCreateFacultyFile
};
