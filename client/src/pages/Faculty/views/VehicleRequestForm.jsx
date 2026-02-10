import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

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
      "AGRI", "AIDS", "AIML", "BIOTECH", "BME", "CHEMISTRY", "CIVIL", "CSBS", "CSD", "CSE",
      "CT", "ECE", "EEE", "EIE", "FASHION", "FOOD", "ISE", "IT", "MATHS", "MECH",
      "MTRS", "PHYSICS", "SMS", "TEXTILE", "QRWA"
    ],
    students_training: [
      "CE KOVAI SELVAN VISIT", "GURUGULAM", "P-SKILL", "RESEARCH PARK", "SKILL-BIT",
      "SKILL-SCHOOL STUDENTS", "SPECIAL LAB/PIC"
    ],
    supporting_department: [
      "ACCOUNTS OFFICE", "Administrative Purpose", "ALUMNI ASSOCIATION", "AUDIO VIDEO IN-CHARGE",
      "AUTONOMY AFFAIRS", "BAPS", "BAS", "BAVN", "BOYS HOSTEL", "CAMPUS MAINTENANCE - CIVIL",
      "CAMPUS MAINTENANCE - CLEANING", "CHILLER PLANT", "CIVIL OFFICE", "CLUBS AND SOCIETIES",
      "COMMUNITY RADIO", "CONTROLLER OF EXAMINATION", "GIRLS HOSTEL", "HORTICULTURE", "IECC",
      "IQAC-ADMIN", "IQAC-EVENTS", "IQAC-HR", "IQAC-INFRA", "IQAC-OFFICE ACADEMICS", "IQAC-SFC",
      "IT OPERATIONS (NMC)", "IT SERVICES (TRC)", "LEARNING CENTRE", "MEDICAL CENTRE", "MESS",
      "NEW INITIATIVES", "PHYSICAL EDUCATION", "PLUMBING & WATER SUPPLY", "POWER HOUSE", "PRD",
      "SECURITY SERVICE", "START UP", "STORES", "STP", "TRAINING & PLACEMENT", "TRAINING ACADEMY", "TRANSPORT"
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
    oral_approval: false,
    purpose: "",
    total_passengers: 1,
    mteam_approval: false,
    mteam_approved_by: "",
    declaration_accepted: false,
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
        oral_approval: form.oral_approval,
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

        // Contact info
        contact_name: profile?.full_name || "",
        contact_phone: profile?.phone || "",
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
        navigate("/faculty-dashboard/my-requests");
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

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-primarytext">Vehicle Request</h1>
        <p className="text-sm text-secondarytext mt-1">
          Submit a vehicle booking request for official travel
        </p>
      </div>

      {/* Step Indicator */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          {[
            {num: 1, label: "Trip Info"},
            {num: 2, label: "Trip Details"},
            {num: 3, label: "Review & Submit"},
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${step >= s.num ? "bg-primary" : "bg-gray-200"}`}
                />
              )}
              <button
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  step === s.num
                    ? "bg-primary text-white"
                    : step > s.num
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 text-secondarytext"
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold">
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
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-primarytext border-b border-gray-100 pb-3">
            Trip Information
          </h2>

          {/* Faculty Info (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Faculty Name
              </label>
              <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                {profile?.full_name || "-"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Department
              </label>
              <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                {profile?.department || "-"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Email
              </label>
              <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                {profile?.email || "-"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Phone
              </label>
              <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                {profile?.phone || "-"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Trip Type <span className="text-red">*</span>
              </label>
              <select
                value={form.trip_type}
                onChange={(e) => handleFormChange("trip_type", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {TRIP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Request Under <span className="text-red">*</span>
              </label>
              <select
                value={form.request_under}
                onChange={(e) => {
                  handleFormChange("request_under", e.target.value);
                  handleFormChange("vertical", "");
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select Request Under</option>
                {REQUEST_UNDER_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.request_under && (
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Vertical <span className="text-red">*</span>
              </label>
              <select
                value={form.vertical}
                onChange={(e) => handleFormChange("vertical", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select Vertical</option>
                {VERTICAL_OPTIONS[form.request_under]?.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondarytext mb-1">
              Purpose of Trip <span className="text-red">*</span>
            </label>
            <textarea
              value={form.purpose}
              onChange={(e) => handleFormChange("purpose", e.target.value)}
              rows={3}
              placeholder="Describe the purpose of your trip request..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Total Passengers
              </label>
              <input
                type="number"
                min="1"
                value={form.total_passengers}
                onChange={(e) =>
                  handleFormChange("total_passengers", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.oral_approval}
                  onChange={(e) =>
                    handleFormChange("oral_approval", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-primarytext">Oral Approval</span>
              </label>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.mteam_approval}
                  onChange={(e) =>
                    handleFormChange("mteam_approval", e.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-primarytext">
                  M-Team Approval
                </span>
              </label>
            </div>
          </div>

          {form.mteam_approval && (
            <div>
              <label className="block text-sm font-medium text-secondarytext mb-1">
                Approved by M-Team Member
              </label>
              <input
                type="text"
                value={form.mteam_approved_by}
                onChange={(e) =>
                  handleFormChange("mteam_approved_by", e.target.value)
                }
                placeholder="Name of M-Team member"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Trip Legs */}
      {step === 2 && (
        <div className="space-y-4">
          {trips.map((trip, idx) => (
            <div
              key={idx}
              className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-semibold text-primarytext">
                  Trip Leg {idx + 1}
                </h3>
                {trips.length > 1 && (
                  <button
                    onClick={() => removeTrip(idx)}
                    className="text-xs text-red hover:text-red/80 font-medium px-3 py-1 rounded-md border border-red/30 hover:bg-red/5 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Departure */}
              <div>
                <p className="text-sm font-medium text-primary mb-2">
                  Departure
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Date <span className="text-red">*</span>
                    </label>
                    <input
                      type="date"
                      value={trip.departure_date}
                      onChange={(e) =>
                        handleTripChange(idx, "departure_date", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Time <span className="text-red">*</span>
                    </label>
                    <input
                      type="time"
                      value={trip.departure_time}
                      onChange={(e) =>
                        handleTripChange(idx, "departure_time", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Location <span className="text-red">*</span>
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Arrival */}
              <div>
                <p className="text-sm font-medium text-green mb-2">Arrival</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Date <span className="text-red">*</span>
                    </label>
                    <input
                      type="date"
                      value={trip.arrival_date}
                      onChange={(e) =>
                        handleTripChange(idx, "arrival_date", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Time <span className="text-red">*</span>
                    </label>
                    <input
                      type="time"
                      value={trip.arrival_time}
                      onChange={(e) =>
                        handleTripChange(idx, "arrival_time", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondarytext mb-1">
                      Location <span className="text-red">*</span>
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Passengers & Outcome */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs text-secondarytext mb-1">
                    Contact Details of Persons
                  </label>
                  <input
                    type="text"
                    value={trip.passenger_contacts}
                    onChange={(e) =>
                      handleTripChange(
                        idx,
                        "passenger_contacts",
                        e.target.value,
                      )
                    }
                    placeholder="Phone numbers / emails"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-secondarytext mb-1">
                  Task ID
                </label>
                <input
                  type="text"
                  value={trip.task_id}
                  onChange={(e) =>
                    handleTripChange(idx, "task_id", e.target.value)
                  }
                  placeholder="Task ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-secondarytext mb-1">
                  Auditable
                </label>
                <input
                  type="text"
                  value={trip.outcome_auditable}
                  onChange={(e) =>
                    handleTripChange(idx, "outcome_auditable", e.target.value)
                  }
                  placeholder="e.g., Skill, Placement/Internship, Awards, Infrastructure"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
          ))}

          {form.trip_type === "multi_stop" && (
            <button
              onClick={addTrip}
              className="w-full py-2.5 border-2 border-dashed border-primary/30 text-primary rounded-md hover:bg-primary/5 transition-colors text-sm font-medium"
            >
              + Add Another Trip Leg
            </button>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-gray-200 text-secondarytext rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (validateStep2()) setStep(3);
              }}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Review Summary */}
          <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-primarytext border-b border-gray-100 pb-3">
              Review Your Request
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-secondarytext">Faculty:</span>
                <span className="text-primarytext font-medium">
                  {profile?.full_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Department:</span>
                <span className="text-primarytext font-medium">
                  {profile?.department}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Trip Type:</span>
                <span className="text-primarytext font-medium">
                  {getTripTypeLabel(form.trip_type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Request Under:</span>
                <span className="text-primarytext font-medium">
                  {getRequestUnderLabel(form.request_under)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Vertical:</span>
                <span className="text-primarytext font-medium">
                  {form.vertical}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Total Passengers:</span>
                <span className="text-primarytext font-medium">
                  {form.total_passengers}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondarytext">Oral Approval:</span>
                <span className="text-primarytext font-medium">
                  {form.oral_approval ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-sm text-secondarytext">Purpose:</span>
              <p className="mt-1 text-sm text-primarytext bg-primarybg rounded-md p-3">
                {form.purpose}
              </p>
            </div>
          </div>

          {/* Trip Legs Summary */}
          {trips.map((trip, idx) => (
            <div
              key={idx}
              className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5"
            >
              <h3 className="text-sm font-semibold text-primarytext mb-3">
                Trip Leg {idx + 1}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-primarybg rounded-md p-3">
                  <p className="text-xs text-primary font-medium mb-1">
                    Departure
                  </p>
                  <p className="text-primarytext">
                    {trip.departure_date} at {trip.departure_time}
                  </p>
                  <p className="text-secondarytext">
                    {trip.departure_location}
                  </p>
                </div>
                <div className="bg-primarybg rounded-md p-3">
                  <p className="text-xs text-green font-medium mb-1">Arrival</p>
                  <p className="text-primarytext">
                    {trip.arrival_date} at {trip.arrival_time}
                  </p>
                  <p className="text-secondarytext">{trip.arrival_location}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-secondarytext">
                {trip.task_id && `Task: ${trip.task_id}`}
                {trip.task_id && trip.outcome_auditable && " · "}
                {trip.outcome_auditable && `Auditable: ${trip.outcome_auditable}`}
              </div>
            </div>
          ))}

          {/* Declaration */}
          <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-primarytext mb-3">
              Declaration
            </h3>
            <div className="bg-primarybg rounded-md p-4 mb-4">
              <p className="text-sm text-secondarytext leading-relaxed">
                I hereby declare that I have read and understood the{" "}
                <span className="text-primary font-medium">
                  BIT Transport Request Guidelines
                </span>
                . I confirm that all the information provided above is accurate
                and the trip is for official purposes only. I understand that
                any misuse may result in disciplinary action.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.declaration_accepted}
                onChange={(e) =>
                  handleFormChange("declaration_accepted", e.target.checked)
                }
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-primarytext">
                I have read the guidelines and accept the declaration above{" "}
                <span className="text-red">*</span>
              </span>
            </label>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border border-gray-200 text-secondarytext rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Back
            </button>
            <button
              disabled={submitting || !form.declaration_accepted}
              onClick={handleSubmit}
              className="px-8 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
