import React, {useState, useEffect, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../../context/AuthContext";
import Loading from "../../../components/ui/Loading";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Truck,
  ChevronRight,
  FileText,
  Users,
  XCircle,
  Play,
  Eye,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? {Authorization: `Bearer ${token}`} : {};
};

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
  assigned: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Truck,
    label: "Assigned",
  },
  trip_started: {
    color: "bg-green/10 text-green border-green/20",
    icon: Play,
    label: "On Trip",
  },
  rejected: {
    color: "bg-red/10 text-red border-red/20",
    icon: XCircle,
    label: "Rejected",
  },
  completed: {
    color: "bg-green/10 text-green border-green/20",
    icon: CheckCircle,
    label: "Completed",
  },
  cancelled: {
    color: "bg-gray-100 text-gray-500 border-gray-200",
    icon: XCircle,
    label: "Cancelled",
  },
};

export default function FacultyHome() {
  const {user} = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [dismissedRejections, setDismissedRejections] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("faculty_dismissed_rejections") || "[]",
      );
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    assigned: 0,
    trip_started: 0,
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/faculty/vehicle-requests`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const allRequests = data || [];
        setRequests(allRequests);

        // Calculate stats
        const pending = allRequests.filter(
          (r) => r.status === "pending",
        ).length;
        const approved = allRequests.filter(
          (r) => r.status === "approved",
        ).length;
        const assigned = allRequests.filter(
          (r) => r.status === "assigned",
        ).length;
        const tripStarted = allRequests.filter(
          (r) => r.status === "trip_started",
        ).length;
        const completed = allRequests.filter(
          (r) => r.status === "completed",
        ).length;

        setStats({
          pending,
          approved,
          assigned,
          trip_started: tripStarted,
          completed,
          total: allRequests.length,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get active requests (not completed, cancelled, or rejected)
  const activeRequests = requests.filter(
    (r) => !["completed", "cancelled", "rejected"].includes(r.status),
  );

  // Get unread rejected/cancelled requests
  const unreadRequestAlerts = useMemo(
    () =>
      requests.filter(
        (r) =>
          ["rejected", "cancelled"].includes(r.status) &&
          !dismissedRejections.includes(r.id),
      ),
    [requests, dismissedRejections],
  );

  const dismissRejection = (id) => {
    const updated = [...dismissedRejections, id];
    setDismissedRejections(updated);
    localStorage.setItem(
      "faculty_dismissed_rejections",
      JSON.stringify(updated),
    );
  };

  const dismissAllRejections = () => {
    const allIds = requests
      .filter((r) => ["rejected", "cancelled"].includes(r.status))
      .map((r) => r.id);
    setDismissedRejections(allIds);
    localStorage.setItem(
      "faculty_dismissed_rejections",
      JSON.stringify(allIds),
    );
  };

  const statCards = [
    {
      title: "Pending",
      value: stats.pending,
      icon: Clock,
      color: "bg-pending",
      textColor: "text-pending",
    },
    {
      title: "Approved",
      value: stats.approved + stats.assigned,
      icon: CheckCircle,
      color: "bg-primary",
      textColor: "text-primary",
    },
    {
      title: "On Trip",
      value: stats.trip_started,
      icon: Play,
      color: "bg-green",
      textColor: "text-green",
    },
    {
      title: "Total Completed",
      value: stats.completed,
      icon: FileText,
      color: "bg-gray-500",
      textColor: "text-gray-600",
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primarydull rounded-md p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome, {user?.full_name || "Faculty"}!
        </h1>
        <p className="mt-2 text-white/90">
          Manage your vehicle requests and track their status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white rounded-md p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 ${card.color} rounded-md flex items-center justify-center text-white`}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-secondarytext uppercase tracking-wide">
                  {card.title}
                </p>
                <p className={`text-2xl font-bold ${card.textColor}`}>
                  {loading ? "-" : card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rejected/Cancelled Request Notifications */}
      {!loading && unreadRequestAlerts.length > 0 && (
        <div className="bg-white rounded-md shadow-sm border border-red/20">
          <div className="flex justify-between items-center p-4 border-b border-red/10">
            <h2 className="text-lg font-bold text-red flex items-center gap-2">
              <span className="w-1 h-5 bg-red rounded-full"></span>
              Request Alerts
              <span className="text-xs font-bold bg-red/10 text-red px-2 py-0.5 rounded-full">
                {unreadRequestAlerts.length}
              </span>
            </h2>
            {unreadRequestAlerts.length > 1 && (
              <button
                onClick={dismissAllRejections}
                className="text-xs font-semibold text-secondarytext hover:text-primarytext transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {unreadRequestAlerts.map((request) => {
              const isCancelled = request.status === "cancelled";
              const actionByName = request.approved_by_name || "Unknown";
              return (
                <div
                  key={request.id}
                  className={`flex items-start justify-between p-4 rounded-md border ${
                    isCancelled
                      ? "bg-amber-50/50 border-amber-200"
                      : "bg-red/5 border-red/10"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        isCancelled ? "bg-amber-100" : "bg-red/10"
                      }`}
                    >
                      <XCircle
                        className={`w-5 h-5 ${
                          isCancelled ? "text-amber-700" : "text-red"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primarytext">
                        {request.onward_from_place} → {request.onward_to_place}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-1 ${
                          isCancelled ? "text-amber-700" : "text-red"
                        }`}
                      >
                        {isCancelled
                          ? `Cancelled - ${actionByName}`
                          : `Rejected - ${actionByName}`}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-secondarytext mt-1">
                        <Calendar size={12} />
                        <span>
                          {request.onward_from_datetime?.split(" ")[0] || "N/A"}
                        </span>
                      </div>
                      {request.admin_remarks && (
                        <p
                          className={`text-xs mt-1.5 ${
                            isCancelled ? "text-amber-700" : "text-red"
                          }`}
                        >
                          <span className="font-semibold">Reason:</span>{" "}
                          {request.admin_remarks}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => dismissRejection(request.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-secondarytext hover:text-primarytext bg-white px-3 py-1.5 rounded-md border border-gray-200 hover:border-gray-300 transition-colors shrink-0 ml-3"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Mark as read
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 
      {/* Active Requests Section */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-primarytext flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full"></span>
            Active Requests
          </h2>
          <button
            onClick={() => navigate("/faculty-dashboard/vehicle-booking")}
            className="text-primary font-medium text-sm hover:underline flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <Loading fullScreen={false} size="small" />
          ) : activeRequests.length > 0 ? (
            <div className="space-y-3">
              {activeRequests.slice(0, 5).map((request) => {
                const config =
                  STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() =>
                      navigate("/faculty-dashboard/vehicle-booking")
                    }
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center border ${config.color}`}
                      >
                        {React.createElement(config.icon, {size: 18})}
                      </div>
                      <div>
                        <p className="font-semibold text-primarytext">
                          {request.onward_from_place} →{" "}
                          {request.onward_to_place}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-secondarytext mt-1">
                          <Calendar size={12} />
                          <span>
                            {request.onward_from_datetime?.split(" ")[0] ||
                              "N/A"}
                          </span>
                          <span className="text-gray-300">•</span>
                          <Clock size={12} />
                          <span>
                            {request.onward_from_datetime
                              ?.split(" ")
                              .slice(1)
                              .join(" ") || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-md text-xs font-semibold border ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-secondarytext">No active requests</p>
              <button
                onClick={() => navigate("/faculty-dashboard/new-request")}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primarydull transition-colors text-sm"
              >
                Book a Vehicle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
