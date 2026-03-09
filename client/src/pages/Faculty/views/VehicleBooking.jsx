import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  Eye,
  X,
  MapPin,
  Calendar,
  User,
  Search,
  Plus,
  FileText,
  ChevronDown,
  Loader2,
  Key,
  Play,
  Phone,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const STATUS_TABS = [
  {key: "all", label: "All", icon: FileText},
  {key: "pending", label: "Pending", icon: Clock},
  {key: "approved", label: "Approved", icon: CheckCircle},
  {key: "rejected", label: "Rejected", icon: XCircle},
  {key: "assigned", label: "Assigned", icon: Truck},
  {key: "trip_started", label: "In Progress", icon: Play},
  {key: "completed", label: "Completed", icon: CheckCircle},
  {key: "cancelled", label: "Cancelled", icon: XCircle},
];

const STATUS_CONFIG = {
  pending: {
    color: "bg-pending/10 text-pending border-pending/20",
    badge: "bg-pending text-white",
    label: "Pending",
  },
  approved: {
    color: "bg-primary/10 text-primary border-primary/20",
    badge: "bg-primary text-white",
    label: "Approved",
  },
  rejected: {
    color: "bg-red/10 text-red border-red/20",
    badge: "bg-red text-white",
    label: "Rejected",
  },
  assigned: {
    color: "bg-green/10 text-green border-green/20",
    badge: "bg-green text-white",
    label: "Assigned",
  },
  trip_started: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    badge: "bg-blue-600 text-white",
    label: "Trip Started",
  },
  completed: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    badge: "bg-gray-500 text-white",
    label: "Completed",
  },
  cancelled: {
    color: "bg-gray-100 text-gray-400 border-gray-200",
    badge: "bg-gray-400 text-white",
    label: "Cancelled",
  },
};

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

// Date/time formatting removed - displaying raw values
// const formatTime12Hour = (time24) => {
//   if (!time24) return "N/A";
//   const [hours, minutes] = time24.split(":");
//   const hour = parseInt(hours);
//   const ampm = hour >= 12 ? "PM" : "AM";
//   const hour12 = hour % 12 || 12;
//   return `${hour12}:${minutes} ${ampm}`;
// };

// const formatDateTime = (datetime) => {
//   if (!datetime) return "N/A";
//   try {
//     const date = new Date(datetime);
//     const month = String(date.getMonth() + 1).padStart(2, "0");
//     const day = String(date.getDate()).padStart(2, "0");
//     const year = date.getFullYear();
//     const hours = date.getHours();
//     const minutes = String(date.getMinutes()).padStart(2, "0");
//     const ampm = hours >= 12 ? "PM" : "AM";
//     const hour12 = hours % 12 || 12;
//     return `${month}-${day}-${year} ${hour12}:${minutes} ${ampm}`;
//   } catch {
//     return datetime;
//   }
// };

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

export default function VehicleBooking() {
  const {showToast} = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [otpData, setOtpData] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/faculty/vehicle-requests`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    const confirmed = await showConfirm(
      "Cancel Request?",
      "This will cancel your vehicle request.",
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/faculty/vehicle-request/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({request_id: requestId}),
        },
      );
      if (res.ok) {
        showToast("Request cancelled", "success");
        fetchRequests();
        setShowDetailsModal(false);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  const openNewRequestModal = () => {
    navigate("/faculty-dashboard/new-request");
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
    setOtpData(null);
    if (request.status === "assigned" || request.status === "trip_started") {
      setOtpLoading(true);
      const token = localStorage.getItem("token");
      fetch(`${API_BASE}/api/faculty/vehicle-request/${request.id}/otp`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setOtpData(data))
        .catch(console.error)
        .finally(() => setOtpLoading(false));
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    const matchesTab = activeTab === "all" || r.status === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      r.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.request_under?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id?.toString().includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  // Get counts for tabs
  const getCounts = () => {
    const counts = {all: requests.length};
    STATUS_TABS.slice(1).forEach((tab) => {
      counts[tab.key] = requests.filter((r) => r.status === tab.key).length;
    });
    return counts;
  };
  const counts = getCounts();

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">
            Vehicle Booking
          </h1>
          <p className="text-sm text-secondarytext mt-1">
            Request and track your vehicle bookings
          </p>
        </div>
        <button
          onClick={openNewRequestModal}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primarydull text-white px-6 py-2.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md"
        >
          <Plus size={18} />
          New Request
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-md p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext w-4 h-4" />
            <input
              type="text"
              placeholder="Search by purpose, request under, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm text-primarytext"
            />
          </div>
          <CustomDropdown
            value={activeTab}
            onChange={setActiveTab}
            options={STATUS_TABS.map((t) => ({
              value: t.key,
              label: t.label,
              icon: t.icon,
            }))}
            width="w-44"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-primarybg w-16 h-16 rounded-md flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-secondarytext" />
            </div>
            <h3 className="text-primarytext font-medium mb-1">
              No Requests Found
            </h3>
            <p className="text-secondarytext text-sm mb-4">
              {activeTab === "all"
                ? "You haven't submitted any vehicle requests yet."
                : `No ${activeTab} requests found.`}
            </p>
            <button
              onClick={openNewRequestModal}
              className="px-5 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Submit a Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">S.No</th>
                  <th className="px-6 py-4">Purpose</th>
                  <th className="px-6 py-4">Trip Type</th>
                  <th className="px-6 py-4">Departure</th>
                  <th className="px-6 py-4">Request Under</th>
                  <th className="px-6 py-4">Vertical</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map((req, idx) => {
                  const cfg =
                    STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;

                  const departureDateTime = req.onward_from_datetime;
                  const routeDisplay =
                    req.trips?.length > 1
                      ? [
                          req.trips[0].departure_location,
                          ...req.trips.map((t) => t.arrival_location),
                        ].join(" → ")
                      : req.trips?.length === 1
                        ? `${req.trips[0].departure_location}${req.trips[0].arrival_location ? ` → ${req.trips[0].arrival_location}` : ""}`
                        : req.onward_from_place
                          ? `${req.onward_from_place}${req.onward_to_place ? ` → ${req.onward_to_place}` : ""}`
                          : null;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => openDetails(req)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-primary">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 text-sm text-primarytext max-w-[200px] truncate">
                        {req.purpose}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                          {getTripTypeLabel(req.trip_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondarytext">
                        {departureDateTime || routeDisplay ? (
                          <div>
                            <p className="text-primarytext font-medium">
                              {departureDateTime || "-"}
                            </p>
                            <p className="text-xs">{routeDisplay || "-"}</p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondarytext">
                        {getRequestUnderLabel(req.request_under)}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondarytext">
                        {req.vertical || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-500 flex justify-between items-center">
          <span>
            Showing {filteredRequests.length} of {requests.length} requests
          </span>
        </div>
      </div>

      {/* New Request Modal - Removed: Now uses full page at /new-vehicle-request */}
      {false && showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  New Vehicle Request
                </h3>
                <p className="text-xs text-secondarytext mt-0.5">
                  Step {step} of 3
                </p>
              </div>
              <button
                onClick={closeNewRequestModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between max-w-md mx-auto">
                {[
                  {num: 1, label: "Trip Info"},
                  {num: 2, label: "Trip Details"},
                  {num: 3, label: "Review"},
                ].map((s, i) => (
                  <React.Fragment key={s.num}>
                    {i > 0 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${step >= s.num ? "bg-primary" : "bg-gray-200"}`}
                      />
                    )}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
                        step === s.num
                          ? "bg-primary text-white"
                          : step > s.num
                            ? "bg-primary/10 text-primary"
                            : "bg-gray-100 text-secondarytext"
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                        {s.num}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Step 1: Trip Info */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Important Instructions */}
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-xs text-blue-800 space-y-1.5">
                    <p className="font-semibold">Important Information:</p>
                    <p>
                      1. Each request must be submitted for guest Pick up and
                      drop separately.
                    </p>
                    <p>
                      2. For faculty external visit single submission is enough
                      for round trip.
                    </p>
                    <p>
                      3. For local Sathy transport requests, submitting this
                      form alone is sufficient; an Apex request is not
                      mandatory.
                    </p>
                  </div>

                  {/* Faculty Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-secondarytext mb-1">
                        Faculty Name
                      </label>
                      <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                        {profile?.full_name || "-"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondarytext mb-1">
                        Department
                      </label>
                      <p className="px-3 py-2 bg-primarybg rounded-md text-sm text-primarytext">
                        {profile?.department || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-secondarytext mb-1">
                        Trip Type <span className="text-red">*</span>
                      </label>
                      <select
                        value={form.trip_type}
                        onChange={(e) =>
                          handleFormChange("trip_type", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      >
                        {TRIP_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondarytext mb-1">
                        Request Under <span className="text-red">*</span>
                      </label>
                      <select
                        value={form.request_under}
                        onChange={(e) => {
                          handleFormChange("request_under", e.target.value);
                          handleFormChange("vertical", "");
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
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
                      <label className="block text-xs font-medium text-secondarytext mb-1">
                        Vertical <span className="text-red">*</span>
                      </label>
                      <select
                        value={form.vertical}
                        onChange={(e) =>
                          handleFormChange("vertical", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
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
                    <div className="mb-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-secondarytext">
                      <p className="font-semibold mb-1">
                        Please specify the reason for the trip accurately, as it
                        will be included in the monthly report for documentation
                        and audit purposes.
                      </p>
                      <p className="mb-1">Examples:</p>
                      <ul className="list-disc pl-4 space-y-1">
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
                    <label className="block text-xs font-medium text-secondarytext mb-1">
                      Purpose of Trip <span className="text-red">*</span>
                    </label>
                    <textarea
                      value={form.purpose}
                      onChange={(e) =>
                        handleFormChange("purpose", e.target.value)
                      }
                      rows={3}
                      placeholder="Describe the purpose..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-secondarytext mb-1">
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
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.oral_approval}
                          onChange={(e) =>
                            handleFormChange("oral_approval", e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-primarytext">
                          Oral Approval
                        </span>
                      </label>
                    </div>
                    <div className="flex items-end">
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
                      <label className="block text-xs font-medium text-secondarytext mb-1">
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
                </div>
              )}

              {/* Step 2: Trip Details */}
              {step === 2 && (
                <div className="space-y-4">
                  {trips.map((trip, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-md p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-primarytext">
                          Trip Leg {idx + 1}
                        </h4>
                        {trips.length > 1 && (
                          <button
                            onClick={() => removeTrip(idx)}
                            className="text-xs text-red hover:text-red/80 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Departure */}
                      <div>
                        <p className="text-xs font-medium text-primary mb-2">
                          Departure
                        </p>
                        <div className="mb-2 p-2.5 bg-yellow-50 rounded border border-yellow-100 text-xs text-secondarytext">
                          <p className="font-bold text-yellow-800 mb-1">
                            Vehicle Departure Timing
                          </p>
                          <p className="mb-1">
                            Respect to the pick up location
                          </p>
                          <p className="mb-1">
                            Vehicles will depart from BIT campus 2 minutes per
                            kilometer in advance of the scheduled pick-up time.
                          </p>
                          <p className="italic mb-1">
                            Example: For a pick-up location 60 km away and
                            scheduled at 8:00 AM, the vehicle will leave BIT
                            campus by 6:00 AM (i.e., 120 minutes/2 hours in
                            advance).
                          </p>
                          <p className="font-medium">
                            Please plan accordingly, keeping in mind possible
                            traffic and other delays.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
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
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
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
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
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
                            placeholder="Location"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      {/* Arrival */}
                      <div>
                        <p className="text-xs font-medium text-green mb-2">
                          Arrival
                        </p>
                        <div className="mb-2 p-2.5 bg-green-50 rounded border border-green-100 text-xs text-secondarytext">
                          <p className="font-bold text-green-800 mb-1">
                            Expected arrival time
                          </p>
                          <p className="mb-1">
                            Respect to the expected visit (1st) location:
                          </p>
                          <p className="mb-1">
                            Once the vehicle is picked up from the location, it
                            will take a minimum of 2 minutes per kilometer to
                            reach the destination.
                          </p>
                          <p className="italic mb-1">
                            Example: For a distance of 60 km after pick-up, the
                            vehicle will take at least 120 minutes (2 hours) to
                            reach the destination.
                          </p>
                          <p className="font-medium">
                            Please plan your schedule accordingly, considering
                            this minimum travel time along with any possible
                            traffic or delays.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <input
                            type="date"
                            value={trip.arrival_date}
                            onChange={(e) =>
                              handleTripChange(
                                idx,
                                "arrival_date",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
                          <input
                            type="time"
                            value={trip.arrival_time}
                            onChange={(e) =>
                              handleTripChange(
                                idx,
                                "arrival_time",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
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
                            placeholder="Location"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
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
                          placeholder="Contact details"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>

                      <div>
                        <div className="mb-2 p-2.5 bg-gray-50 rounded border border-gray-200 text-xs text-secondarytext">
                          <p className="font-bold mb-1">
                            TASK ID/INVMR: eg: T123456/INVMR1234
                          </p>
                          <p className="text-red-600 font-semibold mb-2">
                            **For Local sathyamangalam request mention: "Local"
                          </p>
                          <ol className="list-decimal pl-4 space-y-0.5 text-xs">
                            <li>
                              The Apex request, including transport, must be
                              submitted through the Inventory Apex request form
                              for proper approval. The Task ID from the same
                              request, which is essential for assigning the
                              vehicle, can be obtained from the Apex request
                              submitted through Inventory team.
                            </li>
                            <li>
                              Even if only a guest pick-up is required, the Apex
                              request process is mandatory to obtain the Task
                              ID, Mteam assignment, and subsequent approval.
                            </li>
                            <li>
                              Tasks will be assigned based on the requests
                              submitted to Inventory. Once IQAC assigns the task
                              to the request, the end user is then requested to
                              fill out this form for further processing and
                              automation.
                            </li>
                            <li>
                              If the task has not yet been assigned, the Apex
                              requested inventory reference number (e.g.,
                              INVMR1234), which is generated by default for the
                              submitted request, should be entered temporarily.
                              Once the task is assigned, the Task ID will be
                              auto-fetched and processed.
                            </li>
                            <li>
                              Please check the Inventory sheet for submitting
                              your request to confirm the status and retrieve
                              the reference number.
                            </li>
                          </ol>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <input
                            type="text"
                            value={trip.task_id}
                            onChange={(e) =>
                              handleTripChange(idx, "task_id", e.target.value)
                            }
                            placeholder="Task ID"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 p-2.5 bg-gray-50 rounded border border-gray-200 text-xs text-secondarytext">
                          <p className="font-bold mb-1">
                            Outcome expected & Auditable:
                          </p>
                          <p className="mb-1">eg:</p>
                          <ul className="list-disc pl-4 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                            <li>Infrastructure</li>
                            <li>Regular Maintenance</li>
                            <li>Skill</li>
                            <li>Placement / Internship</li>
                            <li>Product development</li>
                            <li>Awards / Students Achievements</li>
                          </ul>
                        </div>
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
                          placeholder="e.g., Skill, Placement/Internship, Awards, Infrastructure"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  {(form.trip_type === "round_trip" ||
                    form.trip_type === "multi_stop") && (
                    <button
                      onClick={addTrip}
                      className="w-full py-2.5 border-2 border-dashed border-primary/30 text-primary rounded-md hover:bg-primary/5 transition-colors text-sm font-medium"
                    >
                      + Add Another Trip Leg
                    </button>
                  )}
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-primarybg rounded-md p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-primarytext">
                      Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-secondarytext">Trip Type:</span>
                        <p className="font-medium text-primarytext">
                          {getTripTypeLabel(form.trip_type)}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">
                          Request Under:
                        </span>
                        <p className="font-medium text-primarytext">
                          {getRequestUnderLabel(form.request_under)}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">Vertical:</span>
                        <p className="font-medium text-primarytext">
                          {form.vertical}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">Passengers:</span>
                        <p className="font-medium text-primarytext">
                          {form.total_passengers}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-secondarytext text-sm">
                        Purpose:
                      </span>
                      <p className="text-sm text-primarytext mt-1">
                        {form.purpose}
                      </p>
                    </div>
                  </div>

                  {trips.map((trip, idx) => (
                    <div key={idx} className="bg-primarybg rounded-md p-4">
                      <p className="text-sm font-semibold text-primarytext mb-2">
                        Trip Leg {idx + 1}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-primary font-medium">Departure</p>
                          <p className="text-primarytext">
                            {trip.departure_date} at {trip.departure_time}
                          </p>
                          <p className="text-secondarytext">
                            {trip.departure_location}
                          </p>
                        </div>
                        <div>
                          <p className="text-green font-medium">Arrival</p>
                          <p className="text-primarytext">
                            {trip.arrival_date} at {trip.arrival_time}
                          </p>
                          <p className="text-secondarytext">
                            {trip.arrival_location}
                          </p>
                        </div>
                      </div>
                      {(trip.task_id || trip.outcome_auditable) && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                          {trip.task_id && (
                            <p>
                              <span className="text-secondarytext">
                                Task ID:
                              </span>{" "}
                              <span className="text-primarytext">
                                {trip.task_id}
                              </span>
                            </p>
                          )}
                          {trip.outcome_auditable && (
                            <p>
                              <span className="text-secondarytext">
                                Auditable:
                              </span>{" "}
                              <span className="text-primarytext">
                                {trip.outcome_auditable}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Declaration */}
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-xs text-secondarytext mb-3">
                      I hereby declare that all information is accurate and the
                      trip is for official purposes only.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.declaration_accepted}
                        onChange={(e) =>
                          handleFormChange(
                            "declaration_accepted",
                            e.target.checked,
                          )
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-primarytext">
                        I accept the declaration{" "}
                        <span className="text-red">*</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <button
                onClick={
                  step === 1 ? closeNewRequestModal : () => setStep(step - 1)
                }
                className="px-5 py-2 border border-gray-200 text-secondarytext rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                {step === 1 ? "Cancel" : "Back"}
              </button>
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (step === 1 && validateStep1()) setStep(2);
                    else if (step === 2 && validateStep2()) setStep(3);
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={submitting || !form.declaration_accepted}
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 animate-fadeIn">
          <div className="bg-secondarybg w-full max-w-4xl rounded-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-100 animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 bg-primarybg border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center text-white shadow-sm"
                    style={{
                      backgroundColor: STATUS_CONFIG[
                        selectedRequest.status
                      ]?.badge.includes("primary")
                        ? "#7D53F6"
                        : STATUS_CONFIG[selectedRequest.status]?.badge.includes(
                              "green",
                            )
                          ? "#008000"
                          : STATUS_CONFIG[
                                selectedRequest.status
                              ]?.badge.includes("pending")
                            ? "#F0B041"
                            : STATUS_CONFIG[
                                  selectedRequest.status
                                ]?.badge.includes("red")
                              ? "#FF5555"
                              : "#9CA3AF",
                    }}
                  >
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primarytext">
                      {getTripTypeLabel(selectedRequest.trip_type)}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(() => {
                        const cfg =
                          STATUS_CONFIG[selectedRequest.status] ||
                          STATUS_CONFIG.pending;
                        return (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${cfg.badge}`}
                          >
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-secondarytext hover:text-primarytext hover:bg-gray-200 transition-colors p-1.5 rounded-md"
                >
                  <X size={20} />
                </button>
              </div>
              {selectedRequest.purpose && (
                <p className="text-sm text-secondarytext mt-3 italic">
                  "{selectedRequest.purpose}"
                </p>
              )}
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Trip Information Grid */}
              <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-3">
                  Trip Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondarybg rounded-md p-3">
                    <p className="text-xs text-secondarytext mb-1">
                      Request Under
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {getRequestUnderLabel(selectedRequest.request_under) ||
                        "-"}
                    </p>
                  </div>
                  <div className="bg-secondarybg rounded-md p-3">
                    <p className="text-xs text-secondarytext mb-1">Vertical</p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedRequest.vertical || "-"}
                    </p>
                  </div>
                  <div className="bg-secondarybg rounded-md p-3">
                    <p className="text-xs text-secondarytext mb-1">
                      Passengers
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedRequest.count_person ||
                        selectedRequest.total_passengers ||
                        1}{" "}
                      Person(s)
                    </p>
                  </div>
                  <div className="bg-secondarybg rounded-md p-3">
                    <p className="text-xs text-secondarytext mb-1">Submitted</p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedRequest.created_at}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trip Journey Details — unified section */}
              {(() => {
                const tripLegs =
                  selectedRequest.trips?.length > 0
                    ? selectedRequest.trips
                    : selectedRequest.onward_from_place
                      ? [
                          {
                            trip_order: 1,
                            departure_location:
                              selectedRequest.onward_from_place,
                            departure_date:
                              selectedRequest.onward_from_datetime?.split(
                                " ",
                              )[0] || "",
                            departure_time:
                              selectedRequest.onward_from_datetime
                                ?.split(" ")
                                .slice(1)
                                .join(" ") || "",
                            arrival_location: selectedRequest.onward_to_place,
                            arrival_date:
                              selectedRequest.onward_to_datetime?.split(
                                " ",
                              )[0] || "",
                            arrival_time:
                              selectedRequest.onward_to_datetime
                                ?.split(" ")
                                .slice(1)
                                .join(" ") || "",
                          },
                          ...(selectedRequest.return_from_place
                            ? [
                                {
                                  trip_order: 2,
                                  departure_location:
                                    selectedRequest.return_from_place,
                                  departure_date:
                                    selectedRequest.return_from_datetime?.split(
                                      " ",
                                    )[0] || "",
                                  departure_time:
                                    selectedRequest.return_from_datetime
                                      ?.split(" ")
                                      .slice(1)
                                      .join(" ") || "",
                                  arrival_location:
                                    selectedRequest.return_to_place,
                                  arrival_date:
                                    selectedRequest.return_to_datetime?.split(
                                      " ",
                                    )[0] || "",
                                  arrival_time:
                                    selectedRequest.return_to_datetime
                                      ?.split(" ")
                                      .slice(1)
                                      .join(" ") || "",
                                },
                              ]
                            : []),
                        ]
                      : [];

                if (tripLegs.length === 0) return null;

                return (
                  <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-3 flex items-center gap-2">
                      <MapPin size={14} className="text-primary" />
                      Trip Itinerary
                      {tripLegs.length > 1 && (
                        <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                          {tripLegs.length} Legs
                        </span>
                      )}
                    </h4>
                    <div className="space-y-3">
                      {tripLegs.map((trip, idx) => (
                        <div
                          key={idx}
                          className="bg-secondarybg rounded-md p-3 border border-gray-100 relative"
                        >
                          {tripLegs.length > 1 && (
                            <span className="absolute top-2.5 right-2.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              Leg {trip.trip_order || idx + 1}
                            </span>
                          )}
                          <div className="grid grid-cols-2 gap-3 pr-10">
                            {/* Departure */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                                  From
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-primarytext leading-tight mb-1">
                                {trip.departure_location || "—"}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {trip.departure_date && (
                                  <span className="inline-flex items-center gap-1.5 bg-primarybg border border-gray-200 text-primarytext font-semibold text-xs px-2.5 py-1.5 rounded">
                                    <Calendar
                                      size={11}
                                      className="text-primary shrink-0"
                                    />
                                    {trip.departure_date}
                                  </span>
                                )}
                                {trip.departure_time && (
                                  <span className="inline-flex items-center gap-1.5 bg-primarybg border border-gray-200 text-primarytext font-semibold text-xs px-2.5 py-1.5 rounded">
                                    <Clock
                                      size={11}
                                      className="text-secondarytext shrink-0"
                                    />
                                    {trip.departure_time}
                                  </span>
                                )}
                              </div>
                              {idx === 0 && selectedRequest.trip_started_at && (
                                <p className="text-[10px] text-green font-semibold flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100">
                                  <CheckCircle size={10} />
                                  Started: {selectedRequest.trip_started_at}
                                </p>
                              )}
                            </div>
                            {/* Arrival */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-green shrink-0" />
                                <span className="text-[10px] font-bold text-green uppercase tracking-wide">
                                  To
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-primarytext leading-tight mb-1">
                                {trip.arrival_location || "—"}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {trip.arrival_date && (
                                  <span className="inline-flex items-center gap-1.5 bg-primarybg border border-gray-200 text-primarytext font-semibold text-xs px-2.5 py-1.5 rounded">
                                    <Calendar
                                      size={11}
                                      className="text-primary shrink-0"
                                    />
                                    {trip.arrival_date}
                                  </span>
                                )}
                                {trip.arrival_time && (
                                  <span className="inline-flex items-center gap-1.5 bg-primarybg border border-gray-200 text-primarytext font-semibold text-xs px-2.5 py-1.5 rounded">
                                    <Clock
                                      size={11}
                                      className="text-secondarytext shrink-0"
                                    />
                                    {trip.arrival_time}
                                  </span>
                                )}
                              </div>
                              {idx === tripLegs.length - 1 &&
                                selectedRequest.trip_ended_at && (
                                  <p className="text-[10px] text-green font-semibold flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100">
                                    <CheckCircle size={10} />
                                    Ended: {selectedRequest.trip_ended_at}
                                  </p>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Travelling Person Details */}
              {(selectedRequest.traveller_name ||
                selectedRequest.traveller_mobile ||
                selectedRequest.traveller_address) && (
                <div className="bg-teal-50 rounded-md border border-teal-200 p-4">
                  <h4 className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-3">
                    Travelling Person Details
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedRequest.traveller_name && (
                      <div className="bg-white rounded-md p-3 border border-teal-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-md bg-teal-500/10 text-teal-600 flex items-center justify-center">
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-xs text-teal-600 font-medium">
                              Name
                            </p>
                            <p className="text-sm font-semibold text-primarytext">
                              {selectedRequest.traveller_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedRequest.traveller_mobile && (
                      <div className="bg-white rounded-md p-3 border border-teal-100">
                        <p className="text-xs text-teal-600 font-medium mb-1">
                          Mobile Number
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {selectedRequest.traveller_mobile}
                        </p>
                      </div>
                    )}
                    {selectedRequest.traveller_address && (
                      <div className="bg-white rounded-md p-3 border border-teal-100">
                        <p className="text-xs text-teal-600 font-medium mb-1">
                          Address
                        </p>
                        <p className="text-sm font-medium text-primarytext">
                          {selectedRequest.traveller_address}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle Assignment */}
              {(selectedRequest.status === "assigned" ||
                selectedRequest.status === "trip_started" ||
                selectedRequest.status === "completed") &&
                selectedRequest.vehicle_name && (
                  <div className="bg-green/10 border border-green/30 rounded-md p-4">
                    <h4 className="text-xs font-bold text-green uppercase tracking-wide mb-3">
                      Vehicle Assigned
                    </h4>
                    <div className="bg-secondarybg rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-green" />
                        <div>
                          <p className="text-xs text-secondarytext">Vehicle</p>
                          <p className="text-sm font-semibold text-primarytext">
                            {selectedRequest.vehicle_name ||
                              selectedRequest.vehicle_number}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <User size={16} className="text-green" />
                        <div>
                          <p className="text-xs text-secondarytext">Driver</p>
                          <p className="text-sm font-semibold text-primarytext">
                            {selectedRequest.driver_name}
                          </p>
                          {selectedRequest.driver_phone && (
                            <a
                              href={`tel:${selectedRequest.driver_phone}`}
                              className="text-xs text-primary font-medium flex items-center gap-1 mt-1 hover:underline"
                            >
                              <Phone size={12} />
                              {selectedRequest.driver_phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* OTP Section - Start Trip */}
              {otpData &&
                selectedRequest.status === "assigned" &&
                otpData.start_otp && (
                  <div className="bg-secondarybg rounded-md border border-gray-200 overflow-hidden">
                    <div className="bg-primary px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Play size={18} className="text-white" />
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            Start Trip OTP
                          </h4>
                          <p className="text-xs text-white/90 mt-0.5">
                            Provide this OTP to the driver to start the trip.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="bg-primarybg rounded-md p-4 text-center border border-gray-200">
                        <p className="text-3xl font-bold tracking-[0.3em] text-primary font-mono">
                          {otpData.start_otp}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* OTP Section - End Trip */}
              {otpData &&
                selectedRequest.status === "trip_started" &&
                otpData.end_otp && (
                  <div className="bg-secondarybg rounded-md border border-gray-200 overflow-hidden">
                    <div className="bg-green px-5 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-white" />
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            End Trip OTP
                          </h4>
                          <p className="text-xs text-white/90 mt-0.5">
                            Provide this OTP to the driver to complete the trip.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="bg-primarybg rounded-md p-4 text-center border border-gray-200">
                        <p className="text-3xl font-bold tracking-[0.3em] text-green font-mono">
                          {otpData.end_otp}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Admin Remarks */}
              {selectedRequest.admin_remarks && (
                <div className="bg-pending/10 border border-pending/30 rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-pending" />
                    <h4 className="text-xs font-bold text-pending uppercase tracking-wide">
                      Admin Remarks
                    </h4>
                  </div>
                  <p className="text-sm text-primarytext">
                    {selectedRequest.admin_remarks}
                  </p>
                </div>
              )}

              {/* OTP Loading */}
              {otpLoading &&
                (selectedRequest.status === "assigned" ||
                  selectedRequest.status === "trip_started") && (
                  <div className="bg-primarybg rounded-md border border-gray-200 p-4 text-center">
                    <Loading
                      fullScreen={false}
                      size="small"
                      text="Loading OTP..."
                    />
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-primarybg shrink-0 gap-3">
              {selectedRequest.status === "pending" && (
                <button
                  onClick={() => handleCancel(selectedRequest.id)}
                  className="px-5 py-2.5 bg-red text-white rounded-md hover:bg-red/90 transition-colors text-sm font-semibold"
                >
                  Cancel Request
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2.5 bg-gray-200 text-primarytext rounded-md hover:bg-gray-300 transition-colors text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
