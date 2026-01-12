package models

/* =========================
   AUTH & ADMIN MODELS
========================= */

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SetupRequest struct {
	Password string `json:"password"`
}

type PasswordChange struct {
	NewPassword string `json:"new_password"`
}

type AdminProfile struct {
	Username     string `json:"username"`
	FullName     string `json:"full_name"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	ProfileImage string `json:"profile_image"`
}

/* =========================
   DRIVER MODELS
========================= */

type CreateDriverRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`

	LicenseNumber   string `json:"license_number"`
	LicenseType     string `json:"license_type"`
	LicenseExpiry   string `json:"license_expiry"`
	ExperienceYears int    `json:"experience_years"`

	AllowedVehicleType string `json:"allowed_vehicle_type"`
	HomeVehicleID      *int   `json:"home_vehicle_id"`
	HomeStopID         *int   `json:"home_stop_id"`
	IsIncharge         bool   `json:"is_incharge"`
}

type DriverResponse struct {
	ID              int    `json:"id"`
	UserID          int    `json:"user_id"`
	FullName        string `json:"full_name"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	LicenseNumber   string `json:"license_number"`
	LicenseType     string `json:"license_type"`
	LicenseExpiry   string `json:"license_expiry"`
	ExperienceYears int    `json:"experience_years"`
	HomeVehicleID   *int   `json:"home_vehicle_id"`
	HomeStopID      *int   `json:"home_stop_id"`
	IsIncharge      bool   `json:"is_incharge"`
	Status          string `json:"status"`
	ClusterID       *int   `json:"cluster_id"`
	ClusterName     string `json:"cluster_name"`
}

/* =========================
   VEHICLE MODELS
========================= */

type Vehicle struct {
	ID              int    `json:"id"`
	VehicleNumber   string `json:"vehicle_number"`
	VehicleType     string `json:"vehicle_type"`
	FuelType        string `json:"fuel_type"`
	SeatingCapacity int    `json:"seating_capacity"`
	Status          string `json:"status"`
}

type CreateVehicleRequest struct {
	VehicleNumber   string `json:"vehicle_number"`
	VehicleType     string `json:"vehicle_type"`
	FuelType        string `json:"fuel_type"`
	SeatingCapacity int    `json:"seating_capacity"`
	// Bus-specific fields
	BusName    string `json:"bus_name"`
	StartPoint string `json:"start_point"`
	EndPoint   string `json:"end_point"`
}

/* =========================
   STOP MODELS
========================= */

type Stop struct {
	ID       int    `json:"id"`
	StopName string `json:"stop_name"`
	Location string `json:"location"`
}

type CreateStopRequest struct {
	StopName string `json:"stop_name"`
	Location string `json:"location"`
}

/* =========================
   SHIFT MODELS
========================= */

type Shift struct {
	ID          int         `json:"id"`
	Name        string      `json:"name"`
	StartTime   string      `json:"start_time"`
	EndTime     string      `json:"end_time"`
	Description string      `json:"description"`
	CreatedBy   *int        `json:"created_by"`
	Slots       []ShiftSlot `json:"slots,omitempty"`
}

type CreateShiftRequest struct {
	Name        string `json:"name"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Description string `json:"description"`
}

type ShiftSlot struct {
	ID        int    `json:"id"`
	ShiftID   int    `json:"shift_id"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	SlotOrder int    `json:"slot_order"`
}

type SlotInput struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

type CreateShiftWithSlotsRequest struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Slots       []SlotInput `json:"slots"`
}

/* =========================
   ASSIGNMENT MODELS
========================= */

type Assignment struct {
	ID                     int    `json:"id"`
	ShiftID                int    `json:"shift_id"`
	VehicleID              int    `json:"vehicle_id"`
	DriverID               int    `json:"driver_id"`
	AssignedDate           string `json:"assigned_date"`
	StartDate              string `json:"start_date"`
	EndDate                string `json:"end_date"`
	Status                 string `json:"status"`
	IsTemporaryReplacement bool   `json:"is_temporary_replacement"`
	OriginalDriverID       *int   `json:"original_driver_id"`
	CreatedBy              *int   `json:"created_by"`
	// Joined fields
	ShiftName          string `json:"shift_name"`
	StartTime          string `json:"start_time"`
	EndTime            string `json:"end_time"`
	VehicleNumber      string `json:"vehicle_number"`
	VehicleType        string `json:"vehicle_type"`
	DriverName         string `json:"driver_name"`
	OriginalDriverName string `json:"original_driver_name"`
	DriverStatus       string `json:"driver_status"`
}

type CreateAssignmentRequest struct {
	ShiftID                int    `json:"shift_id"`
	VehicleID              int    `json:"vehicle_id"`
	DriverID               int    `json:"driver_id"`
	StartDate              string `json:"start_date"`
	EndDate                string `json:"end_date"`
	VehicleCategory        string `json:"vehicle_category"` // BUS, CAR
	IsTemporaryReplacement bool   `json:"is_temporary_replacement"`
	OriginalDriverID       *int   `json:"original_driver_id"`
	// If true, create even when a time conflict exists
	ForceAssign bool `json:"force_assign"`
}

// TemporaryAssignment - Separate table for temporary driver replacements
type TemporaryAssignment struct {
	ID                  int    `json:"id"`
	OriginalDriverID    int    `json:"original_driver_id"`
	ReplacementDriverID int    `json:"replacement_driver_id"`
	ShiftID             int    `json:"shift_id"`
	VehicleID           int    `json:"vehicle_id"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	Reason              string `json:"reason"`
	Status              string `json:"status"`
	CreatedAt           string `json:"created_at"`
	// Joined fields
	OriginalDriverName    string `json:"original_driver_name"`
	ReplacementDriverName string `json:"replacement_driver_name"`
	ShiftName             string `json:"shift_name"`
	StartTime             string `json:"start_time"`
	EndTime               string `json:"end_time"`
	VehicleNumber         string `json:"vehicle_number"`
	VehicleType           string `json:"vehicle_type"`
}

type CreateTemporaryAssignmentRequest struct {
	OriginalDriverID    int    `json:"original_driver_id"`
	ReplacementDriverID int    `json:"replacement_driver_id"`
	ShiftID             int    `json:"shift_id"`
	VehicleID           int    `json:"vehicle_id"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	Reason              string `json:"reason"`
}

/* =========================
   DUTY MODELS
========================= */

type Duty struct {
	ID           int     `json:"id"`
	AssignmentID int     `json:"assignment_id"`
	RouteFrom    string  `json:"route_from"`
	RouteTo      string  `json:"route_to"`
	StartTime    *string `json:"start_time"`
	EndTime      *string `json:"end_time"`
	Status       string  `json:"status"`
	ApprovedBy   *int    `json:"approved_by"`
	ApprovedAt   *string `json:"approved_at"`
}

type CreateDutyRequest struct {
	AssignmentID int    `json:"assignment_id"`
	RouteFrom    string `json:"route_from"`
	RouteTo      string `json:"route_to"`
	StartTime    string `json:"start_time"`
	EndTime      string `json:"end_time"`
}

/* =========================
   ATTENDANCE MODELS
========================= */

type Attendance struct {
	ID           int     `json:"id"`
	UserID       int     `json:"user_id"`
	Date         string  `json:"date"`
	Status       string  `json:"status"`
	CheckinTime  *string `json:"checkin_time"`
	CheckoutTime *string `json:"checkout_time"`
	// Joined
	FullName string `json:"full_name"`
}

type MarkAttendanceRequest struct {
	UserID      int    `json:"user_id"`
	Date        string `json:"date"`
	Status      string `json:"status"`
	CheckinTime string `json:"checkin_time"`
}

// Buse Fleet

type Bus struct {
	ID        int    `json:"id"`
	VehicleID int    `json:"vehicle_id"`
	BusName   string `json:"bus_name"`
	Start     string `json:"start_point"`
	End       string `json:"end_point"`
	// Joined fields from vehicles
	VehicleNumber   string `json:"vehicle_number"`
	SeatingCapacity int    `json:"seating_capacity"`
	Status          string `json:"status"`
}

type BusStopMap struct {
	ID            int    `json:"id"`
	BusID         int    `json:"bus_id"`
	StopID        int    `json:"stop_id"`
	StopOrder     int    `json:"stop_order"`
	ArrivalTime   string `json:"arrival_time"`
	DepartureTime string `json:"departure_time"`
	// Joined
	StopName string `json:"stop_name"`
	Location string `json:"location"`
}

type AddBusStopRequest struct {
	BusID         int    `json:"bus_id"`
	StopID        int    `json:"stop_id"`
	StopOrder     int    `json:"stop_order"`
	ArrivalTime   string `json:"arrival_time"`
	DepartureTime string `json:"departure_time"`
}

// Stats

type DashboardStats struct {
	TotalDrivers    int `json:"total_drivers"`
	PresentDrivers  int `json:"present_drivers"`
	AbsentDrivers   int `json:"absent_drivers"`
	TotalVehicles   int `json:"total_vehicles"`
	ActiveDuties    int `json:"active_duties"`
	ActiveRoutes    int `json:"active_routes"`
	PendingRequests int `json:"pending_requests"`
	PendingLeaves   int `json:"pending_leaves"`
}

/* =========================
   FUEL & MILEAGE MODELS
========================= */

type FuelIndent struct {
	ID              int     `json:"id"`
	VehicleID       int     `json:"vehicle_id"`
	DriverID        int     `json:"driver_id"`
	FuelRequested   float64 `json:"fuel_requested"`
	FuelFilled      float64 `json:"fuel_filled"`
	OdometerReading int     `json:"odometer_reading"`
	Status          string  `json:"status"` // pending, completed, rejected
	RequestedAt     string  `json:"requested_at"`
	CompletedAt     *string `json:"completed_at"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type CreateFuelIndentRequest struct {
	VehicleID       int     `json:"vehicle_id"`
	DriverID        int     `json:"driver_id"`
	FuelRequested   float64 `json:"fuel_requested"`
	OdometerReading int     `json:"odometer_reading"`
}

type CompleteFuelIndentRequest struct {
	IndentID   int     `json:"indent_id"`
	FuelFilled float64 `json:"fuel_filled"`
}

type OdometerReading struct {
	ID          int     `json:"id"`
	VehicleID   int     `json:"vehicle_id"`
	DriverID    int     `json:"driver_id"`
	FromReading int     `json:"from_reading"`
	ToReading   int     `json:"to_reading"`
	FuelUsed    float64 `json:"fuel_used"`
	RecordedAt  string  `json:"recorded_at"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type CreateOdometerReadingRequest struct {
	VehicleID   int     `json:"vehicle_id"`
	DriverID    int     `json:"driver_id"`
	FromReading int     `json:"from_reading"`
	ToReading   int     `json:"to_reading"`
	FuelUsed    float64 `json:"fuel_used"`
}
