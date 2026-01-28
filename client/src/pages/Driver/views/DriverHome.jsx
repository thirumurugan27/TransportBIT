import React, {useState, useEffect} from "react";
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
} from "lucide-react";

export default function DriverHome() {
  const [assignments, setAssignments] = useState([]);
  const [vehicleAlerts, setVehicleAlerts] = useState({
    alerts: [],
    expired: 0,
    critical: 0,
    total: 0,
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const {user} = useAuth();
  const driverName = user?.full_name || "Driver";
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
      fetchVehicleAlerts();
      fetchNotifications();
    }
  }, [driverId]);

  const fetchNotifications = async () => {
    try {
      const res = await apiGet(`/api/driver/notifications?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
        setUnreadCount((data || []).filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiPost(`/api/driver/notifications/${notificationId}/mark-read`);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? {...n, is_read: true} : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPost(`/api/driver/notifications/mark-all-read?driver_id=${driverId}`);
      setNotifications(notifications.map(n => ({...n, is_read: true})));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'vehicle_change':
        return <RotateCcw className="w-5 h-5 text-primary" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-pending" />;
      case 'alert':
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
        `/api/driver/assignments/today?driver_id=${driverId}&date=${today}`
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
      const res = await apiGet(`/api/driver/vehicles/alerts?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setVehicleAlerts(data || { alerts: [], expired: 0, critical: 0, total: 0 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-primary to-primarydull rounded-md p-8 text-white shadow-xl relative">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back, {driverName}!</h2>
            <p className="text-white/80 text-lg">
              Drive safely and have a great day.
            </p>
          </div>
          {/* Notification Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors relative"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
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
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
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
                  className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? 'bg-primary/10' : 'bg-gray-100'}`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className={`font-medium ${!notif.is_read ? 'text-primarytext' : 'text-secondarytext'}`}>
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
                      <p className="text-sm text-secondarytext mt-1">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
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
        <div className={`${vehicleAlerts.expired > 0 ? 'bg-red/10 border-red/20' : vehicleAlerts.critical > 0 ? 'bg-pending/10 border-pending/20' : 'bg-yellow-500/10 border-yellow-500/20'} border rounded-md p-5`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 ${vehicleAlerts.expired > 0 ? 'bg-red/20' : vehicleAlerts.critical > 0 ? 'bg-pending/20' : 'bg-yellow-500/20'} rounded-md flex items-center justify-center shrink-0`}>
              <Shield className={`w-6 h-6 ${vehicleAlerts.expired > 0 ? 'text-red' : vehicleAlerts.critical > 0 ? 'text-pending' : 'text-yellow-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-bold ${vehicleAlerts.expired > 0 ? 'text-red' : vehicleAlerts.critical > 0 ? 'text-pending' : 'text-yellow-600'}`}>
                ⚠️ Vehicle Document Alert
              </h3>
              <div className="mt-2 space-y-2">
                {vehicleAlerts.alerts?.map((v) => (
                  <div key={v.id} className="text-sm">
                    <span className="font-semibold text-primarytext">{v.vehicle_number}</span>
                    <span className="text-secondarytext ml-1">({v.vehicle_type})</span>
                    <span className="mx-2">—</span>
                    {v.insurance_days !== null && v.insurance_days <= 30 && (
                      <span className={`mr-2 ${v.insurance_days < 0 ? 'text-red font-bold' : v.insurance_days <= 7 ? 'text-pending font-semibold' : 'text-yellow-600'}`}>
                        Insurance: {v.insurance_days < 0 ? 'EXPIRED' : `${v.insurance_days} days left`}
                      </span>
                    )}
                    {v.fc_days !== null && v.fc_days <= 30 && (
                      <span className={`mr-2 ${v.fc_days < 0 ? 'text-red font-bold' : v.fc_days <= 7 ? 'text-pending font-semibold' : 'text-yellow-600'}`}>
                        FC: {v.fc_days < 0 ? 'EXPIRED' : `${v.fc_days} days left`}
                      </span>
                    )}
                    {v.permit_days !== null && v.permit_days <= 30 && (
                      <span className={`${v.permit_days < 0 ? 'text-red font-bold' : v.permit_days <= 7 ? 'text-pending font-semibold' : 'text-yellow-600'}`}>
                        Permit: {v.permit_days < 0 ? 'EXPIRED' : `${v.permit_days} days left`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-2 ${vehicleAlerts.expired > 0 ? 'text-red/70' : vehicleAlerts.critical > 0 ? 'text-pending/70' : 'text-yellow-600/70'}`}>
                Please notify admin if documents need renewal.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-primarytext mb-4 flex items-center gap-2">
          <Calendar className="text-primary" size={24} />
          Today's Duties
        </h3>

        {assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment, index) => {
              const isTemp = assignment.is_temporary_replacement;
              return (
                <div
                  key={assignment.id || index}
                  className={`relative p-5 rounded-md transition-all hover:shadow-md group overflow-hidden ${
                    isTemp
                      ? "bg-linear-to-br from-white to-orange-50 border-pending border-2 shadow-pending/10"
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
                      className={`p-3 rounded-full shrink-0 ${
                        isTemp
                          ? "bg-pending/10 text-pending"
                          : "bg-primarybg text-primary group-hover:bg-primary group-hover:text-white transition-colors"
                      }`}
                    >
                      {assignment.vehicle_type === "CAR" ? (
                        <Truck size={24} />
                      ) : (
                        <Bus size={24} />
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Vehicle Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Vehicle
                        </p>
                        <p className="font-bold text-primarytext text-lg">
                          {assignment.vehicle_number}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              isTemp
                                ? "bg-pending/10 text-pending"
                                : "bg-green/10 text-green"
                            }`}
                          >
                            {assignment.vehicle_type}
                          </span>
                        </div>
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
                          {assignment.start_time} - {assignment.end_time}
                        </div>
                      </div>

                      {/* Status Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
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
                            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
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
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
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
    </div>
  );
}
