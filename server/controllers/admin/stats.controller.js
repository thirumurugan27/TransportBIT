const db = require('../../config/db');

async function queryTypeCount(sql) {
  try {
    const [rows] = await db.query(sql);
    return (rows || []).map(r => {
      const keys = Object.keys(r);
      return {
        label: r[keys[0]] || 'Other',
        count: Number(r[keys[1]] || 0)
      };
    });
  } catch (err) {
    console.error('queryTypeCount error:', err);
    return [];
  }
}

async function queryWeeklyAttendance() {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(dates.d, '%d %b') as date,
        LEFT(DAYNAME(dates.d), 3) as day,
        COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) as present,
        COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) as absent,
        COALESCE((
          SELECT COUNT(DISTINCT lr.driver_id)
          FROM leave_requests lr
          WHERE lr.status = 'approved' AND dates.d BETWEEN lr.start_date AND lr.end_date
        ), 0) as on_leave
      FROM (
        SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as d
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums
      ) dates
      LEFT JOIN attendance a ON a.date = dates.d
      LEFT JOIN drivers dr ON a.user_id = dr.user_id
      GROUP BY dates.d
      ORDER BY dates.d ASC
    `);

    return (rows || []).map(r => ({
      date: r.date,
      day: r.day,
      present: Number(r.present || 0),
      absent: Number(r.absent || 0),
      on_leave: Number(r.on_leave || 0)
    }));
  } catch (err) {
    console.error('queryWeeklyAttendance error:', err);
    return [];
  }
}

async function queryRecentVehicleRequests() {
  try {
    const [rows] = await db.query(`
      SELECT vr.id,
        COALESCE(u.full_name, 'Unknown') AS faculty_name,
        COALESCE(f.department, '') AS department,
        COALESCE(vr.Purpose, '') AS purpose,
        COALESCE(vr.status, 'pending') AS status,
        COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%Y-%m-%d'), '') AS trip_date,
        DATE_FORMAT(vr.created_at, '%d-%m-%Y %h:%i %p') as created_at
      FROM vehiclerequests vr
      LEFT JOIN faculty f ON vr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY vr.created_at DESC
      LIMIT 5
    `);
    return rows || [];
  } catch (err) {
    console.error('queryRecentVehicleRequests error:', err);
    return [];
  }
}

async function queryRecentActivity() {
  const items = [];
  try {
    const [lRows] = await db.query(`
      SELECT CONCAT(COALESCE(u.full_name,'Driver'), ' requested leave (', lr.status, ')') AS message,
        lr.created_at as timestamp
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      ORDER BY lr.created_at DESC LIMIT 3
    `);
    for (const r of lRows || []) {
      items.push({ type: 'leave', color: 'pending', message: r.message, timestamp: new Date(r.timestamp) });
    }
  } catch (e) { /* ignore */ }

  try {
    const [sRows] = await db.query(`
      SELECT CONCAT('Service: ', COALESCE(sr.description,''), ' [', sr.status, ']') AS message,
        sr.created_at as timestamp
      FROM service_records sr
      ORDER BY sr.created_at DESC LIMIT 3
    `);
    for (const r of sRows || []) {
      items.push({ type: 'service', color: 'primary', message: r.message, timestamp: new Date(r.timestamp) });
    }
  } catch (e) { /* ignore */ }

  try {
    const [vRows] = await db.query(`
      SELECT CONCAT(COALESCE(u.full_name,'Faculty'), ' - vehicle request (', vr.status, ')') AS message,
        vr.created_at as timestamp
      FROM vehiclerequests vr
      LEFT JOIN users u ON vr.requester_id = u.id
      ORDER BY vr.created_at DESC LIMIT 3
    `);
    for (const r of vRows || []) {
      items.push({ type: 'vehicle_request', color: 'customblue', message: r.message, timestamp: new Date(r.timestamp) });
    }
  } catch (e) { /* ignore */ }

  try {
    const [kRows] = await db.query(`
      SELECT CONCAT(COALESCE(u.full_name,'Driver'), ' submitted KM log (', kl.status, ')') AS message,
        kl.created_at as timestamp
      FROM km_logs kl
      JOIN drivers d ON kl.driver_id = d.id
      JOIN users u ON d.user_id = u.id
      ORDER BY kl.created_at DESC LIMIT 3
    `);
    for (const r of kRows || []) {
      items.push({ type: 'km_log', color: 'green', message: r.message, timestamp: new Date(r.timestamp) });
    }
  } catch (e) { /* ignore */ }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, 8);
}

async function getDashboardStats(req, res) {
  try {
    const s = {};

    // Driver Metrics
    const [totDrivers] = await db.query('SELECT COUNT(*) as cnt FROM drivers d JOIN users u ON d.user_id = u.id');
    s.total_drivers = totDrivers[0]?.cnt || 0;

    const [presDrivers] = await db.query(`
      SELECT COUNT(*) as cnt FROM attendance a
      JOIN drivers d ON a.user_id = d.user_id
      WHERE a.date = CURDATE() AND a.status = 'present'
    `);
    s.present_drivers = presDrivers[0]?.cnt || 0;

    const [absDrivers] = await db.query(`
      SELECT COUNT(*) as cnt FROM attendance a
      JOIN drivers d ON a.user_id = d.user_id
      WHERE a.date = CURDATE() AND a.status = 'absent'
    `);
    s.absent_drivers = absDrivers[0]?.cnt || 0;

    const [leaveDrivers] = await db.query(`
      SELECT COUNT(DISTINCT d.id) as cnt FROM drivers d
      JOIN leave_requests lr ON d.id = lr.driver_id
      WHERE lr.status = 'approved'
      AND CURDATE() BETWEEN lr.start_date AND lr.end_date
    `);
    s.on_leave_drivers = leaveDrivers[0]?.cnt || 0;

    s.not_marked = Math.max(0, s.total_drivers - s.present_drivers - s.absent_drivers - s.on_leave_drivers);

    // Vehicle Metrics
    const [totVeh] = await db.query('SELECT COUNT(*) as cnt FROM vehicles');
    s.total_vehicles = totVeh[0]?.cnt || 0;

    const [actVeh] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available')");
    s.active_vehicles = actVeh[0]?.cnt || 0;

    const [inServ] = await db.query("SELECT COUNT(*) as cnt FROM service_records WHERE status IN ('reported','scheduled','in_progress')");
    s.in_service_count = inServ[0]?.cnt || 0;

    // Operations
    try {
      const [actDuties] = await db.query("SELECT COUNT(*) as cnt FROM duties WHERE status IN ('planned','ongoing')");
      s.active_duties = actDuties[0]?.cnt || 0;
    } catch {
      s.active_duties = 0;
    }

    const [totAsgn] = await db.query(`
      SELECT COUNT(*) as cnt FROM assignments WHERE status IN ('assigned','active')
      AND CURDATE() BETWEEN start_date AND end_date
    `);
    s.total_assignments = totAsgn[0]?.cnt || 0;

    // Pending Items
    const [pLeaves] = await db.query("SELECT COUNT(*) as cnt FROM leave_requests WHERE status = 'pending'");
    s.pending_leaves = pLeaves[0]?.cnt || 0;

    const [pReqs] = await db.query("SELECT COUNT(*) as cnt FROM vehiclerequests WHERE status = 'pending'");
    s.pending_vehicle_requests = pReqs[0]?.cnt || 0;

    const [actServ] = await db.query("SELECT COUNT(*) as cnt FROM service_records WHERE status IN ('reported','scheduled','in_progress')");
    s.active_services = actServ[0]?.cnt || 0;

    const [pKm] = await db.query("SELECT COUNT(*) as cnt FROM km_logs WHERE status = 'pending'");
    s.pending_km_logs = pKm[0]?.cnt || 0;

    const [pStop] = await db.query("SELECT COUNT(*) as cnt FROM stop_change_requests WHERE status = 'pending'");
    s.pending_stop_changes = pStop[0]?.cnt || 0;

    const [pTrans] = await db.query("SELECT COUNT(*) as cnt FROM transport_requests WHERE status = 'pending'");
    s.pending_transport_requests = pTrans[0]?.cnt || 0;

    const [actRepl] = await db.query("SELECT COUNT(*) as cnt FROM vehicle_replacements WHERE status IN ('pending','approved','active')");
    s.active_replacements = actRepl[0]?.cnt || 0;

    const [pFuel] = await db.query("SELECT COUNT(*) as cnt FROM fuel_indents WHERE status = 'pending'");
    s.pending_fuel_indents = pFuel[0]?.cnt || 0;

    // Document Alerts
    const [insRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10");
    s.insurance_alerts = insRows[0]?.cnt || 0;

    const [fcRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10");
    s.fc_alerts = fcRows[0]?.cnt || 0;

    const [permRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10");
    s.permit_alerts = permRows[0]?.cnt || 0;

    const [polRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND pollution_expire IS NOT NULL AND DATEDIFF(pollution_expire, CURDATE()) <= 10");
    s.pollution_alerts = polRows[0]?.cnt || 0;

    const [gtRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND green_tax_expire IS NOT NULL AND DATEDIFF(green_tax_expire, CURDATE()) <= 10");
    s.green_tax_alerts = gtRows[0]?.cnt || 0;

    const [mvRows] = await db.query("SELECT COUNT(*) as cnt FROM vehicles WHERE status IN ('active','available') AND mv_tax_expire IS NOT NULL AND DATEDIFF(mv_tax_expire, CURDATE()) <= 10");
    s.mv_tax_alerts = mvRows[0]?.cnt || 0;

    s.document_alerts = s.insurance_alerts + s.fc_alerts + s.permit_alerts + s.pollution_alerts + s.green_tax_alerts + s.mv_tax_alerts;

    const [expDoc] = await db.query(`
      SELECT COUNT(*) as cnt FROM vehicles
      WHERE status IN ('active','available')
      AND (
        (insurance_expire_date IS NOT NULL AND insurance_expire_date < CURDATE())
        OR (fc_expire_date IS NOT NULL AND fc_expire_date < CURDATE())
        OR (permit_expire_date IS NOT NULL AND permit_expire_date < CURDATE())
        OR (pollution_expire IS NOT NULL AND pollution_expire < CURDATE())
        OR (green_tax_expire IS NOT NULL AND green_tax_expire < CURDATE())
        OR (mv_tax_expire IS NOT NULL AND mv_tax_expire < CURDATE())
      )
    `);
    s.expired_documents = expDoc[0]?.cnt || 0;

    // Student Transport
    const [totStu] = await db.query("SELECT COUNT(*) as cnt FROM student_transport WHERE status = 'active'");
    s.total_students = totStu[0]?.cnt || 0;

    const [outFees] = await db.query("SELECT COALESCE(SUM(balance), 0) as total FROM student_transport WHERE status = 'active' AND balance > 0");
    s.outstanding_fees = Number(outFees[0]?.total || 0);

    const [colFees] = await db.query("SELECT COALESCE(SUM(paid_amount), 0) as total FROM student_transport WHERE status = 'active'");
    s.total_fee_collected = Number(colFees[0]?.total || 0);

    // Monthly Financials
    const [fuelInd] = await db.query("SELECT COALESCE(SUM(fuel_filled), 0) as total FROM fuel_indents WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [fuelKm] = await db.query("SELECT COALESCE(SUM(fuel_consumed), 0) as total FROM km_logs WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status = 'approved'");
    const f1 = Number(fuelInd[0]?.total || 0);
    const f2 = Number(fuelKm[0]?.total || 0);
    s.fuel_consumed_month = Math.max(f1, f2);

    const [kmMonth] = await db.query("SELECT COALESCE(SUM(total_km), 0) as total FROM km_logs WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status IN ('pending','approved')");
    s.total_km_month = Number(kmMonth[0]?.total || 0);

    s.avg_mileage_month = s.fuel_consumed_month > 0 ? (s.total_km_month / s.fuel_consumed_month) : 0;

    const [servCost] = await db.query("SELECT COALESCE(SUM(total_cost), 0) as total FROM service_records WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    s.service_cost_month = Number(servCost[0]?.total || 0);

    const [partsCost] = await db.query("SELECT COALESCE(SUM(quantity * unit_price), 0) as total FROM parts_purchased WHERE status = 'received' AND purchased_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    s.parts_cost_month = Number(partsCost[0]?.total || 0);

    // Vehicle Requests Breakdown
    const [vrTot] = await db.query('SELECT COUNT(*) as cnt FROM vehiclerequests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    s.vehicle_requests_total = vrTot[0]?.cnt || 0;

    const [vrPend] = await db.query("SELECT COUNT(*) as cnt FROM vehiclerequests WHERE status = 'pending'");
    s.vehicle_requests_pending = vrPend[0]?.cnt || 0;

    const [vrAppr] = await db.query("SELECT COUNT(*) as cnt FROM vehiclerequests WHERE status IN ('approved','assigned')");
    s.vehicle_requests_approved = vrAppr[0]?.cnt || 0;

    const [vrComp] = await db.query("SELECT COUNT(*) as cnt FROM vehiclerequests WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    s.vehicle_requests_completed = vrComp[0]?.cnt || 0;

    // Breakdowns
    s.vehicles_by_type = await queryTypeCount("SELECT COALESCE(vt.type, 'Other'), COUNT(*) FROM vehicles v LEFT JOIN vehicle_types vt ON v.vehicle_type_id = vt.id GROUP BY vt.type ORDER BY COUNT(*) DESC");
    s.vehicles_by_fuel = await queryTypeCount("SELECT COALESCE(fuel_type,'Other'), COUNT(*) FROM vehicles GROUP BY fuel_type ORDER BY COUNT(*) DESC");

    // Weekly Attendance
    s.weekly_attendance = await queryWeeklyAttendance();

    // Driver License Alerts
    try {
      const [expLic] = await db.query(`
        SELECT COUNT(*) as cnt FROM drivers d JOIN users u ON d.user_id = u.id
        WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
        AND (
          (d.license_expiry REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND d.license_expiry < CURDATE())
          OR (d.license_expiry REGEXP '^[0-9]{2}-[0-9]{2}-[0-9]{4}$' AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') < CURDATE())
        )
      `);
      s.expired_licenses = expLic[0]?.cnt || 0;
    } catch {
      s.expired_licenses = 0;
    }

    try {
      const [expiringLic] = await db.query(`
        SELECT COUNT(*) as cnt FROM drivers d JOIN users u ON d.user_id = u.id
        WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
        AND (
          (d.license_expiry REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND d.license_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
          OR (d.license_expiry REGEXP '^[0-9]{2}-[0-9]{2}-[0-9]{4}$' AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
        )
      `);
      s.expiring_licenses = expiringLic[0]?.cnt || 0;
    } catch {
      s.expiring_licenses = 0;
    }

    // Assignment Expiry Alerts
    const [expAsgn] = await db.query("SELECT COUNT(*) as cnt FROM assignments WHERE status IN ('assigned','active') AND end_date < CURDATE()");
    s.expired_assignments = expAsgn[0]?.cnt || 0;

    const [expiringAsgn] = await db.query("SELECT COUNT(*) as cnt FROM assignments WHERE status IN ('assigned','active') AND end_date >= CURDATE() AND end_date <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)");
    s.expiring_assignments = expiringAsgn[0]?.cnt || 0;

    // Group Expiry Alerts
    const [expDrvGrp] = await db.query('SELECT COUNT(*) as cnt FROM driver_clusters WHERE valid_to IS NOT NULL AND valid_to < CURDATE()');
    s.expired_driver_groups = expDrvGrp[0]?.cnt || 0;

    const [expiringDrvGrp] = await db.query('SELECT COUNT(*) as cnt FROM driver_clusters WHERE valid_to IS NOT NULL AND valid_to >= CURDATE() AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)');
    s.expiring_driver_groups = expiringDrvGrp[0]?.cnt || 0;

    const [expVehGrp] = await db.query('SELECT COUNT(*) as cnt FROM vehicle_groups WHERE valid_to IS NOT NULL AND valid_to < CURDATE()');
    s.expired_vehicle_groups = expVehGrp[0]?.cnt || 0;

    const [expiringVehGrp] = await db.query('SELECT COUNT(*) as cnt FROM vehicle_groups WHERE valid_to IS NOT NULL AND valid_to >= CURDATE() AND valid_to <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)');
    s.expiring_vehicle_groups = expiringVehGrp[0]?.cnt || 0;

    // Pending Actions list
    s.pending_actions = [];
    if (s.pending_leaves > 0) {
      s.pending_actions.push({ label: 'Leave Requests', count: s.pending_leaves, route: '/admin-dashboard/leave-approvals', color: 'pending', icon: 'calendar' });
    }
    if (s.pending_vehicle_requests > 0) {
      s.pending_actions.push({ label: 'Vehicle Requests', count: s.pending_vehicle_requests, route: '/admin-dashboard/vehicle-requests', color: 'customblue', icon: 'truck' });
    }
    if (s.pending_km_logs > 0) {
      s.pending_actions.push({ label: 'KM Log Approvals', count: s.pending_km_logs, route: '/admin-dashboard/km-management', color: 'green', icon: 'gauge' });
    }
    if (s.pending_stop_changes > 0) {
      s.pending_actions.push({ label: 'Stop Change Requests', count: s.pending_stop_changes, route: '/admin-dashboard/student-transport', color: 'primary', icon: 'bus' });
    }
    if (s.pending_transport_requests > 0) {
      s.pending_actions.push({ label: 'Transport Requests', count: s.pending_transport_requests, route: '/admin-dashboard/student-transport', color: 'primarydull', icon: 'graduation' });
    }
    if (s.active_services > 0) {
      s.pending_actions.push({ label: 'Active Services', count: s.active_services, route: '/admin-dashboard/service-records', color: 'primary', icon: 'wrench' });
    }
    if (s.active_replacements > 0) {
      s.pending_actions.push({ label: 'Vehicle Replacements', count: s.active_replacements, route: '/admin-dashboard/vehicle-replacements', color: 'pending', icon: 'replace' });
    }
    if (s.pending_fuel_indents > 0) {
      s.pending_actions.push({ label: 'Fuel Indents', count: s.pending_fuel_indents, route: '/admin-dashboard/fuel-indents', color: 'pending', icon: 'fuel' });
    }
    if (s.insurance_alerts > 0) {
      s.pending_actions.push({ label: 'Insurance Expiring', count: s.insurance_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'shield' });
    }
    if (s.fc_alerts > 0) {
      s.pending_actions.push({ label: 'FC Expiring', count: s.fc_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'file-check' });
    }
    if (s.permit_alerts > 0) {
      s.pending_actions.push({ label: 'Permit Expiring', count: s.permit_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'file-text' });
    }
    if (s.pollution_alerts > 0) {
      s.pending_actions.push({ label: 'Pollution PUC Expiring', count: s.pollution_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'alert-circle' });
    }
    if (s.green_tax_alerts > 0) {
      s.pending_actions.push({ label: 'Green Tax Expiring', count: s.green_tax_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'refresh-cw' });
    }
    if (s.mv_tax_alerts > 0) {
      s.pending_actions.push({ label: 'MV Tax Expiring', count: s.mv_tax_alerts, route: '/admin-dashboard/vehicles?view=expiry', color: 'red', icon: 'file-text' });
    }
    if (s.expiring_licenses > 0 || s.expired_licenses > 0) {
      s.pending_actions.push({ label: 'License Expiring', count: s.expiring_licenses + s.expired_licenses, route: '/admin-dashboard/drivers', color: 'red', icon: 'id-card' });
    }
    if (s.expiring_driver_groups > 0 || s.expired_driver_groups > 0) {
      s.pending_actions.push({ label: 'Driver Group Expiring', count: s.expiring_driver_groups + s.expired_driver_groups, route: '/admin-dashboard/schedule-management', color: 'red', icon: 'users' });
    }
    if (s.expiring_vehicle_groups > 0 || s.expired_vehicle_groups > 0) {
      s.pending_actions.push({ label: 'Vehicle Group Expiring', count: s.expiring_vehicle_groups + s.expired_vehicle_groups, route: '/admin-dashboard/schedule-management', color: 'red', icon: 'layers' });
    }
    if (s.expired_assignments > 0) {
      s.pending_actions.push({ label: 'Assignments Expired', count: s.expired_assignments, route: '/admin-dashboard/all-assignments', color: 'red', icon: 'calendar' });
    }
    if (s.expiring_assignments > 0) {
      s.pending_actions.push({ label: 'Assignments Expiring Soon', count: s.expiring_assignments, route: '/admin-dashboard/all-assignments', color: 'pending', icon: 'calendar' });
    }

    s.recent_vehicle_requests = await queryRecentVehicleRequests();
    s.recent_activity = await queryRecentActivity();

    return res.status(200).json(s);
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function getDriverWorkload(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        d.id AS driver_id,
        COALESCE(u.full_name, u.username) AS driver_name,
        COALESCE(active_asgn.cnt, 0) AS active_assignments,
        COALESCE(duties_month.cnt, 0) AS total_duties_month,
        COALESCE(km_month.total_km, 0) AS total_km_month,
        COALESCE(pending_km.cnt, 0) AS pending_km_logs,
        COALESCE(att.status, 'not_marked') AS attendance_status,
        COALESCE(veh_cnt.cnt, 0) AS vehicle_count,
        COALESCE(leaves.cnt, 0) AS leaves_taken
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN (
        SELECT a_agg.driver_id, COUNT(*) AS cnt
        FROM (
          SELECT driver_id FROM assignments 
          WHERE status IN ('assigned','active') AND CURDATE() BETWEEN start_date AND end_date
          UNION ALL
          SELECT ta.replacement_driver_id FROM temporary_assignments ta
          WHERE ta.status = 'active' AND CURDATE() BETWEEN ta.start_date AND ta.end_date
          UNION ALL
          SELECT dcm.driver_id FROM ev_assignments ea
          JOIN driver_cluster_members dcm ON ea.cluster_id = dcm.cluster_id
          WHERE ea.status IN ('assigned', 'active') 
            AND CURDATE() BETWEEN ea.start_date AND ea.end_date
            AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
        ) a_agg
        GROUP BY a_agg.driver_id
      ) active_asgn ON active_asgn.driver_id = d.id
      LEFT JOIN (
        SELECT a_agg.driver_id, COUNT(*) AS cnt
        FROM (
          SELECT driver_id FROM assignments 
          WHERE start_date <= LAST_DAY(CURDATE()) AND end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          UNION ALL
          SELECT ta.replacement_driver_id FROM temporary_assignments ta
          WHERE ta.start_date <= LAST_DAY(CURDATE()) AND ta.end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          UNION ALL
          SELECT dcm.driver_id FROM ev_assignments ea
          JOIN driver_cluster_members dcm ON ea.cluster_id = dcm.cluster_id
          WHERE ea.start_date <= LAST_DAY(CURDATE()) AND ea.end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ) a_agg
        GROUP BY a_agg.driver_id
      ) duties_month ON duties_month.driver_id = d.id
      LEFT JOIN (
        SELECT kl.driver_id, SUM(kl.total_km) AS total_km
        FROM km_logs kl
        WHERE kl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND kl.status IN ('pending','approved')
        GROUP BY kl.driver_id
      ) km_month ON km_month.driver_id = d.id
      LEFT JOIN (
        SELECT
          asgn.driver_id,
          GREATEST(0, asgn.cnt - COALESCE(logs.cnt, 0)) AS cnt
        FROM (
          SELECT a_agg.driver_id, COUNT(*) AS cnt
          FROM (
            SELECT driver_id FROM assignments 
            WHERE status IN ('assigned','active') AND CURDATE() BETWEEN start_date AND end_date
            UNION ALL
            SELECT ta.replacement_driver_id FROM temporary_assignments ta
            WHERE ta.status = 'active' AND CURDATE() BETWEEN ta.start_date AND ta.end_date
            UNION ALL
            SELECT dcm.driver_id FROM ev_assignments ea
            JOIN driver_cluster_members dcm ON ea.cluster_id = dcm.cluster_id
            WHERE ea.status IN ('assigned', 'active') 
              AND CURDATE() BETWEEN ea.start_date AND ea.end_date
              AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
          ) a_agg
          GROUP BY a_agg.driver_id
        ) asgn
        LEFT JOIN (
          SELECT driver_id, COUNT(*) AS cnt
          FROM km_logs
          WHERE date = CURDATE()
            AND status IN ('pending','approved')
          GROUP BY driver_id
        ) logs ON logs.driver_id = asgn.driver_id
      ) pending_km ON pending_km.driver_id = d.id
      LEFT JOIN (
        SELECT a.user_id, a.status
        FROM attendance a
        WHERE a.date = CURDATE()
      ) att ON att.user_id = d.user_id
      LEFT JOIN (
        SELECT a_agg.driver_id, COUNT(DISTINCT a_agg.vehicle_id) AS cnt
        FROM (
          SELECT driver_id, vehicle_id FROM assignments 
          WHERE status IN ('assigned','active') AND CURDATE() BETWEEN start_date AND end_date
          UNION ALL
          SELECT replacement_driver_id as driver_id, vehicle_id FROM temporary_assignments 
          WHERE status = 'active' AND CURDATE() BETWEEN start_date AND end_date
          UNION ALL
          SELECT dcm.driver_id, vgm.vehicle_id 
          FROM ev_assignments ea
          JOIN driver_cluster_members dcm ON ea.cluster_id = dcm.cluster_id
          JOIN vehicle_group_members vgm ON ea.vehicle_group_id = vgm.group_id
          WHERE ea.status IN ('assigned', 'active') 
            AND CURDATE() BETWEEN ea.start_date AND ea.end_date
            AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
            AND CURDATE() BETWEEN vgm.valid_from AND vgm.valid_to
        ) a_agg
        GROUP BY a_agg.driver_id
      ) veh_cnt ON veh_cnt.driver_id = d.id
      LEFT JOIN (
        SELECT lr.driver_id, COUNT(*) AS cnt
        FROM leave_requests lr
        WHERE lr.status = 'approved'
          AND lr.start_date <= LAST_DAY(CURDATE())
          AND lr.end_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        GROUP BY lr.driver_id
      ) leaves ON leaves.driver_id = d.id
      ORDER BY active_asgn.cnt DESC, duties_month.cnt DESC
    `);

    const drivers = [];
    for (const row of rows || []) {
      const activeAssignments = Number(row.active_assignments || 0);
      const totalDutiesMonth = Number(row.total_duties_month || 0);
      const totalKmMonth = Number(row.total_km_month || 0);

      let score = activeAssignments * 25 + totalDutiesMonth * 5;
      if (totalKmMonth > 1000) score += 15;
      else if (totalKmMonth > 500) score += 10;
      if (score > 100) score = 100;

      const driverObj = {
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        active_assignments: activeAssignments,
        total_duties_month: totalDutiesMonth,
        total_km_month: totalKmMonth,
        pending_km_logs: Number(row.pending_km_logs || 0),
        attendance_status: row.attendance_status,
        vehicle_count: Number(row.vehicle_count || 0),
        leaves_taken: Number(row.leaves_taken || 0),
        workload_score: score,
        vehicles: []
      };

      try {
        const [vRows] = await db.query(`
          SELECT COALESCE(v.id, 0) as vehicle_id, 
                 CASE 
                   WHEN a.is_ev = 1 THEN a.ev_group_name
                   ELSE CONCAT(COALESCE(v.vehicle_name, vt.type, ''), ' (', COALESCE(v.vehicle_number, ''), ')')
                 END as vehicle_number,
                 CASE 
                   WHEN a.is_ev = 1 THEN 'BATTERY_VEHICLE'
                   ELSE COALESCE(vt.type, '')
                 END as vehicle_type, 
                 COALESCE(s.name, '') as shift_name
          FROM (
            SELECT vehicle_id, shift_id, 0 as is_ev, '' as ev_group_name 
            FROM assignments 
            WHERE driver_id = ? AND status IN ('assigned','active') AND CURDATE() BETWEEN start_date AND end_date
            UNION ALL
            SELECT vehicle_id, shift_id, 0 as is_ev, '' as ev_group_name 
            FROM temporary_assignments 
            WHERE replacement_driver_id = ? AND status = 'active' AND CURDATE() BETWEEN start_date AND end_date
            UNION ALL
            SELECT 0 as vehicle_id, ea.shift_id, 1 as is_ev, COALESCE(vg.name, 'EV Group') as ev_group_name
            FROM ev_assignments ea
            JOIN driver_cluster_members dcm ON ea.cluster_id = dcm.cluster_id
            LEFT JOIN vehicle_groups vg ON ea.vehicle_group_id = vg.id
            WHERE dcm.driver_id = ?
              AND ea.status IN ('assigned', 'active') 
              AND CURDATE() BETWEEN ea.start_date AND ea.end_date
              AND CURDATE() BETWEEN dcm.valid_from AND dcm.valid_to
          ) a
          LEFT JOIN vehicles v ON a.vehicle_id = v.id
          LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
          LEFT JOIN shifts s ON a.shift_id = s.id
          ORDER BY s.start_time ASC
        `, [row.driver_id, row.driver_id, row.driver_id]);
        driverObj.vehicles = vRows || [];
      } catch (e) {
        console.error('driver vehicle query error:', e);
      }

      drivers.push(driverObj);
    }

    const upcomingTasks = [];

    // Upcoming vehicle requests (next 7 days)
    try {
      const [vrRows] = await db.query(`
        SELECT vr.id, CONCAT(COALESCE(u.full_name,'Faculty'), ' - ', COALESCE(vr.Purpose,'Trip')) as title,
          COALESCE(DATE_FORMAT(vr.OnwardFromDateTime, '%Y-%m-%d'), '') as due_date,
          vr.status
        FROM vehiclerequests vr
        LEFT JOIN faculty f ON vr.faculty_id = f.id
        LEFT JOIN users u ON f.user_id = u.id
        WHERE vr.status IN ('approved','assigned')
        AND vr.OnwardFromDateTime BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY vr.OnwardFromDateTime ASC LIMIT 5
      `);
      for (const t of vrRows || []) {
        upcomingTasks.push({
          id: t.id,
          type: 'vehicle_request',
          title: t.title,
          description: 'Upcoming vehicle request - ' + t.status,
          due_date: t.due_date,
          priority: 'medium',
          route: '/admin-dashboard/vehicle-requests',
          color: 'customblue'
        });
      }
    } catch (e) { /* ignore */ }

    // Expiring vehicle documents (next 10 days)
    try {
      const [docRows] = await db.query(`
        SELECT v.id, COALESCE(v.vehicle_number, 'Unknown Vehicle') as title,
          CASE
            WHEN insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(insurance_expire_date, '%Y-%m-%d')
            WHEN fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(fc_expire_date, '%Y-%m-%d')
            WHEN permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10 THEN DATE_FORMAT(permit_expire_date, '%Y-%m-%d')
          END as due_date,
          CASE
            WHEN insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) <= 10 THEN 'Insurance'
            WHEN fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) <= 10 THEN 'FC Certificate'
            WHEN permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) <= 10 THEN 'Permit'
          END as doc_type
        FROM vehicles v
        WHERE v.status IN ('active','available')
        AND (
          (insurance_expire_date IS NOT NULL AND DATEDIFF(insurance_expire_date, CURDATE()) BETWEEN 0 AND 10)
          OR (fc_expire_date IS NOT NULL AND DATEDIFF(fc_expire_date, CURDATE()) BETWEEN 0 AND 10)
          OR (permit_expire_date IS NOT NULL AND DATEDIFF(permit_expire_date, CURDATE()) BETWEEN 0 AND 10)
        )
        LIMIT 5
      `);
      for (const t of docRows || []) {
        upcomingTasks.push({
          id: t.id,
          type: 'document_expiry',
          title: t.title,
          description: (t.doc_type || 'Document') + ' expiring soon',
          due_date: t.due_date,
          priority: 'high',
          route: '/admin-dashboard/vehicles',
          color: 'red'
        });
      }
    } catch (e) { /* ignore */ }

    // Expiring driver licenses (next 30 days)
    try {
      const [licRows] = await db.query(`
        SELECT d.id, COALESCE(u.full_name, u.username) as title,
          d.license_expiry as due_date
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        WHERE d.license_expiry IS NOT NULL AND d.license_expiry != ''
        AND STR_TO_DATE(d.license_expiry, '%d-%m-%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        LIMIT 5
      `);
      for (const t of licRows || []) {
        upcomingTasks.push({
          id: t.id,
          type: 'license_expiry',
          title: t.title,
          description: 'Driver license expiring soon',
          due_date: t.due_date,
          priority: 'high',
          route: '/admin-dashboard/drivers',
          color: 'pending'
        });
      }
    } catch (e) { /* ignore */ }

    return res.status(200).json({
      drivers,
      upcoming_tasks: upcomingTasks
    });
  } catch (err) {
    console.error('getDriverWorkload error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDashboardStats,
  getDriverWorkload
};
