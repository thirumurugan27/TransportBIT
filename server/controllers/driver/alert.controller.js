const db = require('../../config/db');

async function getDriverVehicleAlerts(req, res) {
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
      SELECT v.id, COALESCE(v.vehicle_name, v.vehicle_number) as vehicle_name, v.vehicle_number, COALESCE(vt.type, '') as vehicle_type, v.status,
             DATE_FORMAT(v.insurance_expire_date, '%d-%m-%Y') as insurance_expire_date,
             DATE_FORMAT(v.fc_expire_date, '%d-%m-%Y') as fc_expire_date,
             DATE_FORMAT(v.permit_expire_date, '%d-%m-%Y') as permit_expire_date,
             DATEDIFF(v.insurance_expire_date, CURDATE()) as insurance_days,
             DATEDIFF(v.fc_expire_date, CURDATE()) as fc_days,
             DATEDIFF(v.permit_expire_date, CURDATE()) as permit_days
      FROM vehicles v
      LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      INNER JOIN assignments a ON a.vehicle_id = v.id
      WHERE a.driver_id = ?
        AND CURDATE() BETWEEN a.start_date AND a.end_date
        AND v.status IN ('active', 'available', 'in_service')
        AND (
          (v.insurance_expire_date IS NOT NULL AND DATEDIFF(v.insurance_expire_date, CURDATE()) <= 10)
          OR (v.fc_expire_date IS NOT NULL AND DATEDIFF(v.fc_expire_date, CURDATE()) <= 10)
          OR (v.permit_expire_date IS NOT NULL AND DATEDIFF(v.permit_expire_date, CURDATE()) <= 10)
        )
      GROUP BY v.id, v.vehicle_name, v.vehicle_number, COALESCE(vt.type, ''), v.status,
               v.insurance_expire_date, v.fc_expire_date, v.permit_expire_date
      ORDER BY
        LEAST(
          COALESCE(DATEDIFF(v.insurance_expire_date, CURDATE()), 999),
          COALESCE(DATEDIFF(v.fc_expire_date, CURDATE()), 999),
          COALESCE(DATEDIFF(v.permit_expire_date, CURDATE()), 999)
        ) ASC
    `, [driverID]);

    let expired = 0;
    let critical = 0;
    const alerts = (rows || []).map(a => {
      let hasExpired = false;
      let hasCritical = false;

      if (a.insurance_days !== null && a.insurance_days < 0) hasExpired = true;
      else if (a.insurance_days !== null && a.insurance_days <= 10) hasCritical = true;

      if (a.fc_days !== null && a.fc_days < 0) hasExpired = true;
      else if (a.fc_days !== null && a.fc_days <= 10) hasCritical = true;

      if (a.permit_days !== null && a.permit_days < 0) hasExpired = true;
      else if (a.permit_days !== null && a.permit_days <= 10) hasCritical = true;

      if (hasExpired) expired++;
      else if (hasCritical) critical++;

      return {
        id: a.id,
        vehicle_name: a.vehicle_name,
        vehicle_number: a.vehicle_number,
        vehicle_type: a.vehicle_type,
        status: a.status,
        insurance_expire_date: a.insurance_expire_date,
        fc_expire_date: a.fc_expire_date,
        permit_expire_date: a.permit_expire_date,
        insurance_days: a.insurance_days,
        fc_days: a.fc_days,
        permit_days: a.permit_days
      };
    });

    return res.status(200).json({
      alerts,
      expired,
      critical,
      total: alerts.length
    });
  } catch (err) {
    console.error('Driver vehicle alerts error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDriverVehicleAlerts
};
