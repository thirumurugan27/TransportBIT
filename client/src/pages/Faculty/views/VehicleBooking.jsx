import React, {useState, useEffect} from "react";
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
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const STATUS_TABS = [
  {key: "all", label: "All", icon: FileText},
  {key: "pending", label: "Pending", icon: Clock},
  {key: "approved", label: "Approved", icon: CheckCircle},
  {key: "rejected", label: "Rejected", icon: XCircle},
  {key: "assigned", label: "Assigned", icon: Truck},
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
  {value: "one_way", label: "One Way"},
  {value: "round_trip", label: "Round Trip"},
  {value: "multi_stop", label: "Multi Stop"},
];

const emptyTrip = {
  trip_order: 1,
  departure_date: "",
  departure_time: "",
  departure_location: "",
  arrival_date: "",
  arrival_time: "",
  arrival_location: "",
  num_passengers: 1,
  passenger_contacts: "",
  outcome_auditable: "",
};

export default function VehicleBooking() {
  const {showToast} = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Form states
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const initialFormState = {
    trip_type: "one_way",
    request_under: "",
    oral_approval: false,
    purpose: "",
    total_passengers: 1,
    mteam_approval: false,
    mteam_approved_by: "",
    declaration_accepted: false,
  };
  const [form, setForm] = useState(initialFormState);
  const [trips, setTrips] = useState([{...emptyTrip}]);

  useEffect(() => {
    fetchRequests();
    fetchProfile();
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

  // Form handlers
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
    if (!form.purpose.trim()) {
      showToast("Purpose of trip is required", "warning");
      return false;
    }
    if (!form.request_under.trim()) {
      showToast("Request Under field is required", "warning");
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
      if (t.num_passengers < 1) {
        showToast(`Trip ${i + 1}: At least 1 passenger required`, "warning");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!form.declaration_accepted) {
      showToast("You must accept the declaration to submit", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");

      // Transform data to match backend expected format
      const onwardTrip = trips[0] || {};
      const returnTrip = trips.length > 1 ? trips[1] : null;

      const requestBody = {
        booking_type: "faculty",
        trip_type: form.trip_type,
        trip_mode: "official",
        request_under: form.request_under,
        purpose: form.purpose,
        count_person: parseInt(form.total_passengers) || 1,

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
        closeNewRequestModal();
        fetchRequests();
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

  const openNewRequestModal = () => {
    setForm(initialFormState);
    setTrips([{...emptyTrip}]);
    setStep(1);
    setShowNewRequestModal(true);
  };

  const closeNewRequestModal = () => {
    setShowNewRequestModal(false);
    setForm(initialFormState);
    setTrips([{...emptyTrip}]);
    setStep(1);
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
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

      {/* Status Tabs */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100">
        <div className="flex items-center gap-1 p-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-secondarytext hover:bg-gray-50 hover:text-primarytext"
                }`}
              >
                <TabIcon size={16} />
                {tab.label}
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      isActive ? "bg-white/20" : "bg-gray-100"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-md p-4 shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext w-4 h-4" />
          <input
            type="text"
            placeholder="Search by purpose, request under, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm text-primarytext"
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
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map((req, idx) => {
                  const cfg =
                    STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;

                  const departureDateTime = req.onward_from_datetime;
                  const departurePlace = req.onward_from_place;
                  const arrivalPlace = req.onward_to_place;
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
                        <span className="inline-flex px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium capitalize">
                          {req.trip_type?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondarytext">
                        {departureDateTime || departurePlace ? (
                          <div>
                            <p className="text-primarytext font-medium">
                              {departureDateTime || "-"}
                            </p>
                            <p className="text-xs">
                              {departurePlace
                                ? `${departurePlace}${arrivalPlace ? ` → ${arrivalPlace}` : ""}`
                                : "-"}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondarytext">
                        {req.request_under || "-"}
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

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
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
                      <input
                        type="text"
                        value={form.request_under}
                        onChange={(e) =>
                          handleFormChange("request_under", e.target.value)
                        }
                        placeholder="e.g., HOD / Dean"
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div>
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

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          min="1"
                          value={trip.num_passengers}
                          onChange={(e) =>
                            handleTripChange(
                              idx,
                              "num_passengers",
                              e.target.value,
                            )
                          }
                          placeholder="No. of passengers"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
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
                        <p className="font-medium text-primarytext capitalize">
                          {form.trip_type.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">
                          Request Under:
                        </span>
                        <p className="font-medium text-primarytext">
                          {form.request_under}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-md shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-primarytext">Request</h3>
                {(() => {
                  const cfg =
                    STATUS_CONFIG[selectedRequest.status] ||
                    STATUS_CONFIG.pending;
                  return (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${cfg.badge}`}
                    >
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-secondarytext">Trip Type:</span>
                  <p className="font-medium text-primarytext capitalize">
                    {selectedRequest.trip_type?.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Request Under:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.request_under || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Total Passengers:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.total_passengers}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Submitted:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.created_at}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-sm text-secondarytext">Purpose:</span>
                <p className="mt-1 text-sm text-primarytext bg-primarybg rounded-md p-3">
                  {selectedRequest.purpose}
                </p>
              </div>

              {/* Trip Details */}
              {selectedRequest.trips?.map((trip, idx) => (
                <div
                  key={idx}
                  className="border border-gray-100 rounded-md p-4"
                >
                  <p className="text-sm font-semibold text-primarytext mb-2">
                    Trip Leg {trip.trip_order}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-primarybg rounded-md p-3">
                      <p className="text-primary font-medium mb-1">Departure</p>
                      <p className="text-primarytext">
                        {trip.departure_date} at {trip.departure_time}
                      </p>
                      <p className="text-secondarytext">
                        {trip.departure_location}
                      </p>
                    </div>
                    <div className="bg-primarybg rounded-md p-3">
                      <p className="text-green font-medium mb-1">Arrival</p>
                      <p className="text-primarytext">
                        {trip.arrival_date} at {trip.arrival_time}
                      </p>
                      <p className="text-secondarytext">
                        {trip.arrival_location}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Vehicle Assignment */}
              {selectedRequest.status === "assigned" && (
                <div className="bg-green/5 border border-green/20 rounded-md p-4">
                  <p className="text-sm font-semibold text-green mb-2">
                    Vehicle Assigned
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-secondarytext">Vehicle:</span>
                      <p className="font-medium text-primarytext">
                        {selectedRequest.vehicle_name ||
                          selectedRequest.vehicle_number}
                      </p>
                    </div>
                    <div>
                      <span className="text-secondarytext">Driver:</span>
                      <p className="font-medium text-primarytext">
                        {selectedRequest.driver_name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Remarks */}
              {selectedRequest.admin_remarks && (
                <div className="bg-primarybg rounded-md p-3">
                  <span className="text-xs text-secondarytext">
                    Admin Remarks:
                  </span>
                  <p className="text-sm text-primarytext mt-1">
                    {selectedRequest.admin_remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedRequest.status === "pending" && (
              <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
                <button
                  onClick={() => handleCancel(selectedRequest.id)}
                  className="px-5 py-2 bg-red text-white rounded-md hover:bg-red/90 transition-colors text-sm font-medium"
                >
                  Cancel Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
