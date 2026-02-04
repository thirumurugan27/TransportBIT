import React, {useState, useEffect, useCallback} from "react";
import {apiGet} from "../../../utils/api";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Route,
  Calendar,
  User,
  Car,
  Clock,
  TrendingUp,
  Filter,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

const defaultFilters = {
  period: "today",
  driverId: "",
  vehicleId: "",
  startDate: "",
  endDate: "",
};

const summaryCards = [
  {
    title: "Total Distance",
    key: "total_km",
    icon: Route,
    accent: "text-primary",
    bg: "bg-primary/10",
    suffix: "km",
  },
  {
    title: "Total Trips",
    key: "total_trips",
    icon: TrendingUp,
    accent: "text-green-600",
    bg: "bg-green-100",
  },
  {
    title: "Avg / Trip",
    key: "avg_km_per_trip",
    icon: Clock,
    accent: "text-amber-600",
    bg: "bg-amber-100",
    suffix: "km",
  },
  {
    title: "Listed Table KM",
    key: "listed_km",
    icon: ClipboardList,
    accent: "text-indigo-600",
    bg: "bg-indigo-100",
    suffix: "km",
  },
];

// Display date from backend (already in dd-mm-yyyy format)
const formatDate = (dateStr) => dateStr || "N/A";

const formatKm = (value) =>
  value || value === 0 ? Number(value).toFixed(1) : "--";

const getVehicleTypeColor = (type) => {
  switch (type?.toUpperCase()) {
    case "BUS":
      return "bg-blue-100 text-blue-700";
    case "CAR":
      return "bg-green-100 text-green-700";
    case "EV":
      return "bg-purple-100 text-purple-700";
    case "VAN":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const getShiftBadge = (shift) => {
  switch (shift?.toUpperCase()) {
    case "MORNING":
      return "bg-amber-100 text-amber-700";
    case "AFTERNOON":
      return "bg-orange-100 text-orange-700";
    case "EVENING":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function KmSummary() {
  const [filters, setFilters] = useState(defaultFilters);
  const [options, setOptions] = useState({drivers: [], vehicles: []});
  const [data, setData] = useState({logs: [], summary: {}, filters: {}});
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadFilterOptions = useCallback(async () => {
    try {
      setMetaLoading(true);
      const res = await apiGet("/api/incharge/km-filters");
      if (!res.ok) throw new Error("Failed to load filters");
      const payload = await res.json();
      console.log("Incharge KM Filters loaded:", payload);
      setOptions({
        drivers: Array.isArray(payload.drivers) ? payload.drivers : [],
        vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : [],
      });
    } catch (err) {
      console.error(err);
      setOptions({drivers: [], vehicles: []});
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const fetchKmSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("period", filters.period);
      if (filters.driverId) params.set("driver_id", filters.driverId);
      if (filters.vehicleId) params.set("vehicle_id", filters.vehicleId);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);
      params.set("limit", "200");

      const res = await apiGet(`/api/incharge/km-summary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load KM summary");
      const payload = await res.json();
      setData(payload);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error(err);
      setError("Unable to load KM summary. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchKmSummary();
  }, [fetchKmSummary]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({...prev, [key]: value}));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFilterBadges = [];
  if (filters.driverId) {
    const selected = options.drivers.find(
      (d) => String(d.id) === String(filters.driverId),
    );
    activeFilterBadges.push({
      label: selected ? selected.name : "Driver",
      key: "driver",
    });
  }
  if (filters.vehicleId) {
    const selected = options.vehicles.find(
      (v) => String(v.id) === String(filters.vehicleId),
    );
    activeFilterBadges.push({
      label: selected ? selected.vehicle_number : "Vehicle",
      key: "vehicle",
    });
  }
  if (filters.startDate || filters.endDate) {
    activeFilterBadges.push({
      label: `${filters.startDate || "..."} → ${filters.endDate || "..."}`,
      key: "dates",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <Route className="text-primary" /> KM Intelligence
          </h3>
          <p className="text-secondarytext text-sm">
            Compare drivers, filter by vehicles, and audit every KM entry in
            seconds.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-secondarybg rounded-lg p-1 overflow-hidden">
            {["today", "week", "month"].map((preset) => (
              <button
                key={preset}
                onClick={() => updateFilter("period", preset)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  filters.period === preset
                    ? "bg-primary text-white shadow"
                    : "text-secondarytext hover:bg-primary/10"
                }`}
              >
                {preset === "today"
                  ? "Today"
                  : preset === "week"
                    ? "This Week"
                    : "This Month"}
              </button>
            ))}
          </div>
          <button
            onClick={fetchKmSummary}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-secondarybg border border-primarybg rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primarytext font-semibold">
            <Filter size={18} /> Advanced Filters
          </div>
          <button
            onClick={clearFilters}
            disabled={
              JSON.stringify(filters) === JSON.stringify(defaultFilters)
            }
            className="text-xs uppercase tracking-wide text-primary disabled:text-secondarytext"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-secondarytext uppercase tracking-wider mb-1 block">
              Driver
            </label>
            <SearchableSelect
              options={(options.drivers || []).map((driver) => ({
                value: driver.id,
                label: driver.name,
                subtitle: driver.cluster ? `Cluster: ${driver.cluster}` : null,
              }))}
              value={filters.driverId}
              onChange={(val) => updateFilter("driverId", val)}
              placeholder="All drivers"
              disabled={metaLoading}
              emptyMessage="No drivers found"
            />
          </div>
          <div>
            <label className="text-xs text-secondarytext uppercase tracking-wider mb-1 block">
              Vehicle
            </label>
            <SearchableSelect
              options={(options.vehicles || []).map((vehicle) => ({
                value: vehicle.id,
                label:
                  vehicle.bus_name &&
                  vehicle.bus_name !== vehicle.vehicle_number
                    ? `${vehicle.bus_name} - ${vehicle.vehicle_number}`
                    : vehicle.vehicle_number,
                subtitle: vehicle.vehicle_type,
              }))}
              value={filters.vehicleId}
              onChange={(val) => updateFilter("vehicleId", val)}
              placeholder="All vehicles"
              disabled={metaLoading}
              emptyMessage="No vehicles found"
            />
          </div>
          <div>
            <label className="text-xs text-secondarytext uppercase tracking-wider">
              Start Date
            </label>
            <input
              type="date"
              className="w-full mt-1 rounded-lg border border-primarybg bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              value={filters.startDate}
              onChange={(e) => updateFilter("startDate", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-secondarytext uppercase tracking-wider">
              End Date
            </label>
            <input
              type="date"
              className="w-full mt-1 rounded-lg border border-primarybg bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              value={filters.endDate}
              onChange={(e) => updateFilter("endDate", e.target.value)}
            />
          </div>
        </div>
        {activeFilterBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {activeFilterBadges.map((chip) => (
              <span
                key={chip.key}
                className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full"
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red/10 border border-red/30 text-red rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const rawValue = data.summary?.[card.key] ?? 0;
          const displayValue = card.suffix?.includes("km")
            ? formatKm(rawValue)
            : rawValue || 0;
          return (
            <div
              key={card.key}
              className="bg-secondarybg border border-primarybg rounded-2xl p-4 flex items-center gap-3 shadow-sm"
            >
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <Icon className={card.accent} size={20} />
              </div>
              <div>
                <p className="text-xs text-secondarytext uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-2xl font-semibold text-primarytext">
                  {displayValue}
                  {card.suffix && (
                    <span className="text-sm text-secondarytext ml-1">
                      {card.suffix}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {(data.driver_focus || data.vehicle_focus) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.driver_focus && (
            <FocusCard
              title="Driver Focus"
              primary={data.driver_focus.driver_name}
              meta={`${data.driver_focus.trips} trips`}
              value={`${formatKm(data.driver_focus.total_km)} km`}
              icon={<User size={18} />}
              accent="from-primary/10 to-primary/5"
            />
          )}
          {data.vehicle_focus && (
            <FocusCard
              title="Vehicle Focus"
              primary={`${data.vehicle_focus.vehicle_number} • ${data.vehicle_focus.vehicle_type}`}
              meta={`${data.vehicle_focus.trips} trips`}
              value={`${formatKm(data.vehicle_focus.total_km)} km`}
              icon={<Car size={18} />}
              accent="from-indigo-50 to-white"
            />
          )}
        </div>
      )}

      <div className="bg-secondarybg rounded-2xl shadow-sm border border-primarybg overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-primarybg">
          <div className="flex items-center gap-2 text-primarytext font-semibold">
            <ClipboardList size={16} /> Detailed KM Ledger
          </div>
          {lastUpdated && (
            <p className="text-xs text-secondarytext">
              Last sync · {formatDate(lastUpdated)}{" "}
              {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : data.logs?.length === 0 ? (
          <div className="p-12 text-center text-secondarytext">
            <Route size={48} className="mx-auto mb-3 opacity-20" />
            <p>No KM logs match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                <tr>
                  <th className="text-left py-3 px-4">
                    <div className="flex items-center gap-1">
                      <User size={14} /> Driver
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} /> Date
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Car size={14} /> Vehicle
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">Shift</th>
                  <th className="text-right py-3 px-4">Start</th>
                  <th className="text-right py-3 px-4">End</th>
                  <th className="text-right py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      <Route size={14} /> Total
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">Recorded By</th>
                  <th className="text-left py-3 px-4">Route / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 text-sm">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {log.driver_name?.charAt(0) || "?"}
                        </div>
                        <span className="font-medium text-primarytext">
                          {log.driver_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-secondarytext">
                      {formatDate(log.date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getVehicleTypeColor(log.vehicle_type)}`}
                        >
                          {log.vehicle_type}
                        </span>
                        <span className="text-primarytext font-medium">
                          {log.vehicle_number}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getShiftBadge(log.shift)}`}
                      >
                        {log.shift || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-secondarytext">
                      {formatKm(log.start_km)}
                    </td>
                    <td className="py-3 px-4 text-right text-secondarytext">
                      {formatKm(log.end_km)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">
                      {formatKm(log.total_km)} km
                    </td>
                    <td className="py-3 px-4 text-secondarytext">
                      {log.recorded_by_name ? (
                        <span className="text-xs font-medium">
                          {log.recorded_by_name}{" "}
                          <span className="uppercase text-[10px] ml-1">
                            {log.recorded_by_role}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">–</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-secondarytext">
                      <p className="font-medium text-primarytext">
                        {log.route_name || "Unassigned"}
                      </p>
                      {log.remarks && (
                        <p className="mt-0.5 text-gray-500">{log.remarks}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-sm">
                <tr>
                  <td
                    colSpan="6"
                    className="py-3 px-4 text-right font-semibold text-primarytext"
                  >
                    Total Distance (filtered)
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-primary">
                    {formatKm(data.summary?.total_km)} km
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {data.logs?.some((l) => l.remarks) && (
        <div className="bg-secondarybg rounded-2xl p-5 border border-primarybg">
          <h4 className="font-semibold text-primarytext mb-3">
            Latest Remarks
          </h4>
          <div className="space-y-2">
            {data.logs
              .filter((l) => l.remarks)
              .slice(0, 4)
              .map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-100 rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-secondarytext mb-1">
                    <span className="font-semibold text-primarytext">
                      {log.driver_name}
                    </span>
                    <span>•</span>
                    <span>{formatDate(log.date)}</span>
                  </div>
                  <p className="text-sm text-primarytext">{log.remarks}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FocusCard({title, primary, meta, value, icon, accent}) {
  return (
    <div
      className={`p-4 rounded-2xl border border-primarybg bg-gradient-to-br ${accent} flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-secondarytext">
        <span>{title}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="text-lg font-semibold text-primarytext">{primary}</p>
      <div className="flex items-center justify-between text-sm text-secondarytext">
        <span>{meta}</span>
        <span className="text-primarytext font-bold">{value}</span>
      </div>
    </div>
  );
}
