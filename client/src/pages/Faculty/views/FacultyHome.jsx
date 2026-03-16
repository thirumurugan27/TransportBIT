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
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="rounded-md border border-[#E4E8F4] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-md ${card.color} text-white shadow-sm`}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondarytext">
                  {card.title}
                </p>
                <p
                  className={`mt-1 text-2xl font-bold leading-none ${card.textColor}`}
                >
                  {loading ? "-" : card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && unreadRequestAlerts.length > 0 && (
        <div className="rounded-md border border-[#F4D4D4] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F8E3E3] px-4 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primarytext">
              <span className="h-5 w-1 rounded-md bg-red"></span>
              Request Alerts
              <span className="rounded-md bg-red/10 px-2 py-0.5 text-xs font-bold text-red">
                {unreadRequestAlerts.length}
              </span>
            </h2>
            {unreadRequestAlerts.length > 1 && (
              <button
                onClick={dismissAllRejections}
                className="rounded-md border border-[#E4E8F4] bg-[#F8F9FD] px-3 py-1.5 text-xs font-semibold text-secondarytext hover:text-primarytext transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="space-y-3 p-4">
            {unreadRequestAlerts.map((request) => {
              const isCancelled = request.status === "cancelled";
              const actionByName = request.approved_by_name || "Unknown";
              return (
                <div
                  key={request.id}
                  className={`flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-start md:justify-between ${
                    isCancelled
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-red bg-red/5"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
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
                        className={`mt-1 text-xs font-semibold ${
                          isCancelled ? "text-amber-700" : "text-red"
                        }`}
                      >
                        {isCancelled
                          ? `Cancelled - ${actionByName}`
                          : `Rejected - ${actionByName}`}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-secondarytext">
                        <Calendar size={12} />
                        <span>
                          {request.onward_from_datetime?.split(" ")[0] || "N/A"}
                        </span>
                      </div>
                      {request.admin_remarks && (
                        <p
                          className={`mt-2 text-xs ${
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
                    className="ml-0 inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-[#D8DCF0] bg-white px-3 py-2 text-xs font-semibold text-secondarytext hover:border-primary/30 hover:text-primary transition-colors md:ml-3"
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

      <div className="rounded-md border min-h-[500px] border-[#E4E8F4] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#EEF1F9] px-4 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primarytext">
            <span className="h-5 w-1 rounded-md bg-primary"></span>
            Active Requests
          </h2>
          <button
            onClick={() => navigate("/faculty-dashboard/vehicle-booking")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primarydull transition-colors"
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
                    className="flex flex-col gap-3 rounded-md border border-[#E4E8F4] bg-[#FBFCFE] p-4 transition-colors hover:border-primary/20 hover:bg-white md:flex-row md:items-center md:justify-between cursor-pointer"
                    onClick={() =>
                      navigate("/faculty-dashboard/vehicle-booking")
                    }
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-md border ${config.color}`}
                      >
                        {React.createElement(config.icon, {size: 18})}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-primarytext truncate">
                          {request.onward_from_place} →{" "}
                          {request.onward_to_place}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondarytext">
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
                      className={`self-start rounded-md border px-3 py-1 text-xs font-semibold ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[#D8DCF0] bg-[#FBFCFE] py-10 text-center">
              <Truck className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-secondarytext">No active requests</p>
              <button
                onClick={() => navigate("/faculty-dashboard/new-request")}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primarydull"
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
