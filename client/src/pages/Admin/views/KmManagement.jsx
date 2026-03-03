import React, {useState, useEffect} from "react";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {useAuth} from "../../../context/AuthContext";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearchableDropdown from "../../../components/ui/CustomSearchableDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Plus,
  Truck,
  User,
  Calendar,
  Map,
  Route,
  TrendingUp,
  AlertCircle,
  Car,
  Bus,
  Zap,
  Clock,
  ChevronRight,
  FileText,
  Award,
  Gauge,
  X,
  BarChart3,
  Check,
  XCircle,
  Fuel,
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

export default function KmManagement() {
  const {user} = useAuth();
  const {showToast} = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterMeta, setFilterMeta] = useState({drivers: [], vehicles: []});
  const [metaLoading, setMetaLoading] = useState(true);

  // Entry modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverAssignments, setDriverAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [form, setForm] = useState({
    date: getToday(),
    vehicle_id: "",
    start_km: "",
    end_km: "",
    fuel_consumed: "",
    remarks: "",
  });

  // Pending count
  const [pendingCount, setPendingCount] = useState(0);

  // Logs
  const [logFilters, setLogFilters] = useState({
    period: "today",
    driverId: "",
    vehicleId: "",
    vehicleType: "",
    search: "",
    status: "",
  });
  const [logs, setLogs] = useState([]);
  const [logSummary, setLogSummary] = useState({total_km: 0, total_trips: 0});

  // Summary
  const [summaryFilters, setSummaryFilters] = useState({
    period: "all",
    driverId: "",
    vehicleId: "",
  });
  const [kmSummary, setKmSummary] = useState(null);
  const [vehicleSummary, setVehicleSummary] = useState([]);
  const [vehicleSummaryLoading, setVehicleSummaryLoading] = useState(false);

  // Fuel by vehicle
  const [fuelByVehicle, setFuelByVehicle] = useState([]);
  const [fuelTotals, setFuelTotals] = useState({grand_total_fuel: 0, grand_total_km: 0});
  const [fuelPeriod, setFuelPeriod] = useState("month");
  const [fuelLoading, setFuelLoading] = useState(false);

  // Driver history modal
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedDriverHistory, setSelectedDriverHistory] = useState(null);
  const [driverHistoryLoading, setDriverHistoryLoading] = useState(false);

  // Vehicle Type detail modal
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState(null);
  const [vehicleTypeLoading, setVehicleTypeLoading] = useState(false);
  const [vehicleTypeLogs, setVehicleTypeLogs] = useState([]);

  // Individual Vehicle detail modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleLogs, setVehicleLogs] = useState([]);

  // Top Drivers search
  const [driverSearch, setDriverSearch] = useState("");

  // Vehicle search
  const [vehicleSearch, setVehicleSearch] = useState("");

  // Date-wise tracker
  const [trackerDate, setTrackerDate] = useState(getToday());
  const [trackerData, setTrackerData] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerFilter, setTrackerFilter] = useState("all"); // all | entered | pending

  /* --- Data Fetching --- */
  const loadFilterMeta = async () => {
    try {
      setMetaLoading(true);
      const res = await apiGet("/api/admin/km-filters");
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

  const fetchDriverInfo = async (driverId) => {
    if (!driverId) {
      setDriverInfo(null);
      return;
    }
    try {
      // Fetch driver basic info from the drivers list
      const driver = filterMeta.drivers.find(
        (d) => String(d.id) === String(driverId),
      );
      if (driver) {
        setDriverInfo({
          id: driver.id,
          name: driver.name,
          cluster: driver.cluster_name || null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch driver info", err);
    }
  };

  useEffect(() => {
    fetchDriverInfo(selectedDriverId);
  }, [selectedDriverId, filterMeta.drivers]);

  // Fetch driver assignments when driver or date changes
  const fetchDriverAssignments = async (driverId, date) => {
    if (!driverId || !date) {
      setDriverAssignments([]);
      return;
    }
    try {
      setAssignmentsLoading(true);
      const res = await apiGet(`/api/admin/driver-assigned-vehicles?driver_id=${driverId}&date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setDriverAssignments(Array.isArray(data) ? data : []);
      } else {
        setDriverAssignments([]);
      }
    } catch (err) {
      console.error("Failed to fetch driver assignments", err);
      setDriverAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    if (showEntryModal && selectedDriverId && form.date) {
      fetchDriverAssignments(selectedDriverId, form.date);
      setSelectedAssignment(null);
      setForm(prev => ({...prev, vehicle_id: ""}));
    }
  }, [selectedDriverId, form.date, showEntryModal]);

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
      const payload = {
        admin_user_id: user?.user_id,
        driver_id: Number(selectedDriverId),
        vehicle_id: Number(form.vehicle_id),
        date: form.date,
        start_km: startKm,
        end_km: endKm,
        total_km: endKm - startKm,
        fuel_consumed: form.fuel_consumed ? parseFloat(form.fuel_consumed) : null,
        remarks: form.remarks?.trim() || "",
        vehicle_type: selectedAssignment?.vehicle_type || "",
        shift_id: selectedAssignment?.shift_id || null,
        assignment_id: selectedAssignment?.assignment_id || null,
      };
      const res = await apiPost("/api/admin/km-log/add", payload);
      const data = await res.json();
      if (res.ok) {
        showToast("KM log added successfully", "success");
        resetForm();
        setShowEntryModal(false);
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

  const resetForm = () => {
    setForm({
      date: getToday(),
      vehicle_id: "",
      start_km: "",
      end_km: "",
      fuel_consumed: "",
      remarks: "",
    });
    setSelectedDriverId("");
    setDriverInfo(null);
    setDriverAssignments([]);
    setSelectedAssignment(null);
  };

  const fetchKmLogs = async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams();
      params.set("period", logFilters.period);
      if (logFilters.driverId) params.set("driver_id", logFilters.driverId);
      if (logFilters.vehicleId) params.set("vehicle_id", logFilters.vehicleId);
      if (logFilters.vehicleType)
        params.set("vehicle_type", logFilters.vehicleType);
      if (logFilters.search) params.set("search", logFilters.search);
      if (logFilters.status) params.set("status", logFilters.status);
      const res = await apiGet("/api/admin/km-logs?" + params.toString());
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

  const fetchKmSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("period", summaryFilters.period);
      if (summaryFilters.driverId)
        params.set("driver_id", summaryFilters.driverId);
      if (summaryFilters.vehicleId)
        params.set("vehicle_id", summaryFilters.vehicleId);
      const res = await apiGet("/api/admin/km-summary?" + params.toString());
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
      const res = await apiGet(
        "/api/admin/km-vehicle-summary?" + params.toString(),
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

  const viewDriverHistory = async (driverId) => {
    try {
      setDriverHistoryLoading(true);
      setShowDriverModal(true);
      const res = await apiGet(
        "/api/admin/driver-km-history?driver_id=" + driverId + "&period=all",
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

  const viewVehicleTypeDetails = async (vehicleType) => {
    try {
      setVehicleTypeLoading(true);
      setShowVehicleTypeModal(true);
      setSelectedVehicleType(vehicleType);
      // Get logs for this vehicle type
      const params = new URLSearchParams();
      params.set("period", summaryFilters.period);
      params.set("vehicle_type", vehicleType.vehicle_type);
      const res = await apiGet("/api/admin/km-logs?" + params.toString());
      if (res.ok) {
        const data = await res.json();
        setVehicleTypeLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch vehicle type logs", err);
    } finally {
      setVehicleTypeLoading(false);
    }
  };

  const viewVehicleDetails = async (vehicle) => {
    try {
      setVehicleLoading(true);
      setShowVehicleModal(true);
      setSelectedVehicle(vehicle);
      // Get logs for this vehicle
      const params = new URLSearchParams();
      params.set("period", summaryFilters.period);
      params.set("vehicle_id", vehicle.vehicle_id);
      const res = await apiGet("/api/admin/km-logs?" + params.toString());
      if (res.ok) {
        const data = await res.json();
        setVehicleLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch vehicle logs", err);
    } finally {
      setVehicleLoading(false);
    }
  };

  useEffect(() => {
    loadFilterMeta();
    fetchPendingCount();
  }, []);

  const fetchPendingCount = async () => {
    try {
      const res = await apiGet("/api/admin/km-logs/pending-count");
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch pending count", err);
    }
  };

  const fetchDatewiseTracker = async (date) => {
    try {
      setTrackerLoading(true);
      const res = await apiGet(`/api/admin/km-datewise-tracker?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setTrackerData(data);
      }
    } catch (err) {
      console.error("Failed to fetch datewise tracker", err);
    } finally {
      setTrackerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tracker") {
      fetchDatewiseTracker(trackerDate);
    }
  }, [activeTab, trackerDate]);

  const fetchFuelByVehicle = async () => {
    try {
      setFuelLoading(true);
      const res = await apiGet(`/api/admin/km-logs/fuel-by-vehicle?period=${fuelPeriod}`);
      if (res.ok) {
        const data = await res.json();
        setFuelByVehicle(data.vehicles || []);
        setFuelTotals({
          grand_total_fuel: data.grand_total_fuel || 0,
          grand_total_km: data.grand_total_km || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch fuel by vehicle", err);
    } finally {
      setFuelLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await apiPost("/api/admin/km-log/approve", {
        id,
        admin_user_id: user?.user_id,
      });
      if (res.ok) {
        showToast("KM log approved", "success");
        fetchKmLogs();
        fetchPendingCount();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to approve", "error");
      }
    } catch (err) {
      showToast("Something went wrong", "error");
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Reason for rejection (optional):");
    if (reason === null) return; // cancelled
    try {
      const res = await apiPost("/api/admin/km-log/reject", {
        id,
        admin_user_id: user?.user_id,
        reason: reason || "",
      });
      if (res.ok) {
        showToast("KM log rejected", "success");
        fetchKmLogs();
        fetchPendingCount();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to reject", "error");
      }
    } catch (err) {
      showToast("Something went wrong", "error");
    }
  };

  useEffect(() => {
    fetchKmSummary();
    fetchVehicleSummary();
  }, [summaryFilters]);

  useEffect(() => {
    fetchKmLogs();
  }, [logFilters]);

  useEffect(() => {
    fetchFuelByVehicle();
  }, [fuelPeriod]);

  const totalKm = parseFloat(form.end_km || 0) - parseFloat(form.start_km || 0);
  const summary = kmSummary || {};
  const avgKmPerTrip =
    summary.avg_km_per_trip ??
    (summary.grand_total_trips > 0
      ? summary.grand_total_km / summary.grand_total_trips
      : 0);
  const maxVehicleKm =
    vehicleSummary.length > 0
      ? Math.max(...vehicleSummary.map((v) => v.total_km || 0)) || 1
      : 1;

  const periodOptions = [
    {value: "today", label: "Today"},
    {value: "week", label: "This Week"},
    {value: "month", label: "This Month"},
    {value: "all", label: "All Time"},
  ];

  const driverOptions = [
    {value: "", label: "All Drivers"},
    ...(filterMeta.drivers || []).map((d) => ({
      value: String(d.id),
      label: d.name,
    })),
  ];

  const vehicleFilterOptions = [
    {value: "", label: "All Vehicles"},
    ...(filterMeta.vehicles || []).map((v) => ({
      value: String(v.id),
      label:
        v.vehicle_name && v.vehicle_name !== v.vehicle_number
          ? v.vehicle_name + " (" + v.vehicle_number + ")"
          : v.vehicle_number,
    })),
  ];

  const vehicleTypeOptions = [
    {value: "", label: "All Types"},
    {value: "BUS", label: "Bus"},
    {value: "CAR", label: "Car"},
    {value: "EV", label: "EV"},
    {value: "BATTERY_VEHICLE", label: "Battery Vehicle"},
  ];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Tab Navigation */}
      <div className="inline-flex items-center gap-2 p-1.5 bg-gray-100 rounded-md">
        <button
          onClick={() => {
            setActiveTab("overview");
            setLogFilters((prev) => ({...prev, status: "", period: "today"}));
          }}
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-300 ${
            activeTab === "overview"
              ? "bg-primary text-white shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview & Logs
        </button>
        <button
          onClick={() => {
            setActiveTab("pending");
            setLogFilters((prev) => ({...prev, status: "pending", period: "all"}));
          }}
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-300 relative ${
            activeTab === "pending"
              ? "bg-primary text-white shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Approvals
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red text-white rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("individual")}
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-300 ${
            activeTab === "individual"
              ? "bg-primary text-white shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <User className="w-4 h-4" />
          Individual Analysis
        </button>
        <button
          onClick={() => setActiveTab("tracker")}
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-300 ${
            activeTab === "tracker"
              ? "bg-primary text-white shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Date-wise Tracker
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                label: "Total Distance",
                value: formatNumber(summary.grand_total_km, 1) + " km",
                icon: Map,
                color: "bg-primary/10 text-primary",
              },
              {
                label: "Total Trips",
                value: summary.grand_total_trips || 0,
                icon: Route,
                color: "bg-green-50 text-green-600",
              },
              {
                label: "Avg / Trip",
                value: formatNumber(avgKmPerTrip, 1) + " km",
                icon: TrendingUp,
                color: "bg-amber-50 text-amber-600",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                      {stat.label}
                    </p>
                    <h3 className="text-2xl font-extrabold text-primarytext">
                      {stat.value}
                    </h3>
                  </div>
                  <div className={"p-3 rounded-md shadow-sm " + stat.color}>
                    <stat.icon size={24} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fuel Consumption by Vehicle (Non-EV) */}
          <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-primarybg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-primarytext text-sm flex items-center gap-2">
                <Fuel size={16} className="text-pending" />
                Fuel Consumption by Vehicle
                <span className="text-xs font-normal text-secondarytext">(Excludes EVs)</span>
              </h3>
              <div className="flex items-center gap-2">
                {fuelTotals.grand_total_fuel > 0 && (
                  <span className="text-xs bg-pending/10 text-pending font-bold px-2 py-1 rounded-md">
                    Total: {fuelTotals.grand_total_fuel.toFixed(1)} L
                  </span>
                )}
                <CustomDropdown
                  value={fuelPeriod}
                  onChange={setFuelPeriod}
                  options={[
                    {value: "today", label: "Today"},
                    {value: "week", label: "This Week"},
                    {value: "month", label: "This Month"},
                    {value: "year", label: "This Year"},
                  ]}
                  placeholder="Period"
                  width="w-36"
                />
              </div>
            </div>
            {fuelLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : fuelByVehicle.length === 0 ? (
              <div className="py-10 text-center text-secondarytext text-sm">
                No fuel consumption data for this period.
              </div>
            ) : (
              <div className="divide-y divide-primarybg">
                {fuelByVehicle.map((v) => {
                  const maxFuel = fuelByVehicle[0]?.total_fuel || 1;
                  const barWidth = Math.max((v.total_fuel / maxFuel) * 100, 4);
                  return (
                    <div key={v.vehicle_id} className="px-5 py-3 flex items-center gap-4 hover:bg-primarybg/50 transition-colors">
                      <div className="flex-shrink-0 w-44">
                        <p className="text-sm font-bold text-primarytext truncate">{v.vehicle_name}</p>
                        <p className="text-[11px] text-secondarytext">{v.vehicle_number} &middot; {v.fuel_type}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-5 bg-primarybg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pending/80 to-pending rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{width: `${barWidth}%`}}
                          >
                            {barWidth > 20 && (
                              <span className="text-[10px] font-bold text-white">{v.total_fuel.toFixed(1)} L</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right w-28 space-y-0.5">
                        <p className="text-sm font-bold text-pending">{v.total_fuel.toFixed(1)} L</p>
                        <p className="text-[11px] text-secondarytext">
                          {v.trip_count} trip{v.trip_count !== 1 ? "s" : ""} &middot; {v.mileage.toFixed(1)} km/L
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
              <CustomSearch
                value={logFilters.search}
                onChange={(val) =>
                  setLogFilters((prev) => ({...prev, search: val}))
                }
                placeholder="Search by driver, vehicle..."
                className="flex-1 sm:w-72"
              />
              <CustomDropdown
                value={logFilters.period}
                onChange={(val) =>
                  setLogFilters((prev) => ({...prev, period: val}))
                }
                options={periodOptions}
                placeholder="Period"
                width="w-36"
              />
              <CustomSearchableDropdown
                value={logFilters.driverId}
                onChange={(val) =>
                  setLogFilters((prev) => ({...prev, driverId: val}))
                }
                options={driverOptions}
                placeholder="All Drivers"
                searchPlaceholder="Search drivers..."
                width="w-56"
              />
              <CustomSearchableDropdown
                value={logFilters.vehicleId}
                onChange={(val) =>
                  setLogFilters((prev) => ({...prev, vehicleId: val}))
                }
                options={vehicleFilterOptions}
                placeholder="All Vehicles"
                searchPlaceholder="Search vehicles..."
                width="w-56"
              />
              <CustomDropdown
                value={logFilters.vehicleType}
                onChange={(val) =>
                  setLogFilters((prev) => ({...prev, vehicleType: val}))
                }
                options={vehicleTypeOptions}
                placeholder="All Types"
                width="w-40"
              />
            </div>
            <button
              onClick={() => setShowEntryModal(true)}
              className="bg-primary hover:bg-primarydull text-secondarybg px-6 py-3 rounded-md flex items-center gap-2 shadow-lg shadow-primary/30 transition-all duration-300 text-sm font-bold hover:scale-105 whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={2.5} /> KM Log Entry
            </button>
          </div>

          {/* KM Logs Table */}
          <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {logsLoading ? (
                <Loading fullScreen={false} />
              ) : logs.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primarybg">
                      <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Start KM
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        End KM
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Total KM
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Fuel (L)
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primarybg">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`hover:bg-primarybg transition-colors ${log.status === "pending" ? "bg-pending/5" : ""}`}
                      >
                        <td className="py-3 px-4 text-sm text-primarytext">
                          {log.date}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-primarytext">
                          {log.driver_name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-secondarytext">
                              {getVehicleIcon(log.vehicle_type)}
                            </span>
                            <div>
                              <p className="text-sm text-primarytext font-medium">
                                {log.vehicle_name &&
                                log.vehicle_name !== log.vehicle_number
                                  ? log.vehicle_name
                                  : log.vehicle_number}
                              </p>
                              {log.vehicle_name &&
                                log.vehicle_name !== log.vehicle_number && (
                                  <p className="text-xs text-secondarytext">
                                    {log.vehicle_number}
                                  </p>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-secondarytext">
                          {formatNumber(log.start_km)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-secondarytext">
                          {formatNumber(log.end_km)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-primary">
                            {formatNumber(log.total_km)} km
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-secondarytext">
                          {log.fuel_consumed != null ? (
                            <span className="font-medium text-primarytext">{formatNumber(log.fuel_consumed)} L</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {log.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleApprove(log.id)}
                                title="Approve"
                                className="p-1.5 rounded-md bg-green/10 text-green hover:bg-green/20 transition-colors"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleReject(log.id)}
                                title="Reject"
                                className="p-1.5 rounded-md bg-red/10 text-red hover:bg-red/20 transition-colors"
                              >
                                <XCircle size={14} />
                              </button>
                              <span className="text-[10px] font-bold text-pending bg-pending/10 px-1.5 py-0.5 rounded">
                                PENDING
                              </span>
                            </div>
                          ) : log.status === "rejected" ? (
                            <span className="text-[10px] font-bold text-red bg-red/10 px-2 py-0.5 rounded">
                              REJECTED
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-green bg-green/10 px-2 py-0.5 rounded">
                              APPROVED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-secondarytext max-w-[200px] truncate">
                          {log.remarks || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 flex flex-col items-center text-secondarytext">
                  <FileText size={48} className="mb-3 opacity-20" />
                  <p className="font-medium">No logs found</p>
                  <p className="text-sm mt-1">
                    Try adjusting the filters or add a new entry
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* KM Log Entry Modal */}
          {showEntryModal && (
            <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-md">
                      <Plus size={20} className="text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-primarytext">
                      Add KM Log Entry
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowEntryModal(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-primarybg rounded-md transition-colors"
                  >
                    <X size={20} className="text-secondarytext" />
                  </button>
                </div>

                {/* Modal Body */}
                <form
                  onSubmit={handleSubmit}
                  className="flex-1 overflow-y-auto p-6 space-y-5"
                >
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primarytext">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((prev) => ({...prev, date: e.target.value}))
                      }
                      max={getToday()}
                      className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                      required
                    />
                  </div>

                  {/* Driver */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primarytext">
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

                  {/* Driver Info */}
                  {driverInfo && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-md border border-primary/10">
                      <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
                        {driverInfo.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primarytext">
                          {driverInfo.name}
                        </p>
                        {driverInfo.cluster && (
                          <p className="text-xs text-secondarytext">
                            Cluster: {driverInfo.cluster}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assignment (Vehicle + Shift) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primarytext">
                      Assignment <span className="text-red-500">*</span>
                    </label>
                    {!selectedDriverId ? (
                      <p className="text-xs text-secondarytext italic py-2">Select a driver first</p>
                    ) : assignmentsLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-secondarytext">Loading assignments...</span>
                      </div>
                    ) : driverAssignments.length === 0 ? (
                      <p className="text-xs text-secondarytext italic py-2">No active assignments for this driver on selected date</p>
                    ) : (
                      <div className="space-y-2">
                        {driverAssignments.map((a) => {
                          const isSelected = selectedAssignment?.vehicle_id === a.vehicle_id && 
                            selectedAssignment?.shift_name === (a.shift_name || '');
                          return (
                            <button
                              key={`${a.vehicle_id}-${a.shift_name || ''}`}
                              type="button"
                              onClick={() => {
                                setSelectedAssignment(a);
                                setForm(prev => ({...prev, vehicle_id: String(a.vehicle_id)}));
                              }}
                              className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                  : "border-gray-200 bg-primarybg hover:border-primary/40"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary"
                              }`}>
                                {getVehicleIcon(a.vehicle_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-primarytext">{a.vehicle_number}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{a.vehicle_type}</span>
                                  {a.shift_name && (
                                    <span className="text-[10px] bg-pending/10 text-pending px-1.5 py-0.5 rounded-full">{a.shift_name}</span>
                                  )}
                                  {a.start_time && a.end_time && (
                                    <span className="text-[10px] text-secondarytext">{a.start_time} - {a.end_time}</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* KM Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-primarytext">
                        Start KM <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.start_km}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            start_km: e.target.value,
                          }))
                        }
                        className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                        placeholder="0.0"
                        required
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-primarytext">
                        End KM <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.end_km}
                        onChange={(e) =>
                          setForm((prev) => ({...prev, end_km: e.target.value}))
                        }
                        className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                        placeholder="0.0"
                        required
                        min={form.start_km || "0"}
                        step="0.1"
                      />
                    </div>
                  </div>

                  {/* Total KM Display */}
                  {totalKm > 0 && (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-md border border-green-100">
                      <span className="text-sm font-medium text-green-700">
                        Total Distance
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        {totalKm.toFixed(1)} km
                      </span>
                    </div>
                  )}

                  {/* Fuel Consumed */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primarytext">
                      Fuel Consumed{" "}
                      <span className="text-secondarytext font-normal">
                        (Optional, in Liters)
                      </span>
                    </label>
                    <input
                      type="number"
                      value={form.fuel_consumed}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fuel_consumed: e.target.value,
                        }))
                      }
                      className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                      placeholder="0.0"
                      min="0"
                      step="0.1"
                    />
                    {form.fuel_consumed && totalKm > 0 && (
                      <p className="text-xs text-secondarytext mt-0.5">
                        Mileage: <span className="font-bold text-primary">{(totalKm / parseFloat(form.fuel_consumed)).toFixed(1)} km/L</span>
                      </p>
                    )}
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primarytext">
                      Remarks{" "}
                      <span className="text-secondarytext font-normal">
                        (Optional)
                      </span>
                    </label>
                    <textarea
                      value={form.remarks}
                      onChange={(e) =>
                        setForm((prev) => ({...prev, remarks: e.target.value}))
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                      rows="2"
                      placeholder="Add any notes..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-primarybg">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEntryModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2.5 border border-gray-200 text-secondarytext rounded-md hover:bg-primarybg font-medium text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primarydull disabled:opacity-50 font-medium text-sm shadow-sm transition-all"
                    >
                      {loading ? (
                        <>
                          <Loading fullScreen={false} size="small" /> Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Add Log
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primarytext flex items-center gap-2">
              <Clock className="w-5 h-5 text-pending" />
              Pending KM Log Approvals
              {pendingCount > 0 && (
                <span className="text-sm font-medium text-pending">({pendingCount})</span>
              )}
            </h2>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-secondarytext">
              <Check className="w-12 h-12 mb-3 text-green" />
              <p className="text-lg font-semibold">All caught up!</p>
              <p className="text-sm">No pending KM log approvals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-secondarybg border border-pending/30 rounded-md p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-primarytext">
                          {log.driver_name}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-customblue/10 text-customblue rounded-full font-medium">
                          {log.vehicle_number}
                        </span>
                        <span className="text-xs text-secondarytext">
                          {new Date(log.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-secondarytext">
                        <span>
                          Start: <strong className="text-primarytext">{parseFloat(log.start_km).toLocaleString()} km</strong>
                        </span>
                        <span>
                          End: <strong className="text-primarytext">{parseFloat(log.end_km).toLocaleString()} km</strong>
                        </span>
                        <span className="text-primary font-semibold">
                          Total: {parseFloat(log.total_km).toFixed(1)} km
                        </span>
                        {log.fuel_consumed && (
                          <span className="text-pending font-semibold flex items-center gap-1">
                            <Fuel className="w-3.5 h-3.5" />
                            {parseFloat(log.fuel_consumed).toFixed(1)} L
                          </span>
                        )}
                      </div>
                      {log.remarks && (
                        <p className="text-xs text-secondarytext italic">"{log.remarks}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(log.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-green text-white text-sm font-medium rounded-md hover:bg-green/90 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(log.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-red text-white text-sm font-medium rounded-md hover:bg-red/90 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Individual Analysis Tab */}
      {activeTab === "individual" && (
        <div className="space-y-6">
          {/* Filters for Individual Analysis */}
          <div className="bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <CustomDropdown
                value={summaryFilters.period}
                onChange={(val) =>
                  setSummaryFilters((prev) => ({...prev, period: val}))
                }
                options={periodOptions}
                placeholder="Period"
                width="w-36"
              />
              <CustomSearchableDropdown
                value={summaryFilters.driverId}
                onChange={(val) =>
                  setSummaryFilters((prev) => ({...prev, driverId: val}))
                }
                options={driverOptions}
                placeholder="All Drivers"
                searchPlaceholder="Search drivers..."
                width="w-64"
              />
              <CustomSearchableDropdown
                value={summaryFilters.vehicleId}
                onChange={(val) =>
                  setSummaryFilters((prev) => ({...prev, vehicleId: val}))
                }
                options={vehicleFilterOptions}
                placeholder="All Vehicles"
                searchPlaceholder="Search vehicles..."
                width="w-64"
              />
            </div>
          </div>

          {/* Distance by Vehicle Type & Top Drivers Row */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Distance by Vehicle Type */}
            <div className="xl:col-span-3 bg-secondarybg rounded-md border border-primarybg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Truck className="text-primary" size={20} />
                <h3 className="text-lg font-bold text-primarytext">
                  Distance by Vehicle Type
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {summary.by_vehicle_type?.map((type) => {
                  const totalKm = summary.grand_total_km || 1;
                  const percentage = ((type.total_km / totalKm) * 100).toFixed(
                    1,
                  );
                  return (
                    <div
                      key={type.vehicle_type}
                      className="bg-primarybg p-5 rounded-md border border-gray-100 hover:border-primary/50 hover:shadow-sm transition-all duration-200 cursor-pointer group"
                      onClick={() => viewVehicleTypeDetails(type)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-secondarybg rounded-md border border-gray-100 text-secondarytext group-hover:text-primary transition-colors">
                          {getVehicleIcon(type.vehicle_type)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                            {percentage}%
                          </span>
                          <ChevronRight
                            size={16}
                            className="text-secondarytext group-hover:text-primary transition-colors"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-secondarytext font-semibold uppercase tracking-wide mb-1">
                        {type.vehicle_type}
                      </p>
                      <p className="text-primarytext mb-1">
                        <span className="text-2xl font-bold">
                          {formatNumber(type.total_km)}
                        </span>
                        <span className="text-base font-medium ml-1">km</span>
                      </p>
                      <p className="text-xs text-secondarytext">
                        {type.total_trips} trips •{" "}
                        {formatNumber(type.avg_km_per_trip)} km/trip
                      </p>
                      <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{width: percentage + "%"}}
                        />
                      </div>
                    </div>
                  );
                }) || (
                  <p className="text-secondarytext text-center py-8 col-span-2">
                    No vehicle type data available
                  </p>
                )}
              </div>
            </div>

            {/* Top Drivers */}
            <div className="xl:col-span-2 bg-secondarybg rounded-md border border-primarybg shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Award className="text-amber-500" size={20} />
                  <h3 className="text-lg font-bold text-primarytext">
                    Top Drivers
                  </h3>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="space-y-3 h-full max-h-[650px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 transition-colors">
                  {summary.top_drivers
                    ?.filter((driver) =>
                      driver.driver_name
                        .toLowerCase()
                        .includes(driverSearch.toLowerCase()),
                    )
                    .map((driver, idx) => (
                      <div
                        key={driver.driver_id}
                        className="flex items-center gap-4 p-4 bg-primarybg rounded-md border border-gray-100 hover:border-primary/50 hover:shadow-sm transition-all duration-200 cursor-pointer group"
                        onClick={() => viewDriverHistory(driver.driver_id)}
                      >
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-md font-bold text-sm ${
                            idx === 0
                              ? "bg-amber-100 text-amber-600"
                              : idx === 1
                                ? "bg-gray-200 text-gray-600"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-600"
                                  : "bg-gray-100 text-secondarytext"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-primarytext text-sm truncate">
                            {driver.driver_name}
                          </p>
                          <p className="text-xs text-secondarytext">
                            {driver.trips || 0} trips
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            {formatNumber(driver.total_km)} km
                          </p>
                          <p className="text-xs text-secondarytext">
                            {driver.trips > 0
                              ? formatNumber(driver.total_km / driver.trips)
                              : 0}{" "}
                            avg
                          </p>
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-secondarytext group-hover:text-primary transition-colors"
                        />
                      </div>
                    )) || (
                    <p className="text-secondarytext text-center py-8">
                      No driver data available
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle-wise Analysis - Table Format */}
          <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Gauge className="text-primary" size={20} />
                <h3 className="text-lg font-bold text-primarytext">
                  Distance by Individual Vehicles
                </h3>
              </div>
              <CustomSearch
                value={vehicleSearch}
                onChange={setVehicleSearch}
                placeholder="Search vehicles..."
                className="max-w-xs"
              />
            </div>
            {vehicleSummaryLoading ? (
              <Loading fullScreen={false} />
            ) : vehicleSummary.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primarybg">
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
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primarybg">
                    {vehicleSummary
                      .filter((vehicle) => {
                        const searchLower = vehicleSearch.toLowerCase();
                        return (
                          vehicle.vehicle_name
                            ?.toLowerCase()
                            .includes(searchLower) ||
                          vehicle.vehicle_number
                            ?.toLowerCase()
                            .includes(searchLower) ||
                          vehicle.vehicle_type
                            ?.toLowerCase()
                            .includes(searchLower)
                        );
                      })
                      .map((vehicle) => {
                        const percentage =
                          ((vehicle.total_km || 0) / maxVehicleKm) * 100;
                        return (
                          <tr
                            key={vehicle.vehicle_id}
                            className="hover:bg-primarybg transition-colors cursor-pointer"
                            onClick={() => viewVehicleDetails(vehicle)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                                  {getVehicleIcon(vehicle.vehicle_type)}
                                </div>
                                <div>
                                  <p className="font-semibold text-primarytext text-sm">
                                    {vehicle.vehicle_name &&
                                    vehicle.vehicle_name !==
                                      vehicle.vehicle_number
                                      ? vehicle.vehicle_name
                                      : vehicle.vehicle_number}
                                  </p>
                                  {vehicle.vehicle_name &&
                                    vehicle.vehicle_name !==
                                      vehicle.vehicle_number && (
                                      <p className="text-xs text-secondarytext">
                                        {vehicle.vehicle_number}
                                      </p>
                                    )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary uppercase">
                                {vehicle.vehicle_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-bold text-primarytext">
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
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-primarybg rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{width: percentage.toFixed(0) + "%"}}
                                  />
                                </div>
                                <span className="text-xs text-secondarytext font-medium min-w-12 text-right">
                                  {percentage.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <ChevronRight
                                size={18}
                                className="text-secondarytext"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-secondarytext text-center py-8">
                No vehicle data available
              </p>
            )}
          </div>
        </div>
      )}

      {/* Date-wise Tracker Tab */}
      {activeTab === "tracker" && (
        <div className="space-y-4">
          {/* Date Picker & Summary */}
          <div className="bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primarytext">Date:</span>
                <input
                  type="date"
                  value={trackerDate}
                  onChange={(e) => setTrackerDate(e.target.value)}
                  className="px-3 py-2 text-sm rounded-md border border-primarybg bg-primarybg text-primarytext focus:ring-2 focus:ring-primary/30 outline-none"
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const d = new Date(trackerDate);
                    d.setDate(d.getDate() - 1);
                    setTrackerDate(d.toISOString().split("T")[0]);
                  }}
                  className="px-3 py-2 text-sm rounded-md bg-primarybg text-secondarytext hover:bg-primary/10 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setTrackerDate(getToday())}
                  className="px-3 py-2 text-sm rounded-md bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const d = new Date(trackerDate);
                    d.setDate(d.getDate() + 1);
                    setTrackerDate(d.toISOString().split("T")[0]);
                  }}
                  className="px-3 py-2 text-sm rounded-md bg-primarybg text-secondarytext hover:bg-primary/10 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Summary Badges */}
            {trackerData && (
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => setTrackerFilter("all")}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    trackerFilter === "all"
                      ? "bg-primary text-white"
                      : "bg-primarybg text-secondarytext hover:bg-primary/10"
                  }`}
                >
                  All Assignments
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-white/20">
                    {trackerData.total_assignments}
                  </span>
                </button>
                <button
                  onClick={() => setTrackerFilter("entered")}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    trackerFilter === "entered"
                      ? "bg-customgreen text-white"
                      : "bg-customgreen/10 text-customgreen hover:bg-customgreen/20"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 inline mr-1" />
                  Entered
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-white/20">
                    {trackerData.entered_count}
                  </span>
                </button>
                <button
                  onClick={() => setTrackerFilter("pending")}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    trackerFilter === "pending"
                      ? "bg-red text-white"
                      : "bg-red/10 text-red hover:bg-red/20"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                  Not Entered
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-white/20">
                    {trackerData.pending_count}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Tracker Table */}
          <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
            {trackerLoading ? (
              <div className="flex justify-center py-12">
                <Loading fullScreen={false} />
              </div>
            ) : !trackerData || trackerData.assignments.length === 0 ? (
              <div className="text-center py-12 text-secondarytext">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No active assignments for this date</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primarybg text-xs text-secondarytext uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Driver</th>
                    <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold">Shift</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Start KM</th>
                    <th className="px-4 py-3 text-right font-semibold">End KM</th>
                    <th className="px-4 py-3 text-right font-semibold">Total KM</th>
                    <th className="px-4 py-3 text-center font-semibold">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primarybg">
                  {trackerData.assignments
                    .filter((a) => {
                      if (trackerFilter === "entered") return a.km_entered;
                      if (trackerFilter === "pending") return !a.km_entered;
                      return true;
                    })
                    .map((a) => (
                      <tr
                        key={a.assignment_id}
                        className={`transition-colors ${
                          a.km_entered
                            ? "hover:bg-customgreen/5"
                            : "bg-red/5 hover:bg-red/10"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="font-medium text-primarytext">{a.driver_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(a.vehicle_type)}
                            <span className="text-primarytext">{a.vehicle_number}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {a.vehicle_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-secondarytext">
                          {a.shift_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.km_entered ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-customgreen bg-customgreen/10 px-2.5 py-1 rounded-full">
                              <Check className="w-3 h-3" /> Entered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red bg-red/10 px-2.5 py-1 rounded-full">
                              <XCircle className="w-3 h-3" /> Not Entered
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-primarytext">
                          {a.km_entered ? formatNumber(a.start_km, 1) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-primarytext">
                          {a.km_entered ? formatNumber(a.end_km, 1) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-primarytext">
                          {a.km_entered ? formatNumber(a.total_km, 1) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.km_entered ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                a.km_status === "approved"
                                  ? "bg-customgreen/10 text-customgreen"
                                  : "bg-pending/10 text-pending"
                              }`}
                            >
                              {a.km_status === "approved" ? "Approved" : "Pending"}
                            </span>
                          ) : (
                            <span className="text-secondarytext">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Driver History Modal - Outside tabs so it works from any tab */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">
                    {driverHistoryLoading
                      ? "Loading..."
                      : selectedDriverHistory?.driver_name || "Driver"}{" "}
                    — KM History
                  </h2>
                  {selectedDriverHistory?.cluster_name && (
                    <p className="text-xs text-secondarytext mt-0.5">
                      Cluster: {selectedDriverHistory.cluster_name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDriverModal(false);
                  setSelectedDriverHistory(null);
                }}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {driverHistoryLoading ? (
                <Loading fullScreen={false} />
              ) : selectedDriverHistory ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Total KM",
                        value:
                          formatNumber(selectedDriverHistory.total_km) + " km",
                        highlight: true,
                      },
                      {
                        label: "Total Trips",
                        value: selectedDriverHistory.total_trips || 0,
                      },
                      {
                        label: "Avg per Trip",
                        value:
                          formatNumber(selectedDriverHistory.avg_km_per_trip) +
                          " km",
                      },
                      {
                        label: "Vehicles Driven",
                        value: selectedDriverHistory.by_vehicle?.length || 0,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-primarybg rounded-md p-4 text-center"
                      >
                        <p className="text-xs text-secondarytext uppercase font-semibold tracking-wide">
                          {s.label}
                        </p>
                        <p
                          className={
                            "text-2xl font-bold mt-1 " +
                            (s.highlight ? "text-primary" : "text-primarytext")
                          }
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Date Range */}
                  {(selectedDriverHistory.first_date ||
                    selectedDriverHistory.last_date) && (
                    <div className="flex items-center justify-center gap-2 text-sm text-secondarytext bg-primarybg rounded-md py-2 px-4">
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
                      <h3 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                        <Truck size={16} className="text-primary" />
                        Vehicles Driven
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedDriverHistory.by_vehicle.map((v, idx) => (
                          <div
                            key={v.vehicle_id || idx}
                            className="flex items-center gap-3 p-3 bg-primarybg rounded-md border border-gray-100"
                          >
                            <div className="p-2 bg-secondarybg rounded-md shadow-sm text-secondarytext">
                              {getVehicleIcon(v.vehicle_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-primarytext text-sm truncate">
                                {v.vehicle_name &&
                                v.vehicle_name !== v.vehicle_number
                                  ? v.vehicle_name
                                  : v.vehicle_number}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-secondarytext">
                                {v.vehicle_name &&
                                  v.vehicle_name !== v.vehicle_number && (
                                    <span>{v.vehicle_number}</span>
                                  )}
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                  {v.vehicle_type}
                                </span>
                                <span>{v.total_trips || 0} trips</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary text-sm">
                                {formatNumber(v.total_km)} km
                              </p>
                              <p className="text-xs text-secondarytext">
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
                      <h3 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        Recent KM Logs
                      </h3>
                      <div className="overflow-x-auto rounded-md border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-primarybg">
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Date
                              </th>
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Vehicle
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Start
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                End
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primarybg">
                            {selectedDriverHistory.recent_logs.map(
                              (log, idx) => (
                                <tr
                                  key={log.id || idx}
                                  className="hover:bg-primarybg transition-colors"
                                >
                                  <td className="py-2.5 px-3 text-primarytext font-medium">
                                    {log.date}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-secondarytext">
                                        {getVehicleIcon(log.vehicle_type)}
                                      </span>
                                      <div>
                                        <p className="text-primarytext font-medium text-sm">
                                          {log.vehicle_name &&
                                          log.vehicle_name !==
                                            log.vehicle_number
                                            ? log.vehicle_name
                                            : log.vehicle_number}
                                        </p>
                                        {log.vehicle_name &&
                                          log.vehicle_name !==
                                            log.vehicle_number && (
                                            <p className="text-xs text-secondarytext">
                                              {log.vehicle_number}
                                            </p>
                                          )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-secondarytext">
                                    {formatNumber(log.start_km)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-secondarytext">
                                    {formatNumber(log.end_km)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-primary">
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
                      <h3 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary" />
                        Monthly Trends
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {selectedDriverHistory.monthly_trends.map((m, idx) => (
                          <div
                            key={m.month || idx}
                            className="bg-primarybg rounded-md px-4 py-3 text-center min-w-24"
                          >
                            <p className="text-xs text-secondarytext font-medium">
                              {m.month}
                            </p>
                            <p className="text-lg font-bold text-primary">
                              {formatNumber(m.total_km)}
                            </p>
                            <p className="text-xs text-secondarytext">
                              {m.trips} trips
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-secondarytext">
                  <AlertCircle size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No history data available</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-primarybg flex justify-end">
              <button
                onClick={() => {
                  setShowDriverModal(false);
                  setSelectedDriverHistory(null);
                }}
                className="px-5 py-2.5 bg-primary text-white rounded-md font-medium hover:bg-primarydull transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Detail Modal */}
      {showVehicleTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  {selectedVehicleType &&
                    getVehicleIcon(selectedVehicleType.vehicle_type)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">
                    {selectedVehicleType?.vehicle_type || "Vehicle Type"} — KM
                    Details
                  </h2>
                  <p className="text-xs text-secondarytext mt-0.5">
                    All trips for this vehicle type
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVehicleTypeModal(false);
                  setSelectedVehicleType(null);
                  setVehicleTypeLogs([]);
                }}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {vehicleTypeLoading ? (
                <Loading fullScreen={false} />
              ) : selectedVehicleType ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Total KM",
                        value:
                          formatNumber(selectedVehicleType.total_km) + " km",
                        highlight: true,
                      },
                      {
                        label: "Total Trips",
                        value: selectedVehicleType.total_trips || 0,
                      },
                      {
                        label: "Avg per Trip",
                        value:
                          formatNumber(selectedVehicleType.avg_km_per_trip) +
                          " km",
                      },
                      {
                        label: "Share",
                        value:
                          (
                            (selectedVehicleType.total_km /
                              (summary.grand_total_km || 1)) *
                            100
                          ).toFixed(1) + "%",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-primarybg rounded-md p-4 text-center"
                      >
                        <p className="text-xs text-secondarytext uppercase font-semibold tracking-wide">
                          {s.label}
                        </p>
                        <p
                          className={
                            "text-2xl font-bold mt-1 " +
                            (s.highlight ? "text-primary" : "text-primarytext")
                          }
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Recent Logs */}
                  {vehicleTypeLogs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        KM Logs ({vehicleTypeLogs.length})
                      </h3>
                      <div className="overflow-x-auto rounded-md border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-primarybg">
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Date
                              </th>
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Driver
                              </th>
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Vehicle
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Start
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                End
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primarybg">
                            {vehicleTypeLogs.slice(0, 50).map((log, idx) => (
                              <tr
                                key={log.id || idx}
                                className="hover:bg-primarybg transition-colors"
                              >
                                <td className="py-2.5 px-3 text-primarytext font-medium">
                                  {log.date}
                                </td>
                                <td className="py-2.5 px-3 text-primarytext">
                                  {log.driver_name}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-secondarytext">
                                      {getVehicleIcon(log.vehicle_type)}
                                    </span>
                                    <div>
                                      <p className="text-primarytext text-sm">
                                        {log.vehicle_name &&
                                        log.vehicle_name !== log.vehicle_number
                                          ? log.vehicle_name
                                          : log.vehicle_number}
                                      </p>
                                      {log.vehicle_name &&
                                        log.vehicle_name !==
                                          log.vehicle_number && (
                                          <p className="text-xs text-secondarytext">
                                            {log.vehicle_number}
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right text-secondarytext">
                                  {formatNumber(log.start_km)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-secondarytext">
                                  {formatNumber(log.end_km)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-primary">
                                  {formatNumber(log.total_km)} km
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {vehicleTypeLogs.length === 0 && (
                    <div className="py-12 text-center text-secondarytext">
                      <FileText size={48} className="mx-auto mb-2 opacity-30" />
                      <p>No logs found for this vehicle type</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-secondarytext">
                  <AlertCircle size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No data available</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-primarybg flex justify-end">
              <button
                onClick={() => {
                  setShowVehicleTypeModal(false);
                  setSelectedVehicleType(null);
                  setVehicleTypeLogs([]);
                }}
                className="px-5 py-2.5 bg-primary text-white rounded-md font-medium hover:bg-primarydull transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Vehicle Detail Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  {selectedVehicle &&
                    getVehicleIcon(selectedVehicle.vehicle_type)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">
                    {selectedVehicle?.vehicle_name &&
                    selectedVehicle?.vehicle_name !==
                      selectedVehicle?.vehicle_number
                      ? selectedVehicle.vehicle_name
                      : selectedVehicle?.vehicle_number || "Vehicle"}{" "}
                    — KM Details
                  </h2>
                  {selectedVehicle?.vehicle_name &&
                    selectedVehicle?.vehicle_name !==
                      selectedVehicle?.vehicle_number && (
                      <p className="text-xs text-secondarytext mt-0.5">
                        {selectedVehicle.vehicle_number} •{" "}
                        {selectedVehicle.vehicle_type}
                      </p>
                    )}
                  {(!selectedVehicle?.vehicle_name ||
                    selectedVehicle?.vehicle_name ===
                      selectedVehicle?.vehicle_number) && (
                    <p className="text-xs text-secondarytext mt-0.5">
                      {selectedVehicle?.vehicle_type}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVehicleModal(false);
                  setSelectedVehicle(null);
                  setVehicleLogs([]);
                }}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {vehicleLoading ? (
                <Loading fullScreen={false} />
              ) : selectedVehicle ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Total KM",
                        value: formatNumber(selectedVehicle.total_km) + " km",
                        highlight: true,
                      },
                      {
                        label: "Total Trips",
                        value: selectedVehicle.total_trips || 0,
                      },
                      {
                        label: "Avg per Trip",
                        value:
                          formatNumber(selectedVehicle.avg_km_per_trip) + " km",
                      },
                      {
                        label: "Vehicle Type",
                        value: selectedVehicle.vehicle_type,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-primarybg rounded-md p-4 text-center"
                      >
                        <p className="text-xs text-secondarytext uppercase font-semibold tracking-wide">
                          {s.label}
                        </p>
                        <p
                          className={
                            "text-2xl font-bold mt-1 " +
                            (s.highlight ? "text-primary" : "text-primarytext")
                          }
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Logs */}
                  {vehicleLogs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        KM Logs ({vehicleLogs.length})
                      </h3>
                      <div className="overflow-x-auto rounded-md border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-primarybg">
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Date
                              </th>
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Driver
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Start KM
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                End KM
                              </th>
                              <th className="text-right py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Total
                              </th>
                              <th className="text-left py-2.5 px-3 text-xs font-semibold text-secondarytext">
                                Remarks
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primarybg">
                            {vehicleLogs.slice(0, 50).map((log, idx) => (
                              <tr
                                key={log.id || idx}
                                className="hover:bg-primarybg transition-colors"
                              >
                                <td className="py-2.5 px-3 text-primarytext font-medium">
                                  {log.date}
                                </td>
                                <td className="py-2.5 px-3 text-primarytext">
                                  {log.driver_name}
                                </td>
                                <td className="py-2.5 px-3 text-right text-secondarytext">
                                  {formatNumber(log.start_km)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-secondarytext">
                                  {formatNumber(log.end_km)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-primary">
                                  {formatNumber(log.total_km)} km
                                </td>
                                <td className="py-2.5 px-3 text-secondarytext text-sm max-w-40 truncate">
                                  {log.remarks || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {vehicleLogs.length === 0 && (
                    <div className="py-12 text-center text-secondarytext">
                      <FileText size={48} className="mx-auto mb-2 opacity-30" />
                      <p>No logs found for this vehicle</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-secondarytext">
                  <AlertCircle size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No data available</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-primarybg flex justify-end">
              <button
                onClick={() => {
                  setShowVehicleModal(false);
                  setSelectedVehicle(null);
                  setVehicleLogs([]);
                }}
                className="px-5 py-2.5 bg-primary text-white rounded-md font-medium hover:bg-primarydull transition-colors text-sm"
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
