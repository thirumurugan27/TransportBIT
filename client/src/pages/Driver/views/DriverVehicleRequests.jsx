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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? {Authorization: `Bearer ${token}`} : {};
};

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
};

const getTripTypeLabel = (value) => {
  if (!value) return "Trip";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatTime12Hour = (time24) => {
  if (!time24) return "N/A";
  const [hours, minutes] = time24.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDateTime12Hour = (datetime) => {
  if (!datetime) return "N/A";
  try {
    const date = new Date(datetime);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return datetime;
  }
};

export default function DriverVehicleRequests() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
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
    if (filterStatus === "all") return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  const upcomingRequests = requests.filter(
    (r) => r.status === "assigned" || r.status === "trip_started",
  );

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-5 p-4">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Truck className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Vehicle Requests
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manage your assigned trips and vehicle requests
                </p>
              </div>
            </div>
          </div>

          {upcomingRequests.length > 0 && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green/10 text-green rounded-lg border border-green/20">
              <div className="w-2 h-2 rounded-full bg-green animate-pulse"></div>
              <span className="text-sm font-bold">
                {upcomingRequests.length} Active / Upcoming
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs with Counts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-1.5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              filterStatus === "all"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <CalendarDays size={16} />
            All Requests
            <span
              className={`ml-1 min-w-6 px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === "all"
                  ? "bg-white/25 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus("assigned")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              filterStatus === "assigned"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {React.createElement(STATUS_CONFIG.assigned.icon, {size: 16})}
            Assigned
            <span
              className={`ml-1 min-w-6 px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === "assigned"
                  ? "bg-white/25 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {counts.assigned || 0}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus("trip_started")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              filterStatus === "trip_started"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {React.createElement(STATUS_CONFIG.trip_started.icon, {size: 16})}
            On Trip
            <span
              className={`ml-1 min-w-6 px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === "trip_started"
                  ? "bg-white/25 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {counts.trip_started || 0}
            </span>
          </button>

          <button
            onClick={() => setFilterStatus("completed")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              filterStatus === "completed"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {React.createElement(STATUS_CONFIG.completed.icon, {size: 16})}
            Completed
            <span
              className={`ml-1 min-w-6 px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === "completed"
                  ? "bg-white/25 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {counts.completed || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Request Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredRequests.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
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
            // Trip Data from new backend structure
            // If trips array is empty, fallback to flat fields
            const onwardTrip = request.trips?.[0] || {
              departure_location: request.onward_from_place,
              departure_date: request.onward_from_datetime?.split(" ")[0],
              departure_time: request.onward_from_datetime?.split(" ")[1],
              arrival_location: request.onward_to_place,
            };

            // Check for return trip or last leg
            const returnTrip =
              request.trips?.length > 1
                ? request.trips[request.trips.length - 1]
                : null;

            return (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden group"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border ${config.color}`}
                      >
                        {React.createElement(config.icon, {size: 22})}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-800 text-base">
                            {getTripTypeLabel(request.trip_type)}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${config.color}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User size={13} />
                          <span className="font-medium truncate">
                            {request.faculty_name}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="truncate">
                            {request.faculty_department}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-200 shrink-0"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>

                {/* Card Body - Trip Timeline */}
                <div className="p-5">
                  <div className="relative pl-4 border-l-2 border-dashed border-gray-200 ml-2 space-y-5">
                    {/* Departure */}
                    <div className="relative">
                      <div className="absolute -left-5.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-primary shadow-sm"></div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Departure
                        </p>
                        <p className="font-bold text-gray-800 text-sm mb-1">
                          {onwardTrip.departure_location || "Start Point"}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            <Calendar size={12} />
                            {onwardTrip.departure_date || "Date N/A"}
                          </span>
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            <Clock size={12} />
                            {formatTime12Hour(onwardTrip.departure_time) ||
                              "Time N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Arrival */}
                    <div className="relative">
                      <div className="absolute -left-5.5 top-1 w-4 h-4 rounded-full border-2 border-white bg-green shadow-sm"></div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Arrival
                        </p>
                        <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">
                          {returnTrip
                            ? returnTrip.departure_location
                            : onwardTrip.arrival_location || "End Point"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            <MapPin size={12} />
                            {returnTrip ? "Return Trip" : "One Way"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer - Vehicle & Passengers */}
                <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 border border-gray-100">
                      <Truck size={16} />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                        Vehicle
                      </p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {request.vehicle_number || "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 border border-gray-100">
                      <Users size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                        Passengers
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-secondarybg rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn border border-gray-100">
            {/* Modal Header */}
            <div className="relative px-6 py-5 bg-gradient-to-br from-primary/5 to-primarybg border-b border-gray-200">
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 w-9 h-9 hover:bg-secondarybg rounded-lg transition-all flex items-center justify-center text-secondarytext hover:text-primarytext shadow-sm"
              >
                <X size={18} />
              </button>
              <div className="flex items-start gap-4 pr-10">
                <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/20">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Trip Itinerary Section */}
              <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Navigation size={14} className="text-primary" />
                  Trip Itinerary
                </h4>

                {(selectedRequest.trips?.length > 0
                  ? selectedRequest.trips
                  : [
                      {
                        departure_location: selectedRequest.onward_from_place,
                        arrival_location: selectedRequest.onward_to_place,
                        departure_date:
                          selectedRequest.onward_from_datetime?.split(" ")[0],
                        departure_time:
                          selectedRequest.onward_from_datetime?.split(" ")[1],
                      },
                    ]
                ).map((trip, idx) => (
                  <div
                    key={idx}
                    className="bg-secondarybg rounded-md p-3 border border-gray-200"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {/* Departure */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-xs font-semibold text-primary uppercase">
                            From
                          </span>
                        </div>
                        <p className="text-sm font-medium text-primarytext mb-2">
                          {trip.departure_location || "N/A"}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-secondarytext">
                          <span className="flex items-center gap-1 bg-primarybg px-2 py-1 rounded-md">
                            <Calendar size={12} /> {trip.departure_date}
                          </span>
                          <span className="flex items-center gap-1 bg-primarybg px-2 py-1 rounded-md">
                            <Clock size={12} />{" "}
                            {formatTime12Hour(trip.departure_time)}
                          </span>
                        </div>
                        {selectedRequest.trip_started_at && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-green font-semibold flex items-center gap-1">
                              <CheckCircle size={11} /> Started:{" "}
                              {formatDateTime12Hour(
                                selectedRequest.trip_started_at,
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Arrival */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green"></div>
                          <span className="text-xs font-semibold text-green uppercase">
                            To
                          </span>
                        </div>
                        <p className="text-sm font-medium text-primarytext mb-2">
                          {trip.arrival_location || "N/A"}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-secondarytext">
                          {trip.arrival_date && (
                            <span className="flex items-center gap-1 bg-primarybg px-2 py-1 rounded-md">
                              <Calendar size={12} /> {trip.arrival_date}
                            </span>
                          )}
                          {trip.arrival_time && (
                            <span className="flex items-center gap-1 bg-primarybg px-2 py-1 rounded-md">
                              <Clock size={12} />{" "}
                              {formatTime12Hour(trip.arrival_time)}
                            </span>
                          )}
                        </div>
                        {selectedRequest.trip_ended_at && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-green font-semibold flex items-center gap-1">
                              <CheckCircle size={11} /> Completed:{" "}
                              {formatDateTime12Hour(
                                selectedRequest.trip_ended_at,
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Passenger Details */}
              <div className="bg-primarybg rounded-md border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-3">
                  Passenger Details
                </h4>
                <div className="space-y-3">
                  {/* Requester */}
                  <div className="bg-secondarybg rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-xs text-secondarytext">Requester</p>
                        <p className="text-sm font-semibold text-primarytext">
                          {selectedRequest.faculty_name}
                        </p>
                        <p className="text-xs text-secondarytext">
                          {selectedRequest.faculty_department}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Guest / Contact */}
                  <div className="bg-secondarybg rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-green/10 text-green flex items-center justify-center">
                          <Users size={14} />
                        </div>
                        <div>
                          <p className="text-xs text-secondarytext">
                            Guest / Contact
                          </p>
                          <p className="text-sm font-semibold text-primarytext">
                            {selectedRequest.guest_name ||
                              selectedRequest.contact_name ||
                              "N/A"}
                          </p>
                          <p className="text-xs text-secondarytext">
                            {selectedRequest.count_person} Person(s)
                          </p>
                        </div>
                      </div>
                      {(selectedRequest.mobile_number ||
                        selectedRequest.contact_phone) && (
                        <a
                          href={`tel:${selectedRequest.mobile_number || selectedRequest.contact_phone}`}
                          className="p-2 bg-green text-white rounded-md hover:opacity-90 transition-colors"
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

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                          className={`w-full bg-primarybg border-2 rounded-lg px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] font-bold text-primarytext placeholder-gray-300 focus:outline-none transition-all ${
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
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <p className="text-xs text-blue-800 text-center flex items-center justify-center gap-1.5">
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
                        className={`w-full py-3.5 rounded-lg font-semibold text-sm disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 ${
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
