import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {
  Truck,
  Users,
  Clock,
  MapPin,
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Fuel,
  Zap,
  LayoutDashboard,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function DashboardHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_vehicles: 0,
    present_drivers: 0,
    total_drivers: 0,
    active_duties: 0,
    absent_drivers: 0,
  });
  const [leaveStats, setLeaveStats] = useState({pending: 0});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [busFleet, setBusFleet] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, leaveStatsRes, leaveReqRes, fleetRes] =
          await Promise.all([
            fetch(`${API_BASE}/api/admin/dashboard/stats`).then((r) =>
              r.json()
            ),
            fetch(`${API_BASE}/api/admin/leave/stats`).then((r) => r.json()),
            fetch(`${API_BASE}/api/admin/leave/pending`).then((r) => r.json()),
            fetch(`${API_BASE}/api/admin/bus-fleet`).then((r) => r.json()),
          ]);

        setStats(statsRes || {});
        setLeaveStats(leaveStatsRes || {});
        setLeaveRequests(leaveReqRes || []);
        setBusFleet(fleetRes || []);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-[var(--color-primary)]">
        <div className="animate-spin inline-block w-10 h-10 border-4 border-current border-t-transparent rounded-full mb-4"></div>
        <p className="text-gray-500 font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  // Calculate percentages with fallbacks
  const vehicleUsagePercent =
    stats.total_vehicles > 0
      ? Math.round((stats.active_duties / stats.total_vehicles) * 100)
      : 0;

  const driverAvailPercent =
    stats.total_drivers > 0
      ? Math.round((stats.present_drivers / stats.total_drivers) * 100)
      : 0;

  // Mock percentage for routes if needed, or calculate from fleet
  const activeRoutesPercent =
    busFleet.length > 0
      ? Math.round(
          (busFleet.filter((b) => b.start_point).length / busFleet.length) * 100
        )
      : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-[var(--color-primary)]" />{" "}
            Operational Overview
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time transport fleet metrics and request management.
          </p>
        </div>
        <div className="flex gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100">
          <Calendar size={16} className="text-gray-400" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Vehicles"
          value={stats.total_vehicles}
          icon={Truck}
          color="bg-blue-500"
          bg="bg-blue-50"
          text="text-blue-600"
        />
        <StatCard
          label="Active Drivers"
          value={stats.present_drivers}
          icon={Users}
          color="bg-emerald-500"
          bg="bg-emerald-50"
          text="text-emerald-600"
        />
        <StatCard
          label="Pending Leaves"
          value={leaveStats.pending || 0}
          icon={Clock}
          color="bg-amber-500"
          bg="bg-amber-50"
          text="text-amber-600"
        />
        <StatCard
          label="Completed Trips"
          value={stats.active_duties || 0}
          icon={MapPin}
          color="bg-[var(--color-primary)]"
          bg="bg-indigo-50"
          text="text-[var(--color-primary)]"
        />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Requests - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-gray-400" /> Recent Leave
              Requests
            </h3>
            <button
              onClick={() => navigate("/admin/leave-approvals")}
              className="text-sm font-medium text-[var(--color-primary)] hover:text-indigo-700 transition-colors"
            >
              View All
            </button>
          </div>

          <div className="p-0 flex-1 overflow-auto max-h-[400px]">
            {leaveRequests && leaveRequests.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {leaveRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                      {req.driver_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="font-semibold text-gray-900 truncate pr-2">
                          {req.driver_name}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide
                           ${
                             req.status === "pending"
                               ? "bg-amber-100 text-amber-700"
                               : "bg-green-100 text-green-700"
                           }
                         `}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          {req.leave_type}
                        </span>
                        <span>•</span>
                        <span>{req.start_date}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <CheckCircle2 size={32} className="mb-2 opacity-50" />
                <p>No pending leave requests</p>
              </div>
            )}
          </div>
        </div>

        {/* Fleet Health - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Activity size={18} className="text-gray-400" /> Fleet Health
            </h3>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* Metric 1 */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">
                  Vehicle Utilization
                </span>
                <span className="font-bold text-blue-600">
                  {vehicleUsagePercent}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{width: `${vehicleUsagePercent}%`}}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {stats.active_duties} active / {stats.total_vehicles} total
              </p>
            </div>

            {/* Metric 2 */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">
                  Driver Availability
                </span>
                <span className="font-bold text-emerald-600">
                  {driverAvailPercent}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                  style={{width: `${driverAvailPercent}%`}}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {stats.present_drivers} present / {stats.total_drivers} total
              </p>
            </div>

            {/* Metric 3 */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Active Routes</span>
                <span className="font-bold text-indigo-600">
                  {activeRoutesPercent}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                  style={{width: `${activeRoutesPercent}%`}}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Scheduled bus routes active
              </p>
            </div>

            {/* Fuel Warning? (Mock) */}
            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex gap-3 items-start mt-4">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-red-700">
                  Maintenance Alert
                </h4>
                <p className="text-[10px] text-red-600 mt-0.5">
                  3 Buses are due for scheduled maintenance this week.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SecondaryStat
          label="Total Personnel"
          value={stats.total_drivers}
          icon={Users}
          trend="+2 this week"
          trendUp={true}
        />
        <SecondaryStat
          label="Absent Staff"
          value={stats.absent_drivers}
          icon={AlertCircle}
          trend="Needs attention"
          trendUp={false}
          trendColor="text-red-500"
          iconColor="text-red-500 bg-red-50"
        />
        <SecondaryStat
          label="Fuel Efficiency"
          value="4.2 km/L"
          icon={Fuel}
          trend="+0.1 this month"
          trendUp={true}
          iconColor="text-orange-500 bg-orange-50"
        />
      </div>
    </div>
  );
}

function StatCard({label, value, icon: Icon, color, bg, text}) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-transform hover:scale-[1.01]">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <h2 className="text-2xl font-bold text-gray-800 mt-1">{value}</h2>
      </div>
      <div className={`p-4 rounded-lg ${bg} ${text}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

function SecondaryStat({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  trendColor,
  iconColor,
}) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center px-6">
      <div
        className={`p-3 rounded-full mr-4 ${
          iconColor || "bg-gray-100 text-gray-600"
        }`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xl font-bold text-gray-800">{value}</span>
          {trend && (
            <span
              className={`text-xs font-medium flex items-center ${
                trendColor || (trendUp ? "text-green-600" : "text-red-600")
              }`}
            >
              {trendUp ? <TrendingUp size={10} className="mr-0.5" /> : null}
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
