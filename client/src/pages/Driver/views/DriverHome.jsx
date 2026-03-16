import React, {useState, useEffect, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
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
  MapPin,
  User,
  FileText,
  CircleDot,
  Gauge,
  Activity,
  TrendingUp,
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
  const [recentKmLogs, setRecentKmLogs] = useState([]);
  const {user} = useAuth();
  const driverName = user?.full_name || "Driver";
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
      fetchVehicleAlerts();
      fetchNotifications();
      fetchUpcomingRequests();
      fetchRecentKmLogs();
    }
  }, [driverId]);

  const fetchRecentKmLogs = async () => {
    try {
      const res = await apiGet(`/api/driver/km-logs?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setRecentKmLogs((data || []).slice(0, 4));
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  const normalizeText = (value) =>
    typeof value === "string" ? value.trim() : "";

  const getAssignmentShifts = (assignment) => {
    if (Array.isArray(assignment?.shifts) && assignment.shifts.length > 0) {
      return assignment.shifts;
    }
    if (
      assignment?.shift_name ||
      assignment?.start_time ||
      assignment?.end_time
    ) {
      return [
        {
          shift_name: assignment?.shift_name || "EV Duty",
          start_time: assignment?.start_time || "",
          end_time: assignment?.end_time || "",
        },
      ];
    }
    return [];
  };

  const getShiftHeadline = (assignment) => {
    const shifts = getAssignmentShifts(assignment);
    if (shifts.length === 0) return "EV Duty";
    if (shifts.length === 1) return shifts[0].shift_name || "EV Duty";
    return `${shifts[0].shift_name || "EV Duty"} +${shifts.length - 1} more`;
  };

  const getShiftTimeLabel = (assignment) => {
    const shifts = getAssignmentShifts(assignment);
    if (shifts.length <= 1) {
      const firstShift = shifts[0] || {};
      return `${firstShift.start_time || assignment?.start_time || "-"} – ${firstShift.end_time || assignment?.end_time || "-"}`;
    }
    return `${shifts.length} shifts assigned`;
  };

  const getVehicleDisplay = (vehicle) => {
    const vehicleName = normalizeText(vehicle?.vehicle_name);
    const vehicleNumber = normalizeText(vehicle?.vehicle_number);

    if (vehicleName && vehicleNumber && vehicleName !== vehicleNumber) {
      return {title: vehicleName, subtitle: vehicleNumber};
    }

    return {
      title: vehicleNumber || vehicleName || "Unknown vehicle",
      subtitle: vehicle?.vehicle_type || vehicle?.fuel_type || "EV",
    };
  };

  const getVehicleReplacementDetails = (assignment) => {
    const previousVehicle = getVehicleDisplay({
      vehicle_name: assignment?.vehicle_name,
      vehicle_number: assignment?.vehicle_number,
      vehicle_type: assignment?.vehicle_type,
    });
    const replacementVehicle = getVehicleDisplay({
      vehicle_name: assignment?.replacement_vehicle_name,
      vehicle_number: assignment?.replacement_vehicle_number,
      vehicle_type: assignment?.vehicle_type,
    });

    const hasReplacement =
      normalizeText(assignment?.replacement_vehicle_number) !== "" ||
      normalizeText(assignment?.replacement_vehicle_name) !== "";

    return {
      hasReplacement,
      previousVehicle,
      activeVehicle: hasReplacement ? replacementVehicle : previousVehicle,
      replacementVehicle,
    };
  };

  const getDateRangeLabel = (assignment) =>
    assignment.start_date === assignment.end_date
      ? assignment.start_date
      : `${assignment.start_date} - ${assignment.end_date}`;

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Summary stats
  const completedCount = assignments.filter(
    (a) => a.status === "completed",
  ).length;
  const scheduledCount = assignments.filter(
    (a) => a.status !== "completed",
  ).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-secondarytext font-medium uppercase tracking-widest mb-0.5">
            {greeting}, {driverName.split(" ")[0]}
          </p>
          <h1 className="text-xl font-bold text-primarytext">Dashboard</h1>
          <p className="text-xs text-secondarytext mt-0.5 flex items-center gap-1.5">
            <Calendar size={12} />
            {todayFormatted}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-md bg-white border border-gray-200 flex items-center justify-center text-secondarytext hover:text-primarytext hover:border-gray-300 transition-all shadow-sm"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red text-white text-[10px] w-4.5 h-4.5 min-w-4.5 min-h-4.5 rounded-full flex items-center justify-center font-bold leading-none px-0.5">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-secondarytext uppercase tracking-wider">
              Today's Duties
            </span>
            <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
              <Bus size={15} className="text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-primarytext">
            {assignments.length}
          </p>
          <p className="text-[11px] text-secondarytext mt-0.5">
            {scheduledCount} pending
          </p>
        </div>

        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-secondarytext uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 bg-green/10 rounded-md flex items-center justify-center">
              <CheckCircle2 size={15} className="text-green" />
            </div>
          </div>
          <p className="text-2xl font-bold text-primarytext">
            {completedCount}
          </p>
          <p className="text-[11px] text-secondarytext mt-0.5">
            of {assignments.length} duties
          </p>
        </div>

        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-secondarytext uppercase tracking-wider">
              Trips
            </span>
            <div className="w-8 h-8 bg-skyblue/10 rounded-md flex items-center justify-center">
              <Truck size={15} className="text-skyblue" />
            </div>
          </div>
          <p className="text-2xl font-bold text-primarytext">
            {upcomingRequests.length}
          </p>
          <p className="text-[11px] text-secondarytext mt-0.5">
            upcoming requests
          </p>
        </div>

        <div
          className={`rounded-md border shadow-sm p-4 ${vehicleAlerts.expired > 0 ? "bg-red/5 border-red/15" : vehicleAlerts.total > 0 ? "bg-pending/5 border-pending/15" : "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-secondarytext uppercase tracking-wider">
              Alerts
            </span>
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center ${vehicleAlerts.expired > 0 ? "bg-red/10" : vehicleAlerts.total > 0 ? "bg-pending/10" : "bg-gray-100"}`}
            >
              <Shield
                size={15}
                className={
                  vehicleAlerts.expired > 0
                    ? "text-red"
                    : vehicleAlerts.total > 0
                      ? "text-pending"
                      : "text-gray-400"
                }
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${vehicleAlerts.expired > 0 ? "text-red" : vehicleAlerts.total > 0 ? "text-pending" : "text-primarytext"}`}
          >
            {vehicleAlerts.total}
          </p>
          <p className="text-[11px] text-secondarytext mt-0.5">
            {vehicleAlerts.expired > 0
              ? `${vehicleAlerts.expired} expired`
              : vehicleAlerts.critical > 0
                ? `${vehicleAlerts.critical} expiring soon`
                : "documents"}
          </p>
        </div>
      </div>

      {/* ── Notification Panel ── */}
      {showNotifications && (
        <div className="bg-white rounded-md shadow-lg border border-gray-100 overflow-hidden animate-slideUp">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-primarytext text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] rounded-full font-semibold">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-5 py-3 hover:bg-gray-50/50 transition-colors ${!notif.is_read ? "bg-primary/3" : ""}`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100"}`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-sm font-medium truncate ${!notif.is_read ? "text-primarytext" : "text-secondarytext"}`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-[11px] text-primary hover:underline shrink-0"
                          >
                            Read
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-secondarytext mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {notif.created_at || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-secondarytext">
                  No notifications yet
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — Today's Duties (wider) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Today's Duties */}
          <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primarytext flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                Today's Duties
                {assignments.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-[11px] rounded-full font-semibold">
                    {assignments.length}
                  </span>
                )}
              </h2>
              {assignments.length > 0 && (
                <button
                  onClick={() => navigate("/driver-dashboard/assignments")}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                >
                  View all <ChevronRight size={12} />
                </button>
              )}
            </div>

            {assignments.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {assignments.map((assignment, index) => {
                  const isTemp = assignment.is_temporary_replacement;
                  const isEV = assignment.is_ev_assignment;
                  const isDone = assignment.status === "completed";
                  const vehicleReplacement =
                    getVehicleReplacementDetails(assignment);

                  if (isEV) {
                    return (
                      <div
                        key={assignment.id || index}
                        onClick={() => setSelectedEVAssignment(assignment)}
                        className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-green/10 flex items-center justify-center shrink-0">
                            <Zap size={17} className="text-green" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-primarytext text-sm truncate">
                                {assignment.vehicle_group_name}
                              </p>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green text-white">
                                <Zap size={8} /> EV
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-secondarytext">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {getShiftTimeLabel(assignment)}
                              </span>
                              <span className="flex items-center gap-1">
                                <CircleDot size={11} />
                                {getShiftHeadline(assignment)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={11} />
                                {assignment.group_drivers?.length || 0} drivers
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 group-hover:text-green transition-colors shrink-0"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={assignment.id || index}
                      className={`px-5 py-3.5 transition-colors ${isTemp ? "bg-pending/2" : "hover:bg-gray-50/60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${isDone ? "bg-green/10" : isTemp ? "bg-pending/10" : "bg-primary/10"}`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={17} className="text-green" />
                          ) : assignment.vehicle_type === "CAR" ? (
                            <Car
                              size={17}
                              className={
                                isTemp ? "text-pending" : "text-primary"
                              }
                            />
                          ) : (
                            <Bus
                              size={17}
                              className={
                                isTemp ? "text-pending" : "text-primary"
                              }
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-primarytext text-sm truncate">
                              {vehicleReplacement.activeVehicle.title}
                            </p>
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isTemp ? "bg-pending/10 text-pending" : "bg-gray-100 text-secondarytext"}`}
                            >
                              {assignment.vehicle_type}
                            </span>
                            {vehicleReplacement.hasReplacement && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-skyblue/10 text-skyblue px-1.5 py-0.5 rounded-full">
                                <RotateCcw size={8} />
                                {
                                  vehicleReplacement.previousVehicle.title
                                } to{" "}
                                {vehicleReplacement.replacementVehicle.title}
                              </span>
                            )}
                            {isTemp && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold bg-pending/10 text-pending px-1.5 py-0.5 rounded-full">
                                <RotateCcw size={8} /> Temp
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-secondarytext flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {assignment.start_time || "-"} –{" "}
                              {assignment.end_time || "-"}
                            </span>
                            {assignment.shift_name && (
                              <span className="flex items-center gap-1">
                                <CircleDot size={11} />
                                {assignment.shift_name}
                              </span>
                            )}
                            {isTemp && assignment.original_driver_name && (
                              <span className="flex items-center gap-1 text-pending">
                                <User size={11} />
                                Covering {assignment.original_driver_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDone ? "bg-green/10 text-green" : isTemp ? "bg-pending/10 text-pending" : "bg-primary/10 text-primary"}`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={11} />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          )}
                          {assignment.status || "Scheduled"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center mb-2.5">
                  <Calendar className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-sm text-secondarytext font-medium">
                  No duties assigned today
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Check back later or contact admin
                </p>
              </div>
            )}
          </div>

          {/* Pending Trip Requests */}
          {upcomingRequests.length > 0 && (
            <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-primarytext flex items-center gap-2">
                  <span className="w-1 h-4 bg-skyblue rounded-full inline-block" />
                  Pending Trip Requests
                  <span className="ml-1 px-2 py-0.5 bg-skyblue/10 text-skyblue text-[11px] rounded-full font-semibold">
                    {upcomingRequests.length}
                  </span>
                </h2>
                <button
                  onClick={() => navigate("/driver-dashboard/vehicle-requests")}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                >
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {upcomingRequests.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    onClick={() =>
                      navigate("/driver-dashboard/vehicle-requests")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-skyblue/10 rounded-md flex items-center justify-center text-skyblue shrink-0">
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-primarytext text-sm truncate">
                          {request.trips?.[0]?.departure_location ||
                            request.onward_from_place}
                          <span className="text-secondarytext font-normal mx-1">
                            →
                          </span>
                          {request.trips?.[0]?.arrival_location ||
                            request.onward_to_place}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-secondarytext mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {request.faculty_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {request.trips?.[0]?.departure_date ||
                              request.onward_from_datetime?.split(" ")[0]}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {request.trips?.[0]?.departure_time ||
                              request.onward_from_datetime
                                ?.split(" ")
                                .slice(1)
                                .join(" ")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${request.status === "trip_started" ? "bg-pending/10 text-pending" : "bg-primary/10 text-primary"}`}
                        >
                          {request.status === "trip_started"
                            ? "On Trip"
                            : "Assigned"}
                        </span>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {request.vehicle_number || request.vehicle_name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — KM Log + Alerts */}
        <div className="space-y-5">
          {/* Recent KM Log */}
          <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primarytext flex items-center gap-2">
                <span className="w-1 h-4 bg-green rounded-full inline-block" />
                Recent KM Log
              </h2>
              <button
                onClick={() => navigate("/driver-dashboard/km-log")}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight size={12} />
              </button>
            </div>
            {recentKmLogs.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recentKmLogs.map((log) => (
                  <div
                    key={log.id}
                    className="px-4 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-green/10 rounded-md flex items-center justify-center shrink-0">
                        <Gauge size={14} className="text-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-primarytext">
                            {log.total_km} km
                          </p>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${log.status === "approved" ? "bg-green/10 text-green" : log.status === "rejected" ? "bg-red/10 text-red" : "bg-pending/10 text-pending"}`}
                          >
                            {log.status || "approved"}
                          </span>
                        </div>
                        <p className="text-[11px] text-secondarytext mt-0.5 truncate">
                          {log.vehicle_number || log.vehicle_type || "—"} ·{" "}
                          {log.date}
                        </p>
                        {log.fuel_consumed && (
                          <p className="text-[11px] text-secondarytext flex items-center gap-1 mt-0.5">
                            <Activity size={10} />
                            {log.fuel_consumed}L fuel
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center mb-2">
                  <TrendingUp className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-xs text-secondarytext">
                  No logs recorded yet
                </p>
              </div>
            )}
          </div>

          {/* Vehicle Document Alerts */}
          {vehicleAlerts.total > 0 && (
            <div
              className={`rounded-md border overflow-hidden ${vehicleAlerts.expired > 0 ? "bg-red/5 border-red/20" : "bg-pending/5 border-pending/20"}`}
            >
              <div
                className={`px-5 py-3.5 flex items-center gap-2.5 border-b ${vehicleAlerts.expired > 0 ? "border-red/10" : "border-pending/10"}`}
              >
                <Shield
                  size={15}
                  className={
                    vehicleAlerts.expired > 0 ? "text-red" : "text-pending"
                  }
                />
                <h2
                  className={`text-sm font-semibold ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}
                >
                  Document Alerts
                </h2>
                <span
                  className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${vehicleAlerts.expired > 0 ? "bg-red/10 text-red" : "bg-pending/10 text-pending"}`}
                >
                  {vehicleAlerts.total}
                </span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                {vehicleAlerts.alerts?.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-1.5 py-2 border-b border-gray-100/60 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-primarytext truncate">
                        {v.vehicle_name || v.vehicle_number}
                      </span>
                      <span className="text-[11px] text-secondarytext shrink-0">
                        {v.vehicle_type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {v.insurance_days !== null && v.insurance_days <= 30 && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${v.insurance_days < 0 ? "bg-red/10 text-red" : "bg-pending/10 text-pending"}`}
                        >
                          <Shield size={9} />
                          Ins:{" "}
                          {v.insurance_days < 0
                            ? "Expired"
                            : `${v.insurance_days}d`}
                        </span>
                      )}
                      {v.fc_days !== null && v.fc_days <= 30 && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${v.fc_days < 0 ? "bg-red/10 text-red" : "bg-pending/10 text-pending"}`}
                        >
                          <FileText size={9} />
                          FC: {v.fc_days < 0 ? "Expired" : `${v.fc_days}d`}
                        </span>
                      )}
                      {v.permit_days !== null && v.permit_days <= 30 && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${v.permit_days < 0 ? "bg-red/10 text-red" : "bg-pending/10 text-pending"}`}
                        >
                          <FileText size={9} />
                          Permit:{" "}
                          {v.permit_days < 0 ? "Expired" : `${v.permit_days}d`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <p
                  className={`text-[11px] pt-0.5 ${vehicleAlerts.expired > 0 ? "text-red/60" : "text-pending/60"}`}
                >
                  Notify admin if documents need renewal.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EV Assignment Details Modal ── */}
      {selectedEVAssignment && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-2xl sm:rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            <div className="bg-linear-to-r from-green to-emerald-600 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="p-3 bg-white/15 rounded-md shadow-sm">
                  <Zap size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold truncate">
                    EV Assignment Details
                  </h3>
                  <p className="text-white/80 text-sm mt-1 truncate">
                    {selectedEVAssignment.vehicle_group_name || "EV Group"}
                  </p>
                  <p className="text-white/70 text-xs mt-1 truncate">
                    {getAssignmentShifts(selectedEVAssignment)
                      .map((shift) => shift.shift_name)
                      .filter(Boolean)
                      .join(" • ") || "EV Duty"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-white/20 rounded-md transition-colors shrink-0"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 max-h-[68vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-green/10 rounded-md border border-green/10">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Date Range
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {getDateRangeLabel(selectedEVAssignment)}
                  </p>
                </div>
                <div className="p-4 bg-green/10 rounded-md border border-green/10">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Shift Coverage
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {getShiftTimeLabel(selectedEVAssignment)}
                  </p>
                  <p className="text-[11px] text-green mt-1 font-medium">
                    {getAssignmentShifts(selectedEVAssignment).length || 1}{" "}
                    shift blocks
                  </p>
                </div>
                <div className="p-4 bg-green/10 rounded-md border border-green/10">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Vehicle Group
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {selectedEVAssignment.vehicle_group_name || "EV Group"}
                  </p>
                  <p className="text-[11px] text-green mt-1 font-medium">
                    {selectedEVAssignment.group_vehicles?.length || 0} vehicles
                  </p>
                </div>
                <div className="p-4 bg-green/10 rounded-md border border-green/10">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Driver Group
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {selectedEVAssignment.driver_group_name || "Driver Group"}
                  </p>
                  <p className="text-[11px] text-green mt-1 font-medium">
                    {selectedEVAssignment.group_drivers?.length || 0} drivers
                  </p>
                </div>
              </div>

              <div className="bg-primarybg rounded-md border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Clock size={18} className="text-green" />
                    Shift Schedule
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green/10 text-green">
                    {getAssignmentShifts(selectedEVAssignment).length || 1}{" "}
                    shifts
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getAssignmentShifts(selectedEVAssignment).map(
                    (shift, index) => (
                      <div
                        key={shift.shift_id || `${shift.shift_name}-${index}`}
                        className="p-4 bg-white rounded-md border border-green/10 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-primarytext text-sm">
                              {shift.shift_name || `Shift ${index + 1}`}
                            </p>
                            <p className="text-xs text-secondarytext mt-1 font-mono">
                              {shift.start_time || "-"} -{" "}
                              {shift.end_time || "-"}
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-green/10 text-green whitespace-nowrap">
                            Block {index + 1}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="bg-primarybg rounded-md border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Car size={18} className="text-green" />
                    Assigned Vehicles
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green/10 text-green">
                    {selectedEVAssignment.group_vehicles?.length || 0}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => {
                    const vehicleDisplay = getVehicleDisplay(vehicle);
                    return (
                      <div
                        key={vehicle.id}
                        className="p-4 bg-white rounded-md border border-green/10 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-primarytext truncate">
                              {vehicleDisplay.title}
                            </p>
                            <p className="text-xs text-secondarytext mt-1 truncate">
                              {vehicleDisplay.subtitle ||
                                "Vehicle number unavailable"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-green/10 text-green">
                              {vehicle.fuel_type || "EV"}
                            </span>
                            {vehicle.vehicle_type && (
                              <span className="text-[11px] text-secondarytext font-medium">
                                {vehicle.vehicle_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedEVAssignment.group_vehicles ||
                    selectedEVAssignment.group_vehicles.length === 0) && (
                    <p className="sm:col-span-2 text-gray-500 text-sm text-center py-6">
                      No vehicles are linked to this EV group yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-primarybg rounded-md border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Users size={18} className="text-green" />
                    Assigned Drivers
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green/10 text-green">
                    {selectedEVAssignment.group_drivers?.length || 0}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-4 bg-white rounded-md border border-green/10 shadow-sm flex items-center gap-3"
                    >
                      <div className="w-11 h-11 bg-green/10 rounded-md flex items-center justify-center text-green font-bold shrink-0">
                        {driver.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {driver.name}
                        </p>
                        <p className="text-xs text-secondarytext mt-1">
                          {selectedEVAssignment.driver_group_name ||
                            "Driver group member"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_drivers ||
                    selectedEVAssignment.group_drivers.length === 0) && (
                    <p className="sm:col-span-2 text-gray-500 text-sm text-center py-6">
                      No drivers are linked to this EV group yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-green/10 rounded-md border border-green/10">
                <div>
                  <p className="text-sm font-semibold text-primarytext">
                    Assignment Status
                  </p>
                  <p className="text-xs text-secondarytext mt-1">
                    EV group assignment is ready for duty.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-white text-green border border-green/15">
                  <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  {selectedEVAssignment.status || "Active"}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full sm:w-auto sm:min-w-36 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-md transition-colors ml-auto block"
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
