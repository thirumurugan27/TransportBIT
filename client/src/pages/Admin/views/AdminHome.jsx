import React, {useState, useEffect, useMemo} from "react";
import {useNavigate} from "react-router-dom";
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
  Layers,
  RotateCcw,
  FileCheck,
  RefreshCw,
} from "lucide-react";

import {apiGet} from "../../../utils/api";

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
  users: Users,
  layers: Layers,
  "file-check": FileCheck,
  "file-text": FileText,
  "alert-circle": AlertCircle,
  "refresh-cw": RefreshCw,
  fuel: Fuel,
};

const ACTION_COLORS = {
  pending: {
    bg: "bg-pending/10",
    text: "text-pending",
    border: "border-pending/20",
  },
  customblue: {
    bg: "bg-customblue/10",
    text: "text-customblue",
    border: "border-customblue/20",
  },
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  red: {bg: "bg-red/10", text: "text-red", border: "border-red/20"},
  green: {bg: "bg-green/10", text: "text-green", border: "border-green/20"},
  primarydull: {
    bg: "bg-primarydull/10",
    text: "text-primarydull",
    border: "border-primarydull/20",
  },
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

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

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
function DonutRing({
  segments,
  size = 172,
  strokeWidth = 22,
  centerLabel = "TOTAL",
}) {
  const visibleSegments = segments.filter((seg) => seg.value > 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;

  const arcData = visibleSegments.map((seg) => {
    const segLen = total > 0 ? (seg.value / total) * circumference : 0;
    const startOffset = offset;

    offset += segLen;

    return {
      ...seg,
      segLen,
      dash: `${segLen} ${circumference - segLen}`,
      startOffset,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#EEF1F9"
        strokeWidth={strokeWidth}
      />
      {arcData.map((seg, i) => {
        const style = {
          strokeDasharray: seg.dash,
          strokeDashoffset: -seg.startOffset,
          transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease",
        };
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={style}
          />
        );
      })}
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        className="fill-primarytext text-[28px] font-extrabold"
        dominantBaseline="middle"
      >
        {total}
      </text>
      <text
        x="50%"
        y="61%"
        textAnchor="middle"
        className="fill-secondarytext text-[10px] font-semibold tracking-wider"
        dominantBaseline="middle"
      >
        {centerLabel}
      </text>
    </svg>
  );
}

// Stat card (enhanced)
function StatCard({title, value, icon: Icon, color, onClick}) {
  const colorMap = {
    "bg-primary": {bg: "bg-primary/8", text: "text-primary"},
    "bg-green": {bg: "bg-green/8", text: "text-green"},
    "bg-customblue": {bg: "bg-customblue/8", text: "text-customblue"},
    "bg-pending": {bg: "bg-pending/8", text: "text-pending"},
    "bg-primarydull": {bg: "bg-primarydull/8", text: "text-primarydull"},
    "bg-red": {bg: "bg-red/8", text: "text-red"},
  };
  const soft = colorMap[color] || {bg: "bg-primary/8", text: "text-primary"};

  return (
    <div
      onClick={onClick}
      className={`bg-secondarybg rounded-md p-4 border border-gray-100 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-9 h-9 ${soft.bg} rounded-md flex items-center justify-center`}
        >
          <Icon className={`w-4.5 h-4.5 ${soft.text}`} />
        </div>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5 text-gray-300" />}
      </div>
      <p className="mt-2.5 text-xl font-bold text-primarytext leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold text-secondarytext mt-1.5 uppercase tracking-wide">
        {title}
      </p>
    </div>
  );
}

// Mini bar chart for weekly attendance
function WeeklyChart({data}) {
  // Always generate 7 days (today + previous 6), merge with server data
  const chartData = useMemo(() => {
    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayLabel = dayNames[d.getDay()];
      const dateStr = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      });
      // Match server data by day name or date
      const match =
        (data || []).find((s) => s.day === dayLabel && (!s.date || true)) ||
        (data || []).find((s) => s.date === dateStr);
      days.push({
        day: dayLabel,
        date: dateStr,
        present: match?.present || 0,
        absent: match?.absent || 0,
        on_leave: match?.on_leave || 0,
        isToday: i === 0,
      });
    }
    // If server returned exact 7 days, prefer that ordering with isToday flag
    if (data?.length === 7) {
      return data.map((d, idx) => ({
        ...d,
        isToday: idx === 6,
      }));
    }
    return days;
  }, [data]);

  const maxVal = Math.max(
    ...chartData.map((d) => d.present + d.absent + (d.on_leave || 0)),
    1,
  );
  const BAR_H = 96;

  return (
    <div className="mt-3">
      <div
        className="flex items-end justify-between"
        style={{height: BAR_H + 36}}
      >
        {chartData.map((d, i) => {
          const total = d.present + d.absent + (d.on_leave || 0);
          const presentPx =
            total > 0
              ? Math.max((d.present / maxVal) * BAR_H, d.present > 0 ? 3 : 0)
              : 0;
          const absentPx =
            total > 0
              ? Math.max((d.absent / maxVal) * BAR_H, d.absent > 0 ? 3 : 0)
              : 0;
          const leavePx =
            total > 0
              ? Math.max(
                  ((d.on_leave || 0) / maxVal) * BAR_H,
                  (d.on_leave || 0) > 0 ? 3 : 0,
                )
              : 0;
          const isEmpty = total === 0;

          return (
            <div
              key={i}
              className="group flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full flex flex-col items-center justify-end relative cursor-pointer"
                style={{height: BAR_H}}
                tabIndex={0}
                aria-label={`${d.day}: ${d.present} present, ${d.absent} absent, ${d.on_leave || 0} leave`}
              >
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+10px)] bg-primarytext text-white text-[10px] leading-tight rounded-md px-2.5 py-2 shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:-translate-y-[calc(100%+14px)] group-focus-within:-translate-y-[calc(100%+14px)] transition-all duration-200 pointer-events-none z-20">
                  <p className="font-bold mb-1">{d.day}</p>
                  <p>Present: {d.present}</p>
                  <p>Absent: {d.absent}</p>
                  <p>Leave: {d.on_leave || 0}</p>
                  <span className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-primarytext" />
                </div>
                {isEmpty ? (
                  <div className="w-7 h-[3px] rounded-bl-xl bg-gray-200/60 transition-all duration-200 group-hover:bg-gray-300/80 group-focus-within:bg-gray-300/80" />
                ) : (
                  <div
                    className="w-7 flex flex-col justify-end overflow-hidden"
                    style={{height: BAR_H}}
                  >
                    {(d.on_leave || 0) > 0 && (
                      <div
                        className="w-full bg-pending transition-all duration-500 group-hover:brightness-95 group-focus-within:brightness-95"
                        style={{height: leavePx}}
                      />
                    )}
                    {d.absent > 0 && (
                      <div
                        className="w-full bg-red transition-all duration-500 group-hover:brightness-95 group-focus-within:brightness-95"
                        style={{height: absentPx}}
                      />
                    )}
                    {d.present > 0 && (
                      <div
                        className="w-full bg-primary transition-all duration-500 group-hover:brightness-95 group-focus-within:brightness-95"
                        style={{height: presentPx}}
                      />
                    )}
                  </div>
                )}
              </div>
              {/* Day label */}
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={`text-[10px] leading-none font-semibold ${d.isToday ? "text-primary" : "text-secondarytext"}`}
                >
                  {d.day}
                </span>
                {d.isToday && (
                  <span className="w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Driver Workload Section ── */
const INITIAL_SHOW = 5;

function DriverWorkloadSection({
  workloadData,
  heavyWorkloadDrivers,
  unassignedDrivers,
  navigate,
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const allDrivers = workloadData?.drivers || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return allDrivers;
    const q = search.toLowerCase();
    return allDrivers.filter(
      (d) =>
        d.driver_name.toLowerCase().includes(q) ||
        (d.vehicles || []).some((v) =>
          v.vehicle_number.toLowerCase().includes(q),
        ),
    );
  }, [allDrivers, search]);

  // Sort by workload score desc
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.workload_score - a.workload_score),
    [filtered],
  );

  const visible =
    showAll || search.trim() ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hasMore = !search.trim() && sorted.length > INITIAL_SHOW;

  return (
    <div className="lg:col-span-3 bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 pb-3 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            Driver Workload Distribution
          </h2>
          <button
            onClick={() => navigate("/admin-dashboard/drivers")}
            className="text-xs font-semibold text-primary flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <p className="text-xs text-secondarytext mt-1">
          Monitor assignment load and help balance driver duties
        </p>
      </div>

      <div className="p-5">
        {/* Summary Chips */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            {
              label: "Light",
              count: allDrivers.filter((d) => d.workload_score <= 40).length,
              bg: "bg-green/10",
              dot: "bg-green",
              text: "text-green",
            },
            {
              label: "Moderate",
              count: allDrivers.filter(
                (d) => d.workload_score > 40 && d.workload_score <= 70,
              ).length,
              bg: "bg-pending/10",
              dot: "bg-pending",
              text: "text-pending",
            },
            {
              label: "Heavy",
              count: heavyWorkloadDrivers.length,
              bg: "bg-red/10",
              dot: "bg-red",
              text: "text-red",
            },
            {
              label: "Unassigned",
              count: unassignedDrivers,
              bg: "bg-primarybg",
              dot: "bg-gray-400",
              text: "text-secondarytext",
            },
          ].map((c) => (
            <div
              key={c.label}
              className={`flex items-center gap-2 ${c.bg} rounded-md px-3 py-2`}
            >
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className={`text-xs font-semibold ${c.text}`}>
                {c.count} {c.label}
              </span>
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-primarybg border border-gray-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-primarytext placeholder:text-secondarytext/60"
          />
        </div>

        {/* Driver List */}
        {sorted.length > 0 ? (
          <div className="space-y-1">
            {visible.map((driver) => {
              const isExpanded = expandedId === driver.driver_id;
              const scoreClass =
                driver.workload_score > 70
                  ? {badge: "bg-red/10 text-red", bar: "bg-red", label: "Heavy"}
                  : driver.workload_score > 40
                    ? {
                        badge: "bg-pending/10 text-pending",
                        bar: "bg-pending",
                        label: "Moderate",
                      }
                    : {
                        badge: "bg-green/10 text-green",
                        bar: "bg-green",
                        label: "Light",
                      };

              return (
                <div key={driver.driver_id}>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : driver.driver_id)
                    }
                    className={`w-full flex items-center gap-4 p-3 rounded-md text-left ${isExpanded ? "bg-primarybg/40" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primarytext truncate">
                          {driver.driver_name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-secondarytext">
                            {driver.active_assignments} assign &middot;{" "}
                            {driver.vehicle_count} veh
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreClass.badge}`}
                          >
                            {scoreClass.label}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              driver.attendance_status === "present"
                                ? "bg-green"
                                : driver.attendance_status === "absent"
                                  ? "bg-red"
                                  : driver.attendance_status === "on_leave"
                                    ? "bg-pending"
                                    : "bg-gray-300"
                            }`}
                            title={driver.attendance_status}
                          />
                        </div>
                      </div>
                      <div className="h-1.5 bg-primarybg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreClass.bar}`}
                          style={{
                            width: `${Math.max(driver.workload_score, 3)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 ml-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-secondarytext" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-secondarytext" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Vehicle Details */}
                  {isExpanded && (
                    <div className="ml-16 mr-4 mb-2 mt-0.5 bg-primarybg rounded-md p-3 border border-gray-100 animate-in slide-in-from-top-1">
                      <div className="grid grid-cols-2 gap-3 text-xs text-secondarytext mb-3">
                        <div>
                          Duties this month:{" "}
                          <span className="font-semibold text-primarytext">
                            {driver.total_duties_month}
                          </span>
                        </div>
                        <div>
                          KM this month:{" "}
                          <span className="font-semibold text-primarytext">
                            {driver.total_km_month.toFixed(1)}
                          </span>
                        </div>
                        <div>
                          Pending KM logs:{" "}
                          <span className="font-semibold text-primarytext">
                            {driver.pending_km_logs}
                          </span>
                        </div>
                        <div>
                          Leaves taken:{" "}
                          <span className="font-semibold text-primarytext">
                            {driver.leaves_taken}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-primarytext mb-2 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-primary" /> Assigned
                        Vehicles
                      </p>
                      {driver.vehicles && driver.vehicles.length > 0 ? (
                        <div className="space-y-1.5">
                          {driver.vehicles.map((v, vi) => (
                            <div
                              key={vi}
                              className="flex items-center gap-3 bg-secondarybg rounded-md px-3 py-2 border border-gray-100"
                            >
                              <Bus className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm font-medium text-primarytext">
                                {v.vehicle_number}
                              </span>
                              {v.vehicle_type && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  {v.vehicle_type}
                                </span>
                              )}
                              {v.shift_name && (
                                <span className="text-[10px] bg-pending/10 text-pending px-2 py-0.5 rounded-full ml-auto">
                                  {v.shift_name}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-secondarytext italic">
                          No vehicles currently assigned
                        </p>
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
                className="w-full mt-2 py-2.5 text-xs font-semibold text-primary bg-primary/5 rounded-md flex items-center justify-center gap-1.5"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> See More (
                    {sorted.length - INITIAL_SHOW} more drivers)
                  </>
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
const getDismissedKey = () =>
  `dismissed_actions_${new Date().toISOString().slice(0, 10)}`;

export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [workloadData, setWorkloadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState(null);
  const [dismissedActions, setDismissedActions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(getDismissedKey()) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const DEFAULTS = {
      total_drivers: 0,
      present_drivers: 0,
      absent_drivers: 0,
      on_leave_drivers: 0,
      not_marked: 0,
      total_vehicles: 0,
      active_vehicles: 0,
      in_service_count: 0,
      active_duties: 0,
      total_assignments: 0,
      pending_leaves: 0,
      pending_vehicle_requests: 0,
      active_services: 0,
      document_alerts: 0,
      expired_documents: 0,
      total_students: 0,
      outstanding_fees: 0,
      total_fee_collected: 0,
      fuel_consumed_month: 0,
      total_km_month: 0,
      service_cost_month: 0,
      parts_cost_month: 0,
      avg_mileage_month: 0,
      vehicle_requests_total: 0,
      vehicle_requests_pending: 0,
      vehicle_requests_approved: 0,
      vehicle_requests_completed: 0,
      vehicles_by_type: [],
      vehicles_by_fuel: [],
      weekly_attendance: [],
      pending_actions: [],
      expiring_licenses: 0,
      expired_licenses: 0,
      expiring_driver_groups: 0,
      expired_driver_groups: 0,
      expiring_vehicle_groups: 0,
      expired_vehicle_groups: 0,
      expired_assignments: 0,
      expiring_assignments: 0,
      recent_vehicle_requests: [],
      recent_activity: [],
      pending_km_logs: 0,
      pending_stop_changes: 0,
      pending_transport_requests: 0,
      active_replacements: 0,
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
        setStats({...DEFAULTS, ...statsData});
        setWorkloadData(wlData);
      } catch (err) {
        console.error(err);
        try {
          const res = await apiGet("/api/admin/dashboard/stats");
          const data = await res.json();
          setStats({...DEFAULTS, ...data});
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

  const pendingVehicleRequests = useMemo(() => {
    if (!stats) return 0;
    return Number(
      stats.vehicle_requests_pending || stats.pending_vehicle_requests || 0,
    );
  }, [stats]);

  const visibleActions = useMemo(() => {
    if (!stats?.pending_actions) return [];
    return stats.pending_actions.filter(
      (a) => !dismissedActions.includes(a.label),
    );
  }, [stats, dismissedActions]);

  const markAsRead = (action) => {
    const updated = [...dismissedActions, action.label];
    setDismissedActions(updated);
    localStorage.setItem(getDismissedKey(), JSON.stringify(updated));
    setExpandedAction(null);
    // Add to recent activity
    setStats((prev) => ({
      ...prev,
      recent_activity: [
        {
          type: "action_read",
          color: action.color,
          message: `${action.label} (${action.count}) marked as read`,
          timestamp: new Date().toISOString(),
        },
        ...(prev.recent_activity || []),
      ],
    }));
  };

  const heavyWorkloadDrivers = useMemo(() => {
    if (!workloadData?.drivers) return [];
    return workloadData.drivers.filter((d) => d.workload_score > 70);
  }, [workloadData]);

  const unassignedDrivers = useMemo(() => {
    if (!workloadData?.drivers) return 0;
    return workloadData.drivers.filter((d) => d.active_assignments === 0)
      .length;
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
    {value: stats.present_drivers, color: "#008000", label: "Present"},
    {value: stats.absent_drivers, color: "#FF5555", label: "Absent"},
    {value: stats.on_leave_drivers, color: "#F0B041", label: "On Leave"},
    {value: stats.not_marked, color: "#D1D5DB", label: "Not Marked"},
  ];

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primarytext">Dashboard</h1>
          <p className="text-sm text-secondarytext mt-0.5">
            Transport management overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.absent_drivers > 0 && (
            <button
              onClick={() => navigate("/admin-dashboard/attendance-records")}
              className="flex items-center gap-1.5 bg-red/8 border border-red/20 text-red rounded-full px-3 py-1.5"
              title={`${stats.absent_drivers} drivers absent today`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">
                {stats.absent_drivers} absent
              </span>
            </button>
          )}
          {heavyWorkloadDrivers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red/10 border border-red/20 text-red rounded-full px-3 py-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">
                {heavyWorkloadDrivers.length} overloaded
              </span>
            </div>
          )}
          <button
            onClick={() => navigate("/admin-dashboard/vehicle-requests")}
            className="relative rounded-full transition-transform duration-200 hover:scale-[1.03]"
            title={`${pendingVehicleRequests} pending vehicle request${pendingVehicleRequests !== 1 ? "s" : ""}`}
            aria-label="View pending vehicle requests"
          >
            {pendingVehicleRequests > 0 && (
              <>
                <span className="absolute inset-0 rounded-full bg-customblue/20 animate-ping" />
                <span className="absolute inset-0 rounded-full bg-customblue/15 animate-ping [animation-delay:450ms]" />
              </>
            )}
            <div
              className={`relative w-10 h-10 rounded-full flex items-center justify-center border ${
                pendingVehicleRequests > 0
                  ? "bg-customblue/12 border-customblue/35 shadow-sm"
                  : "bg-gray-100 border-gray-200"
              }`}
            >
              <Truck
                className={`w-5 h-5 ${pendingVehicleRequests > 0 ? "text-customblue" : "text-gray-500"}`}
              />
            </div>
            {pendingVehicleRequests > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-customblue text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none border-2 border-primarybg shadow-sm">
                {pendingVehicleRequests}
              </span>
            )}
          </button>
          <button
            onClick={() =>
              document
                .getElementById("action-center")
                ?.scrollIntoView({behavior: "smooth"})
            }
            className="relative"
            title={`${totalPendingCount} pending action${totalPendingCount !== 1 ? "s" : ""}`}
          >
            {totalPendingCount > 0 ? (
              <>
                <div className="w-10 h-10 bg-pending/10 border border-pending/20 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-pending" />
                </div>
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-pending text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none border-2 border-primarybg">
                  {totalPendingCount}
                </span>
              </>
            ) : (
              <div className="w-10 h-10 bg-green/10 border border-green/20 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-green" />
              </div>
            )}
          </button>
        </div>
      </div>
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Drivers"
          value={stats.total_drivers}
          icon={Users}
          color="bg-primary"
          onClick={() => navigate("/admin-dashboard/drivers")}
        />
        <StatCard
          title="Fleet Size"
          value={stats.total_vehicles}
          icon={Bus}
          color="bg-green"
          onClick={() => navigate("/admin-dashboard/vehicles")}
        />
        <StatCard
          title="Assignments"
          value={stats.total_assignments}
          icon={ClipboardList}
          color="bg-customblue"
          onClick={() => navigate("/admin-dashboard/all-assignments")}
        />
        <StatCard
          title="Pending Leaves"
          value={stats.pending_leaves}
          icon={Calendar}
          color="bg-pending"
          onClick={() => navigate("/admin-dashboard/leave-approvals")}
        />
        <StatCard
          title="Students"
          value={stats.total_students}
          icon={GraduationCap}
          color="bg-primarydull"
          onClick={() => navigate("/admin-dashboard/student-transport")}
        />
        <StatCard
          title="Active Services"
          value={stats.active_services}
          icon={Wrench}
          color={stats.active_services > 0 ? "bg-red" : "bg-green"}
          onClick={() => navigate("/admin-dashboard/service-records")}
        />
      </div>

      {/* Row 2: Action Center + Driver Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Action Center */}
        <div
          id="action-center"
          className="lg:col-span-2 bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
                <span className="w-1.5 h-5 bg-pending rounded-full" />
                Action Center
              </h2>
              <div className="flex items-center gap-2">
                {dismissedActions.length > 0 && (
                  <button
                    onClick={() => {
                      setDismissedActions([]);
                      localStorage.removeItem(getDismissedKey());
                    }}
                    className="text-[10px] font-semibold text-secondarytext flex items-center gap-1"
                    title="Restore dismissed items"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
                <span
                  className={`text-xs font-bold text-white px-2.5 py-1 rounded-full ${visibleActions.length > 0 ? "bg-pending" : "bg-green"}`}
                >
                  {visibleActions.length}
                </span>
              </div>
            </div>
            <p className="text-xs text-secondarytext mt-1">
              Tasks requiring your attention
            </p>
          </div>

          {/* Content */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[520px]">
            {visibleActions.length > 0 ? (
              (() => {
                const isVehicleRequestAction = (action) => {
                  const label = (action?.label || "").toLowerCase();
                  const route = (action?.route || "").toLowerCase();
                  const icon = (action?.icon || "").toLowerCase();
                  return (
                    label.includes("vehicle request") ||
                    route.includes("vehicle-requests") ||
                    icon === "truck"
                  );
                };

                const priorityVehicleAction = visibleActions.find(
                  isVehicleRequestAction,
                );
                const remainingActions = visibleActions.filter(
                  (a) => !isVehicleRequestAction(a),
                );

                const urgent = remainingActions.filter(
                  (a) => a.color === "red",
                );
                const warning = remainingActions.filter(
                  (a) => a.color === "pending",
                );
                const normal = remainingActions.filter(
                  (a) => a.color !== "red" && a.color !== "pending",
                );

                const renderGroup = (title, icon, items, dotColor) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={title}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <span className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                          {title}
                        </span>
                        <span className="text-[10px] text-secondarytext">
                          ({items.length})
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {items.map((action, i) => {
                          const IconComp = ICON_MAP[action.icon] || CircleDot;
                          const colors =
                            ACTION_COLORS[action.color] ||
                            ACTION_COLORS.primary;
                          const isExpanded = expandedAction === action.label;
                          return (
                            <div key={i} className="group">
                              <div
                                onClick={() =>
                                  setExpandedAction(
                                    isExpanded ? null : action.label,
                                  )
                                }
                                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                                  isExpanded
                                    ? `${colors.border} ${colors.bg} shadow-sm`
                                    : `border-gray-100`
                                }`}
                              >
                                <div
                                  className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${colors.bg}`}
                                >
                                  <IconComp
                                    className={`w-4.5 h-4.5 ${colors.text}`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-primarytext leading-tight truncate">
                                    {action.label}
                                  </p>
                                  <p className="text-[11px] text-secondarytext mt-0.5">
                                    {action.count}{" "}
                                    {action.color === "red"
                                      ? "need attention"
                                      : "pending"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`text-base font-bold tabular-nums ${colors.text}`}
                                  >
                                    {action.count}
                                  </span>
                                  <ChevronRight
                                    className={`w-4 h-4 text-gray-300 ${isExpanded ? "rotate-90" : ""}`}
                                  />
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="flex gap-2 mt-1.5 ml-12 mb-1 animate-in slide-in-from-top-1">
                                  <button
                                    onClick={() => navigate(action.route)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-primary rounded-md shadow-sm"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Details
                                  </button>
                                  <button
                                    onClick={() => markAsRead(action)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-secondarytext bg-primarybg rounded-md"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />{" "}
                                    Dismiss
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <div>
                    {priorityVehicleAction && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-customblue animate-pulse" />
                          <span className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                            Priority Alert
                          </span>
                        </div>

                        <div className="group relative overflow-hidden rounded-md border border-customblue/35 bg-customblue/6 shadow-sm">
                          <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-white/35 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
                          <div
                            onClick={() =>
                              navigate(priorityVehicleAction.route)
                            }
                            className="relative flex items-center gap-3 p-3.5 cursor-pointer"
                          >
                            <div className="relative w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-customblue/14">
                              <Truck className="w-4.5 h-4.5 text-customblue" />
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red animate-ping" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-primarytext leading-tight truncate">
                                {priorityVehicleAction.label}
                              </p>
                              <p className="text-[11px] text-secondarytext mt-0.5">
                                {priorityVehicleAction.count} need attention
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-base font-bold tabular-nums text-customblue">
                                {priorityVehicleAction.count}
                              </span>
                              <ChevronRight className="w-4 h-4 text-customblue/60" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {renderGroup("Urgent", AlertTriangle, urgent, "bg-red")}
                    {renderGroup(
                      "Needs Attention",
                      Clock,
                      warning,
                      "bg-pending",
                    )}
                    {renderGroup("Pending", CircleDot, normal, "bg-primary")}
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-secondarytext">
                <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7 text-green" />
                </div>
                <p className="text-sm font-bold text-green">All caught up!</p>
                <p className="text-xs text-secondarytext mt-1">
                  No pending actions right now
                </p>
              </div>
            )}
          </div>

          {/* Assignment Expiry Summary Footer */}
          {(stats.expired_assignments > 0 ||
            stats.expiring_assignments > 0) && (
            <div className="border-t border-gray-100 p-4 bg-primarybg/30">
              <div className="flex items-center gap-2 mb-2.5">
                <Calendar className="w-3.5 h-3.5 text-secondarytext" />
                <span className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                  Assignment Status
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stats.expired_assignments > 0 && (
                  <div
                    onClick={() => navigate("/admin-dashboard/all-assignments")}
                    className="flex items-center gap-2 bg-red/5 border border-red/15 rounded-md px-3 py-2 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-red shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red">
                        {stats.expired_assignments}
                      </p>
                      <p className="text-[10px] text-red/70">Expired</p>
                    </div>
                  </div>
                )}
                {stats.expiring_assignments > 0 && (
                  <div
                    onClick={() => navigate("/admin-dashboard/all-assignments")}
                    className="flex items-center gap-2 bg-pending/5 border border-pending/15 rounded-md px-3 py-2 cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4 text-pending shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-pending">
                        {stats.expiring_assignments}
                      </p>
                      <p className="text-[10px] text-pending/70">
                        Expiring in 2d
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
        <div className="lg:col-span-2 bg-secondarybg rounded-md p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-primarytext mb-5 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full" />
            Today's Attendance
          </h2>
          <div className="flex items-center gap-7">
            <DonutRing segments={donutSegments} centerLabel="DRIVERS" />
            <div className="space-y-3.5 flex-1">
              {donutSegments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{backgroundColor: seg.color}}
                    />
                    <span className="text-sm text-secondarytext leading-none">
                      {seg.label}
                    </span>
                  </div>
                  <div className="text-right min-w-[74px]">
                    <span className="text-sm font-bold text-primarytext tabular-nums">
                      {seg.value}
                    </span>
                    <span className="text-xs text-secondarytext ml-1 tabular-nums">
                      ({pct(seg.value, stats.total_drivers)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="lg:col-span-3 bg-secondarybg rounded-md p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green rounded-full" />
              Weekly Attendance Trend
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-primary rounded-full" /> Present
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red/70 rounded-full" /> Absent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-pending/70 rounded-full" /> Leave
              </span>
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
              <span className="font-semibold text-secondarytext">
                Vehicle Utilization
              </span>
              <span className="font-bold text-green">
                {vehicleUtilization}%
              </span>
            </div>
            <div className="h-2 bg-primarybg rounded-full overflow-hidden">
              <div
                className="h-full bg-green rounded-full transition-all duration-700"
                style={{width: `${Math.min(vehicleUtilization, 100)}%`}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Monthly Operations + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Monthly Operations */}
        <div className="lg:col-span-2 bg-secondarybg rounded-md p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-primarydull rounded-full" />
              This Month's Operations
            </h2>
            <span className="text-xs font-semibold text-secondarytext bg-primarybg px-3 py-1 rounded-md">
              {new Date().toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primarybg/60 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">
                  KM Driven
                </p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {fmt(stats.total_km_month)}
                <span className="text-xs font-medium text-secondarytext ml-1">
                  km
                </span>
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-green" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">
                  Fuel
                </p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {fmt(stats.fuel_consumed_month)}
                <span className="text-xs font-medium text-secondarytext ml-1">
                  L
                </span>
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-pending" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">
                  Service
                </p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                <span className="text-sm">Rs.</span>
                {fmt(stats.service_cost_month)}
              </p>
            </div>
            <div className="bg-primarybg/60 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-skyblue" />
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wide">
                  Avg Mileage
                </p>
              </div>
              <p className="text-xl font-bold text-primarytext">
                {stats.avg_mileage_month > 0
                  ? stats.avg_mileage_month.toFixed(1)
                  : "\u2014"}
                <span className="text-xs font-medium text-secondarytext ml-1">
                  km/L
                </span>
              </p>
            </div>
          </div>
          {monthlyTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-secondarytext">
                  Total Maintenance
                </span>
                <span className="font-bold text-primarytext">
                  Rs.{fmt(monthlyTotal)}
                </span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-primarybg">
                <div
                  className="bg-pending rounded-l-full transition-all duration-500"
                  style={{
                    width: `${pct(stats.service_cost_month, monthlyTotal)}%`,
                  }}
                  title="Service cost"
                />
                <div
                  className="bg-customblue rounded-r-full transition-all duration-500"
                  style={{
                    width: `${pct(stats.parts_cost_month, monthlyTotal)}%`,
                  }}
                  title="Parts cost"
                />
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                  <span className="w-2 h-2 bg-pending rounded-full" /> Service
                  Rs.{fmt(stats.service_cost_month)}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                  <span className="w-2 h-2 bg-customblue rounded-full" /> Parts
                  Rs.{fmt(stats.parts_cost_month)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-3 bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 pb-3 border-b border-gray-50">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1.5 h-5 bg-primarydull rounded-full" />
              Recent Activity
            </h2>
            <p className="text-xs text-secondarytext mt-1">
              Latest system events
            </p>
          </div>
          <div className="p-4 max-h-[350px] overflow-y-auto">
            {stats.recent_activity?.length > 0 ? (
              <div className="space-y-1">
                {stats.recent_activity.map((item, i) => {
                  const ActIcon = ACTIVITY_ICONS[item.type] || Activity;
                  const colors =
                    ACTION_COLORS[item.color] || ACTION_COLORS.primary;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2.5 rounded-md"
                    >
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${colors.bg}`}
                      >
                        <ActIcon className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primarytext leading-snug">
                          {item.message}
                        </p>
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
      </div>

      {/* Row 6: Quick Navigation */}
      <div>
        <h2 className="text-sm font-bold text-secondarytext uppercase tracking-wide mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Quick Access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {[
            {
              label: "Attendance",
              icon: ClipboardList,
              route: "/admin-dashboard/attendance-records",
              color: "text-primary",
              bg: "bg-primary/5",
            },
            {
              label: "KM Logs",
              icon: Gauge,
              route: "/admin-dashboard/km-management",
              color: "text-green",
              bg: "bg-green/5",
            },
            {
              label: "Requests",
              icon: FileText,
              route: "/admin-dashboard/vehicle-requests",
              color: "text-skyblue",
              bg: "bg-skyblue/5",
            },
            {
              label: "Assignments",
              icon: ClipboardList,
              route: "/admin-dashboard/all-assignments",
              color: "text-primarydull",
              bg: "bg-primarydull/5",
            },
            {
              label: "Fuel",
              icon: Fuel,
              route: "/admin-dashboard/km-management",
              color: "text-pending",
              bg: "bg-pending/5",
            },
            {
              label: "Bus Fleet",
              icon: Bus,
              route: "/admin-dashboard/bus-fleet",
              color: "text-red",
              bg: "bg-red/5",
            },
            {
              label: "Services",
              icon: Wrench,
              route: "/admin-dashboard/service-records",
              color: "text-customblue",
              bg: "bg-customblue/5",
            },
            {
              label: "Reports",
              icon: BarChart3,
              route: "/admin-dashboard/reports",
              color: "text-primary",
              bg: "bg-primary/5",
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center gap-2 ${item.bg} rounded-md px-3 py-4 border border-gray-100`}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-xs font-semibold text-primarytext">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
