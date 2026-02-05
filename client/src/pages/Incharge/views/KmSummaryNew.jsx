import React, {useState, useEffect} from "react";
import {apiGet} from "../../../utils/api";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Loader2,
  Map,
  Route,
  TrendingUp,
  Truck,
  AlertCircle,
  Bus,
  Car,
  Zap,
  Award,
  Gauge,
  Filter,
  RefreshCw,
  User,
  X,
  Calendar,
  Clock,
  ChevronRight,
} from "lucide-react";

const defaultFilters = {
  period: "all",
  driverId: "",
  vehicleId: "",
  startDate: "",
  endDate: "",
};

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

export default function KmSummary() {
  const [kmSummary, setKmSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(defaultFilters);
  const [metaLoading, setMetaLoading] = useState(true);
  const [filterMeta, setFilterMeta] = useState({drivers: [], vehicles: []});
  const [error, setError] = useState("");

  // Driver history modal state
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedDriverHistory, setSelectedDriverHistory] = useState(null);
  const [driverHistoryLoading, setDriverHistoryLoading] = useState(false);

  useEffect(() => {
    loadFilterMeta();
  }, []);

  useEffect(() => {
    fetchKmSummary();
  }, [filters]);

  const loadFilterMeta = async () => {
    try {
      setMetaLoading(true);
      const res = await apiGet(`/api/admin/km-filters`);
      if (res.ok) {
        const payload = await res.json();
        console.log("KM Filters loaded:", payload);
        setFilterMeta({
          drivers: Array.isArray(payload.drivers) ? payload.drivers : [],
          vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : [],
        });
      } else {
        console.error("Failed to load filters, status:", res.status);
      }
    } catch (err) {
      console.error("Failed to load KM filters", err);
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchKmSummary = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("period", filters.period);
      if (filters.driverId) params.set("driver_id", filters.driverId);
      if (filters.vehicleId) params.set("vehicle_id", filters.vehicleId);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);

      const res = await apiGet(`/api/admin/km-summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setKmSummary(data || {});
      } else {
        setError("Unable to fetch KM summary");
      }
    } catch (error) {
      console.error("Error fetching KM summary:", error);
      setError("Something went wrong while loading data");
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({...prev, [key]: value}));
  };

  const resetFilters = () => setFilters({...defaultFilters});

  // Fetch driver KM history
  const fetchDriverHistory = async (driverId) => {
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
      console.error("Error fetching driver history:", err);
    } finally {
      setDriverHistoryLoading(false);
    }
  };

  const closeDriverModal = () => {
    setShowDriverModal(false);
    setSelectedDriverHistory(null);
  };

  const getVehicleIconLarge = (type) => {
    switch (type) {
      case "BUS":
        return <Bus size={24} className="text-primary" />;
      case "CAR":
        return <Car size={24} className="text-primary" />;
      case "EV":
        return <Zap size={24} className="text-primary" />;
      case "VAN":
        return <Truck size={24} className="text-primary" />;
      default:
        return <Truck size={24} className="text-primary" />;
    }
  };

  const summary = kmSummary || {};
  const selectedDriver = summary.selected_driver;
  const selectedVehicle = summary.selected_vehicle;

  const periodPresets = [
    {value: "today", label: "Today"},
    {value: "week", label: "This Week"},
    {value: "month", label: "This Month"},
    {value: "all", label: "All Time"},
  ];

  const activeBadges = [];
  if (
    !filters.startDate &&
    !filters.endDate &&
    filters.period !== defaultFilters.period
  ) {
    const presetName =
      periodPresets.find((preset) => preset.value === filters.period)?.label ||
      filters.period;
    activeBadges.push(presetName);
  }
  if (filters.driverId) {
    const driver = filterMeta.drivers.find(
      (d) => String(d.id) === String(filters.driverId),
    );
    activeBadges.push(driver?.name || "Driver filter");
  }
  if (filters.vehicleId) {
    const vehicle = filterMeta.vehicles.find(
      (v) => String(v.id) === String(filters.vehicleId),
    );
    activeBadges.push(vehicle?.vehicle_number || "Vehicle filter");
  }
  if (filters.startDate || filters.endDate) {
    activeBadges.push(
      `${filters.startDate || "Start"} → ${filters.endDate || "End"}`,
    );
  }

  const hasCustomFilters =
    filters.period !== defaultFilters.period ||
    Boolean(filters.driverId) ||
    Boolean(filters.vehicleId) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const formatDateRange = (start, end) => {
    if (start && end) {
      if (start === end) return start;
      return `${start} → ${end}`;
    }
    return start || end || "No date range";
  };

  const avgKmPerTrip =
    summary.avg_km_per_trip ??
    (summary.grand_total_trips > 0
      ? summary.grand_total_km / summary.grand_total_trips
      : 0);

  const maxVehicleKm = summary.by_vehicle?.[0]?.total_km || 1;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Analytics & Reports
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Detailed breakdown of fleet mileage and driver performance
        </p>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100">
        <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Filter size={18} className="text-primary" />
            Smart Filters
            {metaLoading && (
              <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Syncing options
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasCustomFilters}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-300"
          >
            <RefreshCw size={16} /> Reset filters
          </button>
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Period
            </p>
            <div className="flex flex-wrap gap-2">
              {periodPresets.map((preset) => {
                const isActive = filters.period === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => updateFilter("period", preset.value)}
                    className={`px-3 py-2 text-xs font-semibold rounded-md border transition-all ${
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Driver
            </p>
            <SearchableSelect
              options={(filterMeta.drivers || []).map((driver) => ({
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Vehicle
            </p>
            <SearchableSelect
              options={(filterMeta.vehicles || []).map((vehicle) => ({
                value: vehicle.id,
                label:
                  vehicle.vehicle_name &&
                  vehicle.vehicle_name !== vehicle.vehicle_number
                    ? `${vehicle.vehicle_name} - ${vehicle.vehicle_number}`
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Custom Range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => updateFilter("startDate", e.target.value)}
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                onChange={(e) => updateFilter("endDate", e.target.value)}
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>
        {activeBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-dashed border-gray-100 bg-gray-50/60 rounded-b-xl">
            {activeBadges.map((label, idx) => (
              <span
                key={`${label}-${idx}`}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-white border border-primary/20 text-primary shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-md border border-red-200 bg-red-50 text-red-700">
          <AlertCircle size={18} className="mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Unable to load mileage data</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-md"></div>
        </div>
      ) : (
        <>
          {(selectedDriver || selectedVehicle) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedDriver && (
                <div className="bg-white rounded-md border border-primary/20 shadow-sm p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-md bg-primary/10 text-primary">
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
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-md">
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
                <div className="bg-white rounded-md border border-emerald-100 shadow-sm p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-md bg-emerald-50 text-emerald-600">
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
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md">
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
                            ? selectedVehicle.total_km / selectedVehicle.trips
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Map size={64} className="text-primary" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-primary/10 rounded-md text-primary">
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

            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Route size={64} className="text-green-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-green-50 rounded-md text-green-600">
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

            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-amber-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-amber-50 rounded-md text-amber-600">
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

            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Truck size={64} className="text-indigo-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-indigo-50 rounded-md text-indigo-600">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-md shadow-sm border border-gray-100 flex flex-col">
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
                            ((item.total_km || 0) / summary.grand_total_km) *
                            100
                          ).toFixed(1)
                        : 0;
                    return (
                      <div
                        key={item.vehicle_type}
                        className="bg-gray-50 rounded-md p-5 border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 bg-white rounded-md shadow-sm text-gray-700">
                            {getVehicleIcon(item.vehicle_type)}
                          </div>
                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md">
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
                        <div className="w-full bg-gray-200 rounded-md h-1.5 mt-4 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-md transition-all duration-500"
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

            <div className="bg-white rounded-md shadow-sm border border-gray-100 flex flex-col h-full">
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
                      onClick={() => fetchDriverHistory(d.driver_id)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-100 hover:border-primary/30 transition-all hover:bg-white hover:shadow-sm cursor-pointer group"
                    >
                      <div
                        className={`w-8 h-8 shrink-0 rounded-md flex items-center justify-center font-bold text-xs ${
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

          <div className="bg-white rounded-md shadow-sm border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Gauge size={20} className="text-primary" />
                Distance by Individual Vehicles
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                KM driven by each vehicle in the fleet
              </p>
            </div>
            <div className="p-6">
              {summary.by_vehicle && summary.by_vehicle.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Vehicle
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Total KM
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Trips
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Avg/Trip
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.by_vehicle.map((vehicle, idx) => {
                        const percentage =
                          ((vehicle.total_km || 0) / maxVehicleKm) * 100;
                        return (
                          <tr
                            key={vehicle.vehicle_id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-md flex items-center justify-center ${
                                    idx === 0
                                      ? "bg-amber-100 text-amber-600"
                                      : idx === 1
                                        ? "bg-gray-100 text-gray-600"
                                        : idx === 2
                                          ? "bg-orange-100 text-orange-600"
                                          : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {getVehicleIcon(vehicle.vehicle_type)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-800">
                                    {vehicle.vehicle_number}
                                  </p>
                                  {vehicle.model && (
                                    <p className="text-xs text-gray-500">
                                      {vehicle.model}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-md text-xs font-medium ${
                                  vehicle.vehicle_type === "BUS"
                                    ? "bg-blue-100 text-blue-700"
                                    : vehicle.vehicle_type === "CAR"
                                      ? "bg-green-100 text-green-700"
                                      : vehicle.vehicle_type === "EV"
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {vehicle.vehicle_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-bold text-gray-800">
                                {formatNumber(vehicle.total_km, 1)}
                              </span>
                              <span className="text-gray-500 text-sm ml-1">
                                km
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-600">
                              {vehicle.total_trips}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-600">
                              {formatNumber(vehicle.avg_km_per_trip, 1)} km
                            </td>
                            <td className="py-3 px-4 w-40">
                              <div className="w-full bg-gray-100 rounded-md h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-md transition-all duration-500 ${
                                    idx === 0
                                      ? "bg-amber-500"
                                      : idx === 1
                                        ? "bg-gray-400"
                                        : idx === 2
                                          ? "bg-orange-400"
                                          : "bg-primary"
                                  }`}
                                  style={{width: `${percentage.toFixed(0)}%`}}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center text-center text-gray-400">
                  <Truck size={48} className="mb-2 opacity-20" />
                  <p>No vehicle KM data recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Driver KM History Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md">
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
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
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
                    <div className="bg-gray-50 rounded-md p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Total KM
                      </p>
                      <p className="text-2xl font-bold text-primary mt-1">
                        {formatNumber(selectedDriverHistory.total_km)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Total Trips
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {selectedDriverHistory.total_trips || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        Avg per Trip
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {formatNumber(selectedDriverHistory.avg_km_per_trip)} km
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-4 text-center">
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
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-100"
                          >
                            <div className="p-2 bg-white rounded-md shadow-sm">
                              {getVehicleIcon(v.vehicle_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">
                                {v.vehicle_name || v.vehicle_number}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
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
                            className="bg-gray-50 rounded-md px-4 py-3 text-center min-w-[100px]"
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
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
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
