const axios = require('axios');
const ExcelJS = require('exceljs');
const db = require('../../config/db');

const bulkVehicleRequiredHeaders = [
  'vehicle_number',
  'vehicle_type',
  'fuel_type',
  'seating_capacity'
];

const supportedVehicleFuelTypes = new Set(['DIESEL', 'PETROL', 'CNG', 'EV', 'ELECTRIC']);

function normalizeVehicleCSVHeader(header) {
  let normalized = String(header || '').trim().replace(/^\ufeff/, '').toLowerCase();
  normalized = normalized.replace(/[\s\-\/\.]+/g, '_');

  switch (normalized) {
    case 'registration_number':
    case 'vehicle_reg_number':
    case 'reg_number':
    case 'vehicle_no':
    case 'vehicle_no_':
      return 'vehicle_number';
    case 'vehiclecategory':
    case 'category':
    case 'vehicle_category':
    case 'vehiclekind':
    case 'vehicle_kind':
    case 'type':
      return 'vehicle_type';
    case 'fuel':
    case 'fuelcategory':
    case 'fuel_category':
      return 'fuel_type';
    case 'capacity':
    case 'seat_capacity':
    case 'seats':
      return 'seating_capacity';
    case 'vehiclename':
    case 'bus_name':
    case 'name':
      return 'vehicle_name';
    default:
      return normalized;
  }
}

function formatDateForAudit(s) {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return str;
}

async function insertAuditLog(connOrDb, vehicleId, docType, fieldName, oldVal, newVal, changedBy, changedByName) {
  try {
    await connOrDb.query(
      `INSERT INTO vehicle_document_audit_log (vehicle_id, document_type, field_name, old_value, new_value, changed_by, changed_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vehicleId, docType, fieldName, oldVal || null, newVal || null, changedBy || null, changedByName || null]
    );
  } catch (err) {
    console.error('Audit log insert error:', err);
  }
}

async function compareAndLog(connOrDb, vehicleId, docType, fieldName, oldVal, newVal, userId, userName) {
  const o = oldVal ? String(oldVal).trim() : '';
  const n = newVal ? String(newVal).trim() : '';
  if (o !== n) {
    await insertAuditLog(connOrDb, vehicleId, docType, fieldName, o || null, n || null, userId, userName);
  }
}

async function resolveVehicleTypeID(typeStr, conn = db) {
  const [rows] = await conn.query(
    'SELECT id FROM vehicle_types WHERE is_active = 1 AND UPPER(type) = UPPER(?) LIMIT 1',
    [typeStr]
  );
  if (!rows || rows.length === 0) {
    throw new Error(`invalid vehicle_type: ${typeStr}`);
  }
  return rows[0].id;
}

function normalizeFlexibleDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  let m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return str;
}

// GET /api/admin/vehicles - list all vehicles with replacements & groups
async function getAllVehicles(req, res) {
  try {
    const query = `
      SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.fuel_type, v.seating_capacity, v.status,
             DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y') as insurance_expire_date,
             DATE_FORMAT(v.insurance_start_date,  '%d-%m-%Y') as insurance_start_date,
             DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y') as fc_expire_date,
             DATE_FORMAT(v.fc_start_date,  '%d-%m-%Y') as fc_start_date,
             DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y') as permit_expire_date,
             DATE_FORMAT(v.permit_start_date,  '%d-%m-%Y') as permit_start_date,
             COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
             COALESCE(b.start_point, '') as start_point,
             COALESCE(b.end_point, '') as end_point,
             v.chassis_number, v.engine_number, v.permit_number, v.additional_permit,
             v.insurance_amount, v.road_tax_amount,
             DATE_FORMAT(v.pollution_expire, '%d-%m-%Y') as pollution_expire,
             DATE_FORMAT(v.green_tax_expire, '%d-%m-%Y') as green_tax_expire,
             DATE_FORMAT(v.mv_tax_expire, '%d-%m-%Y') as mv_tax_expire,
             vr.id as replacement_id,
             vr.status as replacement_status,
             DATE_FORMAT(vr.start_date, '%d-%m-%Y') as replacement_start_date,
             DATE_FORMAT(vr.end_date, '%d-%m-%Y') as replacement_end_date,
             vr.reason as replacement_reason,
             rv.vehicle_number as replacement_vehicle_number,
             vgm.group_id as vehicle_group_id,
             COALESCE(vg.name, '') as vehicle_group_name
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      LEFT JOIN buses b ON v.id = b.vehicle_id
      LEFT JOIN vehicle_replacements vr ON v.id = vr.vehicle_id 
          AND vr.status IN ('approved', 'pending')
      LEFT JOIN vehicles rv ON vr.replacement_vehicle_id = rv.id
      LEFT JOIN vehicle_group_members vgm ON vgm.vehicle_id = v.id AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
      LEFT JOIN vehicle_groups vg ON vg.id = vgm.group_id
      ORDER BY v.id DESC`;

    const [rows] = await db.query(query);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAllVehicles error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/vehicle-types - list active vehicle types
async function getVehicleTypes(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT id, type, label
      FROM vehicle_types
      WHERE is_active = 1
      ORDER BY id ASC
    `);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getVehicleTypes error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/vehicle-types/create
async function createVehicleType(req, res) {
  try {
    const { type, label } = req.body;
    const vehicleType = String(type || '').trim().toUpperCase();
    const lbl = String(label || '').trim();

    if (!vehicleType) {
      return res.status(400).json({ error: 'type cannot be empty' });
    }
    if (!lbl) {
      return res.status(400).json({ error: 'label cannot be empty' });
    }

    const [existing] = await db.query(
      'SELECT COUNT(*) as count FROM vehicle_types WHERE UPPER(type) = UPPER(?)',
      [vehicleType]
    );
    if (existing[0].count > 0) {
      return res.status(409).json({ error: 'vehicle type already exists' });
    }

    const [result] = await db.query(
      'INSERT INTO vehicle_types (type, label, is_active) VALUES (?, ?, 1)',
      [vehicleType, lbl]
    );

    return res.status(201).json({
      message: 'Vehicle type created successfully',
      id: result.insertId,
      type: vehicleType,
      label: lbl
    });
  } catch (err) {
    console.error('createVehicleType error:', err);
    return res.status(500).json({ error: 'failed to create vehicle type' });
  }
}

// PUT /api/admin/vehicle-types/:id
async function updateVehicleType(req, res) {
  try {
    const typeId = req.params.id;
    const { type, label } = req.body;

    if (!type && !label) {
      return res.status(400).json({ error: 'at least one field must be provided' });
    }

    let query = '';
    const args = [];
    if (type && label) {
      query = 'UPDATE vehicle_types SET type = ?, label = ? WHERE id = ?';
      args.push(String(type).trim().toUpperCase(), String(label).trim(), typeId);
    } else if (type) {
      query = 'UPDATE vehicle_types SET type = ? WHERE id = ?';
      args.push(String(type).trim().toUpperCase(), typeId);
    } else {
      query = 'UPDATE vehicle_types SET label = ? WHERE id = ?';
      args.push(String(label).trim(), typeId);
    }

    const [result] = await db.query(query, args);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'vehicle type not found' });
    }

    return res.status(200).json({ message: 'Vehicle type updated successfully' });
  } catch (err) {
    console.error('updateVehicleType error:', err);
    return res.status(500).json({ error: 'failed to update vehicle type' });
  }
}

// DELETE /api/admin/vehicle-types/:id
async function deleteVehicleType(req, res) {
  try {
    const typeId = req.params.id;

    const [vCount] = await db.query(
      'SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type_id = ?',
      [typeId]
    );
    if (vCount[0].count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${vCount[0].count} vehicle(s) using this type`
      });
    }

    const [result] = await db.query(
      'UPDATE vehicle_types SET is_active = 0 WHERE id = ?',
      [typeId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'vehicle type not found' });
    }

    return res.status(200).json({ message: 'Vehicle type deleted successfully' });
  } catch (err) {
    console.error('deleteVehicleType error:', err);
    return res.status(500).json({ error: 'failed to delete vehicle type' });
  }
}

// POST /api/admin/vehicles/create
async function createVehicle(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const {
      vehicle_name, vehicle_number, vehicle_type, fuel_type, seating_capacity,
      chassis_number, engine_number, permit_number, additional_permit,
      insurance_amount, road_tax_amount,
      pollution_expire, green_tax_expire, mv_tax_expire,
      insurance_expire_date, insurance_start_date,
      fc_expire_date, fc_start_date,
      permit_expire_date, permit_start_date,
      start_point, end_point
    } = req.body;

    const vType = String(vehicle_type || '').trim().toUpperCase();
    if (!vType) {
      return res.status(400).json({ error: 'vehicle_type is required' });
    }

    const vehicleTypeId = await resolveVehicleTypeID(vType, connection);

    const normInsExp = normalizeFlexibleDate(insurance_expire_date);
    const normInsStart = normalizeFlexibleDate(insurance_start_date);
    const normFcExp = normalizeFlexibleDate(fc_expire_date);
    const normFcStart = normalizeFlexibleDate(fc_start_date);
    const normPermitExp = normalizeFlexibleDate(permit_expire_date);
    const normPermitStart = normalizeFlexibleDate(permit_start_date);

    const normPollutionExp = normalizeFlexibleDate(pollution_expire);
    const normGreenTaxExp = normalizeFlexibleDate(green_tax_expire);
    const normMvTaxExp = normalizeFlexibleDate(mv_tax_expire);

    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
        chassis_number, engine_number, permit_number, additional_permit,
        insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
        insurance_expire_date, insurance_start_date,
        fc_expire_date, fc_start_date,
        permit_expire_date, permit_start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vehicle_name || null,
      String(vehicle_number || '').trim().toUpperCase(),
      vehicleTypeId,
      fuel_type || null,
      Number(seating_capacity) || 0,
      chassis_number || null,
      engine_number || null,
      permit_number || null,
      additional_permit || null,
      insurance_amount != null ? Number(insurance_amount) : null,
      road_tax_amount != null ? Number(road_tax_amount) : null,
      normPollutionExp,
      normGreenTaxExp,
      normMvTaxExp,
      normInsExp,
      normInsStart,
      normFcExp,
      normFcStart,
      normPermitExp,
      normPermitStart
    ]);

    const vehicleId = result.insertId;

    const userId = req.user ? req.user.user_id : null;
    const userName = req.user ? req.user.username : 'System';

    const initialFields = [
      { docType: 'insurance', fieldName: 'start_date', value: formatDateForAudit(normInsStart) },
      { docType: 'insurance', fieldName: 'expire_date', value: formatDateForAudit(normInsExp) },
      { docType: 'fc', fieldName: 'start_date', value: formatDateForAudit(normFcStart) },
      { docType: 'fc', fieldName: 'expire_date', value: formatDateForAudit(normFcExp) },
      { docType: 'permit', fieldName: 'start_date', value: formatDateForAudit(normPermitStart) },
      { docType: 'permit', fieldName: 'expire_date', value: formatDateForAudit(normPermitExp) },
    ];

    for (const f of initialFields) {
      if (f.value) {
        await insertAuditLog(connection, vehicleId, f.docType, f.fieldName, null, f.value, userId, userName);
      }
    }

    if (vType === 'BUS') {
      await connection.query(`
        INSERT INTO buses (vehicle_id, start_point, end_point)
        VALUES (?, ?, ?)
      `, [vehicleId, start_point || null, end_point || null]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Vehicle created successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('createVehicle error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
}

// POST /api/admin/vehicles/update
async function updateVehicle(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const {
      id, vehicle_name, vehicle_number, vehicle_type, fuel_type, seating_capacity, status,
      chassis_number, engine_number, permit_number, additional_permit,
      insurance_amount, road_tax_amount,
      pollution_expire, green_tax_expire, mv_tax_expire,
      insurance_expire_date, insurance_start_date,
      fc_expire_date, fc_start_date,
      permit_expire_date, permit_start_date,
      start_point, end_point
    } = req.body;

    const vType = String(vehicle_type || '').trim().toUpperCase();
    if (!vType) {
      return res.status(400).json({ error: 'vehicle_type is required' });
    }

    const vehicleTypeId = await resolveVehicleTypeID(vType, connection);

    const normInsExp = normalizeFlexibleDate(insurance_expire_date);
    const normInsStart = normalizeFlexibleDate(insurance_start_date);
    const normFcExp = normalizeFlexibleDate(fc_expire_date);
    const normFcStart = normalizeFlexibleDate(fc_start_date);
    const normPermitExp = normalizeFlexibleDate(permit_expire_date);
    const normPermitStart = normalizeFlexibleDate(permit_start_date);

    const normPollutionExp = normalizeFlexibleDate(pollution_expire);
    const normGreenTaxExp = normalizeFlexibleDate(green_tax_expire);
    const normMvTaxExp = normalizeFlexibleDate(mv_tax_expire);

    // Read current document values before update for audit diff
    const [existingRows] = await connection.query(`
      SELECT DATE_FORMAT(insurance_expire_date, '%d-%m-%Y') as oldInsExpire,
             DATE_FORMAT(insurance_start_date, '%d-%m-%Y') as oldInsStart,
             DATE_FORMAT(fc_expire_date, '%d-%m-%Y') as oldFCExpire,
             DATE_FORMAT(fc_start_date, '%d-%m-%Y') as oldFCStart,
             DATE_FORMAT(permit_expire_date, '%d-%m-%Y') as oldPermitExpire,
             DATE_FORMAT(permit_start_date, '%d-%m-%Y') as oldPermitStart
      FROM vehicles WHERE id = ?
    `, [id]);

    const oldVals = existingRows[0] || {};

    await connection.beginTransaction();

    await connection.query(`
      UPDATE vehicles SET vehicle_name=?, vehicle_number=?, vehicle_type_id=?, fuel_type=?, seating_capacity=?, status=?,
        chassis_number=?, engine_number=?, permit_number=?, additional_permit=?,
        insurance_amount=?, road_tax_amount=?, pollution_expire=?, green_tax_expire=?, mv_tax_expire=?,
        insurance_expire_date=?, insurance_start_date=?,
        fc_expire_date=?, fc_start_date=?,
        permit_expire_date=?, permit_start_date=?
      WHERE id=?
    `, [
      vehicle_name || null,
      String(vehicle_number || '').trim().toUpperCase(),
      vehicleTypeId,
      fuel_type || null,
      Number(seating_capacity) || 0,
      status || 'active',
      chassis_number || null,
      engine_number || null,
      permit_number || null,
      additional_permit || null,
      insurance_amount != null ? Number(insurance_amount) : null,
      road_tax_amount != null ? Number(road_tax_amount) : null,
      normPollutionExp,
      normGreenTaxExp,
      normMvTaxExp,
      normInsExp,
      normInsStart,
      normFcExp,
      normFcStart,
      normPermitExp,
      normPermitStart,
      id
    ]);

    const userId = req.user ? req.user.user_id : null;
    const userName = req.user ? req.user.username : 'System';

    await compareAndLog(connection, id, 'insurance', 'start_date', oldVals.oldInsStart, formatDateForAudit(normInsStart), userId, userName);
    await compareAndLog(connection, id, 'insurance', 'expire_date', oldVals.oldInsExpire, formatDateForAudit(normInsExp), userId, userName);
    await compareAndLog(connection, id, 'fc', 'start_date', oldVals.oldFCStart, formatDateForAudit(normFcStart), userId, userName);
    await compareAndLog(connection, id, 'fc', 'expire_date', oldVals.oldFCExpire, formatDateForAudit(normFcExp), userId, userName);
    await compareAndLog(connection, id, 'permit', 'start_date', oldVals.oldPermitStart, formatDateForAudit(normPermitStart), userId, userName);
    await compareAndLog(connection, id, 'permit', 'expire_date', oldVals.oldPermitExpire, formatDateForAudit(normPermitExp), userId, userName);

    if (vType === 'BUS') {
      await connection.query(`
        INSERT INTO buses (vehicle_id, start_point, end_point)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE start_point = VALUES(start_point), end_point = VALUES(end_point)
      `, [id, start_point || null, end_point || null]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Vehicle updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('updateVehicle error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
}

// DELETE /api/admin/vehicles/delete?id=X
async function deleteVehicle(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    await db.query('DELETE FROM vehicles WHERE id=?', [id]);
    return res.status(200).json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    console.error('deleteVehicle error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/vehicles/:id/document-history
async function getVehicleDocumentHistory(req, res) {
  try {
    const vehicleId = req.params.id;
    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID required' });
    }
    const docTypeFilter = req.query.document_type;

    let query = '';
    const args = [];
    if (docTypeFilter && ['insurance', 'fc', 'permit'].includes(docTypeFilter)) {
      query = `
        SELECT id, vehicle_id, document_type, field_name, old_value, new_value, 
               changed_by, changed_by_name, DATE_FORMAT(changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
        FROM vehicle_document_audit_log 
        WHERE vehicle_id = ? AND document_type = ?
        ORDER BY changed_at DESC
      `;
      args.push(vehicleId, docTypeFilter);
    } else {
      query = `
        SELECT id, vehicle_id, document_type, field_name, old_value, new_value, 
               changed_by, changed_by_name, DATE_FORMAT(changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
        FROM vehicle_document_audit_log 
        WHERE vehicle_id = ?
        ORDER BY changed_at DESC
      `;
      args.push(vehicleId);
    }

    const [logs] = await db.query(query, args);

    const grouped = {
      insurance: [],
      fc: [],
      permit: []
    };

    (logs || []).forEach(l => {
      if (grouped[l.document_type]) {
        grouped[l.document_type].push(l);
      }
    });

    return res.status(200).json({
      logs: logs || [],
      grouped,
      total: (logs || []).length
    });
  } catch (err) {
    console.error('getVehicleDocumentHistory error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/vehicles/alerts
async function getVehicleDocumentAlerts(req, res) {
  try {
    const query = `
      SELECT v.id, v.vehicle_number, vt.type as vehicle_type, v.status,
             DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y') as insurance_expire_date,
             DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y') as fc_expire_date,
             DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y') as permit_expire_date,
             DATEDIFF(v.insurance_expire_date, CURDATE()) as insurance_days,
             DATEDIFF(v.fc_expire_date, CURDATE()) as fc_days,
             DATEDIFF(v.permit_expire_date, CURDATE()) as permit_days
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.status IN ('active', 'available')
        AND (
          (v.insurance_expire_date IS NOT NULL AND DATEDIFF(v.insurance_expire_date, CURDATE()) <= 10)
          OR (v.fc_expire_date IS NOT NULL AND DATEDIFF(v.fc_expire_date, CURDATE()) <= 10)
          OR (v.permit_expire_date IS NOT NULL AND DATEDIFF(v.permit_expire_date, CURDATE()) <= 10)
        )
      ORDER BY
        LEAST(
          COALESCE(DATEDIFF(v.insurance_expire_date, CURDATE()), 999),
          COALESCE(DATEDIFF(v.fc_expire_date, CURDATE()), 999),
          COALESCE(DATEDIFF(v.permit_expire_date, CURDATE()), 999)
        ) ASC
    `;

    const [alerts] = await db.query(query);

    let expired = 0;
    let critical = 0;

    (alerts || []).forEach(a => {
      let hasExp = false;
      let hasCrit = false;

      if (a.insurance_days !== null && a.insurance_days !== undefined) {
        if (a.insurance_days < 0) hasExp = true;
        else if (a.insurance_days <= 10) hasCrit = true;
      }
      if (a.fc_days !== null && a.fc_days !== undefined) {
        if (a.fc_days < 0) hasExp = true;
        else if (a.fc_days <= 10) hasCrit = true;
      }
      if (a.permit_days !== null && a.permit_days !== undefined) {
        if (a.permit_days < 0) hasExp = true;
        else if (a.permit_days <= 10) hasCrit = true;
      }

      if (hasExp) expired++;
      else if (hasCrit) critical++;
    });

    return res.status(200).json({
      alerts: alerts || [],
      expired,
      critical,
      total: (alerts || []).length
    });
  } catch (err) {
    console.error('getVehicleDocumentAlerts error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/vehicles/audit-log
async function getVehicleDocumentAuditSummary(req, res) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const [entries] = await db.query(`
      SELECT a.id, a.vehicle_id, v.vehicle_number, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name,
             a.document_type, a.field_name, a.old_value, a.new_value, 
             a.changed_by, a.changed_by_name, DATE_FORMAT(a.changed_at, '%d-%m-%Y %H:%i:%s') as changed_at
      FROM vehicle_document_audit_log a
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      ORDER BY a.changed_at DESC
      LIMIT ?
    `, [limit]);

    return res.status(200).json({ entries: entries || [], total: (entries || []).length });
  } catch (err) {
    console.error('getVehicleDocumentAuditSummary error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Helper: buildGoogleSheetCSVURL
function buildGoogleSheetCSVURL(sheetUrl) {
  const url = String(sheetUrl || '').trim();
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Sheet URL');
  }
  const id = match[1];
  let gid = '0';
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// Helper: readVehicleRecordsFromUpload
async function readVehicleRecordsFromUpload(file) {
  const ext = file.originalname.toLowerCase().split('.').pop();
  const sourceLabel = `Uploaded File: ${file.originalname}`;

  if (ext === 'csv') {
    const content = file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const records = lines.map(line => {
      // simple CSV row splitter handling quotes
      const row = [];
      let inQuotes = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    });
    return { records, sourceLabel };
  } else if (['xlsx', 'xlsm', 'xltx', 'xltm'].includes(ext)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Excel file has no sheets');
    }
    const records = [];
    worksheet.eachRow((row) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let val = cell.value;
        if (val && typeof val === 'object') {
          if (val.text) val = val.text;
          else if (val.result !== undefined) val = val.result;
        }
        rowValues.push(val != null ? String(val).trim() : '');
      });
      if (rowValues.some(v => v.length > 0)) {
        records.push(rowValues);
      }
    });
    return { records, sourceLabel: `${sourceLabel} (sheet: ${worksheet.name})` };
  } else {
    throw new Error('unsupported file type. Upload .xlsx or .csv');
  }
}

// Helper: previewBulkVehicleRecords
async function previewBulkVehicleRecords(records) {
  if (!records || records.length < 2) {
    throw new Error('the sheet does not contain any vehicle rows');
  }

  const rawHeaders = records[0];
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    const norm = normalizeVehicleCSVHeader(h);
    if (norm) {
      headerMap[norm] = idx;
    }
  });

  const missingHeaders = bulkVehicleRequiredHeaders.filter(h => headerMap[h] === undefined);
  if (missingHeaders.length > 0) {
    throw new Error(`missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Load existing vehicles
  const [existingRows] = await db.query('SELECT UPPER(vehicle_number) as vnum FROM vehicles');
  const existingSet = new Set((existingRows || []).map(r => r.vnum));

  // Load active vehicle types
  const [typeRows] = await db.query('SELECT UPPER(type) as vtype FROM vehicle_types WHERE is_active = 1');
  const allowedTypes = new Set((typeRows || []).map(r => r.vtype));

  const vehicleCounts = {};
  const parsedRows = [];

  for (let idx = 1; idx < records.length; idx++) {
    const record = records[idx];
    if (!record || record.every(c => !String(c || '').trim())) {
      continue;
    }

    const rowNumber = idx + 1;
    const getValue = (h) => {
      const colIdx = headerMap[h];
      if (colIdx === undefined || colIdx >= record.length) return '';
      return String(record[colIdx] || '').trim();
    };

    const rowErrors = [];

    const rawVehicleNumber = getValue('vehicle_number').toUpperCase();
    let rawVehicleType = getValue('vehicle_type').toUpperCase().replace(/[\s\-]+/g, '_');
    let rawFuelType = getValue('fuel_type').toUpperCase();
    if (['ELECTRIC', 'ELECTRIC_VEHICLE', 'BATTERY', 'BATTERY_VEHICLE'].includes(rawFuelType)) {
      rawFuelType = 'EV';
    }

    const seatingRaw = getValue('seating_capacity');
    let seatingCapacity = 0;
    if (!seatingRaw) {
      rowErrors.push('Seating capacity is required');
    } else {
      const parsed = parseInt(seatingRaw, 10);
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push('Seating capacity must be a valid non-negative number');
      } else {
        seatingCapacity = parsed;
      }
    }

    if (!rawVehicleNumber) rowErrors.push('Vehicle number is required');
    if (!rawVehicleType) {
      rowErrors.push('Vehicle type is required');
    } else if (!allowedTypes.has(rawVehicleType)) {
      rowErrors.push('Vehicle type is invalid or inactive');
    }

    if (!rawFuelType) {
      rowErrors.push('Fuel type is required');
    } else if (!supportedVehicleFuelTypes.has(rawFuelType)) {
      rowErrors.push('Fuel type must be one of DIESEL, PETROL, CNG, or EV');
    }

    if (seatingCapacity <= 0) {
      rowErrors.push('Seating capacity must be greater than zero');
    }

    const reqData = {
      vehicle_number: rawVehicleNumber,
      vehicle_type: rawVehicleType,
      fuel_type: rawFuelType,
      seating_capacity: seatingCapacity,
      vehicle_name: getValue('vehicle_name') || rawVehicleNumber,
      start_point: getValue('start_point'),
      end_point: getValue('end_point'),
      chassis_number: getValue('chassis_number') || null,
      engine_number: getValue('engine_number') || null,
      permit_number: getValue('permit_number') || null,
      additional_permit: getValue('additional_permit') || null,
      insurance_amount: getValue('insurance_amount') ? parseFloat(getValue('insurance_amount')) : null,
      road_tax_amount: getValue('road_tax_amount') ? parseFloat(getValue('road_tax_amount')) : null,
      pollution_expire: normalizeFlexibleDate(getValue('pollution_expire')),
      green_tax_expire: normalizeFlexibleDate(getValue('green_tax_expire')),
      mv_tax_expire: normalizeFlexibleDate(getValue('mv_tax_expire')),
      insurance_expire_date: normalizeFlexibleDate(getValue('insurance_expire_date')),
      insurance_start_date: normalizeFlexibleDate(getValue('insurance_start_date')),
      fc_expire_date: normalizeFlexibleDate(getValue('fc_expire_date')),
      fc_start_date: normalizeFlexibleDate(getValue('fc_start_date')),
      permit_expire_date: normalizeFlexibleDate(getValue('permit_expire_date')),
      permit_start_date: normalizeFlexibleDate(getValue('permit_start_date'))
    };

    if (rawVehicleNumber) {
      vehicleCounts[rawVehicleNumber] = (vehicleCounts[rawVehicleNumber] || 0) + 1;
    }

    parsedRows.push({
      rowNumber,
      req: reqData,
      errors: rowErrors,
      vnumKey: rawVehicleNumber
    });
  }

  if (parsedRows.length === 0) {
    throw new Error('the sheet only contains empty rows');
  }

  const responseRows = [];
  const validRows = [];

  for (const item of parsedRows) {
    const errors = [...item.errors];
    if (item.vnumKey) {
      if (existingSet.has(item.vnumKey)) {
        errors.push('Vehicle number already exists');
      }
      if (vehicleCounts[item.vnumKey] > 1) {
        errors.push('Vehicle number is duplicated in the sheet');
      }
    }

    const uniqueErrors = Array.from(new Set(errors));
    const isValid = uniqueErrors.length === 0;

    responseRows.push({
      row_number: item.rowNumber,
      vehicle_number: item.req.vehicle_number,
      vehicle_type: item.req.vehicle_type,
      fuel_type: item.req.fuel_type,
      seating_capacity: item.req.seating_capacity,
      vehicle_name: item.req.vehicle_name,
      start_point: item.req.start_point,
      end_point: item.req.end_point,
      chassis_number: item.req.chassis_number || '',
      engine_number: item.req.engine_number || '',
      permit_number: item.req.permit_number || '',
      additional_permit: item.req.additional_permit || '',
      insurance_amount: item.req.insurance_amount,
      road_tax_amount: item.req.road_tax_amount,
      pollution_expire: item.req.pollution_expire || '',
      green_tax_expire: item.req.green_tax_expire || '',
      mv_tax_expire: item.req.mv_tax_expire || '',
      insurance_start: item.req.insurance_start_date || '',
      insurance_expire: item.req.insurance_expire_date || '',
      fc_start: item.req.fc_start_date || '',
      fc_expire: item.req.fc_expire_date || '',
      permit_start: item.req.permit_start_date || '',
      permit_expire: item.req.permit_expire_date || '',
      is_valid: isValid,
      errors: uniqueErrors
    });

    if (isValid) {
      validRows.push(item.req);
    }
  }

  return {
    preview: {
      required_headers: bulkVehicleRequiredHeaders,
      total_rows: responseRows.length,
      ready_rows: validRows.length,
      invalid_rows: responseRows.length - validRows.length,
      rows: responseRows
    },
    validRows
  };
}

// POST /api/admin/vehicles/bulk-preview
async function previewBulkVehicles(req, res) {
  try {
    const { sheet_url } = req.body;
    if (!sheet_url || !String(sheet_url).trim()) {
      return res.status(400).json({ error: 'sheet_url is required' });
    }

    const csvUrl = buildGoogleSheetCSVURL(sheet_url);
    const resp = await axios.get(csvUrl, { timeout: 15000 });
    const content = resp.data;

    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const records = lines.map(line => {
      const row = [];
      let inQuotes = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    });

    const { preview } = await previewBulkVehicleRecords(records);
    preview.sheet_url = sheet_url;
    preview.csv_url = csvUrl;

    return res.status(200).json(preview);
  } catch (err) {
    console.error('previewBulkVehicles error:', err);
    return res.status(400).json({ error: err.message });
  }
}

// POST /api/admin/vehicles/bulk-preview-file
async function previewBulkVehiclesFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const { records, sourceLabel } = await readVehicleRecordsFromUpload(req.file);
    const { preview } = await previewBulkVehicleRecords(records);
    preview.csv_url = sourceLabel;

    return res.status(200).json(preview);
  } catch (err) {
    console.error('previewBulkVehiclesFile error:', err);
    return res.status(400).json({ error: err.message });
  }
}

// POST /api/admin/vehicles/bulk-import
async function importBulkVehicles(req, res) {
  const connection = await db.pool.getConnection();
  try {
    const { sheet_url } = req.body;
    if (!sheet_url || !String(sheet_url).trim()) {
      return res.status(400).json({ error: 'sheet_url is required' });
    }

    const csvUrl = buildGoogleSheetCSVURL(sheet_url);
    const resp = await axios.get(csvUrl, { timeout: 15000 });
    const content = resp.data;

    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const records = lines.map(line => {
      const row = [];
      let inQuotes = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) {
          row.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    });

    const { preview, validRows } = await previewBulkVehicleRecords(records);
    if (preview.invalid_rows > 0) {
      return res.status(400).json({
        error: 'Fix invalid rows in the sheet before importing',
        preview
      });
    }

    if (validRows.length === 0) {
      return res.status(400).json({ error: 'No valid vehicle rows found for import' });
    }

    await connection.beginTransaction();

    for (const vReq of validRows) {
      const vehicleTypeId = await resolveVehicleTypeID(vReq.vehicle_type, connection);
      const [insertRes] = await connection.query(`
        INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
          chassis_number, engine_number, permit_number, additional_permit,
          insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
          insurance_expire_date, insurance_start_date,
          fc_expire_date, fc_start_date,
          permit_expire_date, permit_start_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vReq.vehicle_name || null,
        vReq.vehicle_number,
        vehicleTypeId,
        vReq.fuel_type,
        vReq.seating_capacity,
        vReq.chassis_number,
        vReq.engine_number,
        vReq.permit_number,
        vReq.additional_permit,
        vReq.insurance_amount,
        vReq.road_tax_amount,
        vReq.pollution_expire,
        vReq.green_tax_expire,
        vReq.mv_tax_expire,
        vReq.insurance_expire_date,
        vReq.insurance_start_date,
        vReq.fc_expire_date,
        vReq.fc_start_date,
        vReq.permit_expire_date,
        vReq.permit_start_date
      ]);

      if (vReq.vehicle_type === 'BUS') {
        await connection.query(`
          INSERT INTO buses (vehicle_id, start_point, end_point)
          VALUES (?, ?, ?)
        `, [insertRes.insertId, vReq.start_point || null, vReq.end_point || null]);
      }
    }

    await connection.commit();

    return res.status(200).json({
      message: `${validRows.length} vehicles imported successfully`,
      created_count: validRows.length,
      failed_count: preview.invalid_rows,
      preview
    });
  } catch (err) {
    await connection.rollback();
    console.error('importBulkVehicles error:', err);
    return res.status(500).json({ error: `Import failed: ${err.message}` });
  } finally {
    connection.release();
  }
}

// POST /api/admin/vehicles/bulk-import-file
async function importBulkVehiclesFile(req, res) {
  const connection = await db.pool.getConnection();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const { records, sourceLabel } = await readVehicleRecordsFromUpload(req.file);
    const { preview, validRows } = await previewBulkVehicleRecords(records);
    preview.csv_url = sourceLabel;

    if (preview.invalid_rows > 0) {
      return res.status(400).json({
        error: 'Fix invalid rows in the file before importing',
        preview
      });
    }

    if (validRows.length === 0) {
      return res.status(400).json({ error: 'No valid vehicle rows found for import' });
    }

    await connection.beginTransaction();

    for (const vReq of validRows) {
      const vehicleTypeId = await resolveVehicleTypeID(vReq.vehicle_type, connection);
      const [insertRes] = await connection.query(`
        INSERT INTO vehicles (vehicle_name, vehicle_number, vehicle_type_id, fuel_type, seating_capacity,
          chassis_number, engine_number, permit_number, additional_permit,
          insurance_amount, road_tax_amount, pollution_expire, green_tax_expire, mv_tax_expire,
          insurance_expire_date, insurance_start_date,
          fc_expire_date, fc_start_date,
          permit_expire_date, permit_start_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vReq.vehicle_name || null,
        vReq.vehicle_number,
        vehicleTypeId,
        vReq.fuel_type,
        vReq.seating_capacity,
        vReq.chassis_number,
        vReq.engine_number,
        vReq.permit_number,
        vReq.additional_permit,
        vReq.insurance_amount,
        vReq.road_tax_amount,
        vReq.pollution_expire,
        vReq.green_tax_expire,
        vReq.mv_tax_expire,
        vReq.insurance_expire_date,
        vReq.insurance_start_date,
        vReq.fc_expire_date,
        vReq.fc_start_date,
        vReq.permit_expire_date,
        vReq.permit_start_date
      ]);

      if (vReq.vehicle_type === 'BUS') {
        await connection.query(`
          INSERT INTO buses (vehicle_id, start_point, end_point)
          VALUES (?, ?, ?)
        `, [insertRes.insertId, vReq.start_point || null, vReq.end_point || null]);
      }
    }

    await connection.commit();

    return res.status(200).json({
      message: `${validRows.length} vehicles imported successfully`,
      created_count: validRows.length,
      failed_count: preview.invalid_rows,
      preview
    });
  } catch (err) {
    await connection.rollback();
    console.error('importBulkVehiclesFile error:', err);
    return res.status(500).json({ error: `Import failed: ${err.message}` });
  } finally {
    connection.release();
  }
}

// GET /api/admin/vehicles/unassigned-ev
async function getUnassignedEVVehicles(req, res) {
  try {
    const validFrom = req.query.valid_from;
    const validTo = req.query.valid_to;

    let query = '';
    const args = [];

    if (validFrom && validTo) {
      query = `
        SELECT v.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, NULL as group_id
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        WHERE COALESCE(vt.type, '') = 'BATTERY_VEHICLE' 
        AND v.id NOT IN (
          SELECT vgm.vehicle_id FROM vehicle_group_members vgm
          WHERE NOT (? < vgm.valid_from OR ? > vgm.valid_to)
        )
        ORDER BY v.vehicle_number
      `;
      args.push(validTo, validFrom);
    } else {
      query = `
        SELECT v.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, NULL as group_id
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        WHERE COALESCE(vt.type, '') = 'BATTERY_VEHICLE' 
        AND v.id NOT IN (
          SELECT DISTINCT vgm.vehicle_id FROM vehicle_group_members vgm
          WHERE CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
        )
        ORDER BY v.vehicle_number
      `;
    }

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getUnassignedEVVehicles error:', err);
    return res.status(500).json({ error: 'Error fetching unassigned vehicles' });
  }
}

// GET /api/admin/vehicles/available-for-group
async function getAvailableVehiclesForGroup(req, res) {
  try {
    const validFrom = req.query.valid_from;
    const validTo = req.query.valid_to;
    const excludeGroupID = req.query.exclude_group_id;
    const vehicleType = req.query.vehicle_type;

    if (!validFrom || !validTo) {
      return res.status(400).json({ error: 'valid_from and valid_to required' });
    }

    let query = `
      SELECT v.id, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.id NOT IN (
        SELECT vgm.vehicle_id FROM vehicle_group_members vgm
        WHERE vgm.group_id != COALESCE(?, 0)
        AND NOT (? < vgm.valid_from OR ? > vgm.valid_to)
      )
    `;
    const args = [excludeGroupID || null, validTo, validFrom];

    if (vehicleType) {
      query += ' AND COALESCE(vt.type, \'\') = ?';
      args.push(vehicleType);
    }

    query += ' ORDER BY v.vehicle_number';

    const [rows] = await db.query(query, args);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('getAvailableVehiclesForGroup error:', err);
    return res.status(500).json({ error: 'Error fetching vehicles' });
  }
}

module.exports = {
  getAllVehicles,
  getVehicleTypes,
  createVehicleType,
  updateVehicleType,
  deleteVehicleType,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  previewBulkVehicles,
  previewBulkVehiclesFile,
  importBulkVehicles,
  importBulkVehiclesFile,
  getVehicleDocumentAlerts,
  getVehicleDocumentAuditSummary,
  getVehicleDocumentHistory,
  getUnassignedEVVehicles,
  getAvailableVehiclesForGroup
};
