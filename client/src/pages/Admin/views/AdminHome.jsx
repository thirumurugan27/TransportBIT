import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../../../components/ui/Loading";
import {
  Users,
  Bus,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ChevronRight,
  Fuel,
  Shield,
  Truck,
  FileText,
  Wrench,
  GraduationCap,
  Gauge,
  IdCard,
  CircleDot,
  ArrowUpRight,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Bell,
  Zap,
  Eye,
  User,
  MapPin,
  Timer,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from "lucide-react";

import { apiGet } from "../../../utils/api";

// Color mapping
const TYPE_COLORS = [
  { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary" },
  { bg: "bg-green/10", text: "text-green", bar: "bg-green" },
  { bg: "bg-pending/10", text: "text-pending", bar: "bg-pending" },
  { bg: "bg-customblue/10", text: "text-customblue", bar: "bg-customblue" },
  { bg: "bg-red/10", text: "text-red", bar: "bg-red" },
  { bg: "bg-primarydull/10", text: "text-primarydull", bar: "bg-primarydull" },
];

const ICON_MAP = {
  calendar: Calendar,
  truck: Truck,
  wrench: Wrench,
  shield: Shield,
  "id-card": IdCard,
  gauge: Gauge,
  bus: Bus,
  graduation: GraduationCap,
  replace: Truck,
};

const ACTION_COLORS = {
  pending: { bg: "bg-pending/10", text: "text-pending", border: "border-pending/20" },
  customblue: { bg: "bg-customblue/10", text: "text-customblue", border: "border-customblue/20" },
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  red: { bg: "bg-red/10", text: "text-red", border: "border-red/20" },
  green: { bg: "bg-green/10", text: "text-green", border: "border-green/20" },
  primarydull: { bg: "bg-primarydull/10", text: "text-primarydull", border: "border-primarydull/20" },
};

const PRIORITY_CONFIG = {
  high: { bg: "bg-red/10", text: "text-red", label: "High", dot: "bg-red" },
  medium: { bg: "bg-pending/10", text: "text-pending", label: "Medium", dot: "bg-pending" },
  low: { bg: "bg-green/10", text: "text-green", label: "Low", dot: "bg-green" },
};

const TASK_TYPE_CONFIG = {
  vehicle_request: { icon: Truck, label: "Vehicle Request" },
  document_expiry: { icon: Shield, label: "Document Expiry" },
  license_expiry: { icon: IdCard, label: "License Expiry" },
};

const ACTIVITY_ICONS = {
  leave: Calendar,
  service: Wrench,
  vehicle_request: Truck,
  km_log: Gauge,
};

// Helpers
const fmt = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n?.toLocaleString?.("en-IN") ?? n;
};

const pct = (part, total) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const timeAgo = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

// Donut Ring (CSS only)
function DonutRing({ segments, size = 140, strokeWidth = 18, centerLabel = "TOTAL" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF1F9" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const segLen = total > 0 ? (seg.value / total) * circumference : 0;
        const dash = `${segLen} ${circumference - segLen}`;
        const style = {
          strokeDasharray: dash,
          strokeDashoffset: -offset,
          transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease",
        };
        offset += segLen;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={style}
          />
        );
      })}
      <text x="50%" y="44%" textAnchor="middle" className="fill-primarytext text-2xl font-bold" dominantBaseline="middle">
        {total}
      </text>
      <text x="50%" y="60%" textAnchor="middle" className="fill-secondarytext text-[9px] font-semibold tracking-wider" dominantBaseline="middle">
        {centerLabel}
      </text>
    </svg>
  );
}

// Stat card (enhanced)
function StatCard({ title, value, sub, icon: Icon, color, onClick, badge }) {
  return (
    <div
      onClick={onClick}
      className={`bg-secondarybg rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${onClick ? "cursor-pointer group" : ""} relative overflow-hidden`}
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${color}`} />
      <div className="flex items-start justify-between mt-1">
        <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center text-white shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-[10px] font-bold bg-red/10 text-red px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
          {onClick && (
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
          )}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold text-primarytext leading-none">{value}</p>
      <p className="text-xs font-semibold text-secondarytext mt-1.5 uppercase tracking-wide">{title}</p>
      {sub && <p className="text-[11px] text-secondarytext/70 mt-0.5">{sub}</p>}
    </div>
  );
}

// Mini bar chart for weekly attendance
function WeeklyChart({ data }) {
  const maxVal = Math.max(...data.map((d) => d.present + d.absent + (d.on_leave || 0)), 1);
  const BAR_H = 96; // px total height for bars

  return (
    <div className="flex items-end gap-2 mt-2" style={{ height: BAR_H + 28 }}>
      {data.map((d, i) => {
        const total = d.present + d.absent + (d.on_leave || 0);
        const presentPx = Math.max((d.present / maxVal) * BAR_H, total > 0 ? 4 : 0);
        const absentPx = Math.max((d.absent / maxVal) * BAR_H, d.absent > 0 ? 4 : 0);
        const leavePx = Math.max(((d.on_leave || 0) / maxVal) * BAR_H, (d.on_leave || 0) > 0 ? 4 : 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full flex flex-col items-center justify-end relative" style={{ height: BAR_H }}>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                P:{d.present} A:{d.absent} L:{d.on_leave || 0}
              </div>
              <div className="w-full flex flex-col gap-0.5 justify-end" style={{ height: BAR_H }}>
                {(d.on_leave || 0) > 0 && (
                  <div className="w-full bg-pending/70 rounded-t-sm transition-all duration-500" style={{ height: leavePx }} />
                )}
                {d.absent > 0 && (
                  <div className="w-full bg-red/70 transition-all duration-500" style={{ height: absentPx }} />
                )}
                <div className="w-full bg-primary rounded-t-md transition-all duration-500" style={{ height: presentPx }} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-secondarytext">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

// Breakdown bar
function BreakdownBar({ items, label }) {
  const total = items.reduce((s, x) => s + x.count, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-primarytext">{label}</p>
        <p className="text-xs font-semibold text-secondarytext">{total} total</p>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-primarybg">
        {items.map((item, i) => {
          const c = TYPE_COLORS[i % TYPE_COLORS.length];
          const w = pct(item.count, total);
          return (
            <div key={i} className={`${c.bar} transition-all duration-500`} style={{ width: `${w}%` }} title={`${item.label}: ${item.count}`} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {items.map((item, i) => {
          const c = TYPE_COLORS[i % TYPE_COLORS.length];
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${c.bar}`} />
              <span className="text-xs text-secondarytext">
                {item.label}{" "}
                <span className="font-bold text-primarytext">{item.count}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Driver Workload Section ── */
const INITIAL_SHOW = 5;

function DriverWorkloadSection({ workloadData, heavyWorkloadDrivers, unassignedDrivers, navigate }) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const allDrivers = workloadData?.drivers || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return allDrivers;
    const q = search.toLowerCase();
    return allDrivers.filter(d =>
      d.driver_name.toLowerCase().includes(q) ||
      (d.vehicles || []).some(v => v.vehicle_number.toLowerCase().includes(q))
    );
  }, [allDrivers, search]);

  // Sort by workload score desc
  const sorted = useMemo(() => [...filtered].sort((a, b) => b.workload_score - a.workload_score), [filtered]);

  const visible = showAll || search.trim() ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hasMore = !search.trim() && sorted.length > INITIAL_SHOW;

  return (
    <div className="lg:col-span-3 bg-secondarybg rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 pb-3 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            Driver Workload Distribution
          </h2>
          <button
            onClick={() => navigate("/admin-dashboard/drivers")}
            className="text-xs font-semibold text-primary hover:text-primarydull transition-colors flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <p className="text-xs text-secondarytext mt-1">Monitor assignment load and help balance driver duties</p>
      </div>

      <div className="p-5">
        {/* Summary Chips */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: "Light", count: allDrivers.filter(d => d.workload_score <= 40).length, bg: "bg-green/10", dot: "bg-green", text: "text-green" },
            { label: "Moderate", count: allDrivers.filter(d => d.workload_score > 40 && d.workload_score <= 70).length, bg: "bg-pending/10", dot: "bg-pending", text: "text-pending" },
            { label: "Heavy", count: heavyWorkloadDrivers.length, bg: "bg-red/10", dot: "bg-red", text: "text-red" },
            { label: "Unassigned", count: unassignedDrivers, bg: "bg-primarybg", dot: "bg-gray-400", text: "text-secondarytext" },
          ].map(c => (
            <div key={c.label} className={`flex items-center gap-2 ${c.bg} rounded-lg px-3 py-2`}>
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className={`text-xs font-semibold ${c.text}`}>{c.count} {c.label}</span>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
          <input
            type="text"
            placeholder="Search driver or vehicle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-primarybg border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-primarytext placeholder:text-secondarytext/60"
          />
        </div>

        {/* Driver List */}
        {sorted.length > 0 ? (
          <div className="space-y-1">
            {visible.map(driver => {
              const isExpanded = expandedId === driver.driver_id;
              const scoreClass =
                driver.workload_score > 70 ? { badge: "bg-red/10 text-red", bar: "bg-red", label: "Heavy" } :
                driver.workload_score > 40 ? { badge: "bg-pending/10 text-pending", bar: "bg-pending", label: "Moderate" } :
                { badge: "bg-green/10 text-green", bar: "bg-green", label: "Light" };

              return (
                <div key={driver.driver_id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : driver.driver_id)}
                    className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors hover:bg-primarybg/60 ${isExpanded ? "bg-primarybg/40" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primarytext truncate">{driver.driver_name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-secondarytext">
                            {driver.active_assignments} assign &middot; {driver.vehicle_count} veh
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreClass.badge}`}>
                            {scoreClass.label}
                          </span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            driver.attendance_status === "present" ? "bg-green" :
                            driver.attendance_status === "absent" ? "bg-red" :
                            driver.attendance_status === "on_leave" ? "bg-pending" :
                            "bg-gray-300"
                          }`} title={driver.attendance_status} />
                        </div>
                      </div>
                      <div className="h-1.5 bg-primarybg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreClass.bar}`}
                          style={{ width: `${Math.max(driver.workload_score, 3)}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 ml-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-secondarytext" /> : <ChevronDown className="w-4 h-4 text-secondarytext" />}
                    </div>
                  </button>

                  {/* Expanded Vehicle Details */}
                  {isExpanded && (
                    <div className="ml-16 mr-4 mb-2 mt-0.5 bg-primarybg rounded-lg p-3 border border-gray-100 animate-in slide-in-from-top-1">
                      <div className="grid grid-cols-2 gap-3 text-xs text-secondarytext mb-3">
                        <div>Duties this month: <span className="font-semibold text-primarytext">{driver.total_duties_month}</span></div>
                        <div>KM this month: <span className="font-semibold text-primarytext">{driver.total_km_month.toFixed(1)}</span></div>
                        <div>Pending KM logs: <span className="font-semibold text-primarytext">{driver.pending_km_logs}</span></div>
                        <div>Leaves taken: <span className="font-semibold text-primarytext">{driver.leaves_taken}</span></div>
                      </div>
                      <p className="text-xs font-semibold text-primarytext mb-2 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-primary" /> Assigned Vehicles
                      </p>
                      {driver.vehicles && driver.vehicles.length > 0 ? (
                        <div className="space-y-1.5">
                          {driver.vehicles.map((v, vi) => (
                            <div key={vi} className="flex items-center gap-3 bg-secondarybg rounded-md px-3 py-2 border border-gray-100">
                              <Bus className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm font-medium text-primarytext">{v.vehicle_number}</span>
                              {v.vehicle_type && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{v.vehicle_type}</span>}
                              {v.shift_name && <span className="text-[10px] bg-pending/10 text-pending px-2 py-0.5 rounded-full ml-auto">{v.shift_name}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-secondarytext italic">No vehicles currently assigned</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* See More / See Less */}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-2 py-2.5 text-xs font-semibold text-primary hover:text-primarydull bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {showAll ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> See More ({sorted.length - INITIAL_SHOW} more drivers)</>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-secondarytext">
            {search.trim() ? (
              <>
                <Search className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No drivers matching "{search}"</p>
              </>
            ) : (
              <>
                <Users className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No driver data available</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// MAIN COMPONENT
const getDismissedKey = () => `dismissed_actions_${new Date().toISOString().slice(0, 10)}`;

export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [workloadData, setWorkloadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState(null);
  const [dismissedActions, setDismissedActions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(getDismissedKey()) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const DEFAULTS = {
      total_drivers: 0, present_drivers: 0, absent_drivers: 0,
      on_leave_drivers: 0, not_marked: 0,
      total_vehicles: 0, active_vehicles: 0, in_service_count: 0,
      active_duties: 0, total_assignments: 0,
      pending_leaves: 0, pending_vehicle_requests: 0,
      active_services: 0, document_alerts: 0, expired_documents: 0,
      total_students: 0, outstanding_fees: 0, total_fee_collected: 0,
      fuel_consumed_month: 0, total_km_month: 0,
      service_cost_month: 0, parts_cost_month: 0, avg_mileage_month: 0,
      vehicle_requests_total: 0, vehicle_requests_pending: 0,
      vehicle_requests_approved: 0, vehicle_requests_completed: 0,
      vehicles_by_type: [], vehicles_by_fuel: [],
      weekly_attendance: [], pending_actions: [],
      expiring_licenses: 0, expired_licenses: 0,
      recent_vehicle_requests: [], recent_activity: [],
      pending_km_logs: 0, pending_stop_changes: 0,
      pending_transport_requests: 0, active_replacements: 0,
    };

    const fetchAll = async () => {
      try {
        const [statsRes, workloadRes] = await Promise.all([
          apiGet("/api/admin/dashboard/stats"),
          apiGet("/api/admin/dashboard/driver-workload"),
        ]);
        const [statsData, wlData] = await Promise.all([
          statsRes.json(),
          workloadRes.json(),
        ]);
        setStats({ ...DEFAULTS, ...statsData });
        setWorkloadData(wlData);
      } catch (err) {
        console.error(err);
        try {
          const res = await apiGet("/api/admin/dashboard/stats");
          const data = await res.json();
          setStats({ ...DEFAULTS, ...data });
        } catch (e) {
          console.error(e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const driverAvailability = useMemo(
    () => (stats ? pct(stats.present_drivers, stats.total_drivers) : 0),
    [stats],
  );
  const vehicleUtilization = useMemo(
    () => (stats ? pct(stats.total_assignments, stats.total_vehicles) : 0),
    [stats],
  );
  const monthlyTotal = useMemo(
    () => (stats ? stats.service_cost_month + stats.parts_cost_month : 0),
    [stats],
  );

  const totalPendingCount = useMemo(() => {
    if (!stats) return 0;
    return (stats.pending_actions || []).reduce((sum, a) => sum + a.count, 0);
  }, [stats]);

  const visibleActions = useMemo(() => {
    if (!stats?.pending_actions) return [];
    return stats.pending_actions.filter(a => !dismissedActions.includes(a.label));
  }, [stats, dismissedActions]);

  const markAsRead = (action) => {
    const updated = [...dismissedActions, action.label];
    setDismissedActions(updated);
    localStorage.setItem(getDismissedKey(), JSON.stringify(updated));
    setExpandedAction(null);
    // Add to recent activity
    setStats(prev => ({
      ...prev,
      recent_activity: [
        { type: "action_read", color: action.color, message: `${action.label} (${action.count}) marked as read`, timestamp: new Date().toISOString() },
        ...(prev.recent_activity || []),
      ],
    }));
  };

  const heavyWorkloadDrivers = useMemo(() => {
    if (!workloadData?.drivers) return [];
    return workloadData.drivers.filter(d => d.workload_score > 70);
  }, [workloadData]);

  const unassignedDrivers = useMemo(() => {
    if (!workloadData?.drivers) return 0;
    return workloadData.drivers.filter(d => d.active_assignments === 0).length;
  }, [workloadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading fullScreen={false} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-secondarytext">
        Failed to load dashboard data.
      </div>
    );
  }

  const donutSegments = [
    { value: stats.present_drivers, color: "#008000", label: "Present" },
    { value: stats.absent_drivers, color: "#FF5555", label: "Absent" },
    { value: stats.on_leave_drivers, color: "#F0B041", label: "On Leave" },
    { value: stats.not_marked, color: "#D1D5DB", label: "Not Marked" },
  ];

  const requestDonutSegments = [
    { value: stats.vehicle_requests_pending, color: "#F0B041", label: "Pending" },
    { value: stats.vehicle_requests_approved, color: "#7D53F6", label: "Approved" },
    { value: stats.vehicle_requests_completed, color: "#008000", label: "Completed" },
  ];

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">

      {/* Welcome Header + Quick Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext tracking-tight">
            {getGreeting()}, Admin
          </h1>
          <p className="text-sm text-secondarytext mt-1">
            Here's what's happening today &mdash; {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {totalPendingCount > 0 && (
            <div className="flex items-center gap-2 bg-pending/10 border border-pending/20 rounded-lg px-4 py-2.5">
              <Bell className="w-4 h-4 text-pending" />
              <span className="text-sm font-bold text-pending">{totalPendingCount} pending actions</span>
            </div>
          )}
          {heavyWorkloadDrivers.length > 0 && (
            <div className="flex items-center gap-2 bg-red/10 border border-red/20 rounded-lg px-4 py-2.5">
              <Zap className="w-4 h-4 text-red" />
              <span className="text-sm font-bold text-red">{heavyWorkloadDrivers.length} overloaded drivers</span>
            </div>
          )}
        </div>
      </div>

      {/* Critical Alerts */}
      {(stats.absent_drivers > 0 || stats.expired_documents > 0 || stats.expired_licenses > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.absent_drivers > 0 && (
            <div
              onClick={() => navigate("/admin-dashboard/attendance-records")}
              className="flex items-center gap-3 bg-gradient-to-r from-red/5 to-red/10 border border-red/15 rounded-xl px-4 py-3.5 cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-red/15 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red">{stats.absent_drivers} Absent Today</p>
                <p className="text-xs text-red/60 truncate">{stats.on_leave_drivers} on approved leave</p>
              </div>
              <ChevronRight className="w-4 h-4 text-red/30 group-hover:text-red transition-colors shrink-0" />
            </div>
          )}
          {stats.expired_documents > 0 && (
            <div
              onClick={() => navigate("/admin-dashboard/vehicles")}
              className="flex items-center gap-3 bg-gradient-to-r from-red/5 to-red/10 border border-red/15 rounded-xl px-4 py-3.5 cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-red/15 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red">{stats.expired_documents} Expired Documents</p>
                <p className="text-xs text-red/60 truncate">Insurance, FC, or Permit</p>
              </div>
              <ChevronRight className="w-4 h-4 text-red/30 group-hover:text-red transition-colors shrink-0" />
            </div>
          )}
          {stats.expired_licenses > 0 && (
            <div
              onClick={() => navigate("/admin-dashboard/drivers")}
              className="flex items-center gap-3 bg-gradient-to-r from-pending/5 to-pending/10 border border-pending/15 rounded-xl px-4 py-3.5 cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-pending/15 rounded-lg flex items-center justify-center shrink-0">
                <IdCard className="w-5 h-5 text-pending" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-pending">{stats.expired_licenses + stats.expiring_licenses} License Alerts</p>
                <p className="text-xs text-pending/60 truncate">{stats.expired_licenses} expired, {stats.expiring_licenses} expiring</p>
              </div>
              <ChevronRight className="w-4 h-4 text-pending/30 group-hover:text-pending transition-colors shrink-0" />
            </div>
          )}
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Drivers"
          value={stats.total_drivers}
          sub={`${stats.present_drivers} present today`}
          icon={Users}
          color="bg-primary"
          onClick={() => navigate("/admin-dashboard/drivers")}
        />
        <StatCard
          title="Fleet Size"
          value={stats.total_vehicles}
          sub={`${stats.active_vehicles} active`}
          icon={Bus}
          color="bg-green"
          onClick={() => navigate("/admin-dashboard/vehicles")}
          badge={stats.in_service_count > 0 ? `${stats.in_service_count} servicing` : null}
        />
        <StatCard
          title="Assignments"
          value={stats.total_assignments}
          sub="Active today"
          icon={ClipboardList}
          color="bg-customblue"
          onClick={() => navigate("/admin-dashboard/all-assignments")}
        />
        <StatCard
          title="Pending Leaves"
          value={stats.pending_leaves}
          sub="Awaiting approval"
          icon={Calendar}
          color="bg-pending"
          onClick={() => navigate("/admin-dashboard/leave-approvals")}
        />
        <StatCard
          title="Students"
          value={stats.total_students}
          sub={stats.outstanding_fees > 0 ? `Rs.${fmt(stats.outstanding_fees)} dues` : "Active transport"}
          icon={GraduationCap}
          color="bg-primarydull"
          onClick={() => navigate("/admin-dashboard/student-transport")}
        />
        <StatCard
          title="Active Services"
          value={stats.active_services}
          sub="Repairs in progress"
          icon={Wrench}
          color={stats.active_services > 0 ? "bg-red" : "bg-green"}
          onClick={() => navigate("/admin-dashboard/service-records")}
        />
      </div>

      {/* Row 2: Action Center + Driver Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Action Center */}
        <div className="lg:col-span-2 bg-secondarybg rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
                <span className="w-1.5 h-5 bg-pending rounded-full" />
                Action Center
              </h2>
              <span className="text-xs font-bold text-white bg-pending px-2.5 py-1 rounded-full">
                {visibleActions.length}
              </span>
            </div>
            <p className="text-xs text-secondarytext mt-1">Tasks requiring your attention</p>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            {visibleActions.length > 0 ? (
              <div className="space-y-2.5">
                {visibleActions.map((action, i) => {
                  const IconComp = ICON_MAP[action.icon] || CircleDot;
                  const colors = ACTION_COLORS[action.color] || ACTION_COLORS.primary;
                  const isExpanded = expandedAction === action.label;
                  return (
                    <div key={i}>
                      <div
                        onClick={() => setExpandedAction(isExpanded ? null : action.label)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border ${colors.border} ${colors.bg} hover:shadow-md cursor-pointer transition-all group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondarybg shadow-sm">
                            <IconComp className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primarytext">{action.label}</p>
                            <p className="text-xs text-secondarytext">{action.count} pending</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${colors.text}`}>{action.count}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="flex gap-2 mt-1.5 ml-2">
                          <button
                            onClick={() => navigate(action.route)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primarydull rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            onClick={() => markAsRead(action)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-secondarytext bg-primarybg hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" /> Mark as Read
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-secondarytext">
                <CheckCircle2 className="w-12 h-12 mb-3 text-green/30" />
                <p className="text-sm font-semibold text-green">All caught up!</p>
                <p className="text-xs mt-0.5">No pending actions right now</p>
              </div>
            )}
          </div>
        </div>

        {/* Driver Workload Distribution */}
        <DriverWorkloadSection
          workloadData={workloadData}
          heavyWorkloadDrivers={heavyWorkloadDrivers}
          unassignedDrivers={unassignedDrivers}
          navigate={navigate}
        />
      </div>

      {/* Row 3: Attendance Overview + Weekly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance Donut */}
        <div className="lg:col-span-2 bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-primarytext mb-5 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            Today's Attendance
          </h2>
          <div className="flex items-center gap-6">
            <DonutRing segments={donutSegments} centerLabel="DRIVERS" />
            <div className="space-y-3 flex-1">
              {donutSegments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-sm text-secondarytext">{seg.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-primarytext">{seg.value}</span>
                    <span className="text-xs text-secondarytext ml-1">({pct(seg.value, stats.total_drivers)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-secondarytext">Driver Availability</span>
              <span className={`font-bold ${driverAvailability >= 70 ? "text-green" : driverAvailability >= 40 ? "text-pending" : "text-red"}`}>
                {driverAvailability}%
              </span>
            </div>
            <div className="h-2 bg-primarybg rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${driverAvailability >= 70 ? "bg-green" : driverAvailability >= 40 ? "bg-pending" : "bg-red"}`}
                style={{ width: `${driverAvailability}%` }}
              />
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="lg:col-span-3 bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green rounded-full" />
              Weekly Attendance Trend
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary rounded-full" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red/70 rounded-full" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pending/70 rounded-full" /> Leave</span>
            </div>
          </div>
          {stats.weekly_attendance?.length > 0 ? (
            <WeeklyChart data={stats.weekly_attendance} />
          ) : (
            <div className="flex items-center justify-center h-32 text-secondarytext text-sm">
              No attendance data for this week
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-secondarytext">Vehicle Utilization</span>
              <span className="font-bold text-green">{vehicleUtilization}%</span>
            </div>
            <div className="h-2 bg-primarybg rounded-full overflow-hidden">
              <div className="h-full bg-green rounded-full transition-all duration-700" style={{ width: `${Math.min(vehicleUtilization, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming Tasks + Recent Activity + Vehicle Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming Important Tasks */}
        <div className="bg-secondarybg rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 pb-3 border-b border-gray-50">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-customblue rounded-full" />
              Upcoming Tasks
            </h2>
            <p className="text-xs text-secondarytext mt-1">Deadlines &amp; upcoming events</p>
          </div>
          <div className="p-4 max-h-[350px] overflow-y-auto">
            {workloadData?.upcoming_tasks?.length > 0 ? (
              <div className="space-y-2.5">
                {workloadData.upcoming_tasks.map((task, i) => {
                  const taskConf = TASK_TYPE_CONFIG[task.type] || { icon: Clock, label: task.type };
                  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                  const TaskIcon = taskConf.icon;
                  return (
                    <div
                      key={i}
                      onClick={() => navigate(task.route)}
                      className="p-3 rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-sm cursor-pointer transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ACTION_COLORS[task.color]?.bg || "bg-primarybg"}`}>
                          <TaskIcon className={`w-4 h-4 ${ACTION_COLORS[task.color]?.text || "text-secondarytext"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primarytext truncate">{task.title}</p>
                          <p className="text-xs text-secondarytext mt-0.5">{task.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                              <Clock className="w-3 h-3" />
                              {task.due_date}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                              {priority.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-secondarytext">
                <CheckCircle2 className="w-10 h-10 mb-2 text-green/30" />
                <p className="text-sm font-medium">No upcoming tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-secondarybg rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 pb-3 border-b border-gray-50">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-primarydull rounded-full" />
              Recent Activity
            </h2>
            <p className="text-xs text-secondarytext mt-1">Latest system events</p>
          </div>
          <div className="p-4 max-h-[350px] overflow-y-auto">
            {stats.recent_activity?.length > 0 ? (
              <div className="space-y-1">
                {stats.recent_activity.map((item, i) => {
                  const ActIcon = ACTIVITY_ICONS[item.type] || Activity;
                  const colors = ACTION_COLORS[item.color] || ACTION_COLORS.primary;
                  return (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-primarybg/50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colors.bg}`}>
                        <ActIcon className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primarytext leading-snug">{item.message}</p>
                        <p className="text-[10px] text-secondarytext mt-1">
                          {timeAgo(item.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-secondarytext">
                <Activity className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Requests Summary */}
        <div className="bg-secondarybg rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
                <span className="w-1.5 h-5 bg-skyblue rounded-full" />
                Vehicle Requests
              </h2>
              <button
                onClick={() => navigate("/admin-dashboard/vehicle-requests")}
                className="text-xs font-semibold text-primary hover:text-primarydull transition-colors flex items-center gap-1"
              >
                View <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-5 mb-4">
              <DonutRing segments={requestDonutSegments} size={100} strokeWidth={14} centerLabel="THIS MONTH" />
              <div className="space-y-2 flex-1">
                {requestDonutSegments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs text-secondarytext">{seg.label}</span>
                    </div>
                    <span className="text-sm font-bold text-primarytext">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {stats.recent_vehicle_requests?.length > 0 && (
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-2.5">Recent Requests</p>
                <div className="space-y-2">
                  {stats.recent_vehicle_requests.slice(0, 3).map((req, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-primarybg/40">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primarytext truncate">{req.faculty_name}</p>
                        <p className="text-[10px] text-secondarytext truncate">{req.purpose || "General purpose"}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === "pending" ? "bg-pending/10 text-pending" :
                        req.status === "approved" || req.status === "assigned" ? "bg-primary/10 text-primary" :
                        req.status === "completed" ? "bg-green/10 text-green" :
                        "bg-red/10 text-red"
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Fleet Composition + Monthly Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Breakdown */}
        <div className="bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
            <span className="w-1.5 h-5 bg-customblue rounded-full" />
            Fleet Composition
          </h2>
          {stats.vehicles_by_type?.length > 0 && (
            <BreakdownBar items={stats.vehicles_by_type} label="By Vehicle Type" />
          )}
          {stats.vehicles_by_fuel?.length > 0 && (
            <BreakdownBar items={stats.vehicles_by_fuel} label="By Fuel Type" />
          )}
          {(!stats.vehicles_by_type?.length && !stats.vehicles_by_fuel?.length) && (
            <p className="text-sm text-secondarytext py-4 text-center">No vehicle data available</p>
          )}
        </div>

        {/* Monthly Operations */}
        <div className="bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-primarydull rounded-full" />
              This Month's Operations
            </h2>
            <span className="text-xs font-semibold text-secondarytext bg-primarybg px-3 py-1 rounded-md">
              {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primarybg/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">KM Driven</p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {fmt(stats.total_km_month)}
                <span className="text-xs font-medium text-secondarytext ml-1">km</span>
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-green" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">Fuel</p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {fmt(stats.fuel_consumed_month)}
                <span className="text-xs font-medium text-secondarytext ml-1">L</span>
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-pending" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">Service</p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                <span className="text-sm">Rs.</span>{fmt(stats.service_cost_month)}
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-skyblue" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">Avg Mileage</p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {stats.avg_mileage_month > 0 ? stats.avg_mileage_month.toFixed(1) : "\u2014"}
                <span className="text-xs font-medium text-secondarytext ml-1">km/L</span>
              </p>
            </div>
          </div>
          {monthlyTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-secondarytext">Total Maintenance</span>
                <span className="font-bold text-primarytext">Rs.{fmt(monthlyTotal)}</span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-primarybg">
                <div
                  className="bg-pending rounded-l-full transition-all duration-500"
                  style={{ width: `${pct(stats.service_cost_month, monthlyTotal)}%` }}
                  title="Service cost"
                />
                <div
                  className="bg-customblue rounded-r-full transition-all duration-500"
                  style={{ width: `${pct(stats.parts_cost_month, monthlyTotal)}%` }}
                  title="Parts cost"
                />
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                  <span className="w-2 h-2 bg-pending rounded-full" /> Service Rs.{fmt(stats.service_cost_month)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                  <span className="w-2 h-2 bg-customblue rounded-full" /> Parts Rs.{fmt(stats.parts_cost_month)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 6: Quick Navigation */}
      <div>
        <h2 className="text-sm font-bold text-secondarytext uppercase tracking-wide mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Quick Access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {[
            { label: "Attendance", icon: ClipboardList, route: "/admin-dashboard/attendance-records", color: "text-primary", bg: "bg-primary/5" },
            { label: "KM Logs", icon: Gauge, route: "/admin-dashboard/km-management", color: "text-green", bg: "bg-green/5" },
            { label: "Requests", icon: FileText, route: "/admin-dashboard/vehicle-requests", color: "text-skyblue", bg: "bg-skyblue/5" },
            { label: "Assignments", icon: ClipboardList, route: "/admin-dashboard/all-assignments", color: "text-primarydull", bg: "bg-primarydull/5" },
            { label: "Fuel", icon: Fuel, route: "/admin-dashboard/km-management", color: "text-pending", bg: "bg-pending/5" },
            { label: "Bus Fleet", icon: Bus, route: "/admin-dashboard/bus-fleet", color: "text-red", bg: "bg-red/5" },
            { label: "Services", icon: Wrench, route: "/admin-dashboard/service-records", color: "text-customblue", bg: "bg-customblue/5" },
            { label: "Reports", icon: BarChart3, route: "/admin-dashboard/reports", color: "text-primary", bg: "bg-primary/5" },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center gap-2 ${item.bg} rounded-xl px-3 py-4 border border-gray-100 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all group`}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-xs font-semibold text-primarytext group-hover:text-primary transition-colors">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
