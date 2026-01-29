package routes

import (
	"transport-server/api/admin"
	"transport-server/api/auth"
	"transport-server/api/bus"
	"transport-server/api/driver"
	"transport-server/api/incharge"
	"transport-server/api/student"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	// =========================
	// AUTH & ADMIN PROFILE
	// =========================
	r.POST("/api/login", auth.UnifiedLogin)             // 🔐 UNIFIED LOGIN for all roles
	r.GET("/api/me", auth.Me)                           // 🔐 GET CURRENT USER
	r.GET("/auth/google/login", auth.GoogleLogin)       // 🔐 GOOGLE LOGIN
	r.GET("/auth/google/callback", auth.GoogleCallback) // 🔐 GOOGLE CALLBACK
	r.POST("/api/logout", auth.Logout)                  // 🚪 LOGOUT

	r.POST("/api/admin/setup", auth.SetupAdminPassword)
	r.GET("/api/admin/profile", admin.GetAdminProfile)
	r.POST("/api/admin/profile/update", admin.UpdateAdminProfile)
	r.POST("/api/admin/profile/upload", admin.UploadAdminProfileImage)
	r.POST("/api/admin/password/change", admin.ChangeAdminPassword)
	// =========================
	// DASHBOARD STATS
	// =========================
	r.GET("/api/admin/dashboard/stats", admin.GetDashboardStats)
	// =========================
	// DRIVER MANAGEMENT
	// =========================
	r.GET("/api/admin/drivers", admin.GetDrivers)
	r.POST("/api/admin/drivers/create", admin.CreateDriver)
	r.POST("/api/admin/drivers/update", admin.UpdateDriver)
	r.DELETE("/api/admin/drivers/delete", admin.DeleteDriver)
	// =========================
	// VEHICLE MANAGEMENT
	// =========================
	r.GET("/api/admin/vehicles", admin.GetAllVehicles)
	r.POST("/api/admin/vehicles/create", admin.CreateVehicle)
	r.POST("/api/admin/vehicles/update", admin.UpdateVehicle)
	r.DELETE("/api/admin/vehicles/delete", admin.DeleteVehicle)
	// =========================
	// STOP MANAGEMENT
	// =========================
	r.GET("/api/admin/stops", admin.GetAllStops)
	r.POST("/api/admin/stops/create", admin.CreateStop)
	r.DELETE("/api/admin/stops/delete", admin.DeleteStop)
	// =========================
	// SHIFT MANAGEMENT
	// =========================
	r.GET("/api/admin/shifts", admin.GetAllShifts)
	r.POST("/api/admin/shifts/create", admin.CreateShift)
	r.POST("/api/admin/shifts/update", admin.UpdateShift)
	r.DELETE("/api/admin/shifts/delete", admin.DeleteShift)

	// =========================
	// ASSIGNMENT MANAGEMENT
	// =========================
	r.GET("/api/admin/assignments", admin.GetAllAssignments)
	r.POST("/api/admin/assignments/create", admin.CreateAssignment)
	r.POST("/api/admin/assignments/update", admin.UpdateAssignment)
	r.DELETE("/api/admin/assignments/delete", admin.DeleteAssignment)
	r.POST("/api/admin/assignments/reassign-for-leave", admin.ReassignForLeave)

	// =========================
	// DUTY MANAGEMENT
	// =========================
	r.GET("/api/admin/duties", admin.GetAllDuties)
	r.POST("/api/admin/duties/create", admin.CreateDuty)
	r.POST("/api/admin/duties/approve", admin.ApproveDuty)

	// =========================
	// ATTENDANCE MANAGEMENT
	// =========================
	r.GET("/api/admin/attendance", admin.GetAttendance)
	r.POST("/api/admin/attendance/mark", admin.MarkAttendance)

	// =========================
	// DROPDOWN DATA (for forms) - Shared
	// =========================
	r.GET("/api/vehicles", admin.GetAllVehicles)
	r.GET("/api/stops", admin.GetAllStops)
	r.GET("/api/shifts", admin.GetAllShifts)
	r.GET("/api/drivers", admin.GetDrivers)

	// =========================
	// DRIVER PORTAL
	// =========================
	r.GET("/api/driver/profile", driver.GetDriverProfile)

	r.GET("/api/driver/assignment/today", driver.GetDriverTodayAssignment)
	r.GET("/api/driver/assignments/today", driver.GetDriverTodayAssignments)
	r.GET("/api/driver/assignments", driver.GetDriverAssignments)
	r.GET("/api/driver/km-logs", driver.GetDriverKmLogs)
	r.POST("/api/driver/km-log/add", driver.AddDriverKmLog)
	r.GET("/api/driver/vehicle-last-log", driver.GetLastLogForVehicle)
	r.POST("/api/driver/leave/apply", driver.ApplyLeave)
	r.GET("/api/driver/leave", driver.GetMyLeaveRequests)
	r.GET("/api/driver/vehicles/alerts", driver.GetDriverVehicleAlerts)
	r.GET("/api/driver/notifications", driver.GetDriverNotifications)
	r.GET("/api/driver/notifications/unread-count", driver.GetUnreadNotificationCount)
	r.POST("/api/driver/notifications/:id/mark-read", driver.MarkNotificationRead)
	r.POST("/api/driver/notifications/mark-all-read", driver.MarkAllNotificationsRead)

	// =========================
	// STUDENT PORTAL
	// =========================
	r.GET("/api/student/buses", bus.GetBusFleet)
	r.GET("/api/student/bus/:id/stops", student.GetBusStopsForStudent)
	r.GET("/api/student/transport", student.GetMyTransport)
	r.GET("/api/student/transport/payments", student.GetMyPayments)
	r.POST("/api/student/stop-change/request", student.RequestStopChange)
	r.POST("/api/student/stop-change/request/cancel", student.CancelStopChangeRequest)
	r.GET("/api/student/stop-change/requests", student.GetMyStopChangeRequests)
	r.GET("/api/student/available-stops", student.GetAvailableStops)
	r.GET("/api/student/all-buses", student.GetAllBuses)
	r.POST("/api/student/transport/request", student.RequestTransport)
	r.GET("/api/student/transport/requests", student.GetMyTransportRequests)

	// =========================
	// INCHARGE PORTAL
	// =========================
	r.GET("/api/incharge/assignments", incharge.GetInchargeAssignments)
	r.GET("/api/incharge/cluster-drivers", incharge.GetInchargeClusterDrivers)
	r.POST("/api/incharge/attendance/mark", incharge.InchargeMarkAttendance)
	r.GET("/api/incharge/attendance/history", incharge.GetInchargeAttendanceHistory)
	r.GET("/api/incharge/vehicles/alerts", incharge.GetInchargeVehicleAlerts)
	r.POST("/api/incharge/fc-replacement/request", incharge.RequestFCReplacement)
	r.GET("/api/incharge/fc-replacements", incharge.GetInchargeFCReplacements)
	r.GET("/api/incharge/driver-assignments", incharge.GetDriverAssignments)
	r.GET("/api/incharge/all-drivers", incharge.GetAllDriversForIncharge)
	r.POST("/api/incharge/km-log/add", incharge.InchargeAddKmLog)
	r.POST("/api/incharge/leave/apply", incharge.InchargeApplyLeave)
	r.GET("/api/incharge/driver-km-logs", incharge.GetDriverKmLogs)
	r.GET("/api/incharge/km-summary", incharge.GetInchargeKmSummary)
	r.GET("/api/incharge/km-filters", incharge.GetInchargeKmFilters)

	// =========================
	// BUS FLEET MANAGEMENT
	// =========================
	r.GET("/api/admin/bus-fleet", bus.GetBusFleet)
	r.GET("/api/admin/bus/:id/stops", bus.GetBusStops)
	r.POST("/api/admin/bus-stop/add", bus.AddBusStop)
	r.POST("/api/admin/bus-stop/update", bus.UpdateBusStop)
	r.POST("/api/admin/bus-stop/delete", bus.DeleteBusStop)
	r.POST("/api/admin/bus-route/update", bus.UpdateBusRoute)

	// =========================
	// LEAVE MANAGEMENT
	// =========================
	r.GET("/api/admin/leave/pending", admin.GetPendingLeaveRequests)
	r.GET("/api/admin/leave/all", admin.GetAllLeaveRequests)
	r.POST("/api/admin/leave/approve", admin.ApproveLeave)
	r.GET("/api/admin/leave/history", admin.GetLeaveHistory)
	r.GET("/api/admin/leave/stats", admin.GetLeaveStats)

	// =========================
	// CLUSTER MANAGEMENT
	// =========================
	r.GET("/api/admin/clusters", admin.GetClusters)
	r.POST("/api/admin/clusters/create", admin.CreateCluster)
	r.POST("/api/admin/clusters/create-with-schedule", admin.CreateClusterWithSchedule)
	r.POST("/api/admin/clusters/update", admin.UpdateCluster)
	r.POST("/api/admin/clusters/assign-drivers", admin.AssignDriversToCluster)
	r.POST("/api/admin/clusters/assign-shift", admin.AssignClusterToShift)
	r.DELETE("/api/admin/clusters/delete", admin.DeleteCluster)
	r.GET("/api/admin/drivers/km-suggestions", admin.GetDriverKmSuggestions)

	// =========================
	// EV VEHICLE ASSIGNMENTS
	// =========================
	r.GET("/api/admin/ev-vehicles", admin.GetEVVehicles)
	r.GET("/api/admin/ev-assignments", admin.GetEVAssignments)
	r.GET("/api/admin/ev-assignments/:id/details", admin.GetEVAssignmentDetails)
	r.POST("/api/admin/ev-assignments/create", admin.CreateEVAssignment)
	r.DELETE("/api/admin/ev-assignments/delete", admin.DeleteEVAssignment)

	// =========================
	// CATEGORY-BASED ASSIGNMENTS (BUS/CAR)
	// =========================
	r.GET("/api/admin/assignments/by-category", admin.GetAssignmentsByCategory)
	r.GET("/api/admin/available-drivers", admin.GetAvailableDrivers)
	r.GET("/api/admin/km-summary", admin.GetKMSummary)
	r.GET("/api/admin/km-filters", admin.GetKmFilterMeta)
	r.GET("/api/admin/km-logs", admin.GetAdminKmLogs)
	r.POST("/api/admin/km-log/add", admin.AdminAddKmLog)

	// =========================
	// TEMPORARY ASSIGNMENTS (Separate Table)
	// =========================
	r.GET("/api/admin/temporary-assignments", admin.GetTemporaryAssignments)
	r.POST("/api/admin/temporary-assignments/create", admin.CreateTemporaryAssignment)
	r.DELETE("/api/admin/temporary-assignments/:id", admin.CancelTemporaryAssignment)

	// =========================
	// ABSENT DRIVER ALERTS
	// =========================
	r.GET("/api/admin/assignments/absent-alerts", admin.GetAbsentDriverAlerts)

	// =========================
	// FUEL & MILEAGE MANAGEMENT
	// =========================
	r.GET("/api/admin/fuel-indents", admin.GetFuelIndents)
	r.POST("/api/admin/fuel-indents/create", admin.CreateFuelIndent)
	r.POST("/api/admin/fuel-indents/complete", admin.CompleteFuelIndent)
	r.GET("/api/admin/odometer-readings", admin.GetOdometerReadings)
	r.POST("/api/admin/odometer-readings/create", admin.CreateOdometerReading)

	// =========================
	// VEHICLE DOCUMENT ALERTS
	// =========================
	r.GET("/api/admin/vehicles/alerts", admin.GetVehicleDocumentAlerts)

	// =========================
	// FC/INSURANCE/PERMIT REPLACEMENT MANAGEMENT
	// =========================
	r.GET("/api/admin/fc-replacements", admin.GetFCReplacements)
	r.POST("/api/admin/fc-replacements/create", admin.CreateFCReplacement)
	r.POST("/api/admin/fc-replacements/approve", admin.ApproveFCReplacement)
	r.POST("/api/admin/fc-replacements/reject", admin.RejectFCReplacement)
	r.POST("/api/admin/fc-replacements/complete", admin.CompleteFCReplacement)
	r.POST("/api/admin/fc-replacements/update", admin.UpdateFCReplacement)
	r.POST("/api/admin/fc-replacements/delete", admin.DeleteFCReplacement)
	r.GET("/api/admin/fc-replacements/available-vehicles", admin.GetAvailableReplacementVehicles)
	r.GET("/api/admin/fc-replacements/pending-count", admin.GetPendingFCReplacementsCount)
	r.POST("/api/admin/fc-replacements/check-expired", admin.CheckExpiredFCReplacements)
	r.GET("/api/admin/fc-replacements/recent-completions", admin.GetRecentFCCompletions)
	r.GET("/api/admin/fc-replacements/vehicle-drivers", admin.GetVehicleDrivers)
	r.GET("/api/admin/fc-replacements/cluster-drivers", admin.GetClusterDrivers)

	// Admin notifications
	r.GET("/api/admin/notifications", admin.GetAdminNotifications)
	r.POST("/api/admin/notifications/:id/mark-read", admin.MarkAdminNotificationRead)
	r.POST("/api/admin/notifications/mark-all-read", admin.MarkAllAdminNotificationsRead)

	// =========================
	// STUDENT TRANSPORT MANAGEMENT (Admin)
	// =========================
	r.GET("/api/admin/students", admin.GetAllStudents)
	r.POST("/api/admin/students/create", admin.CreateStudent)
	r.DELETE("/api/admin/students/delete", admin.DeleteStudent)
	r.GET("/api/admin/student-transport", admin.GetAllStudentTransport)
	r.POST("/api/admin/student-transport/assign", admin.AssignStudentTransport)
	r.POST("/api/admin/student-transport/update", admin.UpdateStudentTransport)
	r.DELETE("/api/admin/student-transport/delete", admin.DeleteStudentTransport)
	r.GET("/api/admin/transport-fees", admin.GetTransportFees)
	r.POST("/api/admin/transport-fees/create", admin.CreateTransportFee)
	r.POST("/api/admin/transport-fees/update", admin.UpdateTransportFee)
	r.GET("/api/admin/transport-payments", admin.GetAllTransportPayments)
	r.POST("/api/admin/transport-payments/record", admin.RecordTransportPayment)
	r.GET("/api/admin/stop-change-requests", admin.GetAllStopChangeRequests)
	r.POST("/api/admin/stop-change-requests/process", admin.ProcessStopChangeRequest)
	r.GET("/api/admin/stop-change-requests/pending-count", admin.GetPendingStopChangeCount)

	// Transport Requests (students request bus/stop, admin approves)
	r.GET("/api/admin/transport-requests", admin.GetAllTransportRequests)
	r.POST("/api/admin/transport-requests/process", admin.ProcessTransportRequest)
	r.POST("/api/admin/transport-requests/fix-approved", admin.FixApprovedRequests)
	r.GET("/api/admin/transport-requests/pending-count", admin.GetPendingTransportRequestCount)

	// Students by Bus (view students under each bus)
	r.GET("/api/admin/buses/with-students", admin.GetBusesWithStudentCounts)
	r.GET("/api/admin/buses/:id/students", admin.GetStudentsByBus)
}
