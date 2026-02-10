package models

import "time"

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
	DateOfJoining   string `json:"date_of_joining"`
	DateOfRelieving string `json:"date_of_relieving"`

	AllowedVehicleType string `json:"allowed_vehicle_type"`
	HomeVehicleID      *int   `json:"home_vehicle_id"`
	HomeStopID         *int   `json:"home_stop_id"`
	IsIncharge         bool   `json:"is_incharge"`
}

type DriverResponse struct {
	ID                 int    `json:"id"`
	UserID             int    `json:"user_id"`
	FullName           string `json:"full_name"`
	Role               string `json:"role"`
	Phone              string `json:"phone"`
	Email              string `json:"email"`
	LicenseNumber      string `json:"license_number"`
	LicenseType        string `json:"license_type"`
	LicenseExpiry      string `json:"license_expiry"`
	ExperienceYears    int    `json:"experience_years"`
	DateOfJoining      string `json:"date_of_joining"`
	DateOfRelieving    string `json:"date_of_relieving"`
	AllowedVehicleType string `json:"allowed_vehicle_type"`
	HomeVehicleID      *int   `json:"home_vehicle_id"`
	HomeStopID         *int   `json:"home_stop_id"`
	IsIncharge         bool   `json:"is_incharge"`
	Status             string `json:"status"`
	ClusterID          *int   `json:"cluster_id"`
	ClusterName        string `json:"cluster_name"`
}

/* =========================
   VEHICLE MODELS
========================= */

type Vehicle struct {
	ID                  int     `json:"id"`
	VehicleNumber       string  `json:"vehicle_number"`
	VehicleType         string  `json:"vehicle_type"`
	FuelType            string  `json:"fuel_type"`
	SeatingCapacity     int     `json:"seating_capacity"`
	Status              string  `json:"status"`
	InsuranceExpireDate *string `json:"insurance_expire_date"`
	FCExpireDate        *string `json:"fc_expire_date"`
	PermitExpireDate    *string `json:"permit_expire_date"`
	VehicleName         string  `json:"vehicle_name"`
	StartPoint          string  `json:"start_point"`
	EndPoint            string  `json:"end_point"`
}

type CreateVehicleRequest struct {
	VehicleNumber       string  `json:"vehicle_number"`
	VehicleType         string  `json:"vehicle_type"`
	FuelType            string  `json:"fuel_type"`
	SeatingCapacity     int     `json:"seating_capacity"`
	InsuranceExpireDate *string `json:"insurance_expire_date"`
	FCExpireDate        *string `json:"fc_expire_date"`
	PermitExpireDate    *string `json:"permit_expire_date"`
	// Vehicle-specific fields
	VehicleName string `json:"vehicle_name"`
	StartPoint  string `json:"start_point"`
	EndPoint    string `json:"end_point"`
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
	CreatedBy *int   `json:"created_by,omitempty"`
}

type SlotInput struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

type CreateShiftWithSlotsRequest struct {
	ID          int         `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	StartTime   string      `json:"start_time"`
	EndTime     string      `json:"end_time"`
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
	CreatedAt              string `json:"created_at,omitempty"`
	Description            string `json:"description,omitempty"`
	// Joined fields
	ShiftName          string `json:"shift_name"`
	StartTime          string `json:"start_time"`
	EndTime            string `json:"end_time"`
	VehicleNumber      string `json:"vehicle_number"`
	VehicleType        string `json:"vehicle_type"`
	VehicleName        string `json:"vehicle_name"`
	DriverName         string `json:"driver_name"`
	OriginalDriverName string `json:"original_driver_name"`
	DriverStatus       string `json:"driver_status"`
	CreatedByName      string `json:"created_by_name"`
}

type CreateAssignmentRequest struct {
	ShiftID                int    `json:"shift_id"`
	VehicleID              int    `json:"vehicle_id"`
	DriverID               int    `json:"driver_id"`
	StartDate              string `json:"start_date"`
	EndDate                string `json:"end_date"`
	IsTemporaryReplacement bool   `json:"is_temporary_replacement"`
	OriginalDriverID       *int   `json:"original_driver_id"`
	CreatedBy              *int   `json:"created_by,omitempty"`
	// If true, create even when a time conflict exists
	ForceAssign bool   `json:"force_assign"`
	Description string `json:"description"` // Assignment description
}

// TemporaryAssignment - Separate table for temporary driver replacements
type TemporaryAssignment struct {
	ID                  int    `json:"id"`
	OriginalDriverID    int    `json:"original_driver_id"`
	ReplacementDriverID *int   `json:"replacement_driver_id"`
	ShiftID             *int   `json:"shift_id"`
	VehicleID           int    `json:"vehicle_id"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	Reason              string `json:"reason"`
	Status              string `json:"status"`
	CreatedAt           string `json:"created_at"`
	// Joined fields
	OriginalDriverName    string      `json:"original_driver_name"`
	ReplacementDriverName string      `json:"replacement_driver_name"`
	ShiftName             string      `json:"shift_name"`
	StartTime             string      `json:"start_time"`
	EndTime               string      `json:"end_time"`
	Slots                 []ShiftSlot `json:"slots,omitempty"`
	VehicleNumber         string      `json:"vehicle_number"`
	VehicleType           string      `json:"vehicle_type"`
	VehicleName           string      `json:"vehicle_name"`
}

type CreateTemporaryAssignmentRequest struct {
	OriginalDriverID    int    `json:"original_driver_id"`
	ReplacementDriverID int    `json:"replacement_driver_id"`
	ShiftID             *int   `json:"shift_id"`
	VehicleID           int    `json:"vehicle_id"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	Reason              string `json:"reason"`
	CreatedBy           *int   `json:"created_by,omitempty"`
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
	FullName             string  `json:"full_name"`
	MarkedByInchargeID   *int    `json:"marked_by_incharge_id"`
	MarkedByInchargeName *string `json:"marked_by_incharge_name"`
}

type MarkAttendanceRequest struct {
	UserID      int    `json:"user_id"`
	Date        string `json:"date"`
	Status      string `json:"status"`
	CheckinTime string `json:"checkin_time"`
}

// Buse Fleet

type Bus struct {
	ID          int    `json:"id"`
	VehicleID   int    `json:"vehicle_id"`
	VehicleName string `json:"vehicle_name"`
	Start       string `json:"start_point"`
	End         string `json:"end_point"`
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

/* =========================
   STUDENT TRANSPORT MODELS
========================= */

// TransportFee - Fee structure for each stop
type TransportFee struct {
	ID           int     `json:"id"`
	StopID       int     `json:"stop_id"`
	StopName     string  `json:"stop_name"`
	FeeAmount    float64 `json:"fee_amount"`
	AcademicYear string  `json:"academic_year"`
	IsActive     bool    `json:"is_active"`
}

type CreateTransportFeeRequest struct {
	StopID       int     `json:"stop_id"`
	FeeAmount    float64 `json:"fee_amount"`
	AcademicYear string  `json:"academic_year"`
}

type UpdateTransportFeeRequest struct {
	ID        int     `json:"id"`
	FeeAmount float64 `json:"fee_amount"`
}

// StudentTransport - Student's transport assignment
type StudentTransport struct {
	ID            int     `json:"id"`
	UserID        int     `json:"user_id"`
	StudentName   string  `json:"student_name"`
	StudentEmail  string  `json:"student_email"`
	BusID         int     `json:"bus_id"`
	VehicleName   string  `json:"vehicle_name"`
	BusNumber     string  `json:"bus_number"`
	RouteStart    string  `json:"route_start"`
	RouteEnd      string  `json:"route_end"`
	StopID        int     `json:"stop_id"`
	StopName      string  `json:"stop_name"`
	StopLocation  string  `json:"stop_location"`
	TotalFee      float64 `json:"total_fee"`
	PaidAmount    float64 `json:"paid_amount"`
	Balance       float64 `json:"balance"`
	AcademicYear  string  `json:"academic_year"`
	Status        string  `json:"status"`
	ArrivalTime   string  `json:"arrival_time"`
	DepartureTime string  `json:"departure_time"`
}

type AssignStudentTransportRequest struct {
	UserID       int    `json:"user_id"`
	BusID        int    `json:"bus_id"`
	StopID       int    `json:"stop_id"`
	AcademicYear string `json:"academic_year"`
}

type UpdateStudentTransportRequest struct {
	ID     int    `json:"id"`
	BusID  int    `json:"bus_id"`
	StopID int    `json:"stop_id"`
	Status string `json:"status"`
}

// TransportPayment - Payment records
type TransportPayment struct {
	ID                 int     `json:"id"`
	StudentTransportID int     `json:"student_transport_id"`
	StudentName        string  `json:"student_name"`
	Amount             float64 `json:"amount"`
	PaymentDate        string  `json:"payment_date"`
	PaymentMethod      string  `json:"payment_method"`
	TransactionID      string  `json:"transaction_id"`
	ReceiptNumber      string  `json:"receipt_number"`
	Remarks            string  `json:"remarks"`
	RecordedBy         int     `json:"recorded_by"`
	RecordedByName     string  `json:"recorded_by_name"`
}

type RecordPaymentRequest struct {
	StudentTransportID int     `json:"student_transport_id"`
	Amount             float64 `json:"amount"`
	PaymentDate        string  `json:"payment_date"`
	PaymentMethod      string  `json:"payment_method"`
	TransactionID      string  `json:"transaction_id"`
	ReceiptNumber      string  `json:"receipt_number"`
	Remarks            string  `json:"remarks"`
}

// StopChangeRequest - Student request to change stop
type StopChangeRequest struct {
	ID                 int     `json:"id"`
	StudentTransportID int     `json:"student_transport_id"`
	StudentName        string  `json:"student_name"`
	StudentEmail       string  `json:"student_email"`
	CurrentStopID      int     `json:"current_stop_id"`
	CurrentStopName    string  `json:"current_stop_name"`
	RequestedStopID    int     `json:"requested_stop_id"`
	RequestedStopName  string  `json:"requested_stop_name"`
	CurrentFee         float64 `json:"current_fee"`
	NewFee             float64 `json:"new_fee"`
	FeeDifference      float64 `json:"fee_difference"`
	Reason             string  `json:"reason"`
	Status             string  `json:"status"`
	AdminRemarks       string  `json:"admin_remarks"`
	ProcessedBy        *int    `json:"processed_by"`
	ProcessedByName    string  `json:"processed_by_name"`
	ProcessedAt        *string `json:"processed_at"`
	CreatedAt          string  `json:"created_at"`
}

type CreateStopChangeRequest struct {
	RequestedStopID int    `json:"requested_stop_id"`
	Reason          string `json:"reason"`
}

type ProcessStopChangeRequest struct {
	RequestID    int    `json:"request_id"`
	Status       string `json:"status"` // approved or rejected
	AdminRemarks string `json:"admin_remarks"`
}

type CancelStopChangeRequest struct {
	RequestID int `json:"request_id"`
}

// StudentListItem - For admin dropdown
type StudentListItem struct {
	ID           int    `json:"id"`
	UserID       int    `json:"user_id"`
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	HasTransport bool   `json:"has_transport"`
}

// CreateStudentRequest - For admin to create students
type CreateStudentRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	FullName   string `json:"full_name"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	Department string `json:"department"`
	Year       int    `json:"year"`
	RollNumber string `json:"roll_number"`
}

// TransportRequest - Student requesting bus/stop assignment
type TransportRequest struct {
	ID           int        `json:"id"`
	UserID       int        `json:"user_id"`
	BusID        int        `json:"bus_id"`
	StopID       int        `json:"stop_id"`
	AcademicYear string     `json:"academic_year"`
	Reason       string     `json:"reason"`
	Status       string     `json:"status"`
	AdminRemarks string     `json:"admin_remarks"`
	ProcessedBy  int        `json:"processed_by"`
	ProcessedAt  *time.Time `json:"processed_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Joined fields
	StudentName string  `json:"student_name"`
	Email       string  `json:"email"`
	Phone       string  `json:"phone"`
	Department  string  `json:"department"`
	Year        int     `json:"year"`
	RollNumber  string  `json:"roll_number"`
	VehicleName string  `json:"vehicle_name"`
	Route       string  `json:"route"`
	StopName    string  `json:"stop_name"`
	Fee         float64 `json:"fee"`
}

type CreateTransportRequest struct {
	BusID        int    `json:"bus_id"`
	StopID       int    `json:"stop_id"`
	AcademicYear string `json:"academic_year"`
	Reason       string `json:"reason"`
}

type ProcessTransportRequest struct {
	RequestID    int    `json:"request_id"`
	Status       string `json:"status"` // approved or rejected
	AdminRemarks string `json:"admin_remarks"`
}

/* =========================
   FACULTY MODELS
========================= */

// Faculty - Faculty user profile
type Faculty struct {
	ID          int    `json:"id"`
	UserID      int    `json:"user_id"`
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Department  string `json:"department"`
	Designation string `json:"designation"`
}

type CreateFacultyRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Department  string `json:"department"`
	Designation string `json:"designation"`
}

type UpdateFacultyRequest struct {
	ID          int    `json:"id"`
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Department  string `json:"department"`
	Designation string `json:"designation"`
}

/* =========================
   VEHICLE BOOKING/REQUEST MODELS
========================= */

// VehicleRequest - Faculty vehicle booking request
// VehicleRequest - Faculty vehicle booking request (using vehiclerequests table)
type VehicleRequest struct {
	ID        int `json:"id"`
	FacultyID int `json:"faculty_id"`

	// Booking Details
	BookingType  string `json:"booking_type"`
	TripType     string `json:"trip_type"`
	TripMode     string `json:"trip_mode"`
	RequestUnder string `json:"request_under"`
	Vertical     string `json:"vertical"`
	OralApproval bool   `json:"oral_approval"`
	Purpose      string `json:"purpose"`
	CountPerson  int    `json:"count_person"`

	// Onward Trip
	OnwardFromPlace    string `json:"onward_from_place"`
	OnwardToPlace      string `json:"onward_to_place"`
	OnwardFromDateTime string `json:"onward_from_datetime"`
	OnwardToDateTime   string `json:"onward_to_datetime"`

	// Return Trip (for round trip)
	ReturnFromPlace    string `json:"return_from_place"`
	ReturnToPlace      string `json:"return_to_place"`
	ReturnFromDateTime string `json:"return_from_datetime"`
	ReturnToDateTime   string `json:"return_to_datetime"`

	// Contact Info
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`

	// Task and Outcome fields
	TaskID           string `json:"task_id"`
	OutcomeExpected  string `json:"outcome_expected"`
	OutcomeAuditable string `json:"outcome_auditable"`

	// Assignment
	VehicleID *int `json:"vehicle_id"`
	DriverID  *int `json:"driver_id"`

	// Status and Approval
	Status       string  `json:"status"`
	AdminRemarks string  `json:"admin_remarks"`
	ApprovedBy   *int    `json:"approved_by"`
	ApprovedAt   *string `json:"approved_at"`
	AssignedAt   *string `json:"assigned_at"`
	CreatedAt    string  `json:"created_at"`

	// OTP fields for trip verification
	StartOTP            string  `json:"start_otp,omitempty"`
	EndOTP              string  `json:"end_otp,omitempty"`
	StartOTPGeneratedAt *string `json:"start_otp_generated_at,omitempty"`
	EndOTPGeneratedAt   *string `json:"end_otp_generated_at,omitempty"`
	TripStartedAt       *string `json:"trip_started_at,omitempty"`
	TripEndedAt         *string `json:"trip_ended_at,omitempty"`

	// Joined fields
	FacultyName       string `json:"faculty_name"`
	FacultyEmail      string `json:"faculty_email"`
	FacultyPhone      string `json:"faculty_phone"`
	FacultyDepartment string `json:"faculty_department"`
	VehicleNumber     string `json:"vehicle_number"`
	VehicleType       string `json:"vehicle_type"`
	VehicleName       string `json:"vehicle_name"`
	DriverName        string `json:"driver_name"`
	DriverPhone       string `json:"driver_phone"`
}

// CreateVehicleRequestInput - Input for creating a vehicle request
type CreateVehicleRequestInput struct {
	BookingType  string `json:"booking_type"`
	TripType     string `json:"trip_type"`
	TripMode     string `json:"trip_mode"`
	RequestUnder string `json:"request_under"`
	Vertical     string `json:"vertical"`
	OralApproval bool   `json:"oral_approval"`
	Purpose      string `json:"purpose"`
	// Legacy/DB-aligned aliases (optional)
	PurposeOfVisit string `json:"purpose_of_visit"`
	CountPerson    int    `json:"count_person"`

	// Onward Trip
	OnwardFromPlace    string `json:"onward_from_place"`
	OnwardToPlace      string `json:"onward_to_place"`
	OnwardFromDateTime string `json:"onward_from_datetime"`
	OnwardToDateTime   string `json:"onward_to_datetime"`

	// Return Trip (for round trip)
	ReturnFromPlace    string `json:"return_from_place"`
	ReturnToPlace      string `json:"return_to_place"`
	ReturnFromDateTime string `json:"return_from_datetime"`
	ReturnToDateTime   string `json:"return_to_datetime"`

	// Contact Info
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`

	// Legacy/DB-aligned optional fields
	MobileNumber     string `json:"mobile_number"`
	GuestName        string `json:"guest_name"`
	Address          string `json:"address"`
	TaskID           string `json:"task_id"`
	OutcomeExpected  string `json:"outcome_expected"`
	OutcomeAuditable string `json:"outcome_auditable"`
}

// AssignVehicleRequestInput - Input for assigning vehicle and driver to a request
type AssignVehicleRequestInput struct {
	RequestID int `json:"request_id"`
	VehicleID int `json:"vehicle_id"`
	DriverID  int `json:"driver_id"`
}
