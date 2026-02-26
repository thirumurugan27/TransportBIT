package routes

import (
	"transport-server/api/admin"
	"transport-server/api/auth"
	"transport-server/api/bus"
	"transport-server/api/driver"
	"transport-server/api/faculty"
	"transport-server/api/student"
	"transport-server/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// ========================================
	// PUBLIC ROUTES (no authentication)
	// ========================================
	api.POST("/login", auth.UnifiedLogin)
	api.POST("/logout", auth.Logout)
	api.POST("/admin/setup", auth.SetupAdminPassword)

	// Google OAuth
	r.GET("/auth/google/login", auth.GoogleLogin)
	r.GET("/auth/google/callback", auth.GoogleCallback)

	// ========================================
	// AUTHENTICATED ROUTES
	// ========================================
	authenticated := api.Group("", middleware.AuthMiddleware())

	// Current user
	authenticated.GET("/me", auth.Me)

	// Shared dropdown data (for forms across roles)
	authenticated.GET("/vehicles", admin.GetAllVehicles)
	authenticated.GET("/stops", admin.GetAllStops)
	authenticated.GET("/shifts", admin.GetAllShifts)
	authenticated.GET("/drivers", admin.GetDrivers)

	// ========================================
	// ADMIN ROUTES
	// ========================================
	adm := authenticated.Group("/admin", middleware.RoleMiddleware("ADMIN"))
	registerAdminRoutes(adm)

	// ========================================
	// DRIVER ROUTES
	// ========================================
	drv := authenticated.Group("/driver", middleware.RoleMiddleware("DRIVER"))
	registerDriverRoutes(drv)

	// ========================================
	// STUDENT ROUTES
	// ========================================
	stu := authenticated.Group("/student", middleware.RoleMiddleware("STUDENT"))
	registerStudentRoutes(stu)

	// ========================================
	// FACULTY ROUTES
	// ========================================
	fac := authenticated.Group("/faculty", middleware.RoleMiddleware("FACULTY"))
	registerFacultyRoutes(fac)
}

// registerAdminRoutes sets up all admin endpoints under /api/admin
func registerAdminRoutes(adm *gin.RouterGroup) {
	// Profile
	adm.GET("/profile", admin.GetAdminProfile)
	adm.POST("/profile/update", admin.UpdateAdminProfile)
	adm.POST("/profile/upload", admin.UploadAdminProfileImage)
	adm.POST("/password/change", admin.ChangeAdminPassword)

	// Dashboard
	adm.GET("/dashboard/stats", admin.GetDashboardStats)

	// Driver Management
	adm.GET("/drivers", admin.GetDrivers)
	adm.POST("/drivers/create", admin.CreateDriver)
	adm.PUT("/drivers/update", admin.UpdateDriver)
	adm.DELETE("/drivers/delete", admin.DeleteDriver)
	adm.GET("/drivers/available-for-cluster", admin.GetAvailableDriversForCluster)
	adm.GET("/drivers/km-suggestions", admin.GetDriverKmSuggestions)
	adm.GET("/available-drivers", admin.GetAvailableDrivers)
	adm.GET("/driver-assigned-vehicles", admin.GetDriverAssignedVehicles)
	adm.GET("/driver-km-history", admin.GetDriverKmHistory)

	// Vehicle Management
	adm.GET("/vehicles", admin.GetAllVehicles)
	adm.POST("/vehicles/create", admin.CreateVehicle)
	adm.POST("/vehicles/update", admin.UpdateVehicle)
	adm.DELETE("/vehicles/delete", admin.DeleteVehicle)
	adm.GET("/vehicles/alerts", admin.GetVehicleDocumentAlerts)
	adm.GET("/vehicles/unassigned-ev", admin.GetUnassignedEVVehicles)
	adm.GET("/vehicles/available-for-group", admin.GetAvailableVehiclesForGroup)

	// Stop Management
	adm.GET("/stops", admin.GetAllStops)
	adm.POST("/stops/create", admin.CreateStop)
	adm.DELETE("/stops/delete", admin.DeleteStop)

	// Shift Management
	adm.GET("/shifts", admin.GetAllShifts)
	adm.POST("/shifts/create", admin.CreateShift)
	adm.POST("/shifts/update", admin.UpdateShift)
	adm.DELETE("/shifts/delete", admin.DeleteShift)

	// Assignment Management
	adm.GET("/assignments", admin.GetAllAssignments)
	adm.GET("/assignments/:id", admin.GetAssignmentDetails)
	adm.POST("/assignments/create", admin.CreateAssignment)
	adm.POST("/assignments/update", admin.UpdateAssignment)
	adm.DELETE("/assignments/delete", admin.DeleteAssignment)
	adm.POST("/assignments/reassign-for-leave", admin.ReassignForLeave)
	adm.GET("/assignments/check-driver-conflict", admin.CheckDriverConflictAPI)
	adm.GET("/assignments/check-vehicle-conflict", admin.CheckVehicleConflictAPI)
	adm.GET("/assignments/by-category", admin.GetAssignmentsByCategory)
	adm.GET("/assignments/absent-alerts", admin.GetAbsentDriverAlerts)

	// Temporary Assignments
	adm.GET("/temporary-assignments", admin.GetTemporaryAssignments)
	adm.POST("/temporary-assignments/create", admin.CreateTemporaryAssignment)
	adm.DELETE("/temporary-assignments/:id", admin.CancelTemporaryAssignment)

	// Duty Management
	adm.GET("/duties", admin.GetAllDuties)
	adm.POST("/duties/create", admin.CreateDuty)
	adm.POST("/duties/approve", admin.ApproveDuty)

	// Attendance
	adm.GET("/attendance", admin.GetAttendance)
	adm.POST("/attendance/mark", admin.MarkAttendance)

	// Leave Management
	adm.GET("/leave/pending", admin.GetPendingLeaveRequests)
	adm.GET("/leave/all", admin.GetAllLeaveRequests)
	adm.POST("/leave/apply", admin.AdminApplyLeave)
	adm.POST("/leave/approve", admin.ApproveLeave)
	adm.GET("/leave/history", admin.GetLeaveHistory)
	adm.GET("/leave/stats", admin.GetLeaveStats)
	adm.GET("/leave/:id/affected-assignments", admin.GetLeaveAffectedAssignments)
	adm.POST("/leave/approve-with-assignments", admin.ApproveLeaveWithAssignments)

	// KM Management
	adm.GET("/km-summary", admin.GetKMSummary)
	adm.GET("/km-vehicle-summary", admin.GetVehicleKmSummary)
	adm.GET("/km-filters", admin.GetKmFilterMeta)
	adm.GET("/km-logs", admin.GetAdminKmLogs)
	adm.POST("/km-log/add", admin.AdminAddKmLog)
	adm.POST("/km-log/approve", admin.ApproveKmLog)
	adm.POST("/km-log/reject", admin.RejectKmLog)
	adm.GET("/km-logs/pending-count", admin.GetPendingKmLogsCount)
	adm.GET("/km-logs/fuel-by-vehicle", admin.GetFuelByVehicle)

	// Cluster Management
	adm.GET("/clusters", admin.GetClusters)
	adm.POST("/clusters/create", admin.CreateCluster)
	adm.POST("/clusters/create-with-schedule", admin.CreateClusterWithSchedule)
	adm.POST("/clusters/update", admin.UpdateCluster)
	adm.GET("/clusters/:id/members", admin.GetClusterMembers)
	adm.POST("/clusters/:id/add-member", admin.AddClusterMember)
	adm.DELETE("/clusters/:id/remove-member", admin.RemoveClusterMember)
	adm.POST("/clusters/assign-drivers", admin.AssignDriversToCluster)
	adm.POST("/clusters/assign-shift", admin.AssignClusterToShift)
	adm.DELETE("/clusters/delete", admin.DeleteCluster)

	// Vehicle Group Management
	adm.GET("/vehicle-groups", admin.GetVehicleGroups)
	adm.POST("/vehicle-groups/create", admin.CreateVehicleGroup)
	adm.PUT("/vehicle-groups/:id", admin.UpdateVehicleGroup)
	adm.DELETE("/vehicle-groups/:id", admin.DeleteVehicleGroup)
	adm.GET("/vehicle-groups/:id/details", admin.GetVehicleGroupDetails)
	adm.GET("/vehicle-groups/:id/members", admin.GetVehicleGroupMembers)
	adm.POST("/vehicle-groups/:id/add-member", admin.AddVehicleGroupMember)
	adm.DELETE("/vehicle-groups/:id/remove-member", admin.RemoveVehicleGroupMember)
	adm.POST("/vehicle-groups/:id/assign-vehicles", admin.AssignVehiclesToGroup)
	adm.POST("/vehicle-groups/:id/remove-vehicle", admin.RemoveVehicleFromGroup)

	// EV Vehicle Assignments
	adm.GET("/ev-vehicles", admin.GetEVVehicles)
	adm.GET("/ev-assignments", admin.GetEVAssignments)
	adm.GET("/ev-assignments/:id/details", admin.GetEVAssignmentDetails)
	adm.POST("/ev-assignments/create", admin.CreateEVAssignment)
	adm.POST("/ev-assignments/reassign", admin.ReassignEVAssignment)
	adm.DELETE("/ev-assignments/delete", admin.DeleteEVAssignment)

	// Bus Fleet Management
	adm.GET("/bus-fleet", bus.GetBusFleet)
	adm.GET("/bus/:id/stops", bus.GetBusStops)
	adm.POST("/bus-stop/add", bus.AddBusStop)
	adm.POST("/bus-stop/update", bus.UpdateBusStop)
	adm.POST("/bus-stop/delete", bus.DeleteBusStop)
	adm.POST("/bus-route/update", bus.UpdateBusRoute)

	// Fuel & Mileage
	adm.GET("/fuel-indents", admin.GetFuelIndents)
	adm.POST("/fuel-indents/create", admin.CreateFuelIndent)
	adm.POST("/fuel-indents/complete", admin.CompleteFuelIndent)
	adm.GET("/odometer-readings", admin.GetOdometerReadings)
	adm.POST("/odometer-readings/create", admin.CreateOdometerReading)

	// Vehicle Replacements (unified replacement system)
	adm.GET("/vehicle-replacements", admin.GetVehicleReplacements)
	adm.POST("/vehicle-replacements/create", admin.CreateVehicleReplacement)
	adm.POST("/vehicle-replacements/approve", admin.ApproveVehicleReplacement)
	adm.POST("/vehicle-replacements/reject", admin.RejectVehicleReplacement)
	adm.POST("/vehicle-replacements/complete", admin.CompleteVehicleReplacement)
	adm.POST("/vehicle-replacements/update", admin.UpdateVehicleReplacement)
	adm.POST("/vehicle-replacements/delete", admin.DeleteVehicleReplacement)
	adm.GET("/vehicle-replacements/available-vehicles", admin.GetAvailableReplacementVehiclesNew)
	adm.GET("/vehicle-replacements/pending-count", admin.GetPendingVehicleReplacementsCount)
	adm.POST("/vehicle-replacements/check-expired", admin.CheckExpiredVehicleReplacements)
	adm.GET("/vehicle-replacements/vehicle-drivers", admin.GetVehicleDriversNew)
	adm.GET("/vehicle-replacements/stats", admin.GetVehicleReplacementStats)
	adm.GET("/vehicle-replacements/available-drivers", admin.GetAvailableReplacementDrivers)
	adm.GET("/vehicle-replacements/driver-vehicle", admin.GetDriverVehicle)

	// Legacy FC replacement routes (redirect to new system)
	adm.GET("/fc-replacements", admin.GetVehicleReplacements)
	adm.GET("/fc-replacements/available-vehicles", admin.GetAvailableReplacementVehiclesNew)
	adm.GET("/fc-replacements/vehicle-drivers", admin.GetVehicleDriversNew)
	adm.GET("/fc-replacements/pending-count", admin.GetPendingVehicleReplacementsCount)

	// Notifications
	adm.GET("/notifications", admin.GetAdminNotifications)
	adm.POST("/notifications/:id/mark-read", admin.MarkAdminNotificationRead)
	adm.POST("/notifications/mark-all-read", admin.MarkAllAdminNotificationsRead)

	// Student Transport (Admin)
	adm.GET("/students", admin.GetAllStudents)
	adm.POST("/students/create", admin.CreateStudent)
	adm.DELETE("/students/delete", admin.DeleteStudent)
	adm.GET("/student-transport", admin.GetAllStudentTransport)
	adm.POST("/student-transport/assign", admin.AssignStudentTransport)
	adm.POST("/student-transport/update", admin.UpdateStudentTransport)
	adm.DELETE("/student-transport/delete", admin.DeleteStudentTransport)
	adm.GET("/transport-payments", admin.GetAllTransportPayments)
	adm.POST("/transport-payments/record", admin.RecordTransportPayment)
	adm.GET("/stop-change-requests", admin.GetAllStopChangeRequests)
	adm.POST("/stop-change-requests/process", admin.ProcessStopChangeRequest)
	adm.GET("/stop-change-requests/pending-count", admin.GetPendingStopChangeCount)

	// Transport Requests
	adm.GET("/transport-requests", admin.GetAllTransportRequests)
	adm.POST("/transport-requests/process", admin.ProcessTransportRequest)
	adm.POST("/transport-requests/fix-approved", admin.FixApprovedRequests)
	adm.GET("/transport-requests/pending-count", admin.GetPendingTransportRequestCount)

	// Students by Bus
	adm.GET("/buses/with-students", admin.GetBusesWithStudentCounts)
	adm.GET("/buses/:id/students", admin.GetStudentsByBus)

	// Vehicle Requests (Faculty Bookings - Admin side)
	adm.GET("/vehicle-requests", admin.GetAllVehicleRequests)
	adm.GET("/vehicle-request/:id", admin.GetVehicleRequestDetails)
	adm.POST("/vehicle-request/approve", admin.ApproveVehicleRequest)
	adm.POST("/vehicle-request/reject", admin.RejectVehicleRequest)
	adm.POST("/vehicle-request/cancel", admin.CancelVehicleRequestByAdmin)
	adm.POST("/vehicle-request/assign", admin.AssignVehicleToRequest)
	adm.POST("/vehicle-request/complete", admin.CompleteVehicleRequest)
	adm.GET("/vehicle-requests/pending-count", admin.GetPendingVehicleRequestCount)

	// Service & Repair
	adm.GET("/service-types", admin.GetServiceTypes)
	adm.POST("/service-types/create", admin.CreateServiceType)
	adm.POST("/service-types/update", admin.UpdateServiceType)
	adm.DELETE("/service-types/delete", admin.DeleteServiceType)

	adm.GET("/services", admin.GetAllServiceRecords)
	adm.GET("/services/stats", admin.GetServiceStats)
	adm.GET("/services/:id", admin.GetServiceRecordByID)
	adm.GET("/services/:id/linked-purchases", admin.GetLinkedPurchases)
	adm.POST("/services/create", admin.CreateServiceRecord)
	adm.POST("/services/update", admin.UpdateServiceRecord)
	adm.DELETE("/services/delete", admin.DeleteServiceRecord)
	adm.POST("/services/:id/approve", admin.ApproveServiceRequest)
	adm.POST("/services/:id/reject", admin.RejectServiceRequest)
	adm.POST("/services/:id/start", admin.StartServiceRecord)
	adm.POST("/services/:id/complete", admin.CompleteServiceRecord)
	adm.POST("/services/:id/cancel", admin.CancelServiceRecord)

	adm.GET("/services/:id/parts", admin.GetPartsByServiceRecord)
	adm.POST("/services/parts/add", admin.AddPart)
	adm.POST("/services/parts/add-bulk", admin.AddBulkParts)
	adm.POST("/services/parts/update", admin.UpdatePart)
	adm.POST("/services/parts/update-status", admin.UpdatePartStatus)
	adm.DELETE("/services/parts/delete", admin.DeletePart)
	adm.GET("/parts", admin.GetAllParts)
	adm.GET("/parts/expenditure", admin.GetPartsExpenditure)

	// Purchase Orders
	adm.GET("/purchase-orders", admin.GetAllPurchaseOrders)
	adm.GET("/purchase-orders/:id", admin.GetPurchaseOrderByID)
	adm.POST("/purchase-orders/create", admin.CreatePurchaseOrder)
	adm.POST("/purchase-orders/update", admin.UpdatePurchaseOrder)
	adm.POST("/purchase-orders/update-status", admin.UpdatePurchaseOrderStatus)
	adm.DELETE("/purchase-orders/delete", admin.DeletePurchaseOrder)
	adm.POST("/purchase-orders/add-product", admin.AddProductToOrder)
	adm.DELETE("/purchase-orders/remove-product", admin.RemoveProductFromOrder)

	// Purchase Order Invoice Upload
	adm.POST("/purchase-orders/:id/invoice", admin.UploadPurchaseInvoice)
	adm.GET("/purchase-orders/:id/invoice", admin.GetPurchaseInvoice)
	adm.DELETE("/purchase-orders/:id/invoice", admin.DeletePurchaseInvoice)

	// Vendors
	adm.GET("/vendors", admin.GetVendors)
	adm.GET("/vendors/:id", admin.GetVendorByID)
	adm.POST("/vendors/create", admin.CreateVendor)
	adm.POST("/vendors/update", admin.UpdateVendor)
	adm.DELETE("/vendors/delete", admin.DeleteVendor)

	adm.GET("/service-tracking", admin.GetServiceTracking)
	adm.POST("/service-tracking/update", admin.UpdateServiceTracking)
}

// registerDriverRoutes sets up all driver endpoints under /api/driver
func registerDriverRoutes(drv *gin.RouterGroup) {
	drv.GET("/profile", driver.GetDriverProfile)
	drv.GET("/assignment/today", driver.GetDriverTodayAssignment)
	drv.GET("/assignments/today", driver.GetDriverTodayAssignments)
	drv.GET("/assignments", driver.GetDriverAssignments)

	// KM Logs
	drv.GET("/km-logs", driver.GetDriverKmLogs)
	drv.POST("/km-log/add", driver.AddDriverKmLog)
	drv.GET("/vehicle-last-log", driver.GetLastLogForVehicle)

	// Leave
	drv.POST("/leave/apply", driver.ApplyLeave)
	drv.GET("/leave", driver.GetMyLeaveRequests)

	// Alerts
	drv.GET("/vehicles/alerts", driver.GetDriverVehicleAlerts)

	// Notifications
	drv.GET("/notifications", driver.GetDriverNotifications)
	drv.GET("/notifications/unread-count", driver.GetUnreadNotificationCount)
	drv.POST("/notifications/:id/mark-read", driver.MarkNotificationRead)
	drv.POST("/notifications/mark-all-read", driver.MarkAllNotificationsRead)

	// Vehicle Requests (Faculty Bookings assigned to driver)
	drv.GET("/vehicle-requests", driver.GetDriverVehicleRequests)
	drv.GET("/vehicle-requests/upcoming", driver.GetDriverUpcomingVehicleRequests)
	drv.POST("/vehicle-request/verify-start-otp", driver.VerifyStartOTP)
	drv.POST("/vehicle-request/verify-end-otp", driver.VerifyEndOTP)

	// Service & Repair (Driver)
	drv.GET("/service-types", admin.GetServiceTypes)
	drv.POST("/services/report", driver.ReportIssue)
	drv.GET("/services/my-requests", driver.GetMyServiceRequests)
	drv.GET("/services/vehicle-history", driver.GetVehicleServiceHistory)
}

// registerStudentRoutes sets up all student endpoints under /api/student
func registerStudentRoutes(stu *gin.RouterGroup) {
	stu.GET("/buses", bus.GetBusFleet)
	stu.GET("/bus/:id/stops", student.GetBusStopsForStudent)
	stu.GET("/transport", student.GetMyTransport)
	stu.GET("/transport/payments", student.GetMyPayments)
	stu.GET("/transport/requests", student.GetMyTransportRequests)
	stu.POST("/transport/request", student.RequestTransport)
	stu.POST("/stop-change/request", student.RequestStopChange)
	stu.POST("/stop-change/request/cancel", student.CancelStopChangeRequest)
	stu.GET("/stop-change/requests", student.GetMyStopChangeRequests)
	stu.GET("/available-stops", student.GetAvailableStops)
	stu.GET("/all-buses", student.GetAllBuses)
}

// registerFacultyRoutes sets up all faculty endpoints under /api/faculty
func registerFacultyRoutes(fac *gin.RouterGroup) {
	fac.GET("/profile", faculty.GetFacultyProfile)
	fac.POST("/profile/update", faculty.UpdateFacultyProfile)

	// Vehicle Booking
	fac.POST("/vehicle-request", faculty.CreateVehicleRequest)
	fac.GET("/vehicle-requests", faculty.GetMyVehicleRequests)
	fac.POST("/vehicle-request/cancel", faculty.CancelVehicleRequest)
	fac.GET("/vehicle-request/:id/otp", faculty.GetVehicleRequestOTP)
}
