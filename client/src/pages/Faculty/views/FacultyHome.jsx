import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../../context/AuthContext";
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
    <div className="space-y-6">
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
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
            </div>
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
