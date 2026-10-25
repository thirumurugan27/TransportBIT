const express = require('express');
const router = express.Router();

const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { memoryUpload, profileUpload, fuelUpload, invoiceUpload } = require('../utils/uploader');

// Auth Controllers
const authCtrl = require('../controllers/auth/auth.controller');
const googleCtrl = require('../controllers/auth/google.controller');
const meCtrl = require('../controllers/auth/me.controller');

// Bus Controllers
const busCtrl = require('../controllers/bus/fleet.controller');

// Student Controllers
const studentCtrl = require('../controllers/student/transport.controller');

// Faculty Controllers
const facultyProfileCtrl = require('../controllers/faculty/profile.controller');
const facultyVehicleRequestCtrl = require('../controllers/faculty/vehicleRequest.controller');

// Driver Controllers
const driverProfileCtrl = require('../controllers/driver/profile.controller');
const driverAssignmentCtrl = require('../controllers/driver/assignment.controller');
const driverKmlogCtrl = require('../controllers/driver/kmlog.controller');
const driverLeaveCtrl = require('../controllers/driver/leave.controller');
const driverAlertCtrl = require('../controllers/driver/alert.controller');
const driverNotificationCtrl = require('../controllers/driver/notification.controller');
const driverVehicleRequestCtrl = require('../controllers/driver/vehicleRequest.controller');
const driverServiceCtrl = require('../controllers/driver/service.controller');
const driverFuelIndentCtrl = require('../controllers/driver/fuelIndent.controller');

// Admin Controllers
const adminProfileCtrl = require('../controllers/admin/profile.controller');
const adminStatsCtrl = require('../controllers/admin/stats.controller');
const adminDriverCtrl = require('../controllers/admin/driver.controller');
const adminVehicleCtrl = require('../controllers/admin/vehicle.controller');
const adminDefaultVehicleDriverCtrl = require('../controllers/admin/defaultVehicleDriver.controller');
const adminShiftCtrl = require('../controllers/admin/shift.controller');
const adminAssignmentCtrl = require('../controllers/admin/assignment.controller');
const adminTemporaryAssignmentCtrl = require('../controllers/admin/temporaryAssignment.controller');
const adminDutyCtrl = require('../controllers/admin/duty.controller');
const adminAttendanceCtrl = require('../controllers/admin/attendance.controller');
const adminLeaveCtrl = require('../controllers/admin/leave.controller');
const adminKmCtrl = require('../controllers/admin/km.controller');
const adminClusterCtrl = require('../controllers/admin/cluster.controller');
const adminVehicleGroupCtrl = require('../controllers/admin/vehicleGroup.controller');
const adminEvCtrl = require('../controllers/admin/ev.controller');
const adminFuelCtrl = require('../controllers/admin/fuel.controller');
const adminVehicleReplacementCtrl = require('../controllers/admin/vehicleReplacement.controller');
const adminNotificationCtrl = require('../controllers/admin/notification.controller');
const adminStudentTransportCtrl = require('../controllers/admin/studentTransport.controller');
const adminUserManagementCtrl = require('../controllers/admin/userManagement.controller');
const adminVehicleRequestCtrl = require('../controllers/admin/vehicleRequest.controller');
const adminServiceCtrl = require('../controllers/admin/service.controller');
const adminPartsCtrl = require('../controllers/admin/parts.controller');
const adminPurchaseOrderCtrl = require('../controllers/admin/purchaseOrder.controller');
const adminPurchaseInvoiceCtrl = require('../controllers/admin/purchaseInvoice.controller');
const adminVendorCtrl = require('../controllers/admin/vendor.controller');
const adminReportCtrl = require('../controllers/admin/report.controller');

// ==========================================
// 1. PUBLIC ROUTES (under /api)
// ==========================================
router.post('/login', authCtrl.unifiedLogin);
router.post('/logout', authCtrl.logout);
router.post('/admin/setup', authCtrl.setupAdminPassword);

// ==========================================
// 2. AUTHENTICATED SHARED ROUTES
// ==========================================
router.get('/me', authMiddleware, meCtrl.me);

// Shared dropdown data
router.get('/vehicles', authMiddleware, adminVehicleCtrl.getAllVehicles);
router.get('/vehicle-types', authMiddleware, adminVehicleCtrl.getVehicleTypes);
router.get('/shifts', authMiddleware, adminShiftCtrl.getAllShifts);
router.get('/drivers', authMiddleware, adminDriverCtrl.getDrivers);
router.get('/stops', authMiddleware, busCtrl.getAllStops);

// ==========================================
// 3. ADMIN ROUTES (under /api/admin)
// ==========================================
const adminRouter = express.Router();
adminRouter.use(authMiddleware, roleMiddleware('ADMIN'));

// Profile
adminRouter.get('/profile', adminProfileCtrl.getAdminProfile);
adminRouter.post('/profile/update', adminProfileCtrl.updateAdminProfile);
adminRouter.post('/profile/upload', profileUpload.single('file'), adminProfileCtrl.uploadAdminProfileImage);
adminRouter.post('/password/change', adminProfileCtrl.changeAdminPassword);

// Dashboard
adminRouter.get('/dashboard/stats', adminStatsCtrl.getDashboardStats);
adminRouter.get('/dashboard/driver-workload', adminStatsCtrl.getDriverWorkload);

// Driver Management
adminRouter.get('/drivers', adminDriverCtrl.getDrivers);
adminRouter.post('/drivers/create', adminDriverCtrl.createDriver);
adminRouter.post('/drivers/bulk-preview', adminDriverCtrl.previewBulkDrivers);
adminRouter.post('/drivers/bulk-import', adminDriverCtrl.importBulkDrivers);
adminRouter.post('/drivers/bulk-preview-file', memoryUpload.single('file'), adminDriverCtrl.previewBulkDriversFile);
adminRouter.post('/drivers/bulk-import-file', memoryUpload.single('file'), adminDriverCtrl.importBulkDriversFile);
adminRouter.put('/drivers/update', adminDriverCtrl.updateDriver);
adminRouter.post('/drivers/update', adminDriverCtrl.updateDriver);
adminRouter.delete('/drivers/delete', adminDriverCtrl.deleteDriver);
adminRouter.post('/drivers/delete', adminDriverCtrl.deleteDriver);
adminRouter.get('/drivers/available-for-cluster', adminClusterCtrl.getAvailableDriversForCluster);
adminRouter.get('/drivers/km-suggestions', adminKmCtrl.getDriverKmSuggestions);
adminRouter.get('/available-drivers', adminAssignmentCtrl.getAvailableDrivers);
adminRouter.get('/driver-assigned-vehicles', adminKmCtrl.getDriverAssignedVehicles);
adminRouter.get('/driver-km-history', adminKmCtrl.getDriverKmHistory);

// Vehicle Management
adminRouter.get('/vehicles', adminVehicleCtrl.getAllVehicles);
adminRouter.get('/vehicle-types', adminVehicleCtrl.getVehicleTypes);
adminRouter.post('/vehicle-types/create', adminVehicleCtrl.createVehicleType);
adminRouter.put('/vehicle-types/:id', adminVehicleCtrl.updateVehicleType);
adminRouter.delete('/vehicle-types/:id', adminVehicleCtrl.deleteVehicleType);
adminRouter.post('/vehicles/bulk-preview', adminVehicleCtrl.previewBulkVehicles);
adminRouter.post('/vehicles/bulk-import', adminVehicleCtrl.importBulkVehicles);
adminRouter.post('/vehicles/bulk-preview-file', memoryUpload.single('file'), adminVehicleCtrl.previewBulkVehiclesFile);
adminRouter.post('/vehicles/bulk-import-file', memoryUpload.single('file'), adminVehicleCtrl.importBulkVehiclesFile);
adminRouter.post('/vehicles/create', adminVehicleCtrl.createVehicle);
adminRouter.post('/vehicles/update', adminVehicleCtrl.updateVehicle);
adminRouter.put('/vehicles/update', adminVehicleCtrl.updateVehicle);
adminRouter.delete('/vehicles/delete', adminVehicleCtrl.deleteVehicle);
adminRouter.post('/vehicles/delete', adminVehicleCtrl.deleteVehicle);
adminRouter.get('/vehicles/alerts', adminVehicleCtrl.getVehicleDocumentAlerts);
adminRouter.get('/vehicles/audit-log', adminVehicleCtrl.getVehicleDocumentAuditSummary);
adminRouter.get('/vehicles/:id/document-history', adminVehicleCtrl.getVehicleDocumentHistory);
adminRouter.get('/vehicles/unassigned-ev', adminVehicleCtrl.getUnassignedEVVehicles);
adminRouter.get('/vehicles/available-for-group', adminVehicleCtrl.getAvailableVehiclesForGroup);
adminRouter.get('/default-vehicle-drivers', adminDefaultVehicleDriverCtrl.getDefaultVehicleDrivers);
adminRouter.post('/default-vehicle-drivers/create', adminDefaultVehicleDriverCtrl.createDefaultVehicleDriver);
adminRouter.put('/default-vehicle-drivers/update', adminDefaultVehicleDriverCtrl.updateDefaultVehicleDriver);
adminRouter.post('/default-vehicle-drivers/update', adminDefaultVehicleDriverCtrl.updateDefaultVehicleDriver);
adminRouter.delete('/default-vehicle-drivers/delete', adminDefaultVehicleDriverCtrl.deleteDefaultVehicleDriver);
adminRouter.post('/default-vehicle-drivers/delete', adminDefaultVehicleDriverCtrl.deleteDefaultVehicleDriver);

// Shift Management
adminRouter.get('/shifts', adminShiftCtrl.getAllShifts);
adminRouter.post('/shifts/create', adminShiftCtrl.createShift);
adminRouter.post('/shifts/update', adminShiftCtrl.updateShift);
adminRouter.put('/shifts/update', adminShiftCtrl.updateShift);
adminRouter.delete('/shifts/delete', adminShiftCtrl.deleteShift);
adminRouter.post('/shifts/delete', adminShiftCtrl.deleteShift);

// Assignment Management
adminRouter.get('/assignments', adminAssignmentCtrl.getAllAssignments);
adminRouter.get('/assignments/check-driver-conflict', adminAssignmentCtrl.checkDriverConflictAPI);
adminRouter.get('/assignments/check-vehicle-conflict', adminAssignmentCtrl.checkVehicleConflictAPI);
adminRouter.get('/assignments/by-category', adminAssignmentCtrl.getAssignmentsByCategory);
adminRouter.get('/assignments/absent-alerts', adminAssignmentCtrl.getAbsentDriverAlerts);
adminRouter.get('/assignments/:id', adminAssignmentCtrl.getAssignmentDetails);
adminRouter.post('/assignments/create', adminAssignmentCtrl.createAssignment);
adminRouter.post('/assignments/cancel', adminAssignmentCtrl.cancelAssignment);
adminRouter.post('/assignments/update', adminAssignmentCtrl.updateAssignment);
adminRouter.put('/assignments/update', adminAssignmentCtrl.updateAssignment);
adminRouter.delete('/assignments/delete', adminAssignmentCtrl.deleteAssignment);
adminRouter.post('/assignments/delete', adminAssignmentCtrl.deleteAssignment);
adminRouter.post('/assignments/reassign-for-leave', adminAssignmentCtrl.reassignForLeave);

// Temporary Assignments
adminRouter.get('/temporary-assignments', adminTemporaryAssignmentCtrl.getTemporaryAssignments);
adminRouter.post('/temporary-assignments/create', adminTemporaryAssignmentCtrl.createTemporaryAssignment);
adminRouter.delete('/temporary-assignments/:id', adminTemporaryAssignmentCtrl.cancelTemporaryAssignment);
adminRouter.post('/temporary-assignments/:id/cancel', adminTemporaryAssignmentCtrl.cancelTemporaryAssignment);
adminRouter.post('/temporary-assignments/cancel', adminTemporaryAssignmentCtrl.cancelTemporaryAssignment);
adminRouter.delete('/temporary-assignments/delete', adminTemporaryAssignmentCtrl.cancelTemporaryAssignment);
adminRouter.post('/temporary-assignments/delete', adminTemporaryAssignmentCtrl.cancelTemporaryAssignment);

// Duty Management
adminRouter.get('/duties', adminDutyCtrl.getAllDuties);
adminRouter.post('/duties/create', adminDutyCtrl.createDuty);
adminRouter.post('/duties/approve', adminDutyCtrl.approveDuty);

// Attendance
adminRouter.get('/attendance', adminAttendanceCtrl.getAttendance);
adminRouter.post('/attendance/mark', adminAttendanceCtrl.markAttendance);
adminRouter.post('/attendance/mark-bulk', adminAttendanceCtrl.markAttendanceBulk);

// Leave Management
adminRouter.get('/leave/pending', adminLeaveCtrl.getPendingLeaveRequests);
adminRouter.get('/leave/all', adminLeaveCtrl.getAllLeaveRequests);
adminRouter.post('/leave/apply', adminLeaveCtrl.adminApplyLeave);
adminRouter.post('/leave/approve', adminLeaveCtrl.approveLeave);
adminRouter.get('/leave/history', adminLeaveCtrl.getLeaveHistory);
adminRouter.get('/leave/stats', adminLeaveCtrl.getLeaveStats);
adminRouter.get('/leave/:id/affected-assignments', adminLeaveCtrl.getLeaveAffectedAssignments);
adminRouter.post('/leave/approve-with-assignments', adminLeaveCtrl.approveLeaveWithAssignments);

// KM Management
adminRouter.get('/km-summary', adminKmCtrl.getKMSummary);
adminRouter.get('/km-vehicle-summary', adminKmCtrl.getVehicleKmSummary);
adminRouter.get('/km-filters', adminKmCtrl.getKmFilterMeta);
adminRouter.get('/km-logs', adminKmCtrl.getAdminKmLogs);
adminRouter.post('/km-log/add', adminKmCtrl.adminAddKmLog);
adminRouter.post('/km-log/approve', adminKmCtrl.approveKmLog);
adminRouter.post('/km-log/reject', adminKmCtrl.rejectKmLog);
adminRouter.get('/km-logs/pending-count', adminKmCtrl.getPendingKmLogsCount);
adminRouter.get('/km-logs/fuel-by-vehicle', adminKmCtrl.getFuelByVehicle);
adminRouter.get('/km-datewise-tracker', adminKmCtrl.getDatewiseKmTracker);

// Cluster Management
adminRouter.get('/clusters', adminClusterCtrl.getClusters);
adminRouter.post('/clusters/create', adminClusterCtrl.createCluster);
adminRouter.post('/clusters/create-with-schedule', adminClusterCtrl.createClusterWithSchedule);
adminRouter.post('/clusters/update', adminClusterCtrl.updateCluster);
adminRouter.put('/clusters/update', adminClusterCtrl.updateCluster);
adminRouter.get('/clusters/:id/members', adminClusterCtrl.getClusterMembers);
adminRouter.post('/clusters/:id/add-member', adminClusterCtrl.addClusterMember);
adminRouter.delete('/clusters/:id/remove-member', adminClusterCtrl.removeClusterMember);
adminRouter.post('/clusters/assign-drivers', adminClusterCtrl.assignDriversToCluster);
adminRouter.post('/clusters/assign-shift', adminClusterCtrl.assignClusterToShift);
adminRouter.delete('/clusters/delete', adminClusterCtrl.deleteCluster);
adminRouter.post('/clusters/delete', adminClusterCtrl.deleteCluster);

// Vehicle Group Management
adminRouter.get('/vehicle-groups', adminVehicleGroupCtrl.getVehicleGroups);
adminRouter.post('/vehicle-groups/create', adminVehicleGroupCtrl.createVehicleGroup);
adminRouter.put('/vehicle-groups/:id', adminVehicleGroupCtrl.updateVehicleGroup);
adminRouter.delete('/vehicle-groups/:id', adminVehicleGroupCtrl.deleteVehicleGroup);
adminRouter.get('/vehicle-groups/:id/details', adminVehicleGroupCtrl.getVehicleGroupDetails);
adminRouter.get('/vehicle-groups/:id/members', adminVehicleGroupCtrl.getVehicleGroupMembers);
adminRouter.post('/vehicle-groups/:id/add-member', adminVehicleGroupCtrl.addVehicleGroupMember);
adminRouter.delete('/vehicle-groups/:id/remove-member', adminVehicleGroupCtrl.removeVehicleGroupMember);
adminRouter.post('/vehicle-groups/:id/assign-vehicles', adminVehicleGroupCtrl.assignVehiclesToGroup);
adminRouter.post('/vehicle-groups/:id/remove-vehicle', adminVehicleGroupCtrl.removeVehicleFromGroup);

// EV Vehicle Assignments
adminRouter.get('/ev-vehicles', adminEvCtrl.getEVVehicles);
adminRouter.get('/ev-assignments', adminEvCtrl.getEVAssignments);
adminRouter.get('/ev-assignments/:id/details', adminEvCtrl.getEVAssignmentDetails);
adminRouter.post('/ev-assignments/create', adminEvCtrl.createEVAssignment);
adminRouter.post('/ev-assignments/reassign', adminEvCtrl.reassignEVAssignment);
adminRouter.delete('/ev-assignments/delete', adminEvCtrl.deleteEVAssignment);

// Bus Fleet Management
adminRouter.get('/bus-fleet', busCtrl.getBusFleet);
adminRouter.get('/stops', busCtrl.getAllStops);
adminRouter.get('/bus/:id/stops', busCtrl.getBusStops);
adminRouter.post('/bus-stop/add', busCtrl.addBusStop);
adminRouter.post('/bus-stop/update', busCtrl.updateBusStop);
adminRouter.post('/bus-stop/delete', busCtrl.deleteBusStop);
adminRouter.post('/bus-route/update', busCtrl.updateBusRoute);

// Fuel & Mileage
adminRouter.get('/fuel-indents', adminFuelCtrl.getFuelIndents);
adminRouter.post('/fuel-indents/create', adminFuelCtrl.createFuelIndent);
adminRouter.post('/fuel-indents/complete', adminFuelCtrl.completeFuelIndent);
adminRouter.post('/fuel-indents/approve', adminFuelCtrl.approveFuelIndent);
adminRouter.post('/fuel-indents/reject', adminFuelCtrl.rejectFuelIndent);
adminRouter.post('/fuel-indents/:id/bill', fuelUpload.single('file'), adminFuelCtrl.uploadFuelIndentBill);
adminRouter.put('/fuel-indents/:id', adminFuelCtrl.updateFuelIndent);
adminRouter.post('/fuel-indents/:id/update', adminFuelCtrl.updateFuelIndent);
adminRouter.post('/fuel-indents/update', adminFuelCtrl.updateFuelIndent);
adminRouter.delete('/fuel-indents/:id', adminFuelCtrl.deleteFuelIndent);
adminRouter.post('/fuel-indents/:id/delete', adminFuelCtrl.deleteFuelIndent);
adminRouter.post('/fuel-indents/delete', adminFuelCtrl.deleteFuelIndent);
adminRouter.get('/fuel-indents/pending-count', adminFuelCtrl.getPendingFuelIndentCount);

// Vehicle Replacements
adminRouter.get('/vehicle-replacements', adminVehicleReplacementCtrl.getVehicleReplacements);
adminRouter.post('/vehicle-replacements/create', adminVehicleReplacementCtrl.createVehicleReplacement);
adminRouter.post('/vehicle-replacements/approve', adminVehicleReplacementCtrl.approveVehicleReplacement);
adminRouter.post('/vehicle-replacements/reject', adminVehicleReplacementCtrl.rejectVehicleReplacement);
adminRouter.post('/vehicle-replacements/complete', adminVehicleReplacementCtrl.completeVehicleReplacement);
adminRouter.post('/vehicle-replacements/update', adminVehicleReplacementCtrl.updateVehicleReplacement);
adminRouter.put('/vehicle-replacements/update', adminVehicleReplacementCtrl.updateVehicleReplacement);
adminRouter.post('/vehicle-replacements/delete', adminVehicleReplacementCtrl.deleteVehicleReplacement);
adminRouter.delete('/vehicle-replacements/delete', adminVehicleReplacementCtrl.deleteVehicleReplacement);
adminRouter.get('/vehicle-replacements/available-vehicles', adminVehicleReplacementCtrl.getAvailableReplacementVehiclesNew);
adminRouter.get('/vehicle-replacements/pending-count', adminVehicleReplacementCtrl.getPendingVehicleReplacementsCount);
adminRouter.post('/vehicle-replacements/check-expired', adminVehicleReplacementCtrl.checkExpiredVehicleReplacements);
adminRouter.get('/vehicle-replacements/vehicle-drivers', adminVehicleReplacementCtrl.getVehicleDriversNew);
adminRouter.get('/vehicle-replacements/stats', adminVehicleReplacementCtrl.getVehicleReplacementStats);
adminRouter.get('/vehicle-replacements/available-drivers', adminVehicleReplacementCtrl.getAvailableReplacementDrivers);
adminRouter.get('/vehicle-replacements/driver-vehicle', adminVehicleReplacementCtrl.getDriverVehicle);

// Legacy FC replacement routes
adminRouter.get('/fc-replacements', adminVehicleReplacementCtrl.getVehicleReplacements);
adminRouter.get('/fc-replacements/available-vehicles', adminVehicleReplacementCtrl.getAvailableReplacementVehiclesNew);
adminRouter.get('/fc-replacements/vehicle-drivers', adminVehicleReplacementCtrl.getVehicleDriversNew);
adminRouter.get('/fc-replacements/pending-count', adminVehicleReplacementCtrl.getPendingVehicleReplacementsCount);

// Notifications
adminRouter.get('/notifications', adminNotificationCtrl.getAdminNotifications);
adminRouter.post('/notifications/:id/mark-read', adminNotificationCtrl.markAdminNotificationRead);
adminRouter.post('/notifications/mark-all-read', adminNotificationCtrl.markAllAdminNotificationsRead);
adminRouter.get('/group-expiry-check', adminNotificationCtrl.checkGroupExpiry);

// Student Transport & Users
adminRouter.get('/students', adminStudentTransportCtrl.getAllStudents);
adminRouter.post('/students/create', adminStudentTransportCtrl.createStudent);
adminRouter.delete('/students/delete', adminStudentTransportCtrl.deleteStudent);
adminRouter.post('/users/students/bulk-create-file', memoryUpload.single('file'), adminUserManagementCtrl.bulkCreateStudentsFile);
adminRouter.post('/users/faculty/bulk-create-file', memoryUpload.single('file'), adminUserManagementCtrl.bulkCreateFacultyFile);
adminRouter.post('/users/faculty/create', adminUserManagementCtrl.createFacultyUser);
adminRouter.get('/student-transport', adminStudentTransportCtrl.getAllStudentTransport);
adminRouter.post('/student-transport/assign', adminStudentTransportCtrl.assignStudentTransport);
adminRouter.post('/student-transport/update', adminStudentTransportCtrl.updateStudentTransport);
adminRouter.delete('/student-transport/delete', adminStudentTransportCtrl.deleteStudentTransport);
adminRouter.get('/transport-payments', adminStudentTransportCtrl.getAllTransportPayments);
adminRouter.post('/transport-payments/record', adminStudentTransportCtrl.recordTransportPayment);
adminRouter.get('/stop-change-requests', adminStudentTransportCtrl.getAllStopChangeRequests);
adminRouter.post('/stop-change-requests/process', adminStudentTransportCtrl.processStopChangeRequest);
adminRouter.get('/stop-change-requests/pending-count', adminStudentTransportCtrl.getPendingStopChangeCount);

// Transport Requests
adminRouter.get('/transport-requests', adminStudentTransportCtrl.getAllTransportRequests);
adminRouter.post('/transport-requests/process', adminStudentTransportCtrl.processTransportRequest);
adminRouter.post('/transport-requests/fix-approved', adminStudentTransportCtrl.fixApprovedRequests);
adminRouter.get('/transport-requests/pending-count', adminStudentTransportCtrl.getPendingTransportRequestCount);

// Students by Bus
adminRouter.get('/buses/with-students', adminStudentTransportCtrl.getBusesWithStudentCounts);
adminRouter.get('/buses/:id/students', adminStudentTransportCtrl.getStudentsByBus);
adminRouter.get('/student-transport/:id/fee-summary', adminStudentTransportCtrl.getStudentFeeSummary);

// Vehicle Requests (Admin side)
adminRouter.get('/vehicle-requests', adminVehicleRequestCtrl.getAllVehicleRequests);
adminRouter.get('/vehicle-request/:id', adminVehicleRequestCtrl.getVehicleRequestDetails);
adminRouter.post('/vehicle-request/approve', adminVehicleRequestCtrl.approveVehicleRequest);
adminRouter.post('/vehicle-request/reject', adminVehicleRequestCtrl.rejectVehicleRequest);
adminRouter.post('/vehicle-request/cancel', adminVehicleRequestCtrl.cancelVehicleRequestByAdmin);
adminRouter.post('/vehicle-request/assign', adminVehicleRequestCtrl.assignVehicleToRequest);
adminRouter.post('/vehicle-request/start-trip', adminVehicleRequestCtrl.startVehicleRequestTripByAdmin);
adminRouter.post('/vehicle-request/end-trip', adminVehicleRequestCtrl.endVehicleRequestTripByAdmin);
adminRouter.post('/vehicle-request/complete', adminVehicleRequestCtrl.completeVehicleRequest);
adminRouter.get('/vehicle-requests/pending-count', adminVehicleRequestCtrl.getPendingVehicleRequestCount);

// Service & Repair
adminRouter.get('/services', adminServiceCtrl.getAllServiceRecords);
adminRouter.get('/services/stats', adminServiceCtrl.getServiceStats);
adminRouter.get('/services/:id', adminServiceCtrl.getServiceRecordByID);
adminRouter.get('/services/:id/linked-purchases', adminServiceCtrl.getLinkedPurchases);
adminRouter.post('/services/create', adminServiceCtrl.createServiceRecord);
adminRouter.post('/services/update', adminServiceCtrl.updateServiceRecord);
adminRouter.put('/services/update', adminServiceCtrl.updateServiceRecord);
adminRouter.delete('/services/delete', adminServiceCtrl.deleteServiceRecord);
adminRouter.post('/services/delete', adminServiceCtrl.deleteServiceRecord);
adminRouter.post('/services/:id/approve', adminServiceCtrl.approveServiceRequest);
adminRouter.post('/services/:id/reject', adminServiceCtrl.rejectServiceRequest);
adminRouter.post('/services/:id/start', adminServiceCtrl.startServiceRecord);
adminRouter.post('/services/:id/complete', adminServiceCtrl.completeServiceRecord);
adminRouter.post('/services/:id/cancel', adminServiceCtrl.cancelServiceRecord);
adminRouter.get('/services/:id/parts', adminPartsCtrl.getPartsByServiceRecord);
adminRouter.post('/services/parts/add', adminPartsCtrl.addPart);
adminRouter.post('/services/parts/add-bulk', adminPartsCtrl.addBulkParts);
adminRouter.post('/services/parts/update', adminPartsCtrl.updatePart);
adminRouter.post('/services/parts/update-status', adminPartsCtrl.updatePartStatus);
adminRouter.delete('/services/parts/delete', adminPartsCtrl.deletePart);
adminRouter.get('/parts', adminPartsCtrl.getAllParts);
adminRouter.get('/parts/expenditure', adminPartsCtrl.getPartsExpenditure);

// Purchase Orders
adminRouter.get('/purchase-orders', adminPurchaseOrderCtrl.getAllPurchaseOrders);
adminRouter.get('/purchase-orders/:id', adminPurchaseOrderCtrl.getPurchaseOrderByID);
adminRouter.post('/purchase-orders/create', adminPurchaseOrderCtrl.createPurchaseOrder);
adminRouter.post('/purchase-orders/update', adminPurchaseOrderCtrl.updatePurchaseOrder);
adminRouter.put('/purchase-orders/update', adminPurchaseOrderCtrl.updatePurchaseOrder);
adminRouter.post('/purchase-orders/update-status', adminPurchaseOrderCtrl.updatePurchaseOrderStatus);
adminRouter.delete('/purchase-orders/delete', adminPurchaseOrderCtrl.deletePurchaseOrder);
adminRouter.post('/purchase-orders/delete', adminPurchaseOrderCtrl.deletePurchaseOrder);
adminRouter.post('/purchase-orders/add-product', adminPurchaseOrderCtrl.addProductToOrder);
adminRouter.delete('/purchase-orders/remove-product', adminPurchaseOrderCtrl.removeProductFromOrder);
adminRouter.post('/purchase-orders/:id/invoice', invoiceUpload.single('file'), adminPurchaseInvoiceCtrl.uploadPurchaseInvoice);
adminRouter.get('/purchase-orders/:id/invoice', adminPurchaseInvoiceCtrl.getPurchaseInvoice);
adminRouter.delete('/purchase-orders/:id/invoice', adminPurchaseInvoiceCtrl.deletePurchaseInvoice);

// Vendors
adminRouter.get('/vendors', adminVendorCtrl.getVendors);
adminRouter.get('/vendors/:id', adminVendorCtrl.getVendorByID);
adminRouter.post('/vendors/create', adminVendorCtrl.createVendor);
adminRouter.post('/vendors/update', adminVendorCtrl.updateVendor);
adminRouter.put('/vendors/update', adminVendorCtrl.updateVendor);
adminRouter.delete('/vendors/delete', adminVendorCtrl.deleteVendor);
adminRouter.post('/vendors/delete', adminVendorCtrl.deleteVendor);
adminRouter.get('/service-tracking', adminServiceCtrl.getServiceTracking);
adminRouter.post('/service-tracking/update', adminServiceCtrl.updateServiceTracking);

// Reports
adminRouter.get('/reports/attendance', adminReportCtrl.generateAttendanceReport);
adminRouter.get('/reports/service', adminReportCtrl.generateServiceReport);
adminRouter.get('/reports/purchase', adminReportCtrl.generatePurchaseReport);
adminRouter.get('/reports/leave', adminReportCtrl.generateLeaveReport);
adminRouter.get('/reports/km-fuel', adminReportCtrl.generateKmFuelReport);
adminRouter.get('/reports/vehicle-fleet', adminReportCtrl.generateVehicleFleetReport);
adminRouter.get('/reports/student-fee', adminReportCtrl.generateStudentFeeReport);
adminRouter.get('/reports/vehicle-requests', adminReportCtrl.generateVehicleRequestReport);
adminRouter.get('/reports/drivers', adminReportCtrl.generateDriverReport);
adminRouter.get('/reports/assignments', adminReportCtrl.generateAssignmentReport);
adminRouter.get('/reports/vendor', adminReportCtrl.generateVendorReport);
adminRouter.get('/reports/stop-changes', adminReportCtrl.generateStopChangeReport);
adminRouter.get('/reports/bus-detail', adminReportCtrl.generateBusDetailReport);
adminRouter.get('/reports/driver-groups', adminReportCtrl.generateDriverGroupReport);
adminRouter.get('/reports/vehicle-groups', adminReportCtrl.generateVehicleGroupReport);
adminRouter.get('/reports/shifts', adminReportCtrl.generateShiftReport);

router.use('/admin', adminRouter);

// ==========================================
// 4. DRIVER ROUTES (under /api/driver)
// ==========================================
const driverRouter = express.Router();
driverRouter.use(authMiddleware, roleMiddleware('DRIVER'));

driverRouter.get('/profile', driverProfileCtrl.getDriverProfile);
driverRouter.get('/assignment/today', driverAssignmentCtrl.getDriverTodayAssignment);
driverRouter.get('/assignments/today', driverAssignmentCtrl.getDriverTodayAssignments);
driverRouter.get('/assignments', driverAssignmentCtrl.getDriverAssignments);
driverRouter.get('/km-logs', driverKmlogCtrl.getDriverKmLogs);
driverRouter.post('/km-log/add', driverKmlogCtrl.addDriverKmLog);
driverRouter.get('/km-log/assigned-vehicles', driverKmlogCtrl.getDriverKmLogAssignedVehicles);
driverRouter.get('/vehicle-last-log', driverKmlogCtrl.getLastLogForVehicle);
driverRouter.post('/leave/apply', driverLeaveCtrl.applyLeave);
driverRouter.get('/leave', driverLeaveCtrl.getMyLeaveRequests);
driverRouter.get('/vehicles/alerts', driverAlertCtrl.getDriverVehicleAlerts);
driverRouter.get('/notifications', driverNotificationCtrl.getDriverNotifications);
driverRouter.get('/notifications/unread-count', driverNotificationCtrl.getUnreadNotificationCount);
driverRouter.post('/notifications/:id/mark-read', driverNotificationCtrl.markNotificationRead);
driverRouter.post('/notifications/mark-all-read', driverNotificationCtrl.markAllNotificationsRead);
driverRouter.get('/vehicle-requests', driverVehicleRequestCtrl.getDriverVehicleRequests);
driverRouter.get('/vehicle-requests/upcoming', driverVehicleRequestCtrl.getDriverUpcomingVehicleRequests);
driverRouter.post('/vehicle-request/verify-start-otp', driverVehicleRequestCtrl.verifyStartOTP);
driverRouter.post('/vehicle-request/verify-end-otp', driverVehicleRequestCtrl.verifyEndOTP);
driverRouter.post('/services/report', driverServiceCtrl.reportIssue);
driverRouter.get('/services/my-requests', driverServiceCtrl.getMyServiceRequests);
driverRouter.get('/services/vehicle-history', driverServiceCtrl.getVehicleServiceHistory);
driverRouter.get('/fuel-indents', driverFuelIndentCtrl.getDriverFuelIndents);
driverRouter.post('/fuel-indents/create', driverFuelIndentCtrl.createDriverFuelIndent);
driverRouter.post('/fuel-indents/:id/bill', fuelUpload.single('file'), driverFuelIndentCtrl.uploadDriverFuelIndentBill);
driverRouter.put('/fuel-indents/:id', driverFuelIndentCtrl.updateDriverFuelIndent);
driverRouter.post('/fuel-indents/:id/update', driverFuelIndentCtrl.updateDriverFuelIndent);
driverRouter.post('/fuel-indents/update', driverFuelIndentCtrl.updateDriverFuelIndent);
driverRouter.delete('/fuel-indents/:id', driverFuelIndentCtrl.deleteDriverFuelIndent);
driverRouter.post('/fuel-indents/:id/delete', driverFuelIndentCtrl.deleteDriverFuelIndent);
driverRouter.post('/fuel-indents/delete', driverFuelIndentCtrl.deleteDriverFuelIndent);
driverRouter.get('/drivers-dropdown', driverFuelIndentCtrl.getDriversDropdown);
driverRouter.get('/bus/:vehicle_id/route-info', driverAssignmentCtrl.getBusRouteInfo);

router.use('/driver', driverRouter);

// ==========================================
// 5. STUDENT ROUTES (under /api/student)
// ==========================================
const studentRouter = express.Router();
studentRouter.use(authMiddleware, roleMiddleware('STUDENT'));

studentRouter.get('/buses', busCtrl.getBusFleet);
studentRouter.get('/bus/:id/stops', studentCtrl.getBusStopsForStudent);
studentRouter.get('/transport', studentCtrl.getMyTransport);
studentRouter.get('/transport/payments', studentCtrl.getMyPayments);
studentRouter.get('/transport/requests', studentCtrl.getMyTransportRequests);
studentRouter.post('/transport/request', studentCtrl.requestTransport);
studentRouter.post('/stop-change/request', studentCtrl.requestStopChange);
studentRouter.post('/stop-change/request/cancel', studentCtrl.cancelStopChangeRequest);
studentRouter.get('/stop-change/requests', studentCtrl.getMyStopChangeRequests);
studentRouter.get('/available-stops', studentCtrl.getAvailableStops);
studentRouter.get('/all-buses', studentCtrl.getAllBuses);

router.use('/student', studentRouter);

// ==========================================
// 6. FACULTY ROUTES (under /api/faculty)
// ==========================================
const facultyRouter = express.Router();
facultyRouter.use(authMiddleware, roleMiddleware('FACULTY'));

facultyRouter.get('/profile', facultyProfileCtrl.getFacultyProfile);
facultyRouter.post('/profile/update', facultyProfileCtrl.updateFacultyProfile);
facultyRouter.put('/profile/update', facultyProfileCtrl.updateFacultyProfile);
facultyRouter.put('/profile', facultyProfileCtrl.updateFacultyProfile);
facultyRouter.post('/vehicle-request', facultyVehicleRequestCtrl.createVehicleRequest);
facultyRouter.get('/vehicle-requests', facultyVehicleRequestCtrl.getMyVehicleRequests);
facultyRouter.post('/vehicle-request/cancel', facultyVehicleRequestCtrl.cancelVehicleRequest);
facultyRouter.get('/vehicle-request/:id/otp', facultyVehicleRequestCtrl.getVehicleRequestOTP);

router.use('/faculty', facultyRouter);

module.exports = {
  apiRouter: router,
  googleAuth: {
    login: googleCtrl.googleLogin,
    callback: googleCtrl.googleCallback
  }
};
