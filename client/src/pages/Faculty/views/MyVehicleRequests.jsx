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
  Key,
  Play,
  Phone,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const STATUS_CONFIG = {
  pending: {
    color: "bg-pending/10 text-pending border-pending/20",
    icon: Clock,
    label: "Pending",
  },
  approved: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: CheckCircle,
    label: "Approved",
  },
  rejected: {
    color: "bg-red/10 text-red border-red/20",
    icon: XCircle,
    label: "Rejected",
  },
  assigned: {
    color: "bg-green/10 text-green border-green/20",
    icon: Truck,
    label: "Assigned",
  },
  trip_started: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Play,
    label: "Trip Started",
  },
  completed: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: CheckCircle,
    label: "Completed",
  },
  cancelled: {
    color: "bg-gray-100 text-gray-400 border-gray-200",
    icon: XCircle,
    label: "Cancelled",
  },
};

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

const getTripTypeLabel = (value) => {
  const found = TRIP_TYPES.find((t) => t.value === value);
  return found ? found.label : value?.replace(/_/g, " ") || "-";
};

const getRequestUnderLabel = (value) => {
  const found = REQUEST_UNDER_OPTIONS.find((r) => r.value === value);
  return found ? found.label : value || "-";
};

export default function MyVehicleRequests() {
  const navigate = useNavigate();
  const {showToast} = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
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
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  const fetchOTP = async (requestId) => {
    setOtpLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/faculty/vehicle-request/${requestId}/otp`,
        {
          headers: {Authorization: `Bearer ${token}`},
          credentials: "include",
        },
      );
      if (res.ok) {
        const data = await res.json();
        setOtpData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    setOtpData(null);
    if (req.status === "assigned" || req.status === "trip_started") {
      fetchOTP(req.id);
    }
  };

  const filteredRequests = filterStatus
    ? requests.filter((r) => r.status === filterStatus)
    : requests;

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">My Requests</h1>
          <p className="text-sm text-secondarytext mt-1">
            Track your vehicle booking requests
          </p>
        </div>
        <button
          onClick={() => navigate("/faculty-dashboard/new-request")}
          className="px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          + New Request
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = requests.filter((r) => r.status === key).length;
          const StatusIcon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={`p-3 rounded-md border text-left transition-all ${
                filterStatus === key
                  ? "ring-2 ring-primary border-primary"
                  : "border-gray-100 hover:border-gray-200"
              } bg-secondarybg`}
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon size={14} className={cfg.color.split(" ")[1]} />
                <span className="text-xs text-secondarytext">{cfg.label}</span>
              </div>
              <p className="text-lg font-bold text-primarytext">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Request List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-secondarytext mb-3" />
          <p className="text-secondarytext">No vehicle requests found</p>
          <button
            onClick={() => navigate("/faculty-dashboard/new-request")}
            className="mt-4 px-5 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Submit a Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req, idx) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;

            const departureDateTime = req.onward_from_datetime;
            const departurePlace = req.onward_from_place;
            const arrivalPlace = req.onward_to_place;

            return (
              <div
                key={req.id}
                className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectRequest(req)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-primarytext">
                        {idx + 1}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${cfg.color}`}
                      >
                        <StatusIcon size={12} />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-secondarytext bg-primarybg px-2 py-0.5 rounded-md">
                        {getTripTypeLabel(req.trip_type)}
                      </span>
                    </div>
                    <p className="text-sm text-primarytext truncate">
                      {req.purpose}
                    </p>
                    {(departureDateTime || departurePlace) && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-secondarytext">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {departureDateTime || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {departurePlace
                            ? `${departurePlace}${arrivalPlace ? ` → ${arrivalPlace}` : ""}`
                            : "-"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(req.status === "assigned" ||
                      req.status === "trip_started") && (
                      <div className="text-right text-xs">
                        <p className="text-green font-medium flex items-center gap-1">
                          <Truck size={12} />
                          {req.vehicle_name || req.vehicle_number}
                        </p>
                        <p className="text-secondarytext flex items-center gap-1">
                          <User size={12} />
                          {req.driver_name}
                        </p>
                        {req.driver_phone && (
                          <a
                            href={`tel:${req.driver_phone}`}
                            className="text-primary flex items-center gap-1 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone size={10} />
                            {req.driver_phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-primarytext">Request</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-md hover:bg-primarybg transition-colors"
              >
                <X size={18} className="text-secondarytext" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Badge */}
              {(() => {
                const cfg =
                  STATUS_CONFIG[selectedRequest.status] ||
                  STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium border ${cfg.color}`}
                  >
                    <StatusIcon size={14} />
                    {cfg.label}
                  </div>
                );
              })()}

              {/* Trip Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-secondarytext">Booking Type:</span>
                  <p className="font-medium text-primarytext capitalize">
                    {selectedRequest.booking_type || "Faculty"}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Trip Type:</span>
                  <p className="font-medium text-primarytext">
                    {getTripTypeLabel(selectedRequest.trip_type)}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Trip Mode:</span>
                  <p className="font-medium text-primarytext capitalize">
                    {selectedRequest.trip_mode || "Official"}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Request Under:</span>
                  <p className="font-medium text-primarytext">
                    {getRequestUnderLabel(selectedRequest.request_under)}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Vertical:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.vertical || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Total Passengers:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.count_person ||
                      selectedRequest.total_passengers ||
                      1}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Contact Name:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.contact_name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-secondarytext">Contact Phone:</span>
                  <p className="font-medium text-primarytext">
                    {selectedRequest.contact_phone || "-"}
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

              {/* Admin Remarks (if any) */}
              {selectedRequest.admin_remarks && (
                <div>
                  <span className="text-sm text-secondarytext">
                    Admin Remarks:
                  </span>
                  <p className="mt-1 text-sm text-primarytext bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    {selectedRequest.admin_remarks}
                  </p>
                </div>
              )}

              {/* Trip Details */}
              {selectedRequest.onward_from_place && (
                <div className="border border-gray-100 rounded-md p-4">
                  <p className="text-sm font-semibold text-primarytext mb-3">
                    Onward Journey
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-primary font-medium mb-1">From</p>
                      <p className="text-secondarytext mb-1">
                        {selectedRequest.onward_from_place}
                      </p>
                      {selectedRequest.onward_from_datetime && (
                        <p className="text-primarytext font-medium">
                          {selectedRequest.onward_from_datetime}
                        </p>
                      )}
                    </div>
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-green font-medium mb-1">To</p>
                      <p className="text-secondarytext mb-1">
                        {selectedRequest.onward_to_place}
                      </p>
                      {selectedRequest.onward_to_datetime && (
                        <p className="text-primarytext font-medium">
                          {selectedRequest.onward_to_datetime}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Return Trip */}
              {selectedRequest.return_from_place && (
                <div className="border border-gray-100 rounded-md p-4">
                  <p className="text-sm font-semibold text-primarytext mb-3">
                    Return Journey
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-primary font-medium mb-1">From</p>
                      <p className="text-secondarytext mb-1">
                        {selectedRequest.return_from_place}
                      </p>
                      {selectedRequest.return_from_datetime && (
                        <p className="text-primarytext font-medium">
                          {selectedRequest.return_from_datetime}
                        </p>
                      )}
                    </div>
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-green font-medium mb-1">To</p>
                      <p className="text-secondarytext mb-1">
                        {selectedRequest.return_to_place}
                      </p>
                      {selectedRequest.return_to_datetime && (
                        <p className="text-primarytext font-medium">
                          {selectedRequest.return_to_datetime}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Trip Legs */}
              {selectedRequest.trips?.map((trip, idx) => (
                <div
                  key={idx}
                  className="border border-gray-100 rounded-md p-4"
                >
                  <p className="text-sm font-semibold text-primarytext mb-2">
                    Trip Leg {trip.trip_order}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-primary font-medium mb-1">Departure</p>
                      <p className="text-primarytext">
                        {trip.departure_date} at {trip.departure_time}
                      </p>
                      <p className="text-secondarytext">
                        {trip.departure_location}
                      </p>
                    </div>
                    <div className="bg-primarybg rounded-md p-2.5">
                      <p className="text-green font-medium mb-1">Arrival</p>
                      <p className="text-primarytext">
                        {trip.arrival_date} at {trip.arrival_time}
                      </p>
                      <p className="text-secondarytext">
                        {trip.arrival_location}
                      </p>
                    </div>
                  </div>
                  {trip.outcome_auditable && (
                    <p className="mt-2 text-xs text-secondarytext">
                      Outcome: {trip.outcome_auditable}
                    </p>
                  )}
                </div>
              ))}

              {/* Vehicle Assignment */}
              {(selectedRequest.status === "assigned" ||
                selectedRequest.status === "trip_started" ||
                selectedRequest.status === "completed") &&
                selectedRequest.vehicle_name && (
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
                        <p className="text-xs text-secondarytext">
                          {selectedRequest.vehicle_type}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">Driver:</span>
                        <p className="font-medium text-primarytext">
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
                )}

              {/* OTP Section */}
              {otpData &&
                selectedRequest.status === "assigned" &&
                otpData.start_otp && (
                  <div className="bg-primary/5 border-2 border-primary/30 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Key size={18} className="text-primary" />
                      <p className="text-sm font-semibold text-primary">
                        Start Trip OTP
                      </p>
                    </div>
                    <p className="text-xs text-secondarytext mb-3">
                      Share this OTP with the driver to start the trip
                    </p>
                    <div className="bg-white rounded-md p-4 text-center">
                      <p className="text-3xl font-bold tracking-[0.5em] text-primary font-mono">
                        {otpData.start_otp}
                      </p>
                    </div>
                  </div>
                )}

              {otpData &&
                selectedRequest.status === "trip_started" &&
                otpData.end_otp && (
                  <div className="bg-green/5 border-2 border-green/30 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Key size={18} className="text-green" />
                      <p className="text-sm font-semibold text-green">
                        End Trip OTP
                      </p>
                    </div>
                    <p className="text-xs text-secondarytext mb-3">
                      Share this OTP with the driver to complete the trip
                    </p>
                    <div className="bg-white rounded-md p-4 text-center">
                      <p className="text-3xl font-bold tracking-[0.5em] text-green font-mono">
                        {otpData.end_otp}
                      </p>
                    </div>
                  </div>
                )}

              {selectedRequest.status === "trip_started" && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                    <Play size={12} />
                    Trip is currently in progress
                  </p>
                </div>
              )}

              {otpLoading &&
                (selectedRequest.status === "assigned" ||
                  selectedRequest.status === "trip_started") && (
                  <div className="text-center py-3">
                    <p className="text-sm text-secondarytext">Loading OTP...</p>
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

              {/* Cancel button for pending */}
              {selectedRequest.status === "pending" && (
                <div className="flex justify-end pt-3 border-t border-gray-100">
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
        </div>
      )}
    </div>
  );
}
