import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useToast} from "../../../context/ToastContext";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableDropdown from "../../../components/ui/SearchableDropdown";
import OpenStreetMapRoutePicker from "../../../components/maps/OpenStreetMapRoutePicker";
import {
  User,
  MapPin,
  FileText,
  CheckCircle,
  Car,
  Building2,
} from "lucide-react";

// Format date from YYYY-MM-DD to DD-MM-YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

// Format time from 24hr (HH:MM) to 12hr (HH:MM AM/PM)
const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const emptyTrip = {
  trip_order: 1,
  departure_date: "",
  departure_time: "",
  departure_location: "",
  departure_latitude: null,
  departure_longitude: null,
  arrival_date: "",
  arrival_time: "",
  arrival_location: "",
  arrival_latitude: null,
  arrival_longitude: null,
  passenger_contacts: "",
};

export default function VehicleRequestForm() {
  const navigate = useNavigate();
  const {showToast} = useToast();
  const {user} = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: trip info, 2: trip legs, 3: declaration
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const TRIP_TYPES = [
    {value: "guest_pickup", label: "Guest Pick up"},
    {value: "guest_drop", label: "Guest Drop"},
    {value: "faculty_staff_visit", label: "Faculty/Staff Visit"},
    {value: "round_trip", label: "Round Trip"},
  ];

  const REQUEST_UNDER_OPTIONS = [
    {value: "academic_department", label: "Academic Department"},
    {value: "students_training", label: "Students Training"},
    {value: "supporting_department", label: "Supporting Department"},
  ];

  const VERTICAL_OPTIONS = {
    academic_department: [
      "AGRI",
      "AIDS",
      "AIML",
      "BIOTECH",
      "BME",
      "CHEMISTRY",
      "CIVIL",
      "CSBS",
      "CSD",
      "CSE",
      "CT",
      "ECE",
      "EEE",
      "EIE",
      "FASHION",
      "FOOD",
      "ISE",
      "IT",
      "MATHS",
      "MECH",
      "MTRS",
      "PHYSICS",
      "SMS",
      "TEXTILE",
      "QRWA",
    ],
    students_training: [
      "CE KOVAI SELVAN VISIT",
      "GURUGULAM",
      "P-SKILL",
      "RESEARCH PARK",
      "SKILL-BIT",
      "SKILL-SCHOOL STUDENTS",
      "SPECIAL LAB/PIC",
    ],
    supporting_department: [
      "ACCOUNTS OFFICE",
      "Administrative Purpose",
      "ALUMNI ASSOCIATION",
      "AUDIO VIDEO IN-CHARGE",
      "AUTONOMY AFFAIRS",
      "BAPS",
      "BAS",
      "BAVN",
      "BOYS HOSTEL",
      "CAMPUS MAINTENANCE - CIVIL",
      "CAMPUS MAINTENANCE - CLEANING",
      "CHILLER PLANT",
      "CIVIL OFFICE",
      "CLUBS AND SOCIETIES",
      "COMMUNITY RADIO",
      "CONTROLLER OF EXAMINATION",
      "GIRLS HOSTEL",
      "HORTICULTURE",
      "IECC",
      "IQAC-ADMIN",
      "IQAC-EVENTS",
      "IQAC-HR",
      "IQAC-INFRA",
      "IQAC-OFFICE ACADEMICS",
      "IQAC-SFC",
      "IT OPERATIONS (NMC)",
      "IT SERVICES (TRC)",
      "LEARNING CENTRE",
      "MEDICAL CENTRE",
      "MESS",
      "NEW INITIATIVES",
      "PHYSICAL EDUCATION",
      "PLUMBING & WATER SUPPLY",
      "POWER HOUSE",
      "PRD",
      "SECURITY SERVICE",
      "START UP",
      "STORES",
      "STP",
      "TRAINING & PLACEMENT",
      "TRAINING ACADEMY",
      "TRANSPORT",
    ],
  };

  const getTripTypeLabel = (value) => {
    const found = TRIP_TYPES.find((t) => t.value === value);
    return found ? found.label : value?.replace(/_/g, " ") || "-";
  };

  const getRequestUnderLabel = (value) => {
    const found = REQUEST_UNDER_OPTIONS.find((r) => r.value === value);
    return found ? found.label : value || "-";
  };

  const [form, setForm] = useState({
    trip_type: "guest_pickup",
    request_under: "",
    vertical: "",
    purpose: "",
    task_id: "",
    outcome_auditable: "",
    total_passengers: 1,
    declaration_accepted: false,
    // Travelling Persons Contact Details
    traveller_name: "",
    traveller_address: "",
    traveller_mobile: "",
  });

  const [trips, setTrips] = useState([{...emptyTrip}]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiGet("/api/faculty/profile");
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({...prev, [field]: value}));
  };

  const handleTripChange = (index, field, value) => {
    setTrips((prev) => {
      const updated = [...prev];
      const oldTrip = updated[index];
      const newTrip = {...oldTrip, [field]: value};

      // Auto-set arrival_date to departure_date if empty
      if (field === "departure_date" && (!oldTrip.arrival_date || oldTrip.arrival_date === oldTrip.departure_date)) {
        newTrip.arrival_date = value;
      }

      updated[index] = newTrip;
      return updated;
    });
  };

  const addTrip = () => {
    setTrips((prev) => [...prev, {...emptyTrip, trip_order: prev.length + 1}]);
  };

  const removeTrip = (index) => {
    if (trips.length <= 1) return;
    setTrips((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((t, i) => ({...t, trip_order: i + 1})),
    );
  };

  const validateStep1 = () => {
    if (!form.trip_type || !form.trip_type.trim()) {
      showToast("Trip Type is required", "warning");
      return false;
    }
    const passengers = parseInt(form.total_passengers, 10);
    if (isNaN(passengers) || passengers < 1) {
      showToast("Total passengers must be at least 1", "warning");
      return false;
    }
    if (!form.traveller_name || !form.traveller_name.trim()) {
      showToast("Travelling Person / Guest Name is required", "warning");
      return false;
    }
    if (!form.traveller_mobile || !form.traveller_mobile.trim()) {
      showToast("Travelling Person Mobile Number is required", "warning");
      return false;
    }
    const cleanPhone = form.traveller_mobile.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      showToast("Mobile number must be at least 10 digits", "warning");
      return false;
    }
    if (!form.request_under || !form.request_under.trim()) {
      showToast("Request Under field is required", "warning");
      return false;
    }
    if (!form.vertical || !form.vertical.trim()) {
      showToast("Vertical field is required", "warning");
      return false;
    }
    if (!form.purpose || !form.purpose.trim()) {
      showToast("Purpose of trip is required", "warning");
      return false;
    }
    if (!form.task_id || !form.task_id.trim()) {
      showToast("Task ID is required (e.g. T123456 or Local)", "warning");
      return false;
    }
    if (!form.outcome_auditable || !form.outcome_auditable.trim()) {
      showToast("Auditable Outcome is required", "warning");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < trips.length; i++) {
      const t = trips[i];
      const legNum = i + 1;

      if (!t.departure_date) {
        showToast(`Trip Leg ${legNum}: Departure date is required`, "warning");
        return false;
      }
      if (t.departure_date < today) {
        showToast(`Trip Leg ${legNum}: Departure date cannot be in the past`, "warning");
        return false;
      }
      if (!t.departure_time) {
        showToast(`Trip Leg ${legNum}: Departure time is required`, "warning");
        return false;
      }
      if (!t.departure_location || !t.departure_location.trim()) {
        showToast(`Trip Leg ${legNum}: Departure location is required`, "warning");
        return false;
      }

      if (!t.arrival_date) {
        showToast(`Trip Leg ${legNum}: Arrival date is required`, "warning");
        return false;
      }
      if (t.arrival_date < t.departure_date) {
        showToast(`Trip Leg ${legNum}: Arrival date cannot be earlier than departure date`, "warning");
        return false;
      }
      if (!t.arrival_time) {
        showToast(`Trip Leg ${legNum}: Arrival time is required`, "warning");
        return false;
      }
      if (!t.arrival_location || !t.arrival_location.trim()) {
        showToast(`Trip Leg ${legNum}: Arrival location is required`, "warning");
        return false;
      }

      if (t.departure_location.trim().toLowerCase() === t.arrival_location.trim().toLowerCase()) {
        showToast(`Trip Leg ${legNum}: Departure and arrival locations cannot be identical`, "warning");
        return false;
      }

      const depDT = new Date(`${t.departure_date}T${t.departure_time}`);
      const arrDT = new Date(`${t.arrival_date}T${t.arrival_time}`);
      if (isNaN(depDT.getTime()) || isNaN(arrDT.getTime())) {
        showToast(`Trip Leg ${legNum}: Invalid date or time format`, "warning");
        return false;
      }
      if (arrDT <= depDT) {
        showToast(`Trip Leg ${legNum}: Arrival date/time must be strictly after departure date/time`, "warning");
        return false;
      }

      if (i > 0) {
        const prevTrip = trips[i - 1];
        const prevArrDT = new Date(`${prevTrip.arrival_date}T${prevTrip.arrival_time}`);
        if (depDT < prevArrDT) {
          showToast(`Trip Leg ${legNum}: Departure cannot be earlier than Trip Leg ${i} arrival`, "warning");
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    // Validate all steps before submitting
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    if (!form.declaration_accepted) {
      showToast("You must accept the declaration to submit", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const onwardTrip = trips[0];
      if (
        !onwardTrip ||
        !onwardTrip.departure_location ||
        !onwardTrip.arrival_location
      ) {
        showToast("Trip details are missing", "error");
        setSubmitting(false);
        return;
      }

      const returnTrip = trips.length > 1 ? trips[trips.length - 1] : null;

      const requestBody = {
        booking_type: "faculty",
        trip_type: form.trip_type,
        trip_mode: "official",
        request_under: form.request_under,
        vertical: form.vertical,
        purpose: form.purpose,
        count_person: parseInt(form.total_passengers, 10) || 1,
        task_id: form.task_id || "",
        outcome_auditable: form.outcome_auditable || "",

        // Onward journey
        onward_from_place: (onwardTrip.departure_location || "").trim(),
        onward_to_place: (onwardTrip.arrival_location || "").trim(),
        onward_from_datetime:
          onwardTrip.departure_date && onwardTrip.departure_time
            ? `${onwardTrip.departure_date} ${onwardTrip.departure_time}`
            : "",
        onward_to_datetime:
          onwardTrip.arrival_date && onwardTrip.arrival_time
            ? `${onwardTrip.arrival_date} ${onwardTrip.arrival_time}`
            : "",

        // Return journey (for round trip - last leg)
        return_from_place: (returnTrip?.departure_location || "").trim(),
        return_to_place: (returnTrip?.arrival_location || "").trim(),
        return_from_datetime:
          returnTrip?.departure_date && returnTrip?.departure_time
            ? `${returnTrip.departure_date} ${returnTrip.departure_time}`
            : "",
        return_to_datetime:
          returnTrip?.arrival_date && returnTrip?.arrival_time
            ? `${returnTrip.arrival_date} ${returnTrip.arrival_time}`
            : "",

        // All trip legs
        trips: trips.map((t, i) => ({
          trip_order: i + 1,
          departure_location: (t.departure_location || "").trim(),
          departure_latitude:
            t.departure_latitude !== null && t.departure_latitude !== undefined
              ? Number(t.departure_latitude)
              : null,
          departure_longitude:
            t.departure_longitude !== null &&
            t.departure_longitude !== undefined
              ? Number(t.departure_longitude)
              : null,
          arrival_location: (t.arrival_location || "").trim(),
          arrival_latitude:
            t.arrival_latitude !== null && t.arrival_latitude !== undefined
              ? Number(t.arrival_latitude)
              : null,
          arrival_longitude:
            t.arrival_longitude !== null && t.arrival_longitude !== undefined
              ? Number(t.arrival_longitude)
              : null,
          departure_date: t.departure_date || "",
          departure_time: t.departure_time || "",
          arrival_date: t.arrival_date || "",
          arrival_time: t.arrival_time || "",
          task_id: form.task_id || "",
          outcome_auditable: form.outcome_auditable || "",
        })),

        // Contact info (Faculty/Indenter)
        contact_name: profile?.full_name || user?.full_name || user?.username || "",
        contact_phone: profile?.phone || user?.phone || "",

        // Travelling Persons Contact Details
        traveller_name: (form.traveller_name || "").trim(),
        traveller_address: (form.traveller_address || "").trim(),
        traveller_mobile: (form.traveller_mobile || "").trim(),
      };

      const res = await apiPost("/api/faculty/vehicle-request", requestBody);
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showToast("Vehicle request submitted successfully!", "success");
        navigate("/faculty-dashboard/vehicle-booking");
      } else {
        showToast(data.error || "Failed to submit request", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Define input and label styles
  const inputClass =
    "w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm bg-primarybg";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-fadeIn">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Vehicle Request Form
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Submit a vehicle booking request for official travel
            </p>
          </div>
          <button
            onClick={() => navigate("/faculty-dashboard/vehicle-booking")}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-200"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          {[
            {num: 1, label: "Basic Info"},
            {num: 2, label: "Trip Details"},
            {num: 3, label: "Review"},
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition-colors duration-300 ${step >= s.num ? "bg-primary" : "bg-gray-200"}`}
                />
              )}
              <button
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                }}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  step === s.num
                    ? "bg-linear-to-r from-blue-50 to-indigo-50 text-primary shadow-sm"
                    : step > s.num
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "bg-gray-100 text-secondarytext"
                }`}
                disabled={s.num > step}
              >
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                    step === s.num
                      ? "bg-primary text-white"
                      : step > s.num
                        ? "bg-primary text-white"
                        : "bg-white text-gray-400"
                  }`}
                >
                  {s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Trip Info */}
      {step === 1 && (
        <div className="bg-white rounded-md shadow-2xl overflow-hidden animate-scaleIn">
          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* Important Notes */}
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                📋 Important Guidelines
              </h4>
              <ul className="text-xs text-blue-800 space-y-1.5">
                <li>
                  • Each request must be submitted for guest pick up and drop
                  separately.
                </li>
                <li>
                  • For local Sathy transport requests, submitting this form
                  alone is sufficient; an Apex request is not mandatory.
                </li>
              </ul>
            </div>

            {/* Faculty Information Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </div>
                Faculty Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Faculty Name</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-200">
                    {profile?.full_name || "-"}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-200">
                    {profile?.department || "-"}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-200">
                    {profile?.email || "-"}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-md text-sm text-gray-700 border border-gray-200">
                    {profile?.phone || "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Configuration Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                  <Car size={16} className="text-emerald-600" />
                </div>
                Trip Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Trip Type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    value={form.trip_type}
                    onChange={(value) => handleFormChange("trip_type", value)}
                    options={TRIP_TYPES}
                    placeholder="Select Trip Type"
                    width="w-full"
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Passengers</label>
                  <input
                    type="number"
                    min="1"
                    value={form.total_passengers}
                    onChange={(e) =>
                      handleFormChange("total_passengers", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Number of passengers"
                  />
                </div>
              </div>
            </div>

            {/* Travelling Persons Contact Details */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center">
                  <User size={16} className="text-teal-600" />
                </div>
                Travelling Persons Contact Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.traveller_name}
                    onChange={(e) =>
                      handleFormChange("traveller_name", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Guest / Faculty name"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.traveller_mobile}
                    onChange={(e) =>
                      handleFormChange("traveller_mobile", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <textarea
                    value={form.traveller_address}
                    onChange={(e) =>
                      handleFormChange("traveller_address", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Address (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Purpose Details Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
                  <FileText size={16} className="text-purple-600" />
                </div>
                Purpose Details
              </h3>

              <div className="space-y-5">
                {/* Request Under & Vertical */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Request Under <span className="text-red-500">*</span>
                    </label>
                    <CustomDropdown
                      value={form.request_under}
                      onChange={(value) => {
                        handleFormChange("request_under", value);
                        handleFormChange("vertical", "");
                      }}
                      options={REQUEST_UNDER_OPTIONS}
                      placeholder="Select Request Under"
                      width="w-full"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Vertical <span className="text-red-500">*</span>
                    </label>
                    <SearchableDropdown
                      value={form.vertical}
                      onChange={(value) => handleFormChange("vertical", value)}
                      options={
                        VERTICAL_OPTIONS[form.request_under]?.map((v) => ({
                          value: v,
                          label: v,
                        })) || []
                      }
                      placeholder={
                        form.request_under
                          ? "Select or search vertical"
                          : "Select Request Under first"
                      }
                      searchPlaceholder="Type to search..."
                      width="w-full"
                    />
                  </div>
                </div>

                {/* Purpose of Trip */}
                <div>
                  <label className={labelClass}>
                    Purpose of Trip <span className="text-red-500">*</span>
                  </label>
                  <div className="mb-2 p-3 bg-amber-50 border border-amber-100 rounded-md text-xs text-amber-800">
                    <p className="font-semibold mb-1">
                      📝 Please specify the reason accurately for monthly report
                      documentation:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>
                        For an industry visit by faculty members organized by
                        IECC/Placement/Department.
                      </li>
                      <li>
                        For guest pick-up/drop-off for a workshop organized by
                        IECC, titled "Bridging the Gap: Industry–Institute
                        Synergy Workshop".
                      </li>
                    </ul>
                  </div>
                  <textarea
                    value={form.purpose}
                    onChange={(e) =>
                      handleFormChange("purpose", e.target.value)
                    }
                    rows={3}
                    placeholder="Describe the purpose of your trip request..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm bg-primarybg resize-none"
                  />
                </div>

                {/* Task ID & Auditable */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Task ID <span className="text-red-500">*</span>
                    </label>
                    <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800">
                      <p className="font-semibold mb-1">
                        📋 TASK ID / INVMR — e.g. T123456 / INVMR1234
                      </p>
                      <ol className="list-decimal pl-4 space-y-0.5">
                        <li>
                          Submit the Apex request (including transport) via the
                          Inventory Apex request form.
                        </li>
                        <li>
                          Even for guest pick-up only, the Apex request is
                          mandatory to obtain the Task ID.
                        </li>
                        <li>
                          If not yet assigned, enter the Inventory reference
                          number (e.g. INVMR1234) temporarily.
                        </li>
                      </ol>
                      <p className="mt-1.5 text-red-600 font-semibold">
                        ** For local Sathyamangalam requests, enter: "Local"
                      </p>
                    </div>
                    <input
                      type="text"
                      value={form.task_id}
                      onChange={(e) =>
                        handleFormChange("task_id", e.target.value)
                      }
                      placeholder="e.g. T123456 or INVMR1234"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Auditable Outcome <span className="text-red-500">*</span>
                    </label>
                    <div className="mb-2 p-3 bg-purple-50 border border-purple-100 rounded-md text-xs text-purple-800">
                      <p className="font-semibold mb-1">
                        📊 Outcome expected &amp; Auditable:
                      </p>
                      <div className="grid grid-cols-2 gap-x-3">
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Infrastructure</li>
                          <li>Regular Maintenance</li>
                          <li>Skill</li>
                        </ul>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Placement / Internship</li>
                          <li>Product Development</li>
                          <li>Awards / Achievements</li>
                        </ul>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={form.outcome_auditable}
                      onChange={(e) =>
                        handleFormChange("outcome_auditable", e.target.value)
                      }
                      placeholder="e.g. Skill, Placement / Internship, Awards"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="px-8 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-all duration-200 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl"
            >
              Next Step →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Trip Legs */}
      {step === 2 && (
        <div className="space-y-5">
          {form.trip_type === "round_trip" && (
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                🔄 Round Trip
              </p>
              <p className="text-xs text-amber-800">
                Add all your stops as separate trip legs (A → B → C → ... → A).
                The last leg should return to the starting point. Use the "+ Add
                Another Trip Leg" button below to add intermediate stops.
              </p>
            </div>
          )}
          {trips.map((trip, idx) => (
            <div
              key={idx}
              className="bg-white rounded-md shadow-lg overflow-hidden animate-scaleIn border border-gray-100"
            >
              {/* Trip Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                    <MapPin size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      Trip Leg {idx + 1}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Enter journey details
                    </p>
                  </div>
                </div>
                {trips.length > 1 && (
                  <button
                    onClick={() => removeTrip(idx)}
                    className="px-3 py-1.5 text-xs text-red-600 font-medium rounded-md border border-red-200 hover:bg-red-50 transition-all duration-200"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Departure */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <p className="text-sm font-semibold text-primary">
                      Departure Information
                    </p>
                  </div>
                  <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-100 text-xs text-blue-900">
                    <p className="font-bold mb-1">
                      🚌 Vehicle Departure Timing
                    </p>
                    <p className="mb-1.5">
                      Vehicles will depart from BIT campus 2 minutes per
                      kilometer in advance of the scheduled pick-up time.
                    </p>
                    <p className="italic">
                      Example: For a pick-up location 60 km away and scheduled
                      at 8:00 AM, the vehicle will leave BIT campus by 6:00 AM
                      (i.e., 120 minutes/2 hours in advance).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={trip.departure_date}
                        onChange={(e) =>
                          handleTripChange(
                            idx,
                            "departure_date",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={trip.departure_time}
                        onChange={(e) =>
                          handleTripChange(
                            idx,
                            "departure_time",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={trip.departure_location}
                        onChange={(e) =>
                          handleTripChange(
                            idx,
                            "departure_location",
                            e.target.value,
                          )
                        }
                        placeholder="Set from map below"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Arrival */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green"></div>
                    <p className="text-sm font-semibold text-green">
                      Arrival Information
                    </p>
                  </div>
                  <div className="mb-3 p-3 bg-green-50 rounded-md border border-green-100 text-xs text-green-900">
                    <p className="font-bold mb-1">📍 Expected Arrival Time</p>
                    <p className="mb-1.5">
                      Once the vehicle is picked up from the location, it will
                      take a minimum of 2 minutes per kilometer to reach the
                      destination.
                    </p>
                    <p className="italic">
                      Example: For a distance of 60 km after pick-up, the
                      vehicle will take at least 120 minutes (2 hours) to reach
                      the destination.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={trip.departure_date || new Date().toISOString().split("T")[0]}
                        value={trip.arrival_date}
                        onChange={(e) =>
                          handleTripChange(idx, "arrival_date", e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={trip.arrival_time}
                        onChange={(e) =>
                          handleTripChange(idx, "arrival_time", e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={trip.arrival_location}
                        onChange={(e) =>
                          handleTripChange(
                            idx,
                            "arrival_location",
                            e.target.value,
                          )
                        }
                        placeholder="Set from map below"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <OpenStreetMapRoutePicker
                  departureLocation={trip.departure_location}
                  departureLatitude={trip.departure_latitude}
                  departureLongitude={trip.departure_longitude}
                  arrivalLocation={trip.arrival_location}
                  arrivalLatitude={trip.arrival_latitude}
                  arrivalLongitude={trip.arrival_longitude}
                  onChange={(updated) => {
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "departureLocation",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "departure_location",
                        updated.departureLocation,
                      );
                    }
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "departureLatitude",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "departure_latitude",
                        updated.departureLatitude,
                      );
                    }
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "departureLongitude",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "departure_longitude",
                        updated.departureLongitude,
                      );
                    }
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "arrivalLocation",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "arrival_location",
                        updated.arrivalLocation,
                      );
                    }
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "arrivalLatitude",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "arrival_latitude",
                        updated.arrivalLatitude,
                      );
                    }
                    if (
                      Object.prototype.hasOwnProperty.call(
                        updated,
                        "arrivalLongitude",
                      )
                    ) {
                      handleTripChange(
                        idx,
                        "arrival_longitude",
                        updated.arrivalLongitude,
                      );
                    }
                  }}
                />
              </div>
            </div>
          ))}

          {(form.trip_type === "round_trip" ||
            form.trip_type === "multi_stop") && (
            <button
              onClick={addTrip}
              className="w-full py-3 border-2 border-dashed border-primary/30 text-primary rounded-md hover:bg-primary/5 transition-all duration-200 text-sm font-medium"
            >
              + Add Another Trip Leg
            </button>
          )}

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all duration-200 font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                if (validateStep2()) setStep(3);
              }}
              className="px-8 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-all duration-200 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl"
            >
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Review Summary */}
          <div className="bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                  <FileText size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Review Your Request
                  </h2>
                  <p className="text-xs text-gray-500">
                    Please verify all information before submitting
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Faculty & Trip Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Faculty Name
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {profile?.full_name}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Department
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {profile?.department}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Trip Type
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {getTripTypeLabel(form.trip_type)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Request Under
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {getRequestUnderLabel(form.request_under)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Vertical
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {form.vertical}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-secondarytext mb-1">
                    Total Passengers
                  </p>
                  <p className="text-sm font-semibold text-primarytext">
                    {form.total_passengers}
                  </p>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  Purpose of Trip
                </p>
                <div className="p-4 bg-primarybg rounded-md border border-gray-200">
                  <p className="text-sm text-primarytext leading-relaxed">
                    {form.purpose}
                  </p>
                </div>
              </div>

              {/* Task ID & Auditable */}
              {(form.task_id || form.outcome_auditable) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {form.task_id && (
                    <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                      <p className="text-secondarytext font-medium mb-0.5">
                        Task ID
                      </p>
                      <p className="text-primarytext font-semibold">
                        {form.task_id}
                      </p>
                    </div>
                  )}
                  {form.outcome_auditable && (
                    <div className="p-3 bg-purple-50 rounded-md border border-purple-100">
                      <p className="text-secondarytext font-medium mb-0.5">
                        Auditable
                      </p>
                      <p className="text-primarytext font-semibold">
                        {form.outcome_auditable}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Travelling Persons Contact Details */}
              {(form.traveller_name ||
                form.traveller_mobile ||
                form.traveller_address) && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <User size={14} className="text-teal-600" />
                    Travelling Persons Contact Details
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {form.traveller_name && (
                      <div className="p-4 bg-teal-50 rounded-md border border-teal-200">
                        <p className="text-xs font-medium text-secondarytext mb-1">
                          Name
                        </p>
                        <p className="text-sm font-semibold text-primarytext">
                          {form.traveller_name}
                        </p>
                      </div>
                    )}
                    {form.traveller_mobile && (
                      <div className="p-4 bg-teal-50 rounded-md border border-teal-200">
                        <p className="text-xs font-medium text-secondarytext mb-1">
                          Mobile Number
                        </p>
                        <p className="text-sm font-semibold text-primarytext">
                          {form.traveller_mobile}
                        </p>
                      </div>
                    )}
                    {form.traveller_address && (
                      <div className="p-4 bg-teal-50 rounded-md border border-teal-200">
                        <p className="text-xs font-medium text-secondarytext mb-1">
                          Address
                        </p>
                        <p className="text-sm font-semibold text-primarytext">
                          {form.traveller_address}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trip Legs Summary */}
          {trips.map((trip, idx) => (
            <div
              key={idx}
              className="bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden animate-scaleIn"
            >
              <div className="px-6 py-3 border-b border-gray-100 bg-linear-to-r from-purple-50 to-pink-50">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  Trip Leg {idx + 1}
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      Departure
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(trip.departure_date)} at{" "}
                      {formatTime(trip.departure_time)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {trip.departure_location}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-md border border-green-200">
                    <p className="text-xs font-semibold text-green mb-2 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green"></div>
                      Arrival
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(trip.arrival_date)} at{" "}
                      {formatTime(trip.arrival_time)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {trip.arrival_location}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Declaration */}
          <div className="bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-green flex items-center justify-center">
                  <CheckCircle size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">
                    Declaration
                  </h3>
                  <p className="text-xs text-gray-500">
                    Please read and accept before submitting
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-primarybg rounded-md p-5 mb-4 border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  I hereby declare that I have read and understood the{" "}
                  <span className="text-primary font-semibold">
                    BIT Transport Request Guidelines
                  </span>
                  . I confirm that all the information provided above is
                  accurate and the trip is for official purposes only. I
                  understand that any misuse may result in disciplinary action.
                </p>
              </div>
              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors border border-gray-200">
                <input
                  type="checkbox"
                  checked={form.declaration_accepted}
                  onChange={(e) =>
                    handleFormChange("declaration_accepted", e.target.checked)
                  }
                  className="w-5 h-5 mt-0.5 rounded-md border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    I have read the guidelines and accept the declaration above{" "}
                    <span className="text-red-500">*</span>
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    This is required to submit your request
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all duration-200 font-medium"
            >
              ← Back
            </button>
            <button
              disabled={submitting || !form.declaration_accepted}
              onClick={handleSubmit}
              className="px-10 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-all duration-200 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
