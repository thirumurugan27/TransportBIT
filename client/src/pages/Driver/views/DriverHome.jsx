import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {formatTime} from "../../../utils/dateFormat";
import {
  Calendar,
  Clock,
  Bus,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Shield,
  Bell,
  X,
  Info,
  AlertTriangle,
  Zap,
  Users,
  Car,
  ChevronRight,
  Eye,
  MapPin,
  Play,
  User,
} from "lucide-react";

export default function DriverHome() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [upcomingRequests, setUpcomingRequests] = useState([]);
  const [vehicleAlerts, setVehicleAlerts] = useState({
    alerts: [],
    expired: 0,
    critical: 0,
    total: 0,
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedEVAssignment, setSelectedEVAssignment] = useState(null);
  const {user} = useAuth();
  const driverName = user?.full_name || "Driver";
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
      fetchVehicleAlerts();
      fetchNotifications();
      fetchUpcomingRequests();
    }
  }, [driverId]);

  const fetchUpcomingRequests = async () => {
    try {
      const res = await apiGet(
        `/api/driver/vehicle-requests/upcoming?driver_id=${driverId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setUpcomingRequests(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiGet(
        `/api/driver/notifications?driver_id=${driverId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
        setUnreadCount((data || []).filter((n) => !n.is_read).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiPost(`/api/driver/notifications/${notificationId}/mark-read`);
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? {...n, is_read: true} : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPost(
        `/api/driver/notifications/mark-all-read?driver_id=${driverId}`,
      );
      setNotifications(notifications.map((n) => ({...n, is_read: true})));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "vehicle_change":
        return <RotateCcw className="w-5 h-5 text-primary" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-pending" />;
      case "alert":
        return <AlertCircle className="w-5 h-5 text-red" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const fetchAssignments = async () => {
    try {
      const today = getToday();
      // Use plural endpoint to get all assignments (Regular + EV)
      const res = await apiGet(
        `/api/driver/assignments/today?driver_id=${driverId}&date=${today}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAssignments(data || []);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error(err);
      setAssignments([]);
    }
  };

  const fetchVehicleAlerts = async () => {
    try {
      const res = await apiGet(
        `/api/driver/vehicles/alerts?driver_id=${driverId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setVehicleAlerts(
          data || {alerts: [], expired: 0, critical: 0, total: 0},
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-primary rounded-md p-4 sm:p-6 lg:p-8 text-white shadow-xl relative">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 break-words">
              Welcome back, {driverName}!
            </h2>
            <p className="text-white/80 text-sm sm:text-base lg:text-lg">
              Drive safely and have a great day.
            </p>
          </div>
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors relative"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red text-white text-xs w-5 h-5 rounded-md flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-primarytext flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100"}`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4
                          className={`font-medium ${!notif.is_read ? "text-primarytext" : "text-secondarytext"}`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-xs text-primary hover:underline shrink-0 ml-2"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-secondarytext mt-1">
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {notif.created_at || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-secondarytext">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Document Alert Section */}
      {vehicleAlerts.total > 0 && (
        <div
          className={`${vehicleAlerts.expired > 0 ? "bg-red/10 border-red/20" : vehicleAlerts.critical > 0 ? "bg-pending/10 border-pending/20" : "bg-pending/10 border-pending/20"} border rounded-md p-5`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 ${vehicleAlerts.expired > 0 ? "bg-red/20" : vehicleAlerts.critical > 0 ? "bg-pending/20" : "bg-pending/20"} rounded-md flex items-center justify-center shrink-0`}
            >
              <Shield
                className={`w-6 h-6 ${vehicleAlerts.expired > 0 ? "text-red" : vehicleAlerts.critical > 0 ? "text-pending" : "text-pending"}`}
              />
            </div>
            <div className="flex-1">
              <h3
                className={`font-bold ${vehicleAlerts.expired > 0 ? "text-red" : vehicleAlerts.critical > 0 ? "text-pending" : "text-pending"}`}
              >
                ⚠️ Vehicle Document Alert
              </h3>
              <div className="mt-2 space-y-2">
                {vehicleAlerts.alerts?.map((v) => (
                  <div key={v.id} className="text-sm">
                    <span className="font-semibold text-primarytext">
                      {v.vehicle_name || v.vehicle_number}
                    </span>
                    <span className="text-secondarytext ml-1">
                      ({v.vehicle_type})
                    </span>
                    <span className="mx-2">—</span>
                    {v.insurance_days !== null && v.insurance_days <= 30 && (
                      <span
                        className={`mr-2 ${v.insurance_days < 0 ? "text-red font-bold" : v.insurance_days <= 7 ? "text-pending font-semibold" : "text-pending"}`}
                      >
                        Insurance:{" "}
                        {v.insurance_days < 0
                          ? "EXPIRED"
                          : `${v.insurance_days} days left`}
                      </span>
                    )}
                    {v.fc_days !== null && v.fc_days <= 30 && (
                      <span
                        className={`mr-2 ${v.fc_days < 0 ? "text-red font-bold" : v.fc_days <= 7 ? "text-pending font-semibold" : "text-pending"}`}
                      >
                        FC:{" "}
                        {v.fc_days < 0 ? "EXPIRED" : `${v.fc_days} days left`}
                      </span>
                    )}
                    {v.permit_days !== null && v.permit_days <= 30 && (
                      <span
                        className={`${v.permit_days < 0 ? "text-red font-bold" : v.permit_days <= 7 ? "text-pending font-semibold" : "text-pending"}`}
                      >
                        Permit:{" "}
                        {v.permit_days < 0
                          ? "EXPIRED"
                          : `${v.permit_days} days left`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p
                className={`text-xs mt-2 ${vehicleAlerts.expired > 0 ? "text-red/70" : vehicleAlerts.critical > 0 ? "text-pending/70" : "text-pending/70"}`}
              >
                Please notify admin if documents need renewal.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-primarytext mb-4 flex items-center gap-2">
          <Calendar className="text-primary" size={20} />
          Today's Duties
        </h3>

        {assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment, index) => {
              const isTemp = assignment.is_temporary_replacement;
              const isEV = assignment.is_ev_assignment;

              // EV Assignment Card - Show as Group
              if (isEV) {
                return (
                  <div
                    key={assignment.id || index}
                    onClick={() => setSelectedEVAssignment(assignment)}
                    className="relative p-5 rounded-md transition-all hover:shadow-md group overflow-hidden cursor-pointer bg-white border-green border-2 shadow-green/10"
                  >
                    {/* Accent Side Bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green"></div>

                    {/* EV Badge */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-green text-white text-xs font-bold px-2 py-0.5 rounded-md">
                      <Zap size={12} />
                      EV Assignment
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-5 pl-2">
                      {/* Icon */}
                      <div className="p-3 rounded-md shrink-0 bg-green/10 text-green">
                        <Zap size={24} />
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {/* Vehicle Group Info */}
                        <div>
                          <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                            Vehicle Group
                          </p>
                          <p className="font-bold text-primarytext text-base sm:text-lg">
                            {assignment.vehicle_group_name}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-green/10 text-green">
                              EV
                            </span>
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                              {assignment.group_vehicles?.length || 0} Vehicles
                            </span>
                          </div>
                        </div>

                        {/* Driver Group Info */}
                        <div>
                          <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                            Driver Group
                          </p>
                          <p className="font-medium text-primarytext">
                            {assignment.driver_group_name}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-green">
                            <Users size={12} />
                            <span className="text-xs font-medium">
                              {assignment.group_drivers?.length || 0} Drivers
                            </span>
                          </div>
                        </div>

                        {/* Time Info */}
                        <div>
                          <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                            Shift
                          </p>
                          <p className="font-medium text-primarytext">
                            {assignment.shift_name}
                          </p>
                          <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                            <Clock size={14} />
                            {formatTime(assignment.start_time)} -{" "}
                            {formatTime(assignment.end_time)}
                          </div>
                        </div>

                        {/* View Details */}
                        <div className="flex items-center justify-end">
                          <span className="inline-flex items-center gap-1 text-green text-sm font-medium group-hover:underline">
                            <Eye size={16} />
                            View Details
                            <ChevronRight size={16} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Regular/Temporary Assignment Card
              return (
                <div
                  key={assignment.id || index}
                  className={`relative p-5 rounded-md transition-all hover:shadow-md group overflow-hidden ${
                    isTemp
                      ? "bg-white border-pending border-2 shadow-pending/10"
                      : "bg-white border border-gray-100 hover:border-primarydull"
                  }`}
                >
                  {/* Accent Side Bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isTemp ? "bg-pending" : "bg-primary"
                    }`}
                  ></div>

                  <div className="flex flex-col md:flex-row md:items-center gap-5 pl-2">
                    {/* Icon */}
                    <div
                      className={`p-3 rounded-md shrink-0 ${
                        isTemp
                          ? "bg-pending/10 text-pending"
                          : "bg-primarybg text-primary group-hover:bg-primary group-hover:text-white transition-colors"
                      }`}
                    >
                      {assignment.vehicle_type === "CAR" ? (
                        <Car size={24} />
                      ) : (
                        <Bus size={24} />
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Vehicle Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Vehicle
                        </p>
                        <p className="font-bold text-primarytext text-base sm:text-lg">
                          {assignment.vehicle_name || assignment.vehicle_number}
                        </p>
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                            isTemp
                              ? "bg-pending/10 text-pending"
                              : "bg-green/10 text-green"
                          }`}
                        >
                          {assignment.vehicle_type}
                        </span>
                        {isTemp && (
                          <div className="flex items-center gap-1 mt-1 text-pending">
                            <RotateCcw size={12} />
                            <span className="text-xs font-bold">
                              Covering: {assignment.original_driver_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Shift Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Shift
                        </p>
                        <p className="font-medium text-primarytext">
                          {assignment.shift_name}
                        </p>
                      </div>

                      {/* Time Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Time
                        </p>
                        <div className="flex items-center gap-1.5 text-primarytext font-medium">
                          <Clock size={14} className="text-gray-400" />
                          {formatTime(assignment.start_time)} -{" "}
                          {formatTime(assignment.end_time)}
                        </div>
                      </div>

                      {/* Status Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                            assignment.status === "completed"
                              ? "bg-green/10 text-green"
                              : isTemp
                                ? "bg-pending/10 text-pending"
                                : "bg-primarybg text-primary"
                          }`}
                        >
                          {assignment.status === "completed" ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <div className="w-2 h-2 rounded-md bg-current animate-pulse" />
                          )}
                          {assignment.status || "Scheduled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-md border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mb-3">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-secondarytext font-medium">
              No duties assigned for today.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Check back later or contact admin.
            </p>
          </div>
        )}
      </div>

      {/* Upcoming Vehicle Requests Section */}
      {upcomingRequests.length > 0 && (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-primarytext flex items-center gap-2">
              <Truck className="text-primary" size={20} />
              Upcoming Vehicle Requests
            </h3>
            <button
              onClick={() => navigate("/driver-dashboard/vehicle-requests")}
              className="text-primary font-medium text-sm hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {upcomingRequests.slice(0, 3).map((request) => (
              <div
                key={request.id}
                className="relative p-4 rounded-md bg-gray-50 border border-gray-100 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate("/driver-dashboard/vehicle-requests")}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md"></div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-primarytext text-sm">
                          {request.trips?.[0]?.departure_location ||
                            request.onward_from_place}{" "}
                          →{" "}
                          {request.trips?.[0]?.arrival_location ||
                            request.onward_to_place}
                        </p>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-md">
                          {request.trip_type === "round_trip"
                            ? "Round Trip"
                            : "One Way"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-secondarytext mt-1">
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {request.faculty_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {request.trips?.[0]?.departure_date ||
                            request.onward_from_datetime?.split(" ")[0]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {request.trips?.[0]?.departure_time ||
                            request.onward_from_datetime
                              ?.split(" ")
                              .slice(1)
                              .join(" ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                        request.status === "trip_started"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {request.status === "trip_started"
                        ? "On Trip"
                        : "Assigned"}
                    </span>
                    <span className="text-xs text-secondarytext">
                      {request.vehicle_number || request.vehicle_name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EV Assignment Details Modal */}
      {selectedEVAssignment && (
        <div className="fixed inset-0 bg-black/50  flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-2xl sm:rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-green text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-md">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">EV Assignment Details</h3>
                  <p className="text-white/80 text-sm">
                    {selectedEVAssignment.shift_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-white/20 rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Time Info */}
              <div className="flex items-center gap-3 p-3 bg-green/10 rounded-md">
                <Clock className="text-green" size={20} />
                <div>
                  <p className="text-xs text-secondarytext">Shift Time</p>
                  <p className="font-medium text-primarytext">
                    {formatTime(selectedEVAssignment.start_time)} -{" "}
                    {formatTime(selectedEVAssignment.end_time)}
                  </p>
                </div>
              </div>

              {/* Vehicle Group */}
              <div>
                <h4 className="font-semibold text-primarytext mb-3 flex items-center gap-2">
                  <Car size={18} className="text-green" />
                  Vehicle Group: {selectedEVAssignment.vehicle_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-3 bg-primarybg rounded-md border border-gray-200"
                    >
                      <p className="font-medium text-primarytext">
                        {vehicle.vehicle_name || vehicle.vehicle_number}
                      </p>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-green/10 text-green">
                        {vehicle.fuel_type}
                      </span>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_vehicles ||
                    selectedEVAssignment.group_vehicles.length === 0) && (
                    <p className="col-span-2 text-secondarytext text-sm">
                      No vehicles in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Driver Group */}
              <div>
                <h4 className="font-semibold text-primarytext mb-3 flex items-center gap-2">
                  <Users size={18} className="text-green" />
                  Driver Group: {selectedEVAssignment.driver_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-3 bg-primarybg rounded-md border border-gray-200 flex items-center gap-2"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary font-bold text-sm">
                        {driver.name?.charAt(0).toUpperCase()}
                      </div>
                      <p className="font-medium text-primarytext text-sm">
                        {driver.name}
                      </p>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_drivers ||
                    selectedEVAssignment.group_drivers.length === 0) && (
                    <p className="col-span-2 text-secondarytext text-sm">
                      No drivers in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-green/10 rounded-md">
                <span className="text-secondarytext">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green/10 text-green">
                  <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  {selectedEVAssignment.status}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-primarytext font-medium rounded-md transition-colors"
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
