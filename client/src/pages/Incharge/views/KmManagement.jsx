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
  Award,
  Gauge,
  X,
  BarChart3,
  ChevronRight,
  FileText,
  MapPin,
} from "lucide-react";

const formatNumber = (value, fraction = 1) =>
  Number(value || 0)
    .toFixed(fraction)
    .replace(/\.0+$/, "");

const getVehicleIcon = (type) => {
  switch (type?.toUpperCase()) {
    case "BUS":
      return <Bus size={18} />;
    case "CAR":
      return <Car size={18} />;
    case "EV":
    case "BATTERY_VEHICLE":
      return <Zap size={18} />;
    default:
      return <Truck size={18} />;
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
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[typeStr] || "bg-gray-100 text-gray-700"}`}
    >
      {typeStr}
    </span>
  );
};

const periodPresets = [
  {value: "today", label: "Today"},
  {value: "week", label: "This Week"},
  {value: "month", label: "This Month"},
  {value: "all", label: "All Time"},
];

export default function KmManagement() {
  const {user} = useAuth();
  const {showToast} = useToast();

  const [activeTab, setActiveTab] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterMeta, setFilterMeta] = useState({drivers: [], vehicles: []});
  const [metaLoading, setMetaLoading] = useState(true);

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverInfo, setDriverInfo] = useState(null);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [showDriverVehicles, setShowDriverVehicles] = useState(false);

  const [form, setForm] = useState({
    date: getToday(),
    vehicle_id: "",
    start_km: "",
    end_km: "",
    remarks: "",
  });

  const [logFilters, setLogFilters] = useState({
    period: "today",
    driverId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
    search: "",
  });
  const [logs, setLogs] = useState([]);
  const [logSummary, setLogSummary] = useState({total_km: 0, total_trips: 0});

  const [summaryFilters, setSummaryFilters] = useState({
    period: "all",
    driverId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
  });
  const [kmSummary, setKmSummary] = useState(null);
  const [vehicleSummary, setVehicleSummary] = useState([]);
  const [vehicleSummaryLoading, setVehicleSummaryLoading] = useState(false);

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedDriverHistory, setSelectedDriverHistory] = useState(null);
  const [driverHistoryLoading, setDriverHistoryLoading] = useState(false);

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
      console.error("Failed to load KM filters", err);
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchDriverVehicles = async (driverId, date) => {
    try {
      setVehiclesLoading(true);
      const res = await apiGet(
        `/api/admin/driver-assigned-vehicles?driver_id=${driverId}&date=${date}`,
      );
      if (res.ok) {
        const data = await res.json();
        setDriverInfo({
          id: data.driver_id,
          name: data.driver_name,
          cluster: data.cluster_name,
        });
        setAssignedVehicles(data.vehicles || []);
        setShowDriverVehicles(true);

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

  useEffect(() => {
    if (selectedDriverId && form.date) {
      fetchDriverVehicles(selectedDriverId, form.date);
      setShowDriverVehicles(true);
    } else {
      setAssignedVehicles([]);
      setDriverInfo(null);
      setShowDriverVehicles(false);
    }
  }, [selectedDriverId, form.date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDriverId || !form.vehicle_id || !form.date) {
      showToast("Please fill all required fields", "error");
      return;
    }

    if (!form.start_km || !form.end_km) {
      showToast("Please enter Start and End KM", "error");
      return;
    }

    const startKm = parseFloat(form.start_km);
    const endKm = parseFloat(form.end_km);
    if (endKm <= startKm) {
      showToast("End KM must be greater than Start KM", "error");
      return;
    }

    if (!user?.user_id) {
      showToast("Session expired. Please re-login.", "error");
      return;
    }

    try {
      setLoading(true);
      const selectedVehicleMeta =
        assignedVehicles.find(
          (v) => String(v.vehicle_id) === String(form.vehicle_id),
        ) ||
        filterMeta.vehicles.find(
          (v) => String(v.id) === String(form.vehicle_id),
        );

      const payload = {
        admin_user_id: user?.user_id,
        driver_id: Number(selectedDriverId),
        vehicle_id: Number(form.vehicle_id),
        date: form.date,
        start_km: startKm,
        end_km: endKm,
        total_km: endKm - startKm,
        remarks: form.remarks?.trim() || "",
        vehicle_type: selectedVehicleMeta?.vehicle_type || "",
      };

      const res = await apiPost("/api/admin/km-log/add", payload);
      const data = await res.json();

      if (res.ok) {
        showToast("KM log added successfully", "success");
        setForm({
          date: getToday(),
          vehicle_id: "",
          start_km: "",
          end_km: "",
          remarks: "",
        });
        setSelectedDriverId("");
        fetchKmLogs();
      } else {
        showToast(data.error || "Failed to add KM log", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchKmLogs = async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams();
      params.set("period", logFilters.period);
      if (logFilters.driverId) params.set("driver_id", logFilters.driverId);
      if (logFilters.vehicleId) params.set("vehicle_id", logFilters.vehicleId);
      if (logFilters.startDate) params.set("start_date", logFilters.startDate);
      if (logFilters.endDate) params.set("end_date", logFilters.endDate);
      if (logFilters.search) params.set("search", logFilters.search);

      const res = await apiGet(`/api/admin/km-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogSummary({
          total_km: data.total_km || 0,
          total_trips: data.total_trips || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch KM logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Summary functions
  const fetchKmSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("period", summaryFilters.period);
      if (summaryFilters.driverId)
        params.set("driver_id", summaryFilters.driverId);
      if (summaryFilters.vehicleId)
        params.set("vehicle_id", summaryFilters.vehicleId);
      if (summaryFilters.startDate)
        params.set("start_date", summaryFilters.startDate);
      if (summaryFilters.endDate)
        params.set("end_date", summaryFilters.endDate);

      const res = await apiGet(`/api/admin/km-summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setKmSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch KM summary", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleSummary = async () => {
    try {
      setVehicleSummaryLoading(true);
      const params = new URLSearchParams();
      params.set("period", summaryFilters.period);
      if (summaryFilters.driverId)
        params.set("driver_id", summaryFilters.driverId);
      if (summaryFilters.vehicleId)
        params.set("vehicle_id", summaryFilters.vehicleId);
      if (summaryFilters.startDate)
        params.set("start_date", summaryFilters.startDate);
      if (summaryFilters.endDate)
        params.set("end_date", summaryFilters.endDate);

      const res = await apiGet(
        `/api/admin/km-vehicle-summary?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setVehicleSummary(Array.isArray(data.vehicles) ? data.vehicles : []);
      } else {
        setVehicleSummary([]);
      }
    } catch (err) {
      console.error("Failed to fetch vehicle summary", err);
      setVehicleSummary([]);
    } finally {
      setVehicleSummaryLoading(false);
    }
  };

  const updateSummaryFilter = (key, value) => {
    setSummaryFilters((prev) => ({...prev, [key]: value}));
  };

  const resetSummaryFilters = () => {
    setSummaryFilters({
      period: "month",
      driverId: "",
      vehicleId: "",
      startDate: "",
      endDate: "",
    });
  };

  const viewDriverHistory = async (driverId) => {
    try {
      setDriverHistoryLoading(true);
      setShowDriverModal(true);
      const res = await apiGet(
        `/api/admin/driver-km-history?driver_id=${driverId}&period=all`,
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedDriverHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch driver history", err);
    } finally {
      setDriverHistoryLoading(false);
    }
  };

  const closeDriverModal = () => {
    setShowDriverModal(false);
    setSelectedDriverHistory(null);
  };

  useEffect(() => {
    loadFilterMeta();
  }, []);

  useEffect(() => {
    fetchKmSummary();
    fetchVehicleSummary();
  }, [summaryFilters]);

  useEffect(() => {
    fetchKmLogs();
  }, [logFilters]);

  const totalKm = parseFloat(form.end_km || 0) - parseFloat(form.start_km || 0);

  const summary = kmSummary || {};
  const selectedDriver = summary.selected_driver;
  const selectedVehicle = summary.selected_vehicle;

  const avgKmPerTrip =
    summary.avg_km_per_trip ??
    (summary.grand_total_trips > 0
      ? summary.grand_total_km / summary.grand_total_trips
      : 0);

  const maxVehicleKm =
    vehicleSummary.length > 0
      ? Math.max(...vehicleSummary.map((v) => v.total_km || 0)) || 1
      : 1;

  const formatDateRange = (start, end) => {
    if (start && end) {
      if (start === end) return start;
      return `${start} → ${end}`;
    }
    return start || end || "No date range";
  };

  const activeBadges = [];
  if (
    !summaryFilters.startDate &&
    !summaryFilters.endDate &&
    summaryFilters.period !== "month"
  ) {
    const presetName =
      periodPresets.find((preset) => preset.value === summaryFilters.period)
        ?.label || summaryFilters.period;
    activeBadges.push(presetName);
  }
  if (summaryFilters.driverId) {
    const driver = filterMeta.drivers.find(
      (d) => String(d.id) === String(summaryFilters.driverId),
    );
    activeBadges.push(driver?.name || "Driver filter");
  }
  if (summaryFilters.vehicleId) {
    const vehicle = filterMeta.vehicles.find(
      (v) => String(v.id) === String(summaryFilters.vehicleId),
    );
    activeBadges.push(vehicle?.vehicle_number || "Vehicle filter");
  }
  if (summaryFilters.startDate || summaryFilters.endDate) {
    activeBadges.push(
      `${summaryFilters.startDate || "Start"} → ${summaryFilters.endDate || "End"}`,
    );
  }

  const hasCustomFilters =
    summaryFilters.period !== "month" ||
    Boolean(summaryFilters.driverId) ||
    Boolean(summaryFilters.vehicleId) ||
    Boolean(summaryFilters.startDate) ||
    Boolean(summaryFilters.endDate);

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Route size={28} className="text-primary" />
            KM Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive fleet mileage tracking and analytics
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeTab === "summary"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 size={18} />
              Summary & Analytics
            </div>
          </button>
          <button
            onClick={() => setActiveTab("entry")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeTab === "entry"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus size={18} />
              KM Log Entry
            </div>
          </button>
        </div>
      </div>

      {/* Summary Tab Content */}
      {activeTab === "summary" && (
        <>
          {/* Summary Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-gray-700 font-semibold">
                <Filter size={18} className="text-primary" />
                Smart Filters
                {metaLoading && (
                  <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Syncing
                    options
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetSummaryFilters}
                disabled={!hasCustomFilters}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-300"
              >
                <RefreshCw size={16} /> Reset filters
              </button>
            </div>

            <div className="px-6 pb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
              {/* Period */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Period
                </p>
                <div className="flex flex-wrap gap-2">
                  {periodPresets.map((preset) => {
                    const isActive = summaryFilters.period === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          updateSummaryFilter("period", preset.value)
                        }
                        className={`px-3 py-2 text-xs font-semibold rounded-full border transition-all ${
                          isActive
                            ? "bg-primary text-white border-primary shadow"
                            : "border-gray-200 text-gray-600 hover:border-primary/40"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Driver */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Driver
                </p>
                <SearchableSelect
                  options={(filterMeta.drivers || []).map((driver) => ({
                    value: driver.id,
                    label: driver.name,
                    subtitle: driver.cluster
                      ? `Cluster: ${driver.cluster}`
                      : null,
                  }))}
                  value={summaryFilters.driverId}
                  onChange={(val) => updateSummaryFilter("driverId", val)}
                  placeholder="All drivers"
                  disabled={metaLoading}
                  emptyMessage="No drivers found"
                />
              </div>

              {/* Vehicle */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Vehicle
                </p>
                <SearchableSelect
                  options={(filterMeta.vehicles || []).map((vehicle) => ({
                    value: vehicle.id,
                    label:
                      vehicle.bus_name &&
                      vehicle.bus_name !== vehicle.vehicle_number
                        ? `${vehicle.bus_name} (${vehicle.vehicle_number})`
                        : vehicle.vehicle_number,
                    subtitle: vehicle.vehicle_type,
                  }))}
                  value={summaryFilters.vehicleId}
                  onChange={(val) => updateSummaryFilter("vehicleId", val)}
                  placeholder="All vehicles"
                  disabled={metaLoading}
                  emptyMessage="No vehicles found"
                />
              </div>

              {/* Custom Range */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Custom Range
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={summaryFilters.startDate}
                    onChange={(e) =>
                      updateSummaryFilter("startDate", e.target.value)
                    }
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="date"
                    value={summaryFilters.endDate}
                    min={summaryFilters.startDate || undefined}
                    onChange={(e) =>
                      updateSummaryFilter("endDate", e.target.value)
                    }
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {activeBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-dashed border-gray-100 bg-gray-50/60 rounded-b-xl">
                {activeBadges.map((label, idx) => (
                  <span
                    key={`${label}-${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-primary/20 text-primary shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-full"></div>
            </div>
          ) : (
            <>
              {/* Selected Driver/Vehicle Cards */}
              {(selectedDriver || selectedVehicle) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDriver && (
                    <div className="bg-white rounded-xl border border-primary/20 shadow-sm p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <User size={22} />
                          </div>
                          <div>
                            <p className="text-xs uppercase text-gray-500 font-semibold tracking-wide">
                              Driver Focus
                            </p>
                            <p className="text-lg font-bold text-gray-800">
                              {selectedDriver.driver_name}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                          #{selectedDriver.driver_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Total KM</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(selectedDriver.total_km, 1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Trips</p>
                          <p className="text-xl font-bold text-gray-800">
                            {selectedDriver.trips || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg / Trip</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(
                              selectedDriver.trips > 0
                                ? selectedDriver.total_km / selectedDriver.trips
                                : 0,
                              1,
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {formatDateRange(
                          selectedDriver.first_date,
                          selectedDriver.last_date,
                        )}
                      </p>
                    </div>
                  )}
                  {selectedVehicle && (
                    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-full bg-emerald-50 text-emerald-600">
                            <Truck size={22} />
                          </div>
                          <div>
                            <p className="text-xs uppercase text-gray-500 font-semibold tracking-wide">
                              Vehicle Focus
                            </p>
                            <p className="text-lg font-bold text-gray-800">
                              {selectedVehicle.vehicle_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              {selectedVehicle.vehicle_type || "UNKNOWN"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                          #{selectedVehicle.vehicle_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Total KM</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(selectedVehicle.total_km, 1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Trips</p>
                          <p className="text-xl font-bold text-gray-800">
                            {selectedVehicle.trips || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg / Trip</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(
                              selectedVehicle.trips > 0
                                ? selectedVehicle.total_km /
                                    selectedVehicle.trips
                                : 0,
                              1,
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {formatDateRange(
                          selectedVehicle.first_date,
                          selectedVehicle.last_date,
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Map size={64} className="text-primary" />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-primary/10 rounded-lg text-primary">
                      <Map size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Total Distance
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {formatNumber(summary.grand_total_km, 1)}
                        <span className="text-sm text-gray-500 font-normal ml-1">
                          km
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Route size={64} className="text-green-500" />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-green-50 rounded-lg text-green-600">
                      <Route size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Total Trips
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {summary.grand_total_trips || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp size={64} className="text-amber-500" />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Avg / Trip
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {formatNumber(avgKmPerTrip, 1)}
                        <span className="text-sm text-gray-500 font-normal ml-1">
                          km
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Truck size={64} className="text-indigo-500" />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                      <Truck size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Fleet Types
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {summary.by_vehicle_type?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Types and Top Drivers */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* By Vehicle Type */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Truck size={20} className="text-primary" />
                      Distance by Vehicle Type
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {summary.by_vehicle_type?.map((item) => {
                        const percentage =
                          summary.grand_total_km > 0
                            ? (
                                ((item.total_km || 0) /
                                  summary.grand_total_km) *
                                100
                              ).toFixed(1)
                            : 0;
                        return (
                          <div
                            key={item.vehicle_type}
                            className="bg-gray-50 rounded-lg p-5 border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="p-2.5 bg-white rounded-lg shadow-sm text-gray-700">
                                {getVehicleIcon(item.vehicle_type)}
                              </div>
                              <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                                {percentage}%
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                              {item.vehicle_type}
                            </h4>
                            <p className="text-xl font-bold text-gray-800 mb-1">
                              {formatNumber(item.total_km, 1)}
                              <span className="text-sm text-gray-500 font-normal ml-1">
                                km
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.total_trips} trips •{" "}
                              {formatNumber(item.avg_km_per_trip, 1)} km/trip
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full transition-all duration-500"
                                style={{width: `${percentage}%`}}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                      {(!summary.by_vehicle_type ||
                        summary.by_vehicle_type.length === 0) && (
                        <div className="col-span-full py-12 flex flex-col items-center text-center text-gray-400">
                          <AlertCircle size={48} className="mb-2 opacity-20" />
                          <p>No vehicle data recorded yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Drivers */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Award size={20} className="text-amber-500" />
                      Top Drivers
                    </h3>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
                    <div className="space-y-3">
                      {summary.top_drivers?.map((d, i) => (
                        <div
                          key={d.driver_id}
                          onClick={() => viewDriverHistory(d.driver_id)}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary/30 transition-all hover:bg-white hover:shadow-sm cursor-pointer group"
                        >
                          <div
                            className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                              i === 0
                                ? "bg-amber-100 text-amber-700 ring-4 ring-amber-50"
                                : i === 1
                                  ? "bg-gray-200 text-gray-700 ring-4 ring-gray-100"
                                  : i === 2
                                    ? "bg-orange-100 text-orange-700 ring-4 ring-orange-100"
                                    : "bg-white border border-gray-200 text-gray-500"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-primary transition-colors">
                              {d.driver_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {d.trips} trips completed
                            </p>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <p className="text-sm font-bold text-primary">
                                {formatNumber(d.total_km, 0)} km
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {formatNumber(
                                  d.total_km / Math.max(d.trips || 1, 1),
                                  1,
                                )}{" "}
                                avg
                              </p>
                            </div>
                            <ChevronRight
                              size={16}
                              className="text-gray-300 group-hover:text-primary transition-colors"
                            />
                          </div>
                        </div>
                      ))}
                      {(!summary.top_drivers ||
                        summary.top_drivers.length === 0) && (
                        <div className="py-12 flex flex-col items-center text-center text-gray-400">
                          <Award size={48} className="mb-2 opacity-20" />
                          <p>No driver data available.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Vehicles Table */}
              <div className="bg-secondarybg rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-primarytext flex items-center gap-2">
                    <Gauge size={20} className="text-primary" />
                    Distance by Individual Vehicles
                  </h3>
                  <p className="text-sm text-secondarytext mt-1">
                    KM driven by each vehicle in the fleet
                  </p>
                </div>
                <div className="p-6">
                  {vehicleSummaryLoading ? (
                    <div className="flex justify-center p-12">
                      <div className="animate-spin inline-block w-7 h-7 border-4 border-current border-t-transparent text-primary rounded-full"></div>
                    </div>
                  ) : vehicleSummary.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Vehicle
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Type
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Total KM
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Trips
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Avg/Trip
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Progress
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {vehicleSummary.map((vehicle, idx) => {
                            const percentage =
                              ((vehicle.total_km || 0) / maxVehicleKm) * 100;
                            return (
                              <tr
                                key={vehicle.vehicle_id}
                                className="hover:bg-primarybg transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                      {getVehicleIcon(vehicle.vehicle_type)}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-primarytext">
                                        {vehicle.vehicle_name ||
                                          vehicle.vehicle_number}
                                      </p>
                                      <p className="text-xs text-secondarytext">
                                        {vehicle.vehicle_number}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    {vehicle.vehicle_type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-bold text-primarytext text-lg">
                                    {formatNumber(vehicle.total_km, 1)}
                                  </span>
                                  <span className="text-secondarytext text-sm ml-1">
                                    km
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-secondarytext font-medium">
                                  {vehicle.total_trips}
                                </td>
                                <td className="py-3 px-4 text-right text-secondarytext font-medium">
                                  {formatNumber(vehicle.avg_km_per_trip, 1)} km
                                </td>
                                <td className="py-3 px-4 w-40">
                                  <div className="flex items-center gap-2">
                                    <div className="w-full bg-primarybg rounded-full h-2.5 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                        style={{
                                          width: `${percentage.toFixed(0)}%`,
                                        }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-secondarytext font-medium min-w-[3rem] text-right">
                                      {percentage.toFixed(0)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center text-secondarytext">
                      <Truck size={48} className="mb-2 opacity-20" />
                      <p>No vehicle KM data recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Trip-wise summary table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Gauge size={20} className="text-primary" />
                    Trip-wise Breakdown
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Driver, vehicle, and km per trip in the selected period
                  </p>
                </div>
                <div className="p-6">
                  {summary.trip_wise && summary.trip_wise.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Driver
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Vehicle
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Start KM
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              End KM
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Total KM
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {summary.trip_wise.map((trip) => (
                            <tr
                              key={`${trip.id}-${trip.date}-${trip.driver_id}`}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm text-gray-700">
                                {trip.date || "-"}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-800">
                                    {trip.driver_name || "Unknown"}
                                  </span>
                                  {trip.driver_id && (
                                    <span className="text-xs text-gray-500">
                                      #{trip.driver_id}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {getVehicleIcon(trip.vehicle_type)}
                                  <div className="text-sm text-gray-800 font-medium">
                                    {trip.vehicle_number || "N/A"}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-sm text-gray-600">
                                {formatNumber(trip.start_km)}
                              </td>
                              <td className="py-3 px-4 text-right text-sm text-gray-600">
                                {formatNumber(trip.end_km)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-sm font-semibold text-primary">
                                  {formatNumber(trip.total_km)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center text-center text-gray-400">
                      <Truck size={48} className="mb-2 opacity-20" />
                      <p>No trip data available for this period.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Entry Tab Content */}
      {activeTab === "entry" && (
        <>
          {/* Entry Form - Clean & Simple */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Add KM Log Entry
                  </h2>
                  <p className="text-sm text-gray-500">
                    Record daily vehicle mileage
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <User size={16} className="text-primary" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((prev) => ({...prev, date: e.target.value}))
                      }
                      max={getToday()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Driver Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Driver <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={filterMeta.drivers.map((d) => ({
                        value: d.id,
                        label: d.name,
                      }))}
                      value={selectedDriverId}
                      onChange={setSelectedDriverId}
                      placeholder="Select driver"
                      disabled={metaLoading}
                      emptyMessage="No drivers found"
                    />
                  </div>
                </div>

                {/* Driver Info */}
                {driverInfo && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                        {driverInfo.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {driverInfo.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          ID: {driverInfo.id}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle & Mileage */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Truck size={16} className="text-primary" />
                  Vehicle & Mileage
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Vehicle */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Vehicle <span className="text-red-500">*</span>
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
                        placeholder="Select vehicle"
                        emptyMessage="No assigned vehicles"
                      />
                    ) : (
                      <SearchableSelect
                        options={filterMeta.vehicles.map((v) => ({
                          value: v.id,
                          label:
                            v.bus_name && v.bus_name !== v.vehicle_number
                              ? `${v.bus_name} (${v.vehicle_number})`
                              : v.vehicle_number,
                          subtitle: v.vehicle_type,
                        }))}
                        value={form.vehicle_id}
                        onChange={(val) =>
                          setForm((prev) => ({...prev, vehicle_id: val}))
                        }
                        placeholder="Select vehicle"
                        disabled={metaLoading}
                        emptyMessage="No vehicles found"
                      />
                    )}
                  </div>

                  {/* Start KM */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Start KM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.start_km}
                      onChange={(e) =>
                        setForm((prev) => ({...prev, start_km: e.target.value}))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="0.0"
                      required
                      min="0"
                      step="0.1"
                    />
                  </div>

                  {/* End KM */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      End KM <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.end_km}
                      onChange={(e) =>
                        setForm((prev) => ({...prev, end_km: e.target.value}))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="0.0"
                      required
                      min={form.start_km || "0"}
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Total KM Display */}
                {(form.start_km || form.end_km) && totalKm > 0 && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total Distance
                      </span>
                      <span className="text-2xl font-bold text-green-600">
                        {totalKm.toFixed(1)} km
                      </span>
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-gray-700">
                    Remarks (Optional)
                  </label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, remarks: e.target.value}))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    rows="3"
                    placeholder="Add any notes..."
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      date: getToday(),
                      vehicle_id: "",
                      start_km: "",
                      end_km: "",
                      remarks: "",
                    });
                    setSelectedDriverId("");
                  }}
                  className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Add Log
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Assigned Vehicles */}
          {showDriverVehicles && driverInfo && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Truck size={18} className="text-primary" />
                    Assigned Vehicles for {driverInfo.name}
                  </h3>
                  {assignedVehicles.length > 0 && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                      {assignedVehicles.length} Vehicles
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                {vehiclesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-primary" />
                  </div>
                ) : assignedVehicles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedVehicles.map((vehicle) => (
                      <div
                        key={vehicle.vehicle_id}
                        className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(vehicle.vehicle_type)}
                            <span className="font-semibold text-gray-800">
                              {vehicle.vehicle_number}
                            </span>
                          </div>
                          {getVehicleTypeBadge(vehicle.vehicle_type)}
                        </div>
                        {vehicle.vehicle_name && (
                          <p className="text-sm text-gray-600 mt-2">
                            {vehicle.vehicle_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center text-gray-400">
                    <AlertCircle size={40} className="mb-2 opacity-30" />
                    <p className="text-sm">
                      No vehicles assigned for this date
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Logs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <History size={20} className="text-primary" />
                Recent KM Logs
              </h2>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Period */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Period
                  </label>
                  <div className="flex gap-2">
                    {periodPresets.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          setLogFilters((prev) => ({...prev, period: p.value}))
                        }
                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                          logFilters.period === p.value
                            ? "bg-primary text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-primary"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driver */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Driver
                  </label>
                  <SearchableSelect
                    options={filterMeta.drivers.map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                    value={logFilters.driverId}
                    onChange={(val) =>
                      setLogFilters((prev) => ({...prev, driverId: val}))
                    }
                    placeholder="All drivers"
                    disabled={metaLoading}
                  />
                </div>

                {/* Vehicle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Vehicle
                  </label>
                  <SearchableSelect
                    options={filterMeta.vehicles.map((v) => ({
                      value: v.id,
                      label:
                        v.bus_name && v.bus_name !== v.vehicle_number
                          ? `${v.bus_name} (${v.vehicle_number})`
                          : v.vehicle_number,
                    }))}
                    value={logFilters.vehicleId}
                    onChange={(val) =>
                      setLogFilters((prev) => ({...prev, vehicleId: val}))
                    }
                    placeholder="All vehicles"
                    disabled={metaLoading}
                  />
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Search
                  </label>
                  <input
                    type="text"
                    value={logFilters.search}
                    onChange={(e) =>
                      setLogFilters((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    placeholder="Search..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">Total KM</p>
                  <p className="text-xl font-bold text-primary mt-1">
                    {formatNumber(logSummary.total_km)}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">
                    Total Trips
                  </p>
                  <p className="text-xl font-bold text-gray-800 mt-1">
                    {logSummary.total_trips}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">
                    Avg / Trip
                  </p>
                  <p className="text-xl font-bold text-gray-800 mt-1">
                    {logSummary.total_trips > 0
                      ? formatNumber(
                          logSummary.total_km / logSummary.total_trips,
                        )
                      : "0"}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">Records</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">
                    {logs.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              ) : logs.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Driver
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Vehicle
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Start KM
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        End KM
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Total KM
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 uppercase">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {log.date}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {log.driver_name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(log.vehicle_type)}
                            <span className="text-sm text-gray-700">
                              {log.vehicle_number}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {formatNumber(log.start_km)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {formatNumber(log.end_km)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-primary">
                            {formatNumber(log.total_km)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {log.remarks || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 flex flex-col items-center text-gray-400">
                  <FileText size={48} className="mb-2 opacity-20" />
                  <p>No logs found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Driver History Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {driverHistoryLoading
                      ? "Loading..."
                      : selectedDriverHistory?.driver_name || "Driver"}{" "}
                    KM History
                  </h2>
                  {selectedDriverHistory?.cluster_name && (
                    <p className="text-xs text-gray-500">
                      Cluster: {selectedDriverHistory.cluster_name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeDriverModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {driverHistoryLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              ) : selectedDriverHistory ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Total KM
                      </p>
                      <p className="text-2xl font-bold text-primary mt-1">
                        {formatNumber(selectedDriverHistory.total_km)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Total Trips
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {selectedDriverHistory.total_trips || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Avg per Trip
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {formatNumber(selectedDriverHistory.avg_km_per_trip)} km
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Vehicles Driven
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {selectedDriverHistory.by_vehicle?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Date Range */}
                  {(selectedDriverHistory.first_date ||
                    selectedDriverHistory.last_date) && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <Calendar size={14} />
                      <span>
                        {selectedDriverHistory.first_date || "N/A"} to{" "}
                        {selectedDriverHistory.last_date || "Present"}
                      </span>
                    </div>
                  )}

                  {/* Vehicles Driven */}
                  {selectedDriverHistory.by_vehicle?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Truck size={16} className="text-primary" />
                        Vehicles Driven
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedDriverHistory.by_vehicle.map((v, idx) => (
                          <div
                            key={v.vehicle_id || idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              {getVehicleIcon(v.vehicle_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">
                                {v.vehicle_name || v.vehicle_number}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    v.vehicle_type === "BUS"
                                      ? "bg-blue-100 text-blue-700"
                                      : v.vehicle_type === "CAR"
                                        ? "bg-green-100 text-green-700"
                                        : v.vehicle_type === "EV"
                                          ? "bg-purple-100 text-purple-700"
                                          : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {v.vehicle_type}
                                </span>
                                <span>{v.total_trips} trips</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary text-sm">
                                {formatNumber(v.total_km)} km
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatNumber(v.avg_km_per_trip)} avg
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Logs */}
                  {selectedDriverHistory.recent_logs?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        Recent KM Logs
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                                Date
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                                Vehicle
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                Start
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                End
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {selectedDriverHistory.recent_logs.map(
                              (log, idx) => (
                                <tr
                                  key={log.id || idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="py-2 px-3 text-gray-700">
                                    {log.date}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-1.5">
                                      {getVehicleIcon(log.vehicle_type)}
                                      <span className="text-gray-700">
                                        {log.vehicle_number}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-600">
                                    {formatNumber(log.start_km)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-600">
                                    {formatNumber(log.end_km)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-primary">
                                    {formatNumber(log.total_km)} km
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Monthly Trends */}
                  {selectedDriverHistory.monthly_trends?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary" />
                        Monthly Trends
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {selectedDriverHistory.monthly_trends.map((m, idx) => (
                          <div
                            key={m.month || idx}
                            className="bg-gray-50 rounded-lg px-4 py-3 text-center min-w-[100px]"
                          >
                            <p className="text-xs text-gray-500 font-medium">
                              {m.month}
                            </p>
                            <p className="text-lg font-bold text-primary">
                              {formatNumber(m.total_km)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {m.trips} trips
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <AlertCircle size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No history data available</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={closeDriverModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
