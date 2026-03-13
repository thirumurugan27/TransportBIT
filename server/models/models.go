package models

import "time"

/*
	=========================
	  AUTH & ADMIN MODELS

========================
*/
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

/*
	=========================
	  DRIVER MODELS

=========================
*/
type CreateDriverRequest struct {
	Username           string `json:"username"`
	Password           string `json:"password"`
	FullName           string `json:"full_name"`
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
	Status             string `json:"status"`
	ClusterID          *int   `json:"cluster_id"`
	ClusterName        string `json:"cluster_name"`
}

type BulkDriverSheetRequest struct {
	SheetURL string `json:"sheet_url"`
}

type BulkDriverPreviewRow struct {
	RowNumber          int      `json:"row_number"`
	FullName           string   `json:"full_name"`
	Phone              string   `json:"phone"`
	Email              string   `json:"email"`
	LicenseNumber      string   `json:"license_number"`
	LicenseType        string   `json:"license_type"`
	LicenseExpiry      string   `json:"license_expiry"`
	ExperienceYears    int      `json:"experience_years"`
	DateOfJoining      string   `json:"date_of_joining"`
	DateOfRelieving    string   `json:"date_of_relieving"`
	AllowedVehicleType string   `json:"allowed_vehicle_type"`
	Errors             []string `json:"errors"`
	IsValid            bool     `json:"is_valid"`
}

type BulkDriverSheetPreviewResponse struct {
	SheetURL        string                 `json:"sheet_url"`
	CSVURL          string                 `json:"csv_url"`
	TotalRows       int                    `json:"total_rows"`
	ReadyRows       int                    `json:"ready_rows"`
	InvalidRows     int                    `json:"invalid_rows"`
	RequiredHeaders []string               `json:"required_headers"`
	Rows            []BulkDriverPreviewRow `json:"rows"`
}

type BulkDriverImportResponse struct {
	Message      string                         `json:"message"`
	CreatedCount int                            `json:"created_count"`
	FailedCount  int                            `json:"failed_count"`
	Preview      BulkDriverSheetPreviewResponse `json:"preview"`
}

/*
	=========================
	  VEHICLE MODELS

=========================
*/
type Vehicle struct {
	ID                  int      `json:"id"`
	VehicleNumber       string   `json:"vehicle_number"`
	VehicleType         string   `json:"vehicle_type"`
	FuelType            string   `json:"fuel_type"`
	SeatingCapacity     int      `json:"seating_capacity"`
	Status              string   `json:"status"`
	VehicleName         string   `json:"vehicle_name"`
	StartPoint          string   `json:"start_point"`
	EndPoint            string   `json:"end_point"`
	ChassisNumber       *string  `json:"chassis_number"`
	EngineNumber        *string  `json:"engine_number"`
	PermitNumber        *string  `json:"permit_number"`
	AdditionalPermit    *string  `json:"additional_permit"`
	InsuranceAmount     *float64 `json:"insurance_amount"`
	RoadTaxAmount       *float64 `json:"road_tax_amount"`
	PollutionExpire     *string  `json:"pollution_expire"`
	GreenTaxExpire      *string  `json:"green_tax_expire"`
	MVTaxExpire         *string  `json:"mv_tax_expire"`
	InsuranceExpireDate *string  `json:"insurance_expire_date"`
	InsuranceStartDate  *string  `json:"insurance_start_date"`
	FCExpireDate        *string  `json:"fc_expire_date"`
	FCStartDate         *string  `json:"fc_start_date"`
	PermitExpireDate    *string  `json:"permit_expire_date"`
	PermitStartDate     *string  `json:"permit_start_date"`
}
type CreateVehicleRequest struct {
	VehicleNumber   string `json:"vehicle_number"`
	VehicleType     string `json:"vehicle_type"`
	FuelType        string `json:"fuel_type"`
	SeatingCapacity int    `json:"seating_capacity"`
	// Vehicle-specific fields
	VehicleName string `json:"vehicle_name"`
	StartPoint  string `json:"start_point"`
	EndPoint    string `json:"end_point"`
	// Additional vehicle details
	ChassisNumber    *string  `json:"chassis_number"`
	EngineNumber     *string  `json:"engine_number"`
	PermitNumber     *string  `json:"permit_number"`
	AdditionalPermit *string  `json:"additional_permit"`
	InsuranceAmount  *float64 `json:"insurance_amount"`
	RoadTaxAmount    *float64 `json:"road_tax_amount"`
	PollutionExpire  *string  `json:"pollution_expire"`
	GreenTaxExpire   *string  `json:"green_tax_expire"`
	MVTaxExpire      *string  `json:"mv_tax_expire"`
	// Document fields (optional at creation)
	InsuranceExpireDate *string `json:"insurance_expire_date"`
	InsuranceStartDate  *string `json:"insurance_start_date"`
	FCExpireDate        *string `json:"fc_expire_date"`
	FCStartDate         *string `json:"fc_start_date"`
	PermitExpireDate    *string `json:"permit_expire_date"`
	PermitStartDate     *string `json:"permit_start_date"`
}
type BulkVehiclePreviewRow struct {
	RowNumber        int      `json:"row_number"`
	VehicleNumber    string   `json:"vehicle_number"`
	VehicleType      string   `json:"vehicle_type"`
	FuelType         string   `json:"fuel_type"`
	SeatingCapacity  int      `json:"seating_capacity"`
	VehicleName      string   `json:"vehicle_name"`
	StartPoint       string   `json:"start_point"`
	EndPoint         string   `json:"end_point"`
	ChassisNumber    string   `json:"chassis_number"`
	EngineNumber     string   `json:"engine_number"`
	PermitNumber     string   `json:"permit_number"`
	AdditionalPermit string   `json:"additional_permit"`
	InsuranceAmount  *float64 `json:"insurance_amount"`
	RoadTaxAmount    *float64 `json:"road_tax_amount"`
	PollutionExpire  string   `json:"pollution_expire"`
	GreenTaxExpire   string   `json:"green_tax_expire"`
	MVTaxExpire      string   `json:"mv_tax_expire"`
	InsuranceStart   string   `json:"insurance_start_date"`
	InsuranceExpire  string   `json:"insurance_expire_date"`
	FCStart          string   `json:"fc_start_date"`
	FCExpire         string   `json:"fc_expire_date"`
	PermitStart      string   `json:"permit_start_date"`
	PermitExpire     string   `json:"permit_expire_date"`
	Errors           []string `json:"errors"`
	IsValid          bool     `json:"is_valid"`
}
type BulkVehicleSheetPreviewResponse struct {
	SheetURL        string                  `json:"sheet_url"`
	CSVURL          string                  `json:"csv_url"`
	TotalRows       int                     `json:"total_rows"`
	ReadyRows       int                     `json:"ready_rows"`
	InvalidRows     int                     `json:"invalid_rows"`
	RequiredHeaders []string                `json:"required_headers"`
	Rows            []BulkVehiclePreviewRow `json:"rows"`
}
type BulkVehicleImportResponse struct {
	Message      string                          `json:"message"`
	CreatedCount int                             `json:"created_count"`
	FailedCount  int                             `json:"failed_count"`
	Preview      BulkVehicleSheetPreviewResponse `json:"preview"`
}
// VehicleDocumentAuditLog represents a single field-level change to a vehicle document
type VehicleDocumentAuditLog struct {
	ID            int     `json:"id"`
	VehicleID     int     `json:"vehicle_id"`
	DocumentType  string  `json:"document_type"`
	FieldName     string  `json:"field_name"`
	OldValue      *string `json:"old_value"`
	NewValue      *string `json:"new_value"`
	ChangedBy     int     `json:"changed_by"`
	ChangedByName string  `json:"changed_by_name"`
	ChangedAt     string  `json:"changed_at"`
}
// VehicleType represents a vehicle type master record
type VehicleType struct {
	ID       int    `json:"id"`
	Type     string `json:"type"`
	Label    string `json:"label"`
	IsActive bool   `json:"is_active"`
}
// CreateVehicleTypeRequest - request to create a new vehicle type
type CreateVehicleTypeRequest struct {
	Type  string `json:"type" binding:"required"`
	Label string `json:"label" binding:"required"`
}
// UpdateVehicleTypeRequest - request to update a vehicle type
type UpdateVehicleTypeRequest struct {
	Type  string `json:"type"`
	Label string `json:"label"`
}
/*
	=========================
	  STOP MODELS

=========================*/
type Stop struct {
	ID       int    `json:"id"`
	StopName string `json:"stop_name"`
	Location string `json:"location"`
}
type CreateStopRequest struct {
	StopName string `json:"stop_name"`
	Location string `json:"location"`
}
/*=========================
	  SHIFT MODELS
========================
*/
type Shift struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Description string `json:"description"`
	CreatedBy   *int   `json:"created_by"`
}
type CreateShiftRequest struct {
	Name        string `json:"name"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Description string `json:"description"`
}
type CreateShiftWithSlotsRequest struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
}
/*
=========================
ASSIGNMENT MODELS
=========================
*/
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
	ShiftName                string `json:"shift_name"`
	StartTime                string `json:"start_time"`
	EndTime                  string `json:"end_time"`
	VehicleNumber            string `json:"vehicle_number"`
	VehicleType              string `json:"vehicle_type"`
	VehicleName              string `json:"vehicle_name"`
	DriverName               string `json:"driver_name"`
	OriginalDriverName       string `json:"original_driver_name"`
	DriverStatus             string `json:"driver_status"`
	CreatedByName            string `json:"created_by_name"`
	VehicleStatus            string `json:"vehicle_status"`
	ReplacementVehicleNumber string `json:"replacement_vehicle_number"`
}
type CreateAssignmentRequest struct {
	ShiftID                int    `json:"shift_id"`
	ShiftIDs               []int  `json:"shift_ids"`
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
	OriginalDriverName    string `json:"original_driver_name"`
	ReplacementDriverName string `json:"replacement_driver_name"`
	ShiftName             string `json:"shift_name"`
	StartTime             string `json:"start_time"`
	EndTime               string `json:"end_time"`
	VehicleNumber         string `json:"vehicle_number"`
	VehicleType           string `json:"vehicle_type"`
	VehicleName           string `json:"vehicle_name"`
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
	MarkedBy     *int    `json:"marked_by"`
	// Joined
	FullName     string `json:"full_name"`
	MarkedByName string `json:"marked_by_name"`
}
type MarkAttendanceRequest struct {
	UserID      int     `json:"user_id"`
	Date        string  `json:"date"`
	Status      string  `json:"status"`
	CheckinTime *string `json:"checkin_time"`
}
type BulkMarkAttendanceItem struct {
	UserID      int     `json:"user_id"`
	Status      string  `json:"status"`
	CheckinTime *string `json:"checkin_time"`
}
type BulkMarkAttendanceRequest struct {
	Date    string                   `json:"date"`
	Updates []BulkMarkAttendanceItem `json:"updates"`
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
	ID               int     `json:"id"`
	VehicleID        int     `json:"vehicle_id"`
	DriverID         int     `json:"driver_id"`
	FuelRequested    float64 `json:"fuel_requested"`
	FuelFilled       float64 `json:"fuel_filled"`
	OdometerReading  int     `json:"odometer_reading"`
	Status           string  `json:"status"` // pending, completed, rejected
	RequestedAt      string  `json:"requested_at"`
	CompletedAt      *string `json:"completed_at"`
	FuelIndentNumber string  `json:"fuel_indent_number"`
	VehicleType      string  `json:"vehicle_type"`
	FuelType         string  `json:"fuel_type"`
	FilledDate       string  `json:"filled_date"`
	FilledTime       string  `json:"filled_time"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number"`
	VehicleName   string `json:"vehicle_name"`
	DriverName    string `json:"driver_name"`
}
type CreateFuelIndentRequest struct {
	VehicleID       int     `json:"vehicle_id"`
	DriverID        int     `json:"driver_id"`
	FuelRequested   float64 `json:"fuel_requested"`
	OdometerReading int     `json:"odometer_reading"`
}
type DriverCreateFuelIndentRequest struct {
	VehicleID        int     `json:"vehicle_id"`
	DriverID         int     `json:"driver_id"`
	VehicleType      string  `json:"vehicle_type"`
	FuelType         string  `json:"fuel_type"`
	FuelIndentNumber string  `json:"fuel_indent_number"`
	FilledDate       string  `json:"filled_date"`
	FilledTime       string  `json:"filled_time"`
	OdometerReading  int     `json:"odometer_reading"`
	FilledLiters     float64 `json:"filled_liters"`
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
	Department    string  `json:"department"`
	Year          int     `json:"year"`
	RollNumber    string  `json:"roll_number"`
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
	PaymentType        string  `json:"payment_type"`
}
type RecordPaymentRequest struct {
	StudentTransportID int     `json:"student_transport_id"`
	Amount             float64 `json:"amount"`
	PaymentDate        string  `json:"payment_date"`
	PaymentMethod      string  `json:"payment_method"`
	TransactionID      string  `json:"transaction_id"`
	ReceiptNumber      string  `json:"receipt_number"`
	Remarks            string  `json:"remarks"`
	PaymentType        string  `json:"payment_type"`
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
// Trip - Individual journey segment
type Trip struct {
	TripOrder         int    `json:"trip_order"`
	DepartureLocation string `json:"departure_location"`
	ArrivalLocation   string `json:"arrival_location"`
	DepartureDate     string `json:"departure_date"`
	DepartureTime     string `json:"departure_time"`
	ArrivalDate       string `json:"arrival_date"`
	ArrivalTime       string `json:"arrival_time"`
}
// VehicleRequest - Faculty vehicle booking request (using vehiclerequests table)
type VehicleRequest struct {
	ID          int `json:"id"`
	RequesterID int `json:"requester_id"`
	FacultyID   int `json:"faculty_id"`
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
	// trips slice for structured journey view
	Trips []Trip `json:"trips"`
	// Contact Info
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	MobileNumber string `json:"traveller_mobile"`
	GuestName    string `json:"traveller_name"`
	Address      string `json:"traveller_address"`
	// Task and Outcome fields
	TaskID           string `json:"task_id"`
	OutcomeExpected  string `json:"outcome_expected"`
	OutcomeAuditable string `json:"outcome_auditable"`
	// Assignment
	VehicleID *int `json:"vehicle_id"`
	DriverID  *int `json:"driver_id"`
	// Status and Approval
	Status         string  `json:"status"`
	AdminRemarks   string  `json:"admin_remarks"`
	ApprovedBy     *int    `json:"approved_by"`
	ApprovedByName string  `json:"approved_by_name"`
	ApprovedAt     *string `json:"approved_at"`
	AssignedAt     *string `json:"assigned_at"`
	CreatedAt      string  `json:"created_at"`
	// OTP fields for trip verification
	StartOTP            string  `json:"start_otp,omitempty"`
	EndOTP              string  `json:"end_otp,omitempty"`
	StartOTPGeneratedAt *string `json:"start_otp_generated_at,omitempty"`
	EndOTPGeneratedAt   *string `json:"end_otp_generated_at,omitempty"`
	TripStartedAt       *string `json:"trip_started_at,omitempty"`
	TripEndedAt         *string `json:"trip_ended_at,omitempty"`
	// Joined fields
	RequesterName     string `json:"requester_name"`
	RequesterEmail    string `json:"requester_email"`
	RequesterPhone    string `json:"requester_phone"`
	RequesterRole     string `json:"requester_role"`
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
// TripInput - Individual trip leg input from the frontend
type TripInput struct {
	TripOrder         int    `json:"trip_order"`
	DepartureLocation string `json:"departure_location"`
	ArrivalLocation   string `json:"arrival_location"`
	DepartureDate     string `json:"departure_date"`
	DepartureTime     string `json:"departure_time"`
	ArrivalDate       string `json:"arrival_date"`
	ArrivalTime       string `json:"arrival_time"`
	TaskID            string `json:"task_id"`
	OutcomeAuditable  string `json:"outcome_auditable"`
	PassengerContacts string `json:"passenger_contacts"`
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
	MobileNumber     string `json:"traveller_mobile"`
	GuestName        string `json:"traveller_name"`
	Address          string `json:"traveller_address"`
	TaskID           string `json:"task_id"`
	OutcomeExpected  string `json:"outcome_expected"`
	OutcomeAuditable string `json:"outcome_auditable"`

	// Multi-leg trips (for round_trip)
	Trips []TripInput `json:"trips"`
}

// AssignVehicleRequestInput - Input for assigning vehicle and driver to a request
type AssignVehicleRequestInput struct {
	RequestID   int  `json:"request_id"`
	VehicleID   int  `json:"vehicle_id"`
	DriverID    int  `json:"driver_id"`
	ForceAssign bool `json:"force_assign"`
}

/* =========================
   SERVICE & REPAIR MODELS
========================= */

// Vendor - Master vendor record
type Vendor struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Contact   string `json:"contact"`
	GSTNumber string `json:"gst_number"`
	Email     string `json:"email"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	// Computed fields (from aggregation)
	TotalSpent float64 `json:"total_spent,omitempty"`
	PartsCount int     `json:"parts_count,omitempty"`
}

type CreateVendorRequest struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	Contact   string `json:"contact"`
	GSTNumber string `json:"gst_number"`
	Email     string `json:"email"`
}

type UpdateVendorRequest struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Contact   string `json:"contact"`
	GSTNumber string `json:"gst_number"`
	Email     string `json:"email"`
}

// ServiceRecord - Core service/repair record
type ServiceRecord struct {
	ID                int     `json:"id"`
	VehicleID         int     `json:"vehicle_id"`
	ReportedBy        *int    `json:"reported_by"`
	AssignedToAdmin   *int    `json:"assigned_to_admin"`
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	Severity          string  `json:"severity"`
	Status            string  `json:"status"`
	OdometerAtService *int    `json:"odometer_at_service"`
	ScheduledDate     *string `json:"scheduled_date"`
	StartedAt         *string `json:"started_at"`
	CompletedAt       *string `json:"completed_at"`
	WorkshopName      string  `json:"workshop_name"`
	MechanicName      string  `json:"mechanic_name"`
	MechanicContact   string  `json:"mechanic_contact"`
	LaborCost         float64 `json:"labor_cost"`
	PartsCost         float64 `json:"parts_cost"`
	TotalCost         float64 `json:"total_cost"`
	NextServiceDate   *string `json:"next_service_date"`
	NextServiceKm     *int    `json:"next_service_km"`
	AdminRemarks      string  `json:"admin_remarks"`
	RejectionReason   string  `json:"rejection_reason"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
	// Joined fields
	VehicleNumber  string `json:"vehicle_number"`
	VehicleName    string `json:"vehicle_name"`
	VehicleType    string `json:"vehicle_type"`
	ReportedByName string `json:"reported_by_name"`
	AdminName      string `json:"admin_name"`
}

type CreateServiceRecordRequest struct {
	VehicleID         int     `json:"vehicle_id"`
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	Severity          string  `json:"severity"`
	OdometerAtService *int    `json:"odometer_at_service"`
	ScheduledDate     *string `json:"scheduled_date"`
	WorkshopName      string  `json:"workshop_name"`
	MechanicName      string  `json:"mechanic_name"`
	MechanicContact   string  `json:"mechanic_contact"`
	LaborCost         float64 `json:"labor_cost"`
}

type UpdateServiceRecordRequest struct {
	ID                int     `json:"id"`
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	Severity          string  `json:"severity"`
	OdometerAtService *int    `json:"odometer_at_service"`
	ScheduledDate     *string `json:"scheduled_date"`
	WorkshopName      string  `json:"workshop_name"`
	MechanicName      string  `json:"mechanic_name"`
	MechanicContact   string  `json:"mechanic_contact"`
	LaborCost         float64 `json:"labor_cost"`
	AdminRemarks      string  `json:"admin_remarks"`
}

// Product purchase status constants
const (
	ProductStatusPending   = "pending"
	ProductStatusReceived  = "received"
	ProductStatusReturned  = "returned"
	ProductStatusCancelled = "cancelled"
)

var ValidProductStatuses = []string{
	ProductStatusPending,
	ProductStatusReceived,
	ProductStatusReturned,
	ProductStatusCancelled,
}

func IsValidProductStatus(status string) bool {
	for _, s := range ValidProductStatuses {
		if s == status {
			return true
		}
	}
	return false
}

// Purchase category constants
const (
	PurchaseCategoryGeneral       = "general"
	PurchaseCategoryVehicle       = "vehicle"
	PurchaseCategoryRepairService = "repair_service"
)

// IsValidPurchaseCategory checks if a category value is valid
func IsValidPurchaseCategory(cat string) bool {
	return cat == PurchaseCategoryGeneral || cat == PurchaseCategoryVehicle || cat == PurchaseCategoryRepairService
}

// PartPurchased - Products bought for a purchase order
type PartPurchased struct {
	ID              int     `json:"id"`
	PurchaseOrderID *int    `json:"purchase_order_id"`
	Category        string  `json:"category"`
	VehicleID       *int    `json:"vehicle_id"`
	ServiceRecordID *int    `json:"service_record_id"`
	PartName        string  `json:"part_name"`
	VendorID        *int    `json:"vendor_id"`
	VendorName      string  `json:"vendor_name"`
	VendorContact   string  `json:"vendor_contact"`
	VendorAddress   string  `json:"vendor_address"`
	VendorGST       string  `json:"vendor_gst"`
	Quantity        int     `json:"quantity"`
	UnitPrice       float64 `json:"unit_price"`
	TotalPrice      float64 `json:"total_price"`
	WarrantyMonths  int     `json:"warranty_months"`
	InvoiceNumber   string  `json:"invoice_number"`
	PurchasedDate   string  `json:"purchased_date"`
	Status          string  `json:"status"`
	OrderedDate     string  `json:"ordered_date"`
	ReceivedDate    string  `json:"received_date"`
	ReturnedDate    string  `json:"returned_date"`
	CancelledDate   string  `json:"cancelled_date"`
	AddedBy         *int    `json:"added_by"`
	CreatedAt       string  `json:"created_at"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number"`
	VehicleName   string `json:"vehicle_name"`
	ServiceTitle  string `json:"service_title"`
	AddedByName   string `json:"added_by_name"`
}

type CreatePartRequest struct {
	Category        string  `json:"category"`
	VehicleID       *int    `json:"vehicle_id"`
	ServiceRecordID *int    `json:"service_record_id"`
	PartName        string  `json:"part_name"`
	VendorID        *int    `json:"vendor_id"`
	Quantity        int     `json:"quantity"`
	UnitPrice       float64 `json:"unit_price"`
	WarrantyMonths  int     `json:"warranty_months"`
	InvoiceNumber   string  `json:"invoice_number"`
	PurchasedDate   string  `json:"purchased_date"`
	Status          string  `json:"status"`
	OrderedDate     string  `json:"ordered_date"`
}

type UpdatePartRequest struct {
	ID             int     `json:"id"`
	PartName       string  `json:"part_name"`
	VendorID       *int    `json:"vendor_id"`
	Quantity       int     `json:"quantity"`
	UnitPrice      float64 `json:"unit_price"`
	WarrantyMonths int     `json:"warranty_months"`
	InvoiceNumber  string  `json:"invoice_number"`
	PurchasedDate  string  `json:"purchased_date"`
	Status         string  `json:"status"`
	OrderedDate    string  `json:"ordered_date"`
	ReceivedDate   string  `json:"received_date"`
	ReturnedDate   string  `json:"returned_date"`
	CancelledDate  string  `json:"cancelled_date"`
}

// BulkPartItem - Single item in a bulk purchase
type BulkPartItem struct {
	PartName       string  `json:"part_name"`
	Quantity       int     `json:"quantity"`
	UnitPrice      float64 `json:"unit_price"`
	WarrantyMonths int     `json:"warranty_months"`
}

// BulkCreatePartsRequest - Multiple parts from same vendor in one purchase
type BulkCreatePartsRequest struct {
	Category        string         `json:"category"`
	VehicleID       *int           `json:"vehicle_id"`
	ServiceRecordID *int           `json:"service_record_id"`
	VendorID        *int           `json:"vendor_id"`
	InvoiceNumber   string         `json:"invoice_number"`
	PurchasedDate   string         `json:"purchased_date"`
	Status          string         `json:"status"`
	Parts           []BulkPartItem `json:"parts"`
}

/* =========================
   PURCHASE ORDER MODELS
========================= */

// PurchaseOrder - Groups multiple parts into a single bill/order
type PurchaseOrder struct {
	ID              int    `json:"id"`
	Category        string `json:"category"`
	VehicleID       *int   `json:"vehicle_id"`
	ServiceRecordID *int   `json:"service_record_id"`
	VendorID        *int   `json:"vendor_id"`
	VendorName      string `json:"vendor_name"`
	VendorContact   string `json:"vendor_contact"`
	VendorAddress   string `json:"vendor_address"`
	VendorGST       string `json:"vendor_gst"`
	InvoiceNumber   string `json:"invoice_number"`
	PurchasedDate   string `json:"purchased_date"`
	Status          string `json:"status"`
	OrderedDate     string `json:"ordered_date"`
	ReceivedDate    string `json:"received_date"`
	ReturnedDate    string `json:"returned_date"`
	CancelledDate   string `json:"cancelled_date"`
	Notes           string `json:"notes"`
	AddedBy         *int   `json:"added_by"`
	AddedByName     string `json:"added_by_name"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
	// Joined fields
	VehicleNumber string `json:"vehicle_number"`
	VehicleName   string `json:"vehicle_name"`
	ServiceTitle  string `json:"service_title"`
	// Computed fields
	TotalAmount  float64          `json:"total_amount"`
	ProductCount int              `json:"product_count"`
	Products     []PartPurchased  `json:"products"`
	InvoiceFile  *PurchaseInvoice `json:"invoice_file,omitempty"`
}

// PurchaseInvoice - Uploaded invoice document for a purchase order
type PurchaseInvoice struct {
	ID              int    `json:"id"`
	PurchaseOrderID int    `json:"purchase_order_id"`
	FileName        string `json:"file_name"`
	OriginalName    string `json:"original_name"`
	FileType        string `json:"file_type"`
	FileSize        int64  `json:"file_size"`
	FilePath        string `json:"file_path"`
	FileURL         string `json:"file_url"`
	UploadedBy      *int   `json:"uploaded_by"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

// CreatePurchaseOrderRequest - Request to create a purchase order with products
type CreatePurchaseOrderRequest struct {
	Category        string         `json:"category"`
	VehicleID       *int           `json:"vehicle_id"`
	ServiceRecordID *int           `json:"service_record_id"`
	VendorID        *int           `json:"vendor_id"`
	InvoiceNumber   string         `json:"invoice_number"`
	PurchasedDate   string         `json:"purchased_date"`
	Status          string         `json:"status"`
	Notes           string         `json:"notes"`
	Parts           []BulkPartItem `json:"parts"`
}

// UpdatePurchaseOrderRequest - Request to update order-level fields
type UpdatePurchaseOrderRequest struct {
	ID            int    `json:"id"`
	VehicleID     *int   `json:"vehicle_id"`
	VendorID      *int   `json:"vendor_id"`
	InvoiceNumber string `json:"invoice_number"`
	PurchasedDate string `json:"purchased_date"`
	Notes         string `json:"notes"`
}

// AddProductToOrderRequest - Add a product to an existing order
type AddProductToOrderRequest struct {
	PurchaseOrderID int     `json:"purchase_order_id"`
	PartName        string  `json:"part_name"`
	Quantity        int     `json:"quantity"`
	UnitPrice       float64 `json:"unit_price"`
	WarrantyMonths  int     `json:"warranty_months"`
}

// VehicleServiceTracking - KM-based service tracking per vehicle
type VehicleServiceTracking struct {
	ID              int    `json:"id"`
	VehicleID       int    `json:"vehicle_id"`
	LastServicedKm  int    `json:"last_serviced_km"`
	NextServiceKm   int    `json:"next_service_km"`
	LastServiceDate string `json:"last_service_date"`
	NextServiceDate string `json:"next_service_date"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
	// Computed/Joined fields
	VehicleNumber string `json:"vehicle_number"`
	VehicleName   string `json:"vehicle_name"`
	VehicleType   string `json:"vehicle_type"`
	CurrentKm     int    `json:"current_km"`
	RemainingKm   int    `json:"remaining_km"`
	Status        string `json:"status"` // overdue, danger, warning, on_track
}

type UpdateServiceTrackingRequest struct {
	VehicleID       int    `json:"vehicle_id"`
	LastServicedKm  int    `json:"last_serviced_km"`
	NextServiceKm   int    `json:"next_service_km"`
	LastServiceDate string `json:"last_service_date"`
	NextServiceDate string `json:"next_service_date"`
	Notes           string `json:"notes"`
}

// DriverServiceReportRequest - Driver reports a vehicle issue
type DriverServiceReportRequest struct {
	VehicleID         int    `json:"vehicle_id"`
	Title             string `json:"title"`
	Description       string `json:"description"`
	Severity          string `json:"severity"`
	OdometerAtService *int   `json:"odometer_at_service"`
}

// ServiceStats - Dashboard statistics
type ServiceStats struct {
	TotalServices    int     `json:"total_services"`
	ActiveServices   int     `json:"active_services"`
	PendingRequests  int     `json:"pending_requests"`
	CompletedMonth   int     `json:"completed_this_month"`
	TotalCostMonth   float64 `json:"total_cost_this_month"`
	OverdueReminders int     `json:"overdue_reminders"`
}
