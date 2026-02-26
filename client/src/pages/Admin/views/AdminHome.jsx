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
} from "lucide-react";

import {apiGet} from "../../../utils/api";

// ─── Color mapping for fuel / vehicle type badges ───
const TYPE_COLORS = [
  {bg: "bg-primary/10", text: "text-primary", bar: "bg-primary"},
  {bg: "bg-green/10", text: "text-green", bar: "bg-green"},
  {bg: "bg-pending/10", text: "text-pending", bar: "bg-pending"},
  {bg: "bg-customblue/10", text: "text-customblue", bar: "bg-customblue"},
  {bg: "bg-red/10", text: "text-red", bar: "bg-red"},
  {bg: "bg-primarydull/10", text: "text-primarydull", bar: "bg-primarydull"},
];

const ICON_MAP = {
  calendar: Calendar,
  truck: Truck,
  wrench: Wrench,
  shield: Shield,
  "id-card": IdCard,
};

const ACTION_COLORS = {
  pending: {bg: "bg-pending/10", text: "text-pending"},
  customblue: {bg: "bg-customblue/10", text: "text-customblue"},
  primary: {bg: "bg-primary/10", text: "text-primary"},
  red: {bg: "bg-red/10", text: "text-red"},
  green: {bg: "bg-green/10", text: "text-green"},
  primarydull: {bg: "bg-primarydull/10", text: "text-primarydull"},
};

// ─── Helpers ───
const fmt = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n?.toLocaleString?.("en-IN") ?? n;
};

const pct = (part, total) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

// ─── Donut Ring (CSS only) ───
function DonutRing({segments, size = 160, strokeWidth = 22}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#EEF1F9"
        strokeWidth={strokeWidth}
      />
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
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={style}
          />
        );
      })}
      {/* Center text */}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        className="fill-primarytext text-2xl font-bold"
        dominantBaseline="middle"
      >
        {total}
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        className="fill-secondarytext text-[10px] font-medium"
        dominantBaseline="middle"
      >
        DRIVERS
      </text>
    </svg>
  );
}

// ─── Stat card ───
function StatCard({title, value, sub, icon: Icon, color, onClick}) {
  return (
    <div
      onClick={onClick}
      className={`bg-secondarybg rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${onClick ? "cursor-pointer group" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 ${color} rounded-lg flex items-center justify-center text-white shadow-sm`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {onClick && (
          <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-primarytext leading-none">
        {value}
      </p>
      <p className="text-xs font-semibold text-secondarytext mt-1.5 uppercase tracking-wide">
        {title}
      </p>
      {sub && (
        <p className="text-[11px] text-secondarytext/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

// ─── Mini bar chart for weekly attendance ───
function WeeklyChart({data, maxDrivers}) {
  const maxVal = Math.max(...data.map((d) => d.present + d.absent), 1);

  return (
    <div className="flex items-end gap-2 h-36 mt-2">
      {data.map((d, i) => {
        const presentH = (d.present / maxVal) * 100;
        const absentH = (d.absent / maxVal) * 100;
        const leaveH = (d.on_leave / maxVal) * 100;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <div className="w-full flex flex-col items-center justify-end h-28 relative">
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                P:{d.present} A:{d.absent} L:{d.on_leave}
              </div>
              <div className="w-full flex flex-col gap-0.5">
                {d.on_leave > 0 && (
                  <div
                    className="w-full bg-pending/70 rounded-t-sm transition-all duration-500"
                    style={{height: `${Math.max(leaveH, 4)}%`}}
                  />
                )}
                {d.absent > 0 && (
                  <div
                    className="w-full bg-red/70 transition-all duration-500"
                    style={{height: `${Math.max(absentH, 4)}%`}}
                  />
                )}
                <div
                  className="w-full bg-primary rounded-t-md transition-all duration-500"
                  style={{height: `${Math.max(presentH, 4)}%`}}
                />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-secondarytext">
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Breakdown bar ───
function BreakdownBar({items, label}) {
  const total = items.reduce((s, x) => s + x.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-primarytext">{label}</p>
        <p className="text-xs font-semibold text-secondarytext">{total} total</p>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-primarybg">
        {items.map((item, i) => {
          const c = TYPE_COLORS[i % TYPE_COLORS.length];
          const w = pct(item.count, total);
          return (
            <div
              key={i}
              className={`${c.bar} transition-all duration-500`}
              style={{width: `${w}%`}}
              title={`${item.label}: ${item.count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
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

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const DEFAULTS = {
      total_drivers: 0, present_drivers: 0, absent_drivers: 0,
      on_leave_drivers: 0, not_marked: 0,
      total_vehicles: 0, active_vehicles: 0, in_service_count: 0,
      active_duties: 0, total_assignments: 0,
      pending_leaves: 0, pending_vehicle_requests: 0,
      active_services: 0, document_alerts: 0, expired_documents: 0,
      total_students: 0,
      fuel_consumed_month: 0, total_km_month: 0,
      service_cost_month: 0, parts_cost_month: 0,
      vehicles_by_type: [], vehicles_by_fuel: [],
      weekly_attendance: [], pending_actions: [],
      expiring_licenses: 0, expired_licenses: 0,
    };
    (async () => {
      try {
        const res = await apiGet("/api/admin/dashboard/stats");
        const data = await res.json();
        setStats({ ...DEFAULTS, ...data });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived calculations
  const driverAvailability = useMemo(
    () => (stats ? pct(stats.present_drivers, stats.total_drivers) : 0),
    [stats],
  );
  const vehicleUtilization = useMemo(
    () => (stats ? pct(stats.total_assignments, stats.total_vehicles) : 0),
    [stats],
  );
  const monthlyTotal = useMemo(
    () =>
      stats
        ? stats.service_cost_month + stats.parts_cost_month
        : 0,
    [stats],
  );

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
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-2xl font-bold text-primarytext tracking-tight">
          Dashboard Overview
        </h1>
        <p className="text-sm text-secondarytext mt-1">
          Real-time insights to help you make informed decisions
        </p>
      </div>

      {/* ─── Urgent Alert Banner ─── */}
      {(stats.absent_drivers > 0 || stats.expired_documents > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.absent_drivers > 0 && (
            <div
              onClick={() =>
                navigate("/admin-dashboard/drivers?status=absent")
              }
              className="flex items-center gap-3 bg-red/5 border border-red/15 rounded-lg px-4 py-3 cursor-pointer hover:bg-red/10 transition-colors flex-1 min-w-[250px]"
            >
              <AlertTriangle className="w-5 h-5 text-red shrink-0" />
              <div>
                <p className="text-sm font-bold text-red">
                  {stats.absent_drivers} driver(s) absent today
                </p>
                <p className="text-xs text-red/70">
                  Including {stats.on_leave_drivers} on approved leave
                </p>
              </div>
            </div>
          )}
          {stats.expired_documents > 0 && (
            <div
              onClick={() =>
                navigate("/admin-dashboard/vehicle-replacements")
              }
              className="flex items-center gap-3 bg-red/5 border border-red/15 rounded-lg px-4 py-3 cursor-pointer hover:bg-red/10 transition-colors flex-1 min-w-[250px]"
            >
              <Shield className="w-5 h-5 text-red shrink-0" />
              <div>
                <p className="text-sm font-bold text-red">
                  {stats.expired_documents} vehicle(s) with expired documents
                </p>
                <p className="text-xs text-red/70">
                  Insurance, FC, or Permit expired
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Key Metrics Row ─── */}
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
          sub="Active transport"
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

      {/* ─── Row 2: Attendance + Weekly Trend ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance Donut */}
        <div className="lg:col-span-2 bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-primarytext mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            Today's Attendance
          </h2>
          <div className="flex items-center gap-6">
            <DonutRing segments={donutSegments} />
            <div className="space-y-3 flex-1">
              {donutSegments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{backgroundColor: seg.color}}
                    />
                    <span className="text-sm text-secondarytext">
                      {seg.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-primarytext">
                      {seg.value}
                    </span>
                    <span className="text-xs text-secondarytext ml-1">
                      ({pct(seg.value, stats.total_drivers)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Availability bar */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-secondarytext">
                Driver Availability
              </span>
              <span className="font-bold text-primary">
                {driverAvailability}%
              </span>
            </div>
            <div className="h-2 bg-primarybg rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{width: `${driverAvailability}%`}}
              />
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="lg:col-span-3 bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1 h-5 bg-green rounded-full" />
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
            <WeeklyChart
              data={stats.weekly_attendance}
              maxDrivers={stats.total_drivers}
            />
          ) : (
            <div className="flex items-center justify-center h-36 text-secondarytext text-sm">
              No attendance data for this week
            </div>
          )}
          {/* Utilization bar */}
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

      {/* ─── Row 3: Fleet Breakdown + Pending Actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Breakdown */}
        <div className="bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
            <span className="w-1 h-5 bg-customblue rounded-full" />
            Fleet Composition
          </h2>
          {stats.vehicles_by_type?.length > 0 && (
            <BreakdownBar
              items={stats.vehicles_by_type}
              label="By Vehicle Type"
            />
          )}
          {stats.vehicles_by_fuel?.length > 0 && (
            <BreakdownBar
              items={stats.vehicles_by_fuel}
              label="By Fuel Type"
            />
          )}
          {(!stats.vehicles_by_type?.length &&
            !stats.vehicles_by_fuel?.length) && (
            <p className="text-sm text-secondarytext py-4 text-center">
              No vehicle data available
            </p>
          )}
        </div>

        {/* Pending Actions */}
        <div className="bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
              <span className="w-1 h-5 bg-pending rounded-full" />
              Action Required
            </h2>
            <span className="text-xs font-bold text-secondarytext bg-primarybg px-2 py-1 rounded-md">
              {stats.pending_actions?.length || 0} items
            </span>
          </div>
          {stats.pending_actions?.length > 0 ? (
            <div className="space-y-3">
              {stats.pending_actions.map((action, i) => {
                const IconComp = ICON_MAP[action.icon] || CircleDot;
                const colors = ACTION_COLORS[action.color] || ACTION_COLORS.primary;
                return (
                  <div
                    key={i}
                    onClick={() => navigate(action.route)}
                    className="flex items-center justify-between p-4 rounded-lg bg-primarybg/50 hover:bg-primarybg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}
                      >
                        <IconComp
                          className={`w-5 h-5 ${colors.text}`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primarytext">
                          {action.label}
                        </p>
                        <p className="text-xs text-secondarytext">
                          {action.count} pending
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-lg font-bold ${colors.text}`}
                      >
                        {action.count}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-secondarytext">
              <Activity className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs">No pending actions right now</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Row 4: Monthly Operations Overview ─── */}
      <div className="bg-secondarybg rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-primarytext flex items-center gap-2">
            <span className="w-1 h-5 bg-primarydull rounded-full" />
            This Month's Operations
          </h2>
          <span className="text-xs font-semibold text-secondarytext bg-primarybg px-3 py-1 rounded-md">
            {new Date().toLocaleString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total KM */}
          <div className="bg-primarybg/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Total KM Driven
              </p>
            </div>
            <p className="text-xl font-bold text-primarytext">
              {fmt(stats.total_km_month)}
              <span className="text-xs font-medium text-secondarytext ml-1">
                km
              </span>
            </p>
          </div>

          {/* Fuel */}
          <div className="bg-primarybg/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="w-4 h-4 text-green" />
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Fuel Consumed
              </p>
            </div>
            <p className="text-xl font-bold text-primarytext">
              {fmt(stats.fuel_consumed_month)}
              <span className="text-xs font-medium text-secondarytext ml-1">
                L
              </span>
            </p>
          </div>

          {/* Service Cost */}
          <div className="bg-primarybg/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-pending" />
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Service Cost
              </p>
            </div>
            <p className="text-xl font-bold text-primarytext">
              <span className="text-sm">₹</span>
              {fmt(stats.service_cost_month)}
            </p>
          </div>

          {/* Parts Cost */}
          <div className="bg-primarybg/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-skyblue" />
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Parts Purchased
              </p>
            </div>
            <p className="text-xl font-bold text-primarytext">
              <span className="text-sm">₹</span>
              {fmt(stats.parts_cost_month)}
            </p>
          </div>
        </div>

        {/* Monthly total bar */}
        {monthlyTotal > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-secondarytext">
                Total Maintenance Cost
              </span>
              <span className="font-bold text-primarytext">
                ₹{fmt(monthlyTotal)}
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
              </span>
              <span className="flex items-center gap-1 text-[10px] text-secondarytext">
                <span className="w-2 h-2 bg-customblue rounded-full" /> Parts
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Row 5: Quick Navigation ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Attendance",
            icon: ClipboardList,
            route: "/admin-dashboard/attendance",
            color: "text-primary",
          },
          {
            label: "KM Logs",
            icon: Gauge,
            route: "/admin-dashboard/km-management",
            color: "text-green",
          },
          {
            label: "Vehicle Requests",
            icon: FileText,
            route: "/admin-dashboard/vehicle-requests",
            color: "text-skyblue",
          },
          {
            label: "Assignments",
            icon: ClipboardList,
            route: "/admin-dashboard/all-assignments",
            color: "text-primarydull",
          },
          {
            label: "Fuel & Mileage",
            icon: Fuel,
            route: "/admin-dashboard/km-management",
            color: "text-pending",
          },
          {
            label: "Bus Fleet",
            icon: Bus,
            route: "/admin-dashboard/bus-fleet",
            color: "text-red",
          },
        ].map((item, i) => (
          <button
            key={i}
            onClick={() => navigate(item.route)}
            className="flex items-center gap-2.5 bg-secondarybg rounded-lg px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
            <span className="text-sm font-semibold text-primarytext group-hover:text-primary transition-colors truncate">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
