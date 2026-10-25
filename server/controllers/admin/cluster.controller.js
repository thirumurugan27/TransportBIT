const db = require('../../config/db');

async function checkDriverClusterConflict(driverId, excludeClusterId, validFrom, validTo) {
  const query = `
    SELECT c.name, DATE_FORMAT(dcm.valid_from, '%d-%m-%Y') as existing_from, DATE_FORMAT(dcm.valid_to, '%d-%m-%Y') as existing_to
    FROM driver_cluster_members dcm
    JOIN driver_clusters c ON dcm.cluster_id = c.id
    WHERE dcm.driver_id = ?
    AND dcm.cluster_id != ?
    AND NOT (? < dcm.valid_from OR ? > dcm.valid_to)
    LIMIT 1
  `;

  const [rows] = await db.query(query, [driverId, excludeClusterId, validTo, validFrom]);
  if (rows && rows.length > 0) {
    const [uRows] = await db.query(
      'SELECT u.full_name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?',
      [driverId]
    );
    const driverName = uRows[0] ? uRows[0].full_name : 'Driver';
    return {
      hasConflict: true,
      message: `Driver '${driverName}' is already assigned to '${rows[0].name}' from ${rows[0].existing_from} to ${rows[0].existing_to}. Dates overlap with your selection.`
    };
  }
  return { hasConflict: false, message: '' };
}

// GET /api/admin/clusters
async function getClusters(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.name, COALESCE(c.description, '') as description, 
             (SELECT COUNT(DISTINCT dcm.driver_id) FROM driver_cluster_members dcm 
              WHERE dcm.cluster_id = c.id) as driver_count,
             DATE_FORMAT(c.valid_from, '%d-%m-%Y') as valid_from, 
             DATE_FORMAT(c.valid_to, '%d-%m-%Y') as valid_to
      FROM driver_clusters c
      ORDER BY c.name
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getClusters error:', err);
    return res.status(500).json({ error: 'Error fetching clusters' });
  }
}

// GET /api/admin/clusters/:id/members
async function getClusterMembers(req, res) {
  try {
    const clusterId = req.params.id;
    if (!clusterId) {
      return res.status(400).json({ error: 'Cluster ID required' });
    }

    const [rows] = await db.query(`
      SELECT dcm.id, dcm.cluster_id, dcm.driver_id, 
             COALESCE(u.full_name, '') as driver_name,
             COALESCE(u.phone, '') as driver_phone,
             DATE_FORMAT(dcm.valid_from, '%d-%m-%Y') as valid_from,
             DATE_FORMAT(dcm.valid_to, '%d-%m-%Y') as valid_to,
             DATE_FORMAT(dcm.added_at, '%d-%m-%Y %h:%i %p') as added_at
      FROM driver_cluster_members dcm
      JOIN drivers d ON dcm.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE dcm.cluster_id = ?
      ORDER BY dcm.valid_from DESC, u.full_name
    `, [clusterId]);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getClusterMembers error:', err);
    return res.status(500).json({ error: 'Error fetching members' });
  }
}

// POST /api/admin/clusters/create
async function createCluster(req, res) {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const [result] = await db.query(`
      INSERT INTO driver_clusters (name, description)
      VALUES (?, ?)
    `, [name, description || null]);

    return res.status(200).json({ id: result.insertId, message: 'Cluster created' });
  } catch (err) {
    console.error('createCluster error:', err);
    return res.status(500).json({ error: 'Error creating cluster' });
  }
}

// POST /api/admin/clusters/create-with-schedule
async function createClusterWithSchedule(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { name, description, valid_from, valid_to, driver_ids, force } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const driverIds = Array.isArray(driver_ids) ? driver_ids : [];
    if (driverIds.length === 0) {
      return res.status(400).json({ error: 'At least one driver must be selected' });
    }
    if (!valid_from || !valid_to) {
      return res.status(400).json({ error: 'Valid from and valid to dates are required' });
    }

    const warnings = [];
    for (const did of driverIds) {
      const { hasConflict, message } = await checkDriverClusterConflict(did, 0, valid_from, valid_to);
      if (hasConflict) {
        warnings.push(message);
      }
    }

    if (warnings.length > 0 && !force) {
      return res.status(409).json({ conflicts: warnings });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO driver_clusters (name, description, valid_from, valid_to)
      VALUES (?, ?, ?, ?)
    `, [name, description || null, valid_from, valid_to]);

    const clusterId = result.insertId;

    for (const did of driverIds) {
      await connection.query(`
        INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
        VALUES (?, ?, ?, ?)
      `, [clusterId, did, valid_from, valid_to]);
    }

    await connection.commit();

    return res.status(200).json({
      id: clusterId,
      message: 'Driver group created successfully',
      drivers_added: driverIds.length
    });
  } catch (err) {
    await connection.rollback();
    console.error('createClusterWithSchedule error:', err);
    return res.status(500).json({ error: 'Error creating driver group' });
  } finally {
    connection.release();
  }
}

// POST /api/admin/clusters/update
async function updateCluster(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { id, name, description, valid_from, valid_to, driver_ids, force } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    let vFrom = valid_from;
    let vTo = valid_to;

    if (!vFrom || !vTo) {
      const [existing] = await db.query(
        'SELECT valid_from, valid_to FROM driver_clusters WHERE id = ?',
        [id]
      );
      if (existing && existing.length > 0) {
        vFrom = vFrom || existing[0].valid_from || '2024-01-01';
        vTo = vTo || existing[0].valid_to || '2025-12-31';
      }
    }

    const driverIds = Array.isArray(driver_ids) ? driver_ids : [];

    const warnings = [];
    for (const did of driverIds) {
      const { hasConflict, message } = await checkDriverClusterConflict(did, id, vFrom, vTo);
      if (hasConflict) {
        warnings.push(message);
      }
    }

    if (warnings.length > 0 && !force) {
      return res.status(409).json({ conflicts: warnings });
    }

    await connection.beginTransaction();

    await connection.query(`
      UPDATE driver_clusters 
      SET name=?, description=?, valid_from=?, valid_to=?
      WHERE id=?
    `, [name, description || null, vFrom, vTo, id]);

    await connection.query('DELETE FROM driver_cluster_members WHERE cluster_id = ?', [id]);

    for (const did of driverIds) {
      await connection.query(`
        INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
        VALUES (?, ?, ?, ?)
      `, [id, did, vFrom, vTo]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Driver group updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('updateCluster error:', err);
    return res.status(500).json({ error: 'Error updating driver group' });
  } finally {
    connection.release();
  }
}

// POST /api/admin/clusters/:id/add-member
async function addClusterMember(req, res) {
  try {
    const clusterId = parseInt(req.params.id, 10);
    const { driver_id, valid_from, valid_to, force } = req.body;

    if (!clusterId || !driver_id || !valid_from || !valid_to) {
      return res.status(400).json({ error: 'Driver ID, valid_from, and valid_to are required' });
    }

    const { hasConflict, message } = await checkDriverClusterConflict(driver_id, clusterId, valid_from, valid_to);
    if (hasConflict && !force) {
      return res.status(409).json({ conflicts: [message] });
    }

    await db.query(`
      INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
      VALUES (?, ?, ?, ?)
    `, [clusterId, driver_id, valid_from, valid_to]);

    return res.status(200).json({ message: 'Driver added to group successfully' });
  } catch (err) {
    console.error('addClusterMember error:', err);
    return res.status(500).json({ error: 'Error adding member' });
  }
}

// DELETE /api/admin/clusters/:id/remove-member
async function removeClusterMember(req, res) {
  try {
    const memberId = req.query.member_id;
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID required' });
    }

    await db.query('DELETE FROM driver_cluster_members WHERE id = ?', [memberId]);
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('removeClusterMember error:', err);
    return res.status(500).json({ error: 'Error removing member' });
  }
}

// POST /api/admin/clusters/assign-drivers (legacy)
async function assignDriversToCluster(req, res) {
  try {
    const { cluster_id, driver_ids, valid_from, valid_to } = req.body;
    if (!valid_from || !valid_to) {
      return res.status(400).json({ error: 'Valid from and valid to dates are required' });
    }

    let addedCount = 0;
    const driverIds = Array.isArray(driver_ids) ? driver_ids : [];

    for (const did of driverIds) {
      const { hasConflict } = await checkDriverClusterConflict(did, cluster_id, valid_from, valid_to);
      if (!hasConflict) {
        await db.query(`
          INSERT INTO driver_cluster_members (cluster_id, driver_id, valid_from, valid_to)
          VALUES (?, ?, ?, ?)
        `, [cluster_id, did, valid_from, valid_to]);
        addedCount++;
      }
    }

    return res.status(200).json({ message: 'Drivers assigned to cluster', added: addedCount });
  } catch (err) {
    console.error('assignDriversToCluster error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/clusters/assign-shift
async function assignClusterToShift(req, res) {
  try {
    const { cluster_id, shift_id, assigned_date } = req.body;
    const createdBy = req.user ? req.user.user_id : null;

    const [rows] = await db.query(`
      SELECT dcm.driver_id FROM driver_cluster_members dcm
      WHERE dcm.cluster_id = ? AND ? BETWEEN dcm.valid_from AND dcm.valid_to
    `, [cluster_id, assigned_date]);

    const driverIds = (rows || []).map(r => r.driver_id);

    const [vRows] = await db.query(
      "SELECT id FROM vehicles WHERE status = 'available' LIMIT ?",
      [Math.max(driverIds.length, 1)]
    );
    const vehicleIds = (vRows || []).map(r => r.id);

    let assignedCount = 0;
    for (let i = 0; i < driverIds.length; i++) {
      const vId = vehicleIds[i] || (vehicleIds.length > 0 ? vehicleIds[0] : null);
      if (vId) {
        await db.query(`
          INSERT INTO assignments (driver_id, vehicle_id, shift_id, assigned_date, status, created_by)
          VALUES (?, ?, ?, ?, 'assigned', ?)
          ON DUPLICATE KEY UPDATE shift_id = ?, vehicle_id = ?
        `, [driverIds[i], vId, shift_id, assigned_date, createdBy, shift_id, vId]);
        assignedCount++;
      }
    }

    return res.status(200).json({
      message: 'Cluster assigned to shift',
      assigned_count: assignedCount,
      total_drivers: driverIds.length
    });
  } catch (err) {
    console.error('assignClusterToShift error:', err);
    return res.status(500).json({ error: 'Error assigning cluster to shift' });
  }
}

// DELETE /api/admin/clusters/delete?id=X
async function deleteCluster(req, res) {
  try {
    let id = req.query.id || (req.body ? req.body.id : null);
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    id = parseInt(id, 10);

    await db.query('DELETE FROM ev_assignments WHERE cluster_id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM driver_clusters WHERE id = ?', [id]);

    return res.status(200).json({ message: 'Driver group deleted' });
  } catch (err) {
    console.error('deleteCluster error:', err);
    return res.status(500).json({ error: 'Error deleting cluster' });
  }
}

// GET /api/admin/drivers/available-for-cluster
async function getAvailableDriversForCluster(req, res) {
  try {
    const { valid_from, valid_to, exclude_cluster_id } = req.query;
    if (!valid_from || !valid_to) {
      return res.status(400).json({ error: 'valid_from and valid_to required' });
    }

    const query = `
      SELECT d.id, u.full_name as name, COALESCE(d.license_type, '') as license_type
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.id NOT IN (
        SELECT dcm.driver_id FROM driver_cluster_members dcm
        WHERE dcm.cluster_id != COALESCE(?, 0)
        AND NOT (? < dcm.valid_from OR ? > dcm.valid_to)
      )
      ORDER BY u.full_name
    `;

    const [rows] = await db.query(query, [exclude_cluster_id || null, valid_to, valid_from]);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAvailableDriversForCluster error:', err);
    return res.status(500).json({ error: 'Error fetching drivers' });
  }
}

module.exports = {
  getClusters,
  getClusterMembers,
  createCluster,
  createClusterWithSchedule,
  updateCluster,
  addClusterMember,
  removeClusterMember,
  assignDriversToCluster,
  assignClusterToShift,
  deleteCluster,
  getAvailableDriversForCluster
};
