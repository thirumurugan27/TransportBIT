import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableDropdown from "../../../components/ui/SearchableDropdown";
import {
  User,
  MapPin,
  FileText,
  CheckCircle,
  Car,
  Building2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE;

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
  task_id: "",
  departure_date: "",
  departure_time: "",
  departure_location: "",
  arrival_date: "",
  arrival_time: "",
  arrival_location: "",
  passenger_contacts: "",
  outcome_auditable: "",
};

export default function VehicleRequestForm() {
  const navigate = useNavigate();
  const {showToast} = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: trip info, 2: trip legs, 3: declaration
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const TRIP_TYPES = [
    {value: "guest_pickup", label: "Guest Pick up"},
    {value: "guest_drop", label: "Guest Drop"},
    {value: "faculty_staff_visit", label: "Faculty/Staff Visit"},
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
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/faculty/profile`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });
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
      updated[index] = {...updated[index], [field]: value};
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
    if (!form.trip_type.trim()) {
      showToast("Trip Type is required", "warning");
      return false;
    }
    if (!form.purpose.trim()) {
      showToast("Purpose of trip is required", "warning");
      return false;
    }
    if (!form.request_under.trim()) {
      showToast("Request Under field is required", "warning");
      return false;
    }
    if (!form.vertical.trim()) {
      showToast("Vertical field is required", "warning");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < trips.length; i++) {
      const t = trips[i];
      if (!t.departure_date || !t.departure_time || !t.departure_location) {
        showToast(`Trip ${i + 1}: Departure details are required`, "warning");
        return false;
      }
      if (!t.arrival_date || !t.arrival_time || !t.arrival_location) {
        showToast(`Trip ${i + 1}: Arrival details are required`, "warning");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    // Validate all steps before submitting
    if (!validateStep1() || !validateStep2()) {
      return;
    }

    if (!form.declaration_accepted) {
      showToast("You must accept the declaration to submit", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");

      // Transform data to match backend expected format
      // Ensure we have at least one trip with valid data
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

      const returnTrip = trips.length > 1 ? trips[1] : null;

      const requestBody = {
        booking_type: "faculty",
        trip_type: form.trip_type,
        trip_mode: "official",
        request_under: form.request_under,
        vertical: form.vertical,
        purpose: form.purpose,
        count_person: parseInt(form.total_passengers) || 1,
        task_id: onwardTrip.task_id || "",
        outcome_auditable: onwardTrip.outcome_auditable || "",

        // Onward journey
        onward_from_place: onwardTrip.departure_location || "",
        onward_to_place: onwardTrip.arrival_location || "",
        onward_from_datetime:
          onwardTrip.departure_date && onwardTrip.departure_time
            ? `${onwardTrip.departure_date} ${onwardTrip.departure_time}`
            : "",
        onward_to_datetime:
          onwardTrip.arrival_date && onwardTrip.arrival_time
            ? `${onwardTrip.arrival_date} ${onwardTrip.arrival_time}`
            : "",

        // Return journey (for round trip)
        return_from_place: returnTrip?.departure_location || "",
        return_to_place: returnTrip?.arrival_location || "",
        return_from_datetime:
          returnTrip?.departure_date && returnTrip?.departure_time
            ? `${returnTrip.departure_date} ${returnTrip.departure_time}`
            : "",
        return_to_datetime:
          returnTrip?.arrival_date && returnTrip?.arrival_time
            ? `${returnTrip.arrival_date} ${returnTrip.arrival_time}`
            : "",

        // Contact info (Faculty/Indenter)
        contact_name: profile?.full_name || "",
        contact_phone: profile?.phone || "",

        // Travelling Persons Contact Details
        traveller_name: form.traveller_name || "",
        traveller_address: form.traveller_address || "",
        traveller_mobile: form.traveller_mobile || "",
      };

      const res = await fetch(`${API_BASE}/api/faculty/vehicle-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Vehicle request submitted successfully!", "success");
        navigate("/faculty-dashboard/vehicle-booking");
      } else {
        showToast(data.error || "Failed to submit request", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error", "error");
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
    <div className="max-w-5xl mx-auto space-y-6 p-4 animate-fadeIn">
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
                  • For faculty external visit, single submission is enough for
                  round trip.
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
              <div className="space-y-4">
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
                </div>

                {form.request_under && (
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
                      placeholder="Select or search vertical"
                      searchPlaceholder="Type to search..."
                      width="w-full"
                    />
                  </div>
                )}

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
                    placeholder="Number"
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
                    type="text"
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

            {/* Purpose Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
                  <FileText size={16} className="text-purple-600" />
                </div>
                Purpose Details
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-md border border-amber-100 text-xs text-amber-900">
                  <p className="font-semibold mb-1.5">
                    📝 Please specify the reason accurately for monthly report
                    documentation:
                  </p>
                  <p className="mb-1.5">Examples:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      For an industry visit by faculty members organized by
                      IECC/Placement/Department.
                    </li>
                    <li>
                      For guest pick-up/drop-off for a workshop organized by
                      IECC, titled "Bridging the Gap: Industry–Institute Synergy
                      Workshop".
                    </li>
                  </ul>
                </div>
                <div>
                  <label className={labelClass}>
                    Purpose of Trip <span className="text-red-500">*</span>
                  </label>
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
                        placeholder="Departure location"
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
                        placeholder="Arrival location"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div>
                    <div className="mb-2 p-3 bg-amber-50 rounded-md border border-amber-100 text-xs text-amber-900">
                      <p className="font-bold mb-1">
                        📋 TASK ID/INVMR: eg: T123456/INVMR1234
                      </p>
                      <p className="text-red-600 font-semibold mb-2">
                        **For Local Sathyamangalam request mention: "Local"
                      </p>
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>
                          The Apex request, including transport, must be
                          submitted through the Inventory Apex request form for
                          proper approval.
                        </li>
                        <li>
                          Even if only a guest pick-up is required, the Apex
                          request process is mandatory to obtain the Task ID.
                        </li>
                        <li>
                          If the task has not yet been assigned, enter the
                          Inventory reference number (e.g., INVMR1234)
                          temporarily.
                        </li>
                      </ol>
                    </div>
                    <label className={labelClass}>Task ID</label>
                    <input
                      type="text"
                      value={trip.task_id}
                      onChange={(e) =>
                        handleTripChange(idx, "task_id", e.target.value)
                      }
                      placeholder="Task ID or INVMR reference"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <div className="mb-2 p-3 bg-purple-50 rounded-md border border-purple-100 text-xs text-purple-900">
                      <p className="font-bold mb-1">
                        📊 Outcome expected & Auditable:
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 mt-2">
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Infrastructure</li>
                          <li>Regular Maintenance</li>
                          <li>Skill</li>
                        </ul>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Placement / Internship</li>
                          <li>Product development</li>
                          <li>Awards / Achievements</li>
                        </ul>
                      </div>
                    </div>
                    <label className={labelClass}>Auditable</label>
                    <input
                      type="text"
                      value={trip.outcome_auditable}
                      onChange={(e) =>
                        handleTripChange(
                          idx,
                          "outcome_auditable",
                          e.target.value,
                        )
                      }
                      placeholder="e.g., Skill, Placement/Internship, Awards"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {form.trip_type === "multi_stop" && (
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
                {(trip.task_id || trip.outcome_auditable) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {trip.task_id && (
                      <div>
                        <p className="text-secondarytext font-medium mb-0.5">
                          Task ID
                        </p>
                        <p className="text-primarytext font-semibold">
                          {trip.task_id}
                        </p>
                      </div>
                    )}
                    {trip.outcome_auditable && (
                      <div>
                        <p className="text-secondarytext font-medium mb-0.5">
                          Auditable
                        </p>
                        <p className="text-primarytext font-semibold">
                          {trip.outcome_auditable}
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
