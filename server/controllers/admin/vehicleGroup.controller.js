const db = require('../../config/db');
const { formatDateForDB } = require('../../utils/helpers');

async function checkVehicleGroupConflict(vehicleId, excludeGroupId, validFrom, validTo) {
  const query = `
    SELECT vg.name, DATE_FORMAT(vgm.valid_from, '%d-%m-%Y') as existing_from, DATE_FORMAT(vgm.valid_to, '%d-%m-%Y') as existing_to
    FROM vehicle_group_members vgm
    JOIN vehicle_groups vg ON vgm.group_id = vg.id
    WHERE vgm.vehicle_id = ?
    AND vgm.group_id != ?
    AND NOT (? < vgm.valid_from OR ? > vgm.valid_to)
    LIMIT 1
  `;

  const [rows] = await db.query(query, [vehicleId, excludeGroupId, validTo, validFrom]);
  if (rows && rows.length > 0) {
    const [vRows] = await db.query('SELECT vehicle_number FROM vehicles WHERE id = ?', [vehicleId]);
    const vNum = vRows[0] ? vRows[0].vehicle_number : 'Vehicle';
    return {
      hasConflict: true,
      message: `Vehicle '${vNum}' is already assigned to '${rows[0].name}' from ${rows[0].existing_from} to ${rows[0].existing_to}. Dates overlap with your selection.`
    };
  }
  return { hasConflict: false, message: '' };
}

// GET /api/admin/vehicle-groups
async function getVehicleGroups(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT vg.id, vg.name, COALESCE(vg.description, '') as description,
             (SELECT COUNT(DISTINCT vgm.vehicle_id) FROM vehicle_group_members vgm 
              WHERE vgm.group_id = vg.id) as vehicle_count,
             DATE_FORMAT(vg.valid_from, '%d-%m-%Y') as valid_from,
             DATE_FORMAT(vg.valid_to, '%d-%m-%Y') as valid_to,
             DATE_FORMAT(vg.created_at, '%d-%m-%Y %h:%i %p') as created_at,
             DATE_FORMAT(vg.updated_at, '%d-%m-%Y %h:%i %p') as updated_at
      FROM vehicle_groups vg
      ORDER BY vg.name
    `);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getVehicleGroups error:', err);
    return res.status(500).json({ error: 'Error fetching vehicle groups' });
  }
}

// POST /api/admin/vehicle-groups/create
async function createVehicleGroup(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { name, description, valid_from, valid_to, vehicle_ids } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    if (!valid_from || !valid_to) {
      return res.status(400).json({ error: 'Valid from and valid to dates are required' });
    }

    const vFrom = formatDateForDB(valid_from);
    const vTo = formatDateForDB(valid_to);
    const vehicleIds = Array.isArray(vehicle_ids) ? vehicle_ids : [];

    if (vehicleIds.length > 0) {
      for (const vid of vehicleIds) {
        const { hasConflict, message } = await checkVehicleGroupConflict(vid, 0, vFrom, vTo);
        if (hasConflict) {
          return res.status(409).json({ error: message });
        }
      }
    }

    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO vehicle_groups (name, description, valid_from, valid_to)
      VALUES (?, ?, ?, ?)
    `, [name, description || null, vFrom, vTo]);

    const groupId = result.insertId;

    for (const vid of vehicleIds) {
      await connection.query(`
        INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
        VALUES (?, ?, ?, ?)
      `, [groupId, vid, vFrom, vTo]);
    }

    await connection.commit();
    return res.status(200).json({ id: groupId, message: 'Vehicle group created successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('createVehicleGroup error:', err);
    return res.status(500).json({ error: 'Error creating vehicle group' });
  } finally {
    connection.release();
  }
}

// PUT /api/admin/vehicle-groups/:id
async function updateVehicleGroup(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const { name, description, valid_from, valid_to, vehicle_ids } = req.body;

    let vFrom = valid_from;
    let vTo = valid_to;

    if (!vFrom || !vTo) {
      const [existing] = await db.query(
        'SELECT valid_from, valid_to FROM vehicle_groups WHERE id = ?',
        [id]
      );
      if (existing && existing.length > 0) {
        vFrom = vFrom || existing[0].valid_from;
        vTo = vTo || existing[0].valid_to;
      }
    }

    if (!vFrom || !vTo) {
      return res.status(400).json({ error: 'Valid from and valid to dates are required' });
    }

    vFrom = formatDateForDB(vFrom);
    vTo = formatDateForDB(vTo);

    if (vFrom > vTo) {
      return res.status(400).json({ error: 'Valid From date must be before Valid To date' });
    }

    await connection.beginTransaction();

    await connection.query(`
      UPDATE vehicle_groups 
      SET name = ?, description = ?, valid_from = ?, valid_to = ?
      WHERE id = ?
    `, [name, description || null, vFrom, vTo, id]);

    await connection.query('DELETE FROM vehicle_group_members WHERE group_id = ?', [id]);

    const vehicleIds = Array.isArray(vehicle_ids) ? vehicle_ids : [];
    for (const vid of vehicleIds) {
      await connection.query(`
        INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
        VALUES (?, ?, ?, ?)
      `, [id, vid, vFrom, vTo]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Vehicle group updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('updateVehicleGroup error:', err);
    return res.status(500).json({ error: 'Error updating vehicle group' });
  } finally {
    connection.release();
  }
}

// DELETE /api/admin/vehicle-groups/:id
async function deleteVehicleGroup(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    await db.query('DELETE FROM vehicle_groups WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Vehicle group deleted successfully' });
  } catch (err) {
    console.error('deleteVehicleGroup error:', err);
    return res.status(500).json({ error: 'Error deleting vehicle group' });
  }
}

// GET /api/admin/vehicle-groups/:id/details
async function getVehicleGroupDetails(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const [rows] = await db.query(`
      SELECT vg.id, vg.name, COALESCE(vg.description, '') as description,
             (SELECT COUNT(DISTINCT vgm.vehicle_id) FROM vehicle_group_members vgm 
              WHERE vgm.group_id = vg.id) as vehicle_count,
             DATE_FORMAT(vg.valid_from, '%d-%m-%Y') as valid_from,
             DATE_FORMAT(vg.valid_to, '%d-%m-%Y') as valid_to,
             DATE_FORMAT(vg.created_at, '%d-%m-%Y %h:%i %p') as created_at,
             DATE_FORMAT(vg.updated_at, '%d-%m-%Y %h:%i %p') as updated_at
      FROM vehicle_groups vg
      WHERE vg.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle group not found' });
    }

    return res.status(200).json({ group: rows[0] });
  } catch (err) {
    console.error('getVehicleGroupDetails error:', err);
    return res.status(500).json({ error: 'Error fetching vehicle group details' });
  }
}

// GET /api/admin/vehicle-groups/:id/members
async function getVehicleGroupMembers(req, res) {
  try {
    const groupId = req.params.id;
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID required' });
    }

    const [rows] = await db.query(`
      SELECT vgm.id, vgm.group_id, vgm.vehicle_id,
             COALESCE(NULLIF(v.vehicle_name, ''), v.vehicle_number, '') as vehicle_name,
             v.vehicle_number, COALESCE(vt.type, '') as vehicle_type,
             DATE_FORMAT(vgm.valid_from, '%d-%m-%Y') as valid_from,
             DATE_FORMAT(vgm.valid_to, '%d-%m-%Y') as valid_to,
             DATE_FORMAT(vgm.added_at, '%d-%m-%Y %h:%i %p') as added_at,
             v.status as vehicle_status
      FROM vehicle_group_members vgm
      JOIN vehicles v ON vgm.vehicle_id = v.id
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE vgm.group_id = ?
      ORDER BY vgm.valid_from DESC, v.vehicle_number
    `, [groupId]);

    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getVehicleGroupMembers error:', err);
    return res.status(500).json({ error: 'Error fetching members' });
  }
}

// POST /api/admin/vehicle-groups/:id/add-member
async function addVehicleGroupMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { vehicle_id, valid_from, valid_to } = req.body;

    if (!groupId || !vehicle_id || !valid_from || !valid_to) {
      return res.status(400).json({ error: 'Vehicle ID, valid_from, and valid_to are required' });
    }

    const vFrom = formatDateForDB(valid_from);
    const vTo = formatDateForDB(valid_to);

    const { hasConflict, message } = await checkVehicleGroupConflict(vehicle_id, groupId, vFrom, vTo);
    if (hasConflict) {
      return res.status(409).json({ error: message });
    }

    await db.query(`
      INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
      VALUES (?, ?, ?, ?)
    `, [groupId, vehicle_id, vFrom, vTo]);

    return res.status(200).json({ message: 'Vehicle added to group successfully' });
  } catch (err) {
    console.error('addVehicleGroupMember error:', err);
    return res.status(500).json({ error: 'Error adding member' });
  }
}

// DELETE /api/admin/vehicle-groups/:id/remove-member
async function removeVehicleGroupMember(req, res) {
  try {
    const memberId = req.query.member_id;
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID required' });
    }

    await db.query('DELETE FROM vehicle_group_members WHERE id = ?', [memberId]);
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('removeVehicleGroupMember error:', err);
    return res.status(500).json({ error: 'Error removing member' });
  }
}

// POST /api/admin/vehicle-groups/:id/assign-vehicles (legacy)
async function assignVehiclesToGroup(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { vehicle_ids, valid_from, valid_to, clear_existing } = req.body;
    const vehicleIds = Array.isArray(vehicle_ids) ? vehicle_ids : [];

    if (vehicleIds.length === 0 && !clear_existing) {
      return res.status(400).json({ error: 'No vehicles selected' });
    }

    if (clear_existing && vehicleIds.length === 0) {
      await db.query('DELETE FROM vehicle_group_members WHERE group_id = ?', [groupId]);
      return res.status(200).json({ message: 'All vehicles removed from group', added: 0 });
    }

    let vFrom = valid_from;
    let vTo = valid_to;

    if (!vFrom || !vTo) {
      const [rows] = await db.query(`
        SELECT DATE_FORMAT(valid_from, '%d-%m-%Y') as vfrom, DATE_FORMAT(valid_to, '%d-%m-%Y') as vto
        FROM vehicle_groups WHERE id = ?
      `, [groupId]);
      if (rows && rows.length > 0) {
        vFrom = vFrom || rows[0].vfrom;
        vTo = vTo || rows[0].vto;
      }
    }

    if (!vFrom || !vTo) {
      return res.status(400).json({ error: 'Valid from and valid to dates are required' });
    }

    vFrom = formatDateForDB(vFrom);
    vTo = formatDateForDB(vTo);

    if (clear_existing) {
      await db.query('DELETE FROM vehicle_group_members WHERE group_id = ?', [groupId]);
    }

    let addedCount = 0;
    for (const vid of vehicleIds) {
      const { hasConflict } = await checkVehicleGroupConflict(vid, groupId, vFrom, vTo);
      if (!hasConflict || clear_existing) {
        await db.query('DELETE FROM vehicle_group_members WHERE group_id = ? AND vehicle_id = ?', [groupId, vid]);
        await db.query(`
          INSERT INTO vehicle_group_members (group_id, vehicle_id, valid_from, valid_to)
          VALUES (?, ?, ?, ?)
        `, [groupId, vid, vFrom, vTo]);
        addedCount++;
      }
    }

    return res.status(200).json({ message: 'Vehicles assigned successfully', added: addedCount });
  } catch (err) {
    console.error('assignVehiclesToGroup error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/vehicle-groups/:id/remove-vehicle
async function removeVehicleFromGroup(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { vehicle_id } = req.body;

    await db.query('DELETE FROM vehicle_group_members WHERE vehicle_id = ? AND group_id = ?', [vehicle_id, groupId]);
    return res.status(200).json({ message: 'Vehicle removed successfully' });
  } catch (err) {
    console.error('removeVehicleFromGroup error:', err);
    return res.status(500).json({ error: 'Error removing vehicle' });
  }
}

module.exports = {
  getVehicleGroups,
  createVehicleGroup,
  updateVehicleGroup,
  deleteVehicleGroup,
  getVehicleGroupDetails,
  getVehicleGroupMembers,
  addVehicleGroupMember,
  removeVehicleGroupMember,
  assignVehiclesToGroup,
  removeVehicleFromGroup
};
