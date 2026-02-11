import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  Bell,
  Filter,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const {user} = useAuth();
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchNotifications();
    }
  }, [driverId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/driver/notifications?driver_id=${driverId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      case "info":
        return <Info className="w-5 h-5 text-skyblue" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "vehicle_change":
        return "Vehicle Change";
      case "warning":
        return "Warning";
      case "alert":
        return "Alert";
      case "info":
        return "Information";
      default:
        return "Notification";
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case "vehicle_change":
        return "bg-primary/10 text-primary";
      case "warning":
        return "bg-pending/10 text-pending";
      case "alert":
        return "bg-red/10 text-red";
      case "info":
        return "bg-skyblue/10 text-skyblue";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    // Type filter
    if (filterType !== "all" && n.type !== filterType) return false;

    // Status filter
    if (filterStatus === "unread" && n.is_read) return false;
    if (filterStatus === "read" && !n.is_read) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = n.title?.toLowerCase().includes(query);
      const matchesMessage = n.message?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesMessage) return false;
    }

    return true;
  });

  // Get unique notification types for filter dropdown
  const notificationTypes = [...new Set(notifications.map((n) => n.type))];

  // Stats
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const totalCount = notifications.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-primarytext flex items-center gap-2">
              <Bell className="text-primary" /> Notifications
            </h3>
            <p className="text-sm text-secondarytext mt-1">
              View and manage all your notifications
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-md font-medium">
                {unreadCount} unread
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md font-medium">
                {totalCount} total
              </span>
            </div>
            <button
              onClick={fetchNotifications}
              className="p-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
              >
                <Check size={16} /> Mark All Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-3 sm:p-4 flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="flex items-center gap-2 text-sm text-secondarytext font-medium">
          <Filter size={16} /> Filters:
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm w-full sm:w-64"
          />
        </div>

        <CustomDropdown
          value={filterType}
          onChange={setFilterType}
          options={[
            {value: "all", label: "All Types"},
            {value: "vehicle_change", label: "🔄 Vehicle Change"},
            {value: "info", label: "ℹ️ Information"},
            {value: "warning", label: "⚠️ Warning"},
            {value: "alert", label: "🚨 Alert"},
          ]}
          width="w-44"
        />

        <CustomDropdown
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            {value: "all", label: "All Status"},
            {value: "unread", label: "📬 Unread Only"},
            {value: "read", label: "📭 Read Only"},
          ]}
          width="w-40"
        />

        {(filterType !== "all" || filterStatus !== "all" || searchQuery) && (
          <button
            onClick={() => {
              setFilterType("all");
              setFilterStatus("all");
              setSearchQuery("");
            }}
            className="px-3 py-2 text-sm text-red hover:bg-red/10 rounded-md transition-colors flex items-center gap-1"
          >
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-secondarytext">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
            Loading notifications...
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 sm:p-5 hover:bg-gray-50 transition-colors ${!notif.is_read ? "bg-primary/5 border-l-4 border-l-primary" : ""}`}
              >
                <div className="flex gap-2 sm:gap-4">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md flex items-center justify-center shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100"}`}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`font-semibold ${!notif.is_read ? "text-primarytext" : "text-secondarytext"}`}
                          >
                            {notif.title}
                          </h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-md ${getTypeBadgeColor(notif.type)}`}
                          >
                            {getTypeLabel(notif.type)}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-md"></span>
                          )}
                        </div>
                        <p className="text-sm text-secondarytext mt-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-3">
                          {notif.created_at || "-"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0">
                        {!notif.is_read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors flex items-center gap-1"
                          >
                            <Check size={12} /> Mark Read
                          </button>
                        )}
                        {notif.is_read && (
                          <span className="flex items-center gap-1 text-xs text-green">
                            <CheckCircle size={14} /> Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-secondarytext font-medium">
              No notifications found
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {filterType !== "all" || filterStatus !== "all" || searchQuery
                ? "Try adjusting your filters"
                : "You're all caught up!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
