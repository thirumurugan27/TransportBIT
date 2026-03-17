import React, {useState, useEffect, useMemo} from "react";
import {
  Clock,
  CheckCircle,
  Truck,
  Eye,
  X,
  MapPin,
  Calendar,
  User,
  Play,
  Users,
  Phone,
  ShieldCheck,
  CalendarDays,
  Navigation,
  Info,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {useAuth} from "../../../context/AuthContext";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const headers = {
    "X-Tunnel-Skip-Efficiency-Check": "true",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const DRIVER_STATUS_OPTIONS = [
  {value: "all", label: "All Requests", icon: CalendarDays},
  {value: "assigned", label: "Assigned", icon: CalendarDays},
  {value: "trip_started", label: "On Trip", icon: Play},
  {value: "completed", label: "Completed", icon: CheckCircle},
  {value: "cancelled", label: "Cancelled", icon: X},
];

const STATUS_CONFIG = {
  assigned: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: CalendarDays,
    label: "Assigned",
  },
  trip_started: {
    color: "bg-pending/10 text-pending border-pending/20",
    icon: Play,
    label: "On Trip",
  },
  completed: {
    color: "bg-green/10 text-green border-green/20",
    icon: CheckCircle,
    label: "Completed",
  },
  cancelled: {
    color: "bg-red/10 text-red border-red/20",
    icon: X,
    label: "Cancelled",
  },
};

const getTripTypeLabel = (value) => {
  if (!value) return "Trip";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Date/time formatting removed - displaying raw backend values
// const formatTime12Hour = (time24) => {
//   if (!time24) return "N/A";
//   const [hours, minutes] = time24.split(":");
//   const hour = parseInt(hours);
//   const ampm = hour >= 12 ? "PM" : "AM";
//   const hour12 = hour % 12 || 12;
//   return `${hour12}:${minutes} ${ampm}`;
// };

// const formatDateTime12Hour = (datetime) => {
//   if (!datetime) return "N/A";
//   try {
//     const date = new Date(datetime);
//     const hours = date.getHours();
//     const minutes = date.getMinutes().toString().padStart(2, "0");
//     const ampm = hours >= 12 ? "PM" : "AM";
//     const hour12 = hours % 12 || 12;
//     return `${hour12}:${minutes} ${ampm}`;
//   } catch {
//     return datetime;
//   }
// };

export default function DriverVehicleRequests() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [otpInput, setOtpInput] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  useEffect(() => {
    if (driverId) {
      fetchRequests();
    }
  }, [driverId]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/driver/vehicle-requests?driver_id=${driverId}`,
        {
          credentials: "include",
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStartOTP = async (requestId) => {
    if (!otpInput || otpInput.length !== 6) {
      showToast("Please enter a valid 6-digit OTP", "warning");
      return;
    }
    setOtpSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/driver/vehicle-request/verify-start-otp`,
        {
          method: "POST",
          credentials: "include",
          headers: {"Content-Type": "application/json", ...getAuthHeaders()},
          body: JSON.stringify({request_id: requestId, otp: otpInput}),
        },
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Trip started successfully!", "success");
        handleCloseModal();
        fetchRequests();
      } else {
        showToast(data.error || "Invalid OTP", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleVerifyEndOTP = async (requestId) => {
    if (!otpInput || otpInput.length !== 6) {
      showToast("Please enter a valid 6-digit OTP", "warning");
      return;
    }
    setOtpSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/driver/vehicle-request/verify-end-otp`,
        {
          method: "POST",
          credentials: "include",
          headers: {"Content-Type": "application/json", ...getAuthHeaders()},
          body: JSON.stringify({request_id: requestId, otp: otpInput}),
        },
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Trip completed successfully!", "success");
        handleCloseModal();
        fetchRequests();
      } else {
        showToast(data.error || "Invalid OTP", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Function to close modal and reset OTP
  const handleCloseModal = () => {
    setSelectedRequest(null);
    setOtpInput("");
  };

  // Calculate counts for each status
  const counts = useMemo(() => {
    const c = {
      all: requests.length,
      assigned: 0,
      trip_started: 0,
      completed: 0,
    };
    requests.forEach((r) => {
      // Normalize 'active' or other statuses if backend returns different ones
      const statusKey = r.status;
      if (c[statusKey] !== undefined) {
        c[statusKey]++;
      } else if (statusKey === "assigned") {
        // explicit check just in case
        c.assigned++;
      } else if (statusKey === "trip_started") {
        c.trip_started++;
      }
    });
    return c;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        r.trip_type?.toLowerCase().includes(q) ||
        r.id?.toString().includes(q) ||
        r.trips?.[0]?.departure_location?.toLowerCase().includes(q) ||
        r.trips?.[0]?.arrival_location?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, filterStatus, searchQuery]);

  const upcomingRequests = requests.filter(
    (r) => r.status === "assigned" || r.status === "trip_started",
  );

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-2 sm:space-y-5 p-0 sm:p-2 lg:p-4 animate-fadeIn">
      {/* Page Header */}
      <p className="text-gray-600 font-medium text-xl">Vehicle Requests</p>
      {/* Search & Filter */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by trip type, location, or ID..."
            className="flex-1"
          />
          <CustomDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            options={DRIVER_STATUS_OPTIONS}
            width="w-44"
          />
        </div>
      </div>

      {/* Request Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        {filteredRequests.length === 0 ? (
          <div className="col-span-full bg-white rounded-md shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              No requests found
            </h3>
            <p className="text-sm text-gray-500">
              There are no vehicle requests for this filter.
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const config =
              STATUS_CONFIG[request.status] || STATUS_CONFIG.assigned;

            // Build unified trip legs - prefer trips array, fallback to flat fields
            const tripLegs =
              request.trips?.length > 0
                ? request.trips
                : request.onward_from_place
                  ? [
                      {
                        trip_order: 1,
                        departure_location: request.onward_from_place,
                        departure_date:
                          request.onward_from_datetime?.split(" ")[0] || "",
                        departure_time:
                          request.onward_from_datetime
                            ?.split(" ")
                            .slice(1)
                            .join(" ") || "",
                        arrival_location: request.onward_to_place || "",
                        arrival_date:
                          request.onward_to_datetime?.split(" ")[0] || "",
                        arrival_time:
                          request.onward_to_datetime
                            ?.split(" ")
                            .slice(1)
                            .join(" ") || "",
                      },
                    ]
                  : [];

            const firstLeg = tripLegs[0];
            const lastLeg = tripLegs[tripLegs.length - 1];
            const hasMultipleLegs = tripLegs.length > 1;
            const isCancelled = request.status?.toLowerCase() === "cancelled";

            return (
              <div
                key={request.id}
                className={`rounded-md shadow-sm border transition-all duration-200 overflow-hidden relative z-0 ${
                  isCancelled ? "bg-gray-50 border-red opacity-60" : "bg-white border-gray-100 hover:shadow-md"
                }`}
              >
                {/* Cancelled Watermark */}
                {isCancelled && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 text-red font-black text-6xl pointer-events-none uppercase tracking-widest z-0 whitespace-nowrap">
                    Cancelled
                  </div>
                )}

                {/* Card Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 relative z-10">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 border ${config.color}`}
                      >
                        {React.createElement(config.icon, {size: 20})}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-800 text-sm">
                            {getTripTypeLabel(request.trip_type)}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${config.color}`}
                          >
                            {config.label}
                          </span>
                          {hasMultipleLegs && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded uppercase tracking-wide">
                              {tripLegs.length} Legs
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <User size={11} />
                          <span className="font-medium truncate">
                            {request.faculty_name}
                          </span>
                          {request.faculty_department && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="truncate text-[11px]">
                                {request.faculty_department}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all shrink-0"
                      title="View details"
                    >
                      <Eye size={17} />
                    </button>
                  </div>
                </div>

                {/* Card Body - Trip Timeline */}
                {firstLeg && (
                  <div className="p-4 sm:p-5">
                    <div className="relative pl-5 border-l-2 border-dashed border-gray-200 space-y-4">
                      {/* Origin */}
                      <div className="relative">
                        <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-primary shadow-sm" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          Departure
                        </p>
                        <p className="font-bold text-gray-800 text-sm leading-tight mb-1.5">
                          {firstLeg.departure_location || "—"}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500">
                          {firstLeg.departure_date && (
                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <Calendar size={11} />
                              {firstLeg.departure_date}
                            </span>
                          )}
                          {firstLeg.departure_time && (
                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <Clock size={11} />
                              {firstLeg.departure_time}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Intermediate waypoints (middle legs, collapsed if > 2) */}
                      {hasMultipleLegs &&
                        tripLegs.length <= 4 &&
                        tripLegs.slice(0, -1).map((leg, i) => (
                          <div className="relative" key={i}>
                            <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-amber-400 shadow-sm" />
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">
                              Stop {i + 1}
                            </p>
                            <p className="font-semibold text-gray-800 text-sm leading-tight mb-1">
                              {leg.arrival_location || "—"}
                            </p>
                            {(leg.arrival_date || leg.arrival_time) && (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                {leg.arrival_date && (
                                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                    <Calendar size={11} />
                                    {leg.arrival_date}
                                  </span>
                                )}
                                {leg.arrival_time && (
                                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                    <Clock size={11} />
                                    {leg.arrival_time}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      {hasMultipleLegs && tripLegs.length > 4 && (
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-gray-300 shadow-sm" />
                          <p className="text-[11px] text-gray-400 italic">
                            + {tripLegs.length - 2} intermediate stops
                          </p>
                        </div>
                      )}

                      {/* Destination */}
                      <div className="relative">
                        <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-green shadow-sm" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          Arrival
                        </p>
                        <p className="font-bold text-gray-800 text-sm leading-tight mb-1.5">
                          {lastLeg.arrival_location || "—"}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500">
                          {lastLeg.arrival_date && (
                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <Calendar size={11} />
                              {lastLeg.arrival_date}
                            </span>
                          )}
                          {lastLeg.arrival_time && (
                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <Clock size={11} />
                              {lastLeg.arrival_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Footer */}
                <div className="px-4 sm:px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Truck size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                        Vehicle
                      </p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {request.vehicle_number || "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                      <Users size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                        Pax
                      </p>
                      <p className="text-sm font-bold text-gray-800">
                        {request.count_person || 1}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50  animate-fadeIn">
          <div className="bg-secondarybg rounded-t-2xl sm:rounded-md shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn border border-gray-100">
            {/* Modal Header */}
            <div className="relative px-4 sm:px-6 py-4 sm:py-5 bg-linear-to-br from-primary/5 to-primarybg border-b border-gray-200">
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 w-9 h-9 hover:bg-secondarybg rounded-md transition-all flex items-center justify-center text-secondarytext hover:text-primarytext shadow-sm"
              >
                <X size={18} />
              </button>
              <div className="flex items-start gap-4 pr-10">
                <div className="w-14 h-14 bg-primary rounded-md flex items-center justify-center text-white shadow-md shadow-primary/20">
                  {React.createElement(
                    STATUS_CONFIG[selectedRequest.status]?.icon || Truck,
                    {size: 26},
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primarytext mb-1">
                    {getTripTypeLabel(selectedRequest.trip_type)}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-secondarytext">
                    <Truck size={16} className="text-primary" />
                    <span className="font-medium">
                      {selectedRequest.vehicle_name}
                    </span>
                  </div>
                  {selectedRequest.purpose && (
                    <p className="text-sm text-secondarytext mt-2 italic line-clamp-2">
                      "{selectedRequest.purpose}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
              {/* Trip Itinerary Section */}
              <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Navigation size={14} className="text-primary" />
                  Trip Itinerary
                  {selectedRequest.trips?.length > 1 && (
                    <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {selectedRequest.trips.length} Legs
                    </span>
                  )}
                </h4>

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
                              arrival_location: selectedRequest.onward_to_place,
                              departure_date:
                                selectedRequest.onward_from_datetime?.split(
                                  " ",
                                )[0] || "",
                              departure_time:
                                selectedRequest.onward_from_datetime
                                  ?.split(" ")
                                  .slice(1)
                                  .join(" ") || "",
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
                          ]
                        : [];

                  return (
                    <div className="space-y-2">
                      {tripLegs.map((trip, idx) => (
                        <div
                          key={idx}
                          className="bg-secondarybg rounded-md p-3 border border-gray-200 relative"
                        >
                          {tripLegs.length > 1 && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded absolute top-2.5 right-2.5 uppercase tracking-wide">
                              Leg {trip.trip_order || idx + 1}
                            </span>
                          )}
                          <div className="grid grid-cols-2 gap-3 pr-10">
                            {/* Departure */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                                  From
                                </span>
                              </div>
                              <p className="text-sm font-medium text-primarytext mb-1 leading-tight">
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
                                  <CheckCircle size={10} /> Started:{" "}
                                  {selectedRequest.trip_started_at}
                                </p>
                              )}
                            </div>
                            {/* Arrival */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-green" />
                                <span className="text-[10px] font-bold text-green uppercase tracking-wide">
                                  To
                                </span>
                              </div>
                              <p className="text-sm font-medium text-primarytext mb-1 leading-tight">
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
                                    <CheckCircle size={10} /> Ended:{" "}
                                    {selectedRequest.trip_ended_at}
                                  </p>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {tripLegs.length === 0 && (
                        <p className="text-sm text-secondarytext text-center py-4">
                          No trip details available
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Passenger Details */}
              <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-3">
                  Travelling Person Details
                </h4>
                <div className="space-y-3">
                  {/* Travelling Person Contact */}
                  <div className="bg-teal-50 rounded-md p-3 border border-teal-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-md bg-teal-500/10 text-teal-600 flex items-center justify-center">
                          <Users size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">
                            Travelling Person
                          </p>
                          <p className="text-sm font-bold text-primarytext mt-1">
                            {selectedRequest.traveller_name || "N/A"}
                          </p>
                          {selectedRequest.traveller_mobile && (
                            <p className="text-xs font-semibold text-primary mt-0.5">
                              {selectedRequest.traveller_mobile}
                            </p>
                          )}
                          {selectedRequest.traveller_address && (
                            <p className="text-xs text-secondarytext mt-1">
                              {selectedRequest.traveller_address}
                            </p>
                          )}
                          <p className="text-xs text-secondarytext mt-1">
                            {selectedRequest.count_person} Person(s)
                          </p>
                        </div>
                      </div>
                      {selectedRequest.traveller_mobile && (
                        <a
                          href={`tel:${selectedRequest.traveller_mobile}`}
                          className="p-2 bg-teal-500 text-white rounded-md hover:opacity-90 transition-colors"
                        >
                          <Phone size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* OTP Verification Section */}
              {(selectedRequest.status === "assigned" ||
                selectedRequest.status === "trip_started") && (
                <div className="bg-primarybg rounded-md border border-gray-200 p-5">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-4 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-primary" />
                    {selectedRequest.status === "assigned"
                      ? "Start Trip Verification"
                      : "Complete Trip Verification"}
                  </h4>

                  <div className="bg-white rounded-md border border-gray-200 p-6">
                    {/* Message */}
                    <div className="mb-5">
                      <h5 className="text-lg font-bold text-primarytext text-center mb-2">
                        {selectedRequest.status === "assigned"
                          ? "Enter Start OTP"
                          : "Enter End OTP"}
                      </h5>
                      <p className="text-sm text-secondarytext text-center">
                        Ask passenger for the 6-digit code
                      </p>
                    </div>

                    {/* OTP Input */}
                    <div className="space-y-4">
                      <div>
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) =>
                            setOtpInput(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          placeholder="000000"
                          className={`w-full bg-primarybg border-2 rounded-md px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] font-bold text-primarytext placeholder-gray-300 focus:outline-none transition-all ${
                            otpInput.length === 6
                              ? selectedRequest.status === "assigned"
                                ? "border-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
                                : "border-green focus:border-green focus:ring-2 focus:ring-green/20"
                              : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
                          }`}
                          maxLength={6}
                          autoComplete="off"
                        />
                        {/* Character indicators */}
                        <div className="flex justify-center items-center gap-2 mt-3">
                          {[...Array(6)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                i < otpInput.length
                                  ? selectedRequest.status === "assigned"
                                    ? "bg-primary"
                                    : "bg-green"
                                  : "bg-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                        <p className="text-xs text-primary text-center flex items-center justify-center gap-1.5">
                          <Info size={14} className="shrink-0" />
                          <span>
                            OTP is required to{" "}
                            {selectedRequest.status === "assigned"
                              ? "start"
                              : "end"}{" "}
                            the trip. Verify with the passenger.
                          </span>
                        </p>
                      </div>

                      {/* Verify Button */}
                      <button
                        onClick={() =>
                          selectedRequest.status === "assigned"
                            ? handleVerifyStartOTP(selectedRequest.id)
                            : handleVerifyEndOTP(selectedRequest.id)
                        }
                        disabled={otpSubmitting || otpInput.length !== 6}
                        className={`w-full py-3.5 rounded-md font-semibold text-sm disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 ${
                          otpInput.length === 6
                            ? selectedRequest.status === "assigned"
                              ? "bg-primary hover:bg-primarydull text-white disabled:opacity-50"
                              : "bg-green hover:opacity-90 text-white disabled:opacity-50"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {otpSubmitting ? (
                          <>
                            <Clock className="animate-spin" size={18} />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={18} />
                            <span>
                              Verify &{" "}
                              {selectedRequest.status === "assigned"
                                ? "Start"
                                : "Complete"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {selectedRequest.status !== "assigned" &&
              selectedRequest.status !== "trip_started" && (
                <div className="px-6 py-4 bg-primarybg border-t border-gray-100 flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-6 py-2.5 bg-gray-200 text-primarytext font-semibold rounded-md hover:bg-gray-300 transition-all duration-200"
                  >
                    Close
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
