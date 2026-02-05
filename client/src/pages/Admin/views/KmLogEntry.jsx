import React, {useState, useEffect} from "react";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {useAuth} from "../../../context/AuthContext";
import {useToast} from "../../../context/ToastContext";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Plus,
  Truck,
  User,
  Calendar,
  Map,
  Route,
  TrendingUp,
  AlertCircle,
  Loader2,
  Filter,
  RefreshCw,
  Car,
  Bus,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  Search,
} from "lucide-react";

const formatNumber = (value, fraction = 1) =>
  Number(value || 0)
    .toFixed(fraction)
    .replace(/\.0+$/, "");

const getVehicleIcon = (type) => {
  switch (type?.toUpperCase()) {
    case "BUS":
      return <Bus size={18} className="text-blue-600" />;
    case "CAR":
      return <Car size={18} className="text-green-600" />;
    case "EV":
      return <Zap size={18} className="text-purple-600" />;
    default:
      return <Truck size={18} className="text-gray-600" />;
  }
};

const getVehicleTypeBadge = (type) => {
  const typeStr = type?.toUpperCase() || "UNKNOWN";
  const colors = {
    BUS: "bg-blue-100 text-blue-700",
    CAR: "bg-green-100 text-green-700",
    EV: "bg-purple-100 text-purple-700",
    VAN: "bg-orange-100 text-orange-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-xs font-medium ${colors[typeStr] || "bg-gray-100 text-gray-700"}`}
    >
      {typeStr}
    </span>
  );
};

export default function KmLogEntry() {
  const {user} = useAuth();
  const {showToast} = useToast();

  // State
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterMeta, setFilterMeta] = useState({drivers: [], vehicles: []});
  const [metaLoading, setMetaLoading] = useState(true);

  // Driver selection & assigned vehicles
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverInfo, setDriverInfo] = useState(null);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [showDriverVehicles, setShowDriverVehicles] = useState(false);

  // Form state
  const [form, setForm] = useState({
    date: getToday(),
    vehicle_id: "",
    start_km: "",
    end_km: "",
    remarks: "",
  });

  // Logs state with filters
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState({
    period: "today",
    driverId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    search: "",
  });
  const [logSummary, setLogSummary] = useState({total_km: 0, total_trips: 0});

  // Load filter metadata
  useEffect(() => {
    loadFilterMeta();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logFilters]);

  const loadFilterMeta = async () => {
    try {
      setMetaLoading(true);
      const res = await apiGet(`/api/admin/km-filters`);
      if (res.ok) {
        const payload = await res.json();
        setFilterMeta({
          drivers: Array.isArray(payload.drivers) ? payload.drivers : [],
          vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : [],
        });
      }
    } catch (err) {
      console.error("Failed to load filters", err);
    } finally {
      setMetaLoading(false);
    }
  };

  // Fetch assigned vehicles when driver selected
  useEffect(() => {
    if (selectedDriverId) {
      fetchDriverAssignedVehicles(selectedDriverId);
    } else {
      setAssignedVehicles([]);
      setDriverInfo(null);
      setShowDriverVehicles(false);
    }
  }, [selectedDriverId, form.date]);

  const fetchDriverAssignedVehicles = async (driverId) => {
    try {
      setVehiclesLoading(true);
      const res = await apiGet(
        `/api/admin/driver-assigned-vehicles?driver_id=${driverId}&date=${form.date}`,
      );
      if (res.ok) {
        const data = await res.json();
        setDriverInfo({
          driver_id: data.driver_id,
          driver_name: data.driver_name,
          cluster_name: data.cluster_name,
        });
        setAssignedVehicles(data.vehicles || []);
        setShowDriverVehicles(true);

        // Auto-select first vehicle if only one
        if (data.vehicles?.length === 1) {
          setForm((prev) => ({
            ...prev,
            vehicle_id: data.vehicles[0].vehicle_id,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch driver vehicles", err);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams();
      params.set("period", logFilters.period);
      if (logFilters.driverId) params.set("driver_id", logFilters.driverId);
      if (logFilters.vehicleId) params.set("vehicle_id", logFilters.vehicleId);
      if (logFilters.startDate) params.set("start_date", logFilters.startDate);
      if (logFilters.endDate) params.set("end_date", logFilters.endDate);
      if (logFilters.search) params.set("search", logFilters.search);
      params.set("limit", "100");

      const res = await apiGet(`/api/admin/km-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogSummary(data.summary || {total_km: 0, total_trips: 0});
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDriverId) {
      showToast("Please select a driver", "warning");
      return;
    }
    if (!form.vehicle_id) {
      showToast("Please select a vehicle", "warning");
      return;
    }
    if (!form.start_km || !form.end_km) {
      showToast("Please enter start and end KM", "warning");
      return;
    }
    if (parseFloat(form.end_km) <= parseFloat(form.start_km)) {
      showToast("End KM must be greater than Start KM", "warning");
      return;
    }

    const payload = {
      admin_user_id: user?.user_id,
      driver_id: parseInt(selectedDriverId),
      vehicle_id: parseInt(form.vehicle_id),
      date: form.date,
      start_km: parseFloat(form.start_km),
      end_km: parseFloat(form.end_km),
      total_km: parseFloat(form.end_km) - parseFloat(form.start_km),
      remarks: form.remarks,
    };

    try {
      setLoading(true);
      const res = await apiPost("/api/admin/km-log/add", payload);

      if (res.ok) {
        showToast("KM log recorded successfully!", "success");
        // Reset form
        setForm({
          date: getToday(),
          vehicle_id: "",
          start_km: "",
          end_km: "",
          remarks: "",
        });
        setSelectedDriverId("");
        setAssignedVehicles([]);
        setDriverInfo(null);
        // Refresh logs
        fetchLogs();
      } else {
        const errData = await res.json();
        showToast("Failed: " + (errData.error || "Unknown error"), "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error adding KM log", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateLogFilter = (key, value) => {
    setLogFilters((prev) => ({...prev, [key]: value}));
  };

  const resetLogFilters = () => {
    setLogFilters({
      period: "today",
      driverId: "",
      vehicleId: "",
      startDate: "",
      endDate: "",
      search: "",
    });
  };

  const periodPresets = [
    {value: "today", label: "Today"},
    {value: "week", label: "This Week"},
    {value: "month", label: "This Month"},
  ];

  const hasActiveFilters =
    logFilters.driverId ||
    logFilters.vehicleId ||
    logFilters.startDate ||
    logFilters.endDate ||
    logFilters.search ||
    logFilters.period !== "today";

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Map className="text-primary" size={28} />
          KM Log Entry
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Record driver KM logs with automatic vehicle assignment detection
        </p>
      </div>

      {/* KM Entry Form */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-primary" />
          Add New KM Entry
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar size={14} />
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({...prev, date: e.target.value}))
                }
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Driver Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <User size={14} />
                Select Driver
              </label>
              <SearchableSelect
                options={filterMeta.drivers.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                value={selectedDriverId}
                onChange={setSelectedDriverId}
                placeholder="Search driver..."
                disabled={metaLoading}
                emptyMessage="No drivers found"
              />
            </div>

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Truck size={14} />
                Vehicle
              </label>
              {assignedVehicles.length > 0 ? (
                <SearchableSelect
                  options={assignedVehicles.map((v) => ({
                    value: v.vehicle_id,
                    label: v.vehicle_name
                      ? `${v.vehicle_name} (${v.vehicle_number})`
                      : v.vehicle_number,
                    subtitle: v.vehicle_type,
                  }))}
                  value={form.vehicle_id}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, vehicle_id: val}))
                  }
                  placeholder="Select assigned vehicle"
                  emptyMessage="No assigned vehicles"
                />
              ) : (
                <SearchableSelect
                  options={filterMeta.vehicles.map((v) => ({
                    value: v.id,
                    label:
                      v.vehicle_name && v.vehicle_name !== v.vehicle_number
                        ? `${v.vehicle_name} (${v.vehicle_number})`
                        : v.vehicle_number,
                    subtitle: v.vehicle_type,
                  }))}
                  value={form.vehicle_id}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, vehicle_id: val}))
                  }
                  placeholder="Select any vehicle..."
                  disabled={metaLoading}
                  emptyMessage="No vehicles found"
                />
              )}
            </div>

            {/* Start KM */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Start KM
              </label>
              <input
                type="number"
                step="0.1"
                value={form.start_km}
                onChange={(e) =>
                  setForm((prev) => ({...prev, start_km: e.target.value}))
                }
                placeholder="0"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* End KM */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                End KM
              </label>
              <input
                type="number"
                step="0.1"
                value={form.end_km}
                onChange={(e) =>
                  setForm((prev) => ({...prev, end_km: e.target.value}))
                }
                placeholder="0"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Calculated Total */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total KM
              </label>
              <div className="w-full border border-gray-100 bg-gray-50 rounded-md px-3 py-2.5 text-sm font-semibold text-primary">
                {form.start_km && form.end_km
                  ? formatNumber(
                      parseFloat(form.end_km) - parseFloat(form.start_km),
                      1,
                    )
                  : "0"}{" "}
                km
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Remarks (Optional)
              </label>
              <input
                type="text"
                value={form.remarks}
                onChange={(e) =>
                  setForm((prev) => ({...prev, remarks: e.target.value}))
                }
                placeholder="Any notes..."
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {loading ? "Recording..." : "Record KM Log"}
            </button>
          </div>
        </form>

        {/* Driver's Assigned Vehicles Panel */}
        {selectedDriverId && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDriverVehicles(!showDriverVehicles)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-primary transition-colors"
            >
              {showDriverVehicles ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
              {driverInfo?.driver_name
                ? `${driverInfo.driver_name}'s Assigned Vehicles`
                : "Driver's Assigned Vehicles"}
              {driverInfo?.cluster_name && (
                <span className="text-xs font-normal text-gray-500">
                  ({driverInfo.cluster_name})
                </span>
              )}
            </button>

            {showDriverVehicles && (
              <div className="mt-4">
                {vehiclesLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 size={24} className="animate-spin mr-2" />
                    Loading vehicles...
                  </div>
                ) : assignedVehicles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedVehicles.map((v, idx) => (
                      <div
                        key={`${v.vehicle_id}-${idx}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            vehicle_id: v.vehicle_id,
                          }))
                        }
                        className={`p-4 rounded-md border cursor-pointer transition-all ${
                          form.vehicle_id === v.vehicle_id
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-gray-200 hover:border-primary/40 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-gray-50">
                            {getVehicleIcon(v.vehicle_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">
                              {v.vehicle_name || v.vehicle_number}
                            </p>
                            {v.vehicle_name && (
                              <p className="text-xs text-gray-500">
                                {v.vehicle_number}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {getVehicleTypeBadge(v.vehicle_type)}
                              <span className="text-xs text-gray-400">
                                {v.assignment_type === "TEMPORARY"
                                  ? "Temp"
                                  : v.assignment_type === "EV_CLUSTER"
                                    ? "EV"
                                    : "Regular"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-6 text-gray-400 justify-center">
                    <AlertCircle size={18} />
                    No vehicles assigned for {form.date}. You can select any
                    vehicle from the dropdown.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KM Logs Table with Filters */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100">
        {/* Filters Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-primary" />
              Recent KM Logs
              {logSummary.total_trips > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({logSummary.total_trips} entries •{" "}
                  {formatNumber(logSummary.total_km)} km)
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={resetLogFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-300"
            >
              <RefreshCw size={16} /> Reset
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Period */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Period
              </label>
              <div className="flex gap-1">
                {periodPresets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateLogFilter("period", p.value)}
                    className={`px-2 py-1 text-xs font-medium rounded-md ${
                      logFilters.period === p.value
                        ? "bg-primary text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-primary/40"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Driver Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Driver
              </label>
              <SearchableSelect
                options={filterMeta.drivers.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                value={logFilters.driverId}
                onChange={(val) => updateLogFilter("driverId", val)}
                placeholder="All drivers"
                disabled={metaLoading}
              />
            </div>

            {/* Vehicle Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Vehicle
              </label>
              <SearchableSelect
                options={filterMeta.vehicles.map((v) => ({
                  value: v.id,
                  label: v.vehicle_number,
                  subtitle: v.vehicle_type,
                }))}
                value={logFilters.vehicleId}
                onChange={(val) => updateLogFilter("vehicleId", val)}
                placeholder="All vehicles"
                disabled={metaLoading}
              />
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">From</label>
              <input
                type="date"
                value={logFilters.startDate}
                onChange={(e) => updateLogFilter("startDate", e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">To</label>
              <input
                type="date"
                value={logFilters.endDate}
                min={logFilters.startDate}
                onChange={(e) => updateLogFilter("endDate", e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
              />
            </div>

            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">
                Search
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={logFilters.search}
                  onChange={(e) => updateLogFilter("search", e.target.value)}
                  placeholder="Driver or vehicle..."
                  className="w-full border border-gray-200 rounded-md pl-7 pr-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          {logsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : logs.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Driver
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Vehicle
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Start KM
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    End KM
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Total KM
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">
                    Recorded By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {log.date}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-800">
                        {log.driver_name}
                      </p>
                      {log.cluster_name &&
                        log.cluster_name !== "Unassigned" && (
                          <p className="text-xs text-gray-500">
                            {log.cluster_name}
                          </p>
                        )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getVehicleIcon(log.vehicle_type)}
                        <span className="text-sm text-gray-700">
                          {log.vehicle_number}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">
                      {formatNumber(log.start_km, 1)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600">
                      {formatNumber(log.end_km, 1)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-primary">
                      {formatNumber(log.total_km, 1)} km
                    </td>
                    <td className="py-3 px-4">
                      {log.recorded_by_name ? (
                        <div>
                          <p className="text-xs text-gray-600">
                            {log.recorded_by_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {log.recorded_by_role}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Route size={48} className="mb-2 opacity-30" />
              <p>No KM logs found for the selected filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
