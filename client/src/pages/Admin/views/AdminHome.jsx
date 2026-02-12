import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {
  Users,
  Bus,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  Fuel,
  Shield,
  FileWarning,
  Truck,
  MapPin,
  FileText,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_drivers: 0,
    present_drivers: 0,
    absent_drivers: 0,
    total_vehicles: 0,
    active_duties: 0,
  });
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [vehicleAlerts, setVehicleAlerts] = useState({
    alerts: [],
    expired: 0,
    critical: 0,
    total: 0,
  });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          statsRes,
          assignmentsRes,
          alertsRes,
          pendingCountRes,
          requestsRes,
        ] = await Promise.all([
          fetch(`${API_BASE}/api/admin/dashboard/stats`),
          fetch(`${API_BASE}/api/admin/assignments`),
          fetch(`${API_BASE}/api/admin/vehicles/alerts`),
          fetch(`${API_BASE}/api/admin/vehicle-requests/pending-count`),
          fetch(`${API_BASE}/api/admin/vehicle-requests?status=pending`),
        ]);
        const statsData = await statsRes.json();
        const assignmentsData = await assignmentsRes.json();
        const alertsData = await alertsRes.json();
        const pendingCountData = await pendingCountRes.json();
        const requestsData = await requestsRes.json();
        setStats(statsData);
        setRecentAssignments((assignmentsData || []).slice(0, 4));
        setVehicleAlerts(
          alertsData || {alerts: [], expired: 0, critical: 0, total: 0},
        );
        setPendingCount(pendingCountData.count || 0);
        setPendingRequests((requestsData || []).slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    {
      title: "Total Drivers",
      value: stats.total_drivers,
      icon: Users,
      color: "bg-primary",
      shadowColor: "shadow-primary/30",
      subtext: `${stats.present_drivers} Present • ${stats.absent_drivers} Absent`,
    },
    {
      title: "Total Vehicles",
      value: stats.total_vehicles,
      icon: Bus,
      color: "bg-green",
      shadowColor: "shadow-green/30",
      subtext: "Fleet Active",
    },
    {
      title: "Active Duties",
      value: stats.active_duties,
      icon: ClipboardList,
      color: "bg-pending",
      shadowColor: "shadow-pending/30",
      subtext: "Current Operations",
    },
    {
      title: "System Status",
      value: "Online",
      icon: CheckCircle,
      color: "bg-green",
      shadowColor: "shadow-green/30",
      subtext: "All systems operational",
      isText: true,
    },
  ];

  // Calculate fleet health percentages
  const vehicleUsage =
    stats.total_vehicles > 0
      ? Math.round((stats.active_duties / stats.total_vehicles) * 100)
      : 0;
  const driverAvailability =
    stats.total_drivers > 0
      ? Math.round((stats.present_drivers / stats.total_drivers) * 100)
      : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primarytext tracking-tight">
          Operational Overview
        </h1>
        <p className="text-secondarytext mt-2 font-medium">
          Manage your transport fleet and monitor operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-secondarybg rounded-md p-6 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-300 group"
            style={{
              animationDelay: `${idx * 100}ms`,
            }}
          >
            <div
              className={`w-14 h-14 ${card.color} rounded-md flex items-center justify-center text-white shadow-lg ${card.shadowColor} group-hover:scale-105 transition-transform duration-300`}
            >
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-widest">
                {card.title}
              </p>
              <h3
                className={`text-2xl font-bold ${
                  card.isText ? "text-green" : "text-primarytext"
                } mt-1`}
              >
                {card.value}
              </h3>
              <p className="text-xs text-secondarytext mt-0.5">
                {card.subtext}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Assignments */}
        <div className="bg-secondarybg p-8 rounded-md shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-primarytext flex items-center gap-3">
              <span className="w-1.5 h-6 bg-primary rounded-md"></span>
              Recent Assignments
            </h2>
            <button
              onClick={() => navigate("/admin-dashboard/all-assignments")}
              className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primarybg border-t-primary rounded-md animate-spin"></div>
              </div>
            ) : recentAssignments.length > 0 ? (
              recentAssignments.map((assignment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-primarybg/50 rounded-md hover:bg-primarybg transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center text-primary font-bold text-xs">
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-primarytext">
                        {assignment.driver_name || "Unassigned"}
                      </p>
                      <p className="text-xs text-secondarytext">
                        {assignment.vehicle_number || "No Vehicle"} •{" "}
                        {assignment.shift_name || "No Shift"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                      assignment.status === "completed"
                        ? "bg-green/10 text-green"
                        : assignment.status === "in_progress"
                          ? "bg-primary/10 text-primary"
                          : "bg-pending/10 text-pending"
                    }`}
                  >
                    {assignment.status || "Pending"}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-secondarytext">
                No recent assignments found
              </div>
            )}
          </div>
        </div>

        {/* Fleet Health */}
        <div className="bg-secondarybg p-8 rounded-md shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-primarytext flex items-center gap-3">
              <span className="w-1.5 h-6 bg-green rounded-md"></span>
              Fleet Health
            </h2>
            <Fuel className="w-5 h-5 text-gray-300" />
          </div>
          <div className="space-y-6">
            {/* Vehicle Usage */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-secondarytext">
                  Vehicle Usage
                </span>
                <span className="text-primary font-bold">{vehicleUsage}%</span>
              </div>
              <div className="h-3 bg-primarybg rounded-md overflow-hidden">
                <div
                  className="h-full bg-primary rounded-md transition-all duration-500 ease-out"
                  style={{width: `${Math.min(vehicleUsage, 100)}%`}}
                ></div>
              </div>
            </div>

            {/* Driver Availability */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-secondarytext">
                  Driver Availability
                </span>
                <span className="text-green font-bold">
                  {driverAvailability}%
                </span>
              </div>
              <div className="h-3 bg-primarybg rounded-md overflow-hidden">
                <div
                  className="h-full bg-green rounded-md transition-all duration-500 ease-out"
                  style={{width: `${Math.min(driverAvailability, 100)}%`}}
                ></div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="p-4 bg-primarybg/50 rounded-md">
                <div className="flex items-center gap-2 text-secondarytext mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Today
                  </span>
                </div>
                <p className="text-lg font-bold text-primarytext">
                  {stats.active_duties} Duties
                </p>
              </div>
              <div className="p-4 bg-primarybg/50 rounded-md">
                <div className="flex items-center gap-2 text-secondarytext mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Status
                  </span>
                </div>
                <p className="text-lg font-bold text-green">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Vehicle Requests Alert */}
      {pendingCount > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-md flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-primary">
                  Pending Vehicle Requests
                </h3>
                <p className="text-sm text-primary/80">
                  {pendingCount} request(s) awaiting approval
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/admin-dashboard/vehicle-requests")}
              className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primarydull transition-colors text-sm flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Show preview of pending requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-2 mt-4 border-t border-primary/20 pt-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-100 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-pending/10 rounded-md flex items-center justify-center">
                      <Truck className="w-4 h-4 text-pending" />
                    </div>
                    <div>
                      <p className="font-medium text-primarytext text-sm">
                        {request.faculty_name || "Faculty"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-secondarytext">
                        <MapPin size={11} />
                        <span>
                          {request.onward_from_place} →{" "}
                          {request.onward_to_place}
                        </span>
                        <span className="text-gray-300">•</span>
                        <Calendar size={11} />
                        <span>
                          {request.onward_from_datetime?.split(" ")[0] || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-pending/10 text-pending text-xs font-semibold rounded-md">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Absent Driver Alert Section */}
      {stats.absent_drivers > 0 && (
        <div className="bg-red/10 border border-red/20 rounded-md p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red/20 rounded-md flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red" />
            </div>
            <div>
              <h3 className="font-bold text-red">Attention Required</h3>
              <p className="text-sm text-red/80">
                {stats.absent_drivers} driver(s) are absent or on leave today
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/admin-dashboard/drivers?status=absent")}
            className="px-4 py-2 bg-red text-white rounded-md font-medium hover:bg-red/90 transition-colors text-sm"
          >
            View Details
          </button>
        </div>
      )}

      {/* Vehicle Document Alert Section */}
      {vehicleAlerts.total > 0 && (
        <div
          className={`${vehicleAlerts.expired > 0 ? "bg-red/10 border-red/20" : "bg-pending/10 border-pending/20"} border rounded-md p-6 flex items-center justify-between`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 ${vehicleAlerts.expired > 0 ? "bg-red/20" : "bg-pending/20"} rounded-md flex items-center justify-center`}
            >
              <Shield
                className={`w-6 h-6 ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}
              />
            </div>
            <div>
              <h3
                className={`font-bold ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}
              >
                ⚠️ Vehicle Document Alerts
              </h3>
              <p
                className={`text-sm ${vehicleAlerts.expired > 0 ? "text-red/80" : "text-pending/80"}`}
              >
                {vehicleAlerts.expired > 0 && (
                  <span className="font-semibold">
                    {vehicleAlerts.expired} vehicle(s) with expired documents
                  </span>
                )}
                {vehicleAlerts.expired > 0 &&
                  vehicleAlerts.critical > 0 &&
                  " • "}
                {vehicleAlerts.critical > 0 && (
                  <span>
                    {vehicleAlerts.critical} vehicle(s) expiring within 10 days
                  </span>
                )}
                {" — Insurance, FC, or Permit"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/admin-dashboard/fc-replacement")}
              className="px-4 py-2 bg-primary hover:bg-primarydull text-white rounded-md font-medium transition-colors text-sm"
            >
              Manage Replacements
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
