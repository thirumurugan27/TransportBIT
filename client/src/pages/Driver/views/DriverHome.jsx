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
  Eye,
  MapPin,
  Play,
  User,
  ListChecks,
  FileText,
  Wrench,
  ArrowRight,
  CircleDot,
  ClipboardList,
  CalendarDays,
  Sun,
  Moon,
  Sunrise,
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

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return {text: "Good Morning", icon: <Sunrise size={20} />};
    if (hour < 17) return {text: "Good Afternoon", icon: <Sun size={20} />};
    return {text: "Good Evening", icon: <Moon size={20} />};
  }, []);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Compute pending tasks
  const pendingTasks = useMemo(() => {
    const tasks = [];
    const pendingAssignments = assignments.filter(
      (a) => a.status !== "completed",
    );
    if (pendingAssignments.length > 0) {
      tasks.push({
        id: "duties",
        label: `${pendingAssignments.length} ${pendingAssignments.length === 1 ? "duty" : "duties"} scheduled`,
        icon: <Bus size={16} />,
        color: "text-primary",
        bg: "bg-primary/10",
        action: () => navigate("/driver-dashboard/assignments"),
      });
    }
    if (upcomingRequests.length > 0) {
      tasks.push({
        id: "requests",
        label: `${upcomingRequests.length} upcoming ${upcomingRequests.length === 1 ? "trip" : "trips"}`,
        icon: <Truck size={16} />,
        color: "text-skyblue",
        bg: "bg-skyblue/10",
        action: () => navigate("/driver-dashboard/vehicle-requests"),
      });
    }
    if (vehicleAlerts.expired > 0) {
      tasks.push({
        id: "expired",
        label: `${vehicleAlerts.expired} expired ${vehicleAlerts.expired === 1 ? "document" : "documents"}`,
        icon: <AlertCircle size={16} />,
        color: "text-red",
        bg: "bg-red/10",
        action: null,
      });
    }
    if (vehicleAlerts.critical > 0) {
      tasks.push({
        id: "critical",
        label: `${vehicleAlerts.critical} ${vehicleAlerts.critical === 1 ? "document" : "documents"} expiring soon`,
        icon: <AlertTriangle size={16} />,
        color: "text-pending",
        bg: "bg-pending/10",
        action: null,
      });
    }
    if (unreadCount > 0) {
      tasks.push({
        id: "notifs",
        label: `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`,
        icon: <Bell size={16} />,
        color: "text-primarydull",
        bg: "bg-primarydull/10",
        action: () => setShowNotifications(true),
      });
    }
    return tasks;
  }, [assignments, upcomingRequests, vehicleAlerts, unreadCount]);

  // Summary stats for cards
  const completedCount = assignments.filter(
    (a) => a.status === "completed",
  ).length;
  const scheduledCount = assignments.filter(
    (a) => a.status !== "completed",
  ).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primarydull rounded-2xl p-5 sm:p-7 lg:p-8 text-white shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
              {greeting.icon}
              <span>{greeting.text}</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 break-words">
              {driverName}
            </h2>
            <p className="text-white/60 text-xs sm:text-sm flex items-center gap-1.5">
              <CalendarDays size={14} />
              {todayFormatted}
            </p>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-lg">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Inline Quick Stats */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <p className="text-white/60 text-[11px] uppercase tracking-wider font-medium">Today's Duties</p>
            <p className="text-2xl font-bold mt-0.5">{assignments.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <p className="text-white/60 text-[11px] uppercase tracking-wider font-medium">Completed</p>
            <p className="text-2xl font-bold mt-0.5">{completedCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <p className="text-white/60 text-[11px] uppercase tracking-wider font-medium">Upcoming Trips</p>
            <p className="text-2xl font-bold mt-0.5">{upcomingRequests.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <p className="text-white/60 text-[11px] uppercase tracking-wider font-medium">Alerts</p>
            <p className="text-2xl font-bold mt-0.5">{vehicleAlerts.total}</p>
          </div>
        </div>
      </div>

      {/* ── Notification Panel ── */}
      {showNotifications && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-slideUp">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-primarytext flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-semibold">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-5 py-3.5 hover:bg-gray-50/50 transition-colors ${!notif.is_read ? "bg-primary/[0.03]" : ""}`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100"}`}
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
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {notif.created_at || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-secondarytext">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pending Tasks Overview ── */}
      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-primarytext flex items-center gap-2">
              <ListChecks size={18} className="text-primary" />
              Pending Tasks
              <span className="ml-auto text-xs text-secondarytext font-normal">
                {pendingTasks.length} {pendingTasks.length === 1 ? "item" : "items"} need attention
              </span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                onClick={task.action || undefined}
                className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${task.action ? "hover:bg-gray-50/70 cursor-pointer" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.bg}`}>
                  <span className={task.color}>{task.icon}</span>
                </div>
                <span className="text-sm text-primarytext font-medium flex-1">{task.label}</span>
                {task.action && (
                  <ArrowRight size={14} className="text-gray-400" />
                )}
                {!task.action && (
                  <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-pulse" style={{color: "inherit"}} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Assignments",
            icon: <ClipboardList size={22} />,
            path: "/driver-dashboard/assignments",
            color: "text-primary",
            bg: "bg-primary/10 hover:bg-primary/15",
          },
          {
            label: "KM Log",
            icon: <FileText size={22} />,
            path: "/driver-dashboard/km-log",
            color: "text-green",
            bg: "bg-green/10 hover:bg-green/15",
          },
          {
            label: "Service",
            icon: <Wrench size={22} />,
            path: "/driver-dashboard/service-repair",
            color: "text-pending",
            bg: "bg-pending/10 hover:bg-pending/15",
          },
          {
            label: "Leave",
            icon: <CalendarDays size={22} />,
            path: "/driver-dashboard/apply-leave",
            color: "text-skyblue",
            bg: "bg-skyblue/10 hover:bg-skyblue/15",
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow transition-all group`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.bg} ${item.color} transition-colors`}>
              {item.icon}
            </div>
            <span className="text-xs font-semibold text-secondarytext group-hover:text-primarytext transition-colors">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Vehicle Document Alerts ── */}
      {vehicleAlerts.total > 0 && (
        <div
          className={`rounded-2xl border overflow-hidden ${
            vehicleAlerts.expired > 0
              ? "bg-red/5 border-red/15"
              : "bg-pending/5 border-pending/15"
          }`}
        >
          <div className={`px-5 py-3.5 flex items-center gap-3 border-b ${
            vehicleAlerts.expired > 0 ? "border-red/10 bg-red/5" : "border-pending/10 bg-pending/5"
          }`}>
            <Shield
              size={18}
              className={vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}
            />
            <h3 className={`text-sm font-semibold ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}>
              Vehicle Document Alerts
            </h3>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              vehicleAlerts.expired > 0 ? "bg-red/10 text-red" : "bg-pending/10 text-pending"
            }`}>
              {vehicleAlerts.total}
            </span>
          </div>
          <div className="px-5 py-3 space-y-2.5">
            {vehicleAlerts.alerts?.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-gray-100/60 last:border-0"
              >
                <span className="font-semibold text-sm text-primarytext">
                  {v.vehicle_name || v.vehicle_number}
                </span>
                <span className="text-xs text-secondarytext">
                  {v.vehicle_type}
                </span>
                <div className="flex flex-wrap gap-2 ml-auto">
                  {v.insurance_days !== null && v.insurance_days <= 30 && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        v.insurance_days < 0
                          ? "bg-red/10 text-red"
                          : v.insurance_days <= 7
                            ? "bg-pending/10 text-pending"
                            : "bg-pending/5 text-pending"
                      }`}
                    >
                      <Shield size={10} />
                      Insurance: {v.insurance_days < 0 ? "Expired" : `${v.insurance_days}d`}
                    </span>
                  )}
                  {v.fc_days !== null && v.fc_days <= 30 && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        v.fc_days < 0
                          ? "bg-red/10 text-red"
                          : v.fc_days <= 7
                            ? "bg-pending/10 text-pending"
                            : "bg-pending/5 text-pending"
                      }`}
                    >
                      <FileText size={10} />
                      FC: {v.fc_days < 0 ? "Expired" : `${v.fc_days}d`}
                    </span>
                  )}
                  {v.permit_days !== null && v.permit_days <= 30 && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        v.permit_days < 0
                          ? "bg-red/10 text-red"
                          : v.permit_days <= 7
                            ? "bg-pending/10 text-pending"
                            : "bg-pending/5 text-pending"
                      }`}
                    >
                      <FileText size={10} />
                      Permit: {v.permit_days < 0 ? "Expired" : `${v.permit_days}d`}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <p className={`text-[11px] pt-1 ${vehicleAlerts.expired > 0 ? "text-red/60" : "text-pending/60"}`}>
              Please notify admin if documents need renewal.
            </p>
          </div>
        </div>
      )}

      {/* ── Today's Duties ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primarytext flex items-center gap-2">
            <Calendar className="text-primary" size={18} />
            Today's Duties
          </h3>
          {assignments.length > 0 && (
            <button
              onClick={() => navigate("/driver-dashboard/assignments")}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
            >
              All Assignments <ChevronRight size={14} />
            </button>
          )}
        </div>

        {assignments.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {assignments.map((assignment, index) => {
              const isTemp = assignment.is_temporary_replacement;
              const isEV = assignment.is_ev_assignment;
              const isDone = assignment.status === "completed";

              // EV Assignment Card
              if (isEV) {
                return (
                  <div
                    key={assignment.id || index}
                    onClick={() => setSelectedEVAssignment(assignment)}
                    className="px-5 py-4 hover:bg-green/[0.02] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-green/10 flex items-center justify-center shrink-0">
                        <Zap size={20} className="text-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-primarytext text-sm truncate">
                            {assignment.vehicle_group_name}
                          </p>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green text-white">
                            <Zap size={9} /> EV
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-secondarytext">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {assignment.start_time || "-"} – {assignment.end_time || "-"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {assignment.group_drivers?.length || 0} drivers
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-green transition-colors shrink-0" />
                    </div>
                  </div>
                );
              }

              // Regular / Temporary Card
              return (
                <div
                  key={assignment.id || index}
                  className={`px-5 py-4 transition-colors ${isTemp ? "bg-pending/[0.02]" : "hover:bg-gray-50/50"}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isDone
                          ? "bg-green/10"
                          : isTemp
                            ? "bg-pending/10"
                            : "bg-primary/10"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={20} className="text-green" />
                      ) : assignment.vehicle_type === "CAR" ? (
                        <Car size={20} className={isTemp ? "text-pending" : "text-primary"} />
                      ) : (
                        <Bus size={20} className={isTemp ? "text-pending" : "text-primary"} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-primarytext text-sm truncate">
                          {assignment.vehicle_name || assignment.vehicle_number}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isTemp
                              ? "bg-pending/10 text-pending"
                              : "bg-gray-100 text-secondarytext"
                          }`}
                        >
                          {assignment.vehicle_type}
                        </span>
                        {isTemp && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold bg-pending/10 text-pending px-2 py-0.5 rounded-full">
                            <RotateCcw size={9} /> Temp
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-secondarytext">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {assignment.start_time || "-"} – {assignment.end_time || "-"}
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

                    {/* Status Badge */}
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isDone
                          ? "bg-green/10 text-green"
                          : isTemp
                            ? "bg-pending/10 text-pending"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={12} />
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-secondarytext font-medium">
              No duties assigned today
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Check back later or contact admin
            </p>
          </div>
        )}
      </div>

      {/* ── Upcoming Vehicle Requests ── */}
      {upcomingRequests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primarytext flex items-center gap-2">
              <Truck className="text-primary" size={18} />
              Upcoming Trips
            </h3>
            <button
              onClick={() => navigate("/driver-dashboard/vehicle-requests")}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {upcomingRequests.slice(0, 3).map((request) => (
              <div
                key={request.id}
                className="px-5 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                onClick={() => navigate("/driver-dashboard/vehicle-requests")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primarytext text-sm truncate">
                      {request.trips?.[0]?.departure_location ||
                        request.onward_from_place}{" "}
                      →{" "}
                      {request.trips?.[0]?.arrival_location ||
                        request.onward_to_place}
                    </p>
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
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        request.status === "trip_started"
                          ? "bg-pending/10 text-pending"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {request.status === "trip_started"
                        ? "On Trip"
                        : "Assigned"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {request.vehicle_number || request.vehicle_name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EV Assignment Details Modal ── */}
      {selectedEVAssignment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-green to-emerald-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-xl">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold">EV Assignment</h3>
                  <p className="text-white/70 text-xs mt-0.5">
                    {selectedEVAssignment.shift_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Time */}
              <div className="flex items-center gap-3 p-3.5 bg-green/5 rounded-xl">
                <Clock className="text-green" size={18} />
                <div>
                  <p className="text-[11px] text-secondarytext uppercase tracking-wider font-medium">Shift Time</p>
                  <p className="text-sm font-semibold text-primarytext">
                    {selectedEVAssignment.start_time || "-"} –{" "}
                    {selectedEVAssignment.end_time || "-"}
                  </p>
                </div>
              </div>

              {/* Vehicles */}
              <div>
                <h4 className="text-xs font-semibold text-primarytext mb-2.5 flex items-center gap-1.5">
                  <Car size={14} className="text-green" />
                  Vehicles — {selectedEVAssignment.vehicle_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <p className="text-sm font-medium text-primarytext">
                        {vehicle.vehicle_name || vehicle.vehicle_number}
                      </p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green/10 text-green mt-1 inline-block">
                        {vehicle.fuel_type}
                      </span>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_vehicles ||
                    selectedEVAssignment.group_vehicles.length === 0) && (
                    <p className="col-span-2 text-xs text-secondarytext">
                      No vehicles in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Drivers */}
              <div>
                <h4 className="text-xs font-semibold text-primarytext mb-2.5 flex items-center gap-1.5">
                  <Users size={14} className="text-green" />
                  Drivers — {selectedEVAssignment.driver_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs">
                        {driver.name?.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-primarytext truncate">
                        {driver.name}
                      </p>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_drivers ||
                    selectedEVAssignment.group_drivers.length === 0) && (
                    <p className="col-span-2 text-xs text-secondarytext">
                      No drivers in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3.5 bg-green/5 rounded-xl">
                <span className="text-xs text-secondarytext font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green/10 text-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  {selectedEVAssignment.status}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-primarytext text-sm font-medium rounded-xl transition-colors"
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
