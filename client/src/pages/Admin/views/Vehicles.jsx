import React, {useState, useEffect, useRef} from "react";
import {useSearchParams} from "react-router-dom";
import Loading from "../../../components/ui/Loading";
import {showError, showSuccess, showConfirm} from "../../../utils/swal";
import {
  Car,
  Bus,
  Truck,
  Zap,
  Fuel,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  XCircle,
  Trash2,
  Edit2,
  Search,
  Filter,
  Shield,
  FileCheck,
  FileText,
  Calendar,
  Save,
  ChevronDown,
  Wrench,
  RefreshCw,
  Clock,
  History,
  MessageSquare,
  User,
} from "lucide-react";

import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  fetchVehicleTypes,
  toVehicleTypeLabel,
} from "../../../utils/vehicleTypes";

// Parse dd-mm-yyyy date format from backend
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

// Helper to calculate days until expiry
const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDate(dateStr);
  if (!expiry || isNaN(expiry)) return null;
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};

// Get status color based on days remaining
const getStatusColor = (days) => {
  if (days === null) return "bg-primarybg text-secondarytext";
  if (days < 0) return "bg-red text-secondarybg"; // Expired
  if (days <= 30) return "bg-red/10 text-red"; // Critical
  if (days <= 90) return "bg-pending/10 text-pending"; // Warning
  return "bg-green/10 text-green"; // OK
};

// Display date from backend (already in dd-mm-yyyy format)
const formatDate = (dateStr) => dateStr || "-";

const vehicleTypeIcon = (type) => {
  switch ((type || "").toUpperCase()) {
    case "BUS":
      return Bus;
    case "CAR":
      return Car;
    case "BATTERY_VEHICLE":
      return Zap;
    default:
      return Truck;
  }
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrZero = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildVehiclePayload = (source, id = null) => {
  const payload = {
    ...source,
    seating_capacity: toIntegerOrZero(source.seating_capacity),
    insurance_amount: toNullableNumber(source.insurance_amount),
    road_tax_amount: toNullableNumber(source.road_tax_amount),
  };

  if (id !== null && id !== undefined) {
    payload.id = id;
  }

  return payload;
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([
    {value: "ALL", label: "All Vehicles", icon: Bus},
    {value: "BUS", label: "College Bus", icon: Bus},
    {value: "CAR", label: "Car", icon: Car},
    {value: "BATTERY_VEHICLE", label: "Battery Vehicle", icon: Zap},
    {value: "OTHER", label: "Others", icon: Truck},
  ]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter State
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState(() => {
    const v = searchParams.get("view");
    return v === "expiry" ? "expiry" : "fleet";
  });

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Inline expiry edit state
  const [editingExpiry, setEditingExpiry] = useState(null); // { vehicleId, field }
  const [expiryFormValue, setExpiryFormValue] = useState("");

  // Filter Dropdown
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Document Detail Modal State (for expiry table row click)
  const [showDocDetailModal, setShowDocDetailModal] = useState(false);
  const [docDetailVehicle, setDocDetailVehicle] = useState(null);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyGrouped, setHistoryGrouped] = useState({
    insurance: [],
    fc: [],
    permit: [],
  });
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form State
  const initialFormState = {
    vehicle_type: "BUS",
    vehicle_number: "",
    seating_capacity: 0,
    fuel_type: "DIESEL",
    vehicle_name: "",
    start_point: "",
    end_point: "",
    chassis_number: "",
    engine_number: "",
    permit_number: "",
    additional_permit: "",
    insurance_amount: "",
    road_tax_amount: "",
    pollution_expire: "",
    green_tax_expire: "",
    mv_tax_expire: "",
    insurance_expire_date: "",
    insurance_start_date: "",
    insurance_remarks: "",
    fc_expire_date: "",
    fc_start_date: "",
    fc_remarks: "",
    permit_expire_date: "",
    permit_start_date: "",
    permit_remarks: "",
    status: "available",
  };
  const [vehicleForm, setVehicleForm] = useState(initialFormState);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/vehicles");
      const data = await res.json();
      setVehicles(data || []);
      return data || [];
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTypeOptions = async () => {
    const masterTypes = await fetchVehicleTypes();
    const mapped = [
      {value: "ALL", label: "All Vehicles", icon: Bus},
      ...masterTypes.map((t) => ({
        value: t.type,
        label: t.label || toVehicleTypeLabel(t.type),
        icon: vehicleTypeIcon(t.type),
      })),
    ];
    setVehicleTypeOptions(mapped);
  };

  useEffect(() => {
    fetchVehicles();
    fetchTypeOptions();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVehicles = vehicles.filter((v) => {
    const matchesType = filterType === "ALL" || v.vehicle_type === filterType;
    const matchesSearch =
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.vehicle_name &&
        v.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getVehicleLabel = (v) => {
    if (v.vehicle_name) {
      return v.vehicle_name;
    }
    return v.vehicle_number;
  };

  // Open detail modal
  const openDetailModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDetailModal(true);
  };

  // Open document detail modal (from expiry table row click)
  const openDocDetailModal = (vehicle) => {
    setDocDetailVehicle(vehicle);
    setShowDocDetailModal(true);
  };

  // Get vehicle type display name
  const getVehicleTypeLabel = (type) => {
    const found = vehicleTypeOptions.find((opt) => opt.value === type);
    return found?.label || toVehicleTypeLabel(type) || type;
  };

  // Convert dd-mm-yyyy from backend to yyyy-mm-dd for HTML date inputs
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 2) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Normalize backend status to frontend dropdown values
  const normalizeStatus = (status) => {
    if (!status) return "available";
    const s = status.toLowerCase().trim();
    if (s === "active" || s === "available") return "available";
    if (s === "in_service" || s === "maintenance") return "in_service";
    if (s === "not_available" || s === "inactive") return "not_available";
    return "NA";
  };

  const handleEdit = (vehicle) => {
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type || "NA",
      vehicle_number: vehicle.vehicle_number || "NA",
      seating_capacity: vehicle.seating_capacity ?? 0,
      fuel_type: vehicle.fuel_type || "NA",
      status: normalizeStatus(vehicle.status),
      vehicle_name: vehicle.vehicle_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
      chassis_number: vehicle.chassis_number || "",
      engine_number: vehicle.engine_number || "",
      permit_number: vehicle.permit_number || "",
      additional_permit: vehicle.additional_permit || "",
      insurance_amount: vehicle.insurance_amount ?? "",
      road_tax_amount: vehicle.road_tax_amount ?? "",
      pollution_expire: formatDateForInput(vehicle.pollution_expire),
      green_tax_expire: formatDateForInput(vehicle.green_tax_expire),
      mv_tax_expire: formatDateForInput(vehicle.mv_tax_expire),
      insurance_expire_date: formatDateForInput(vehicle.insurance_expire_date),
      insurance_start_date: formatDateForInput(vehicle.insurance_start_date),
      insurance_remarks: vehicle.insurance_remarks || "",
      fc_expire_date: formatDateForInput(vehicle.fc_expire_date),
      fc_start_date: formatDateForInput(vehicle.fc_start_date),
      fc_remarks: vehicle.fc_remarks || "",
      permit_expire_date: formatDateForInput(vehicle.permit_expire_date),
      permit_start_date: formatDateForInput(vehicle.permit_start_date),
      permit_remarks: vehicle.permit_remarks || "",
    });
    setEditingId(vehicle.id);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this vehicle?",
    );
    if (!isConfirmed) return;
    try {
      const res = await apiDelete(`/api/admin/vehicles/delete?id=${id}`);
      if (res.ok) {
        showSuccess("Success", "Vehicle deleted successfully!");
        fetchVehicles();
      } else {
        showError("Error", "Failed to delete vehicle: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error deleting vehicle");
    }
  };

  const handleSubmit = async () => {
    if (
      !vehicleForm.vehicle_type ||
      !vehicleForm.vehicle_number ||
      vehicleForm.seating_capacity === null ||
      vehicleForm.seating_capacity === undefined ||
      vehicleForm.seating_capacity === "" ||
      !vehicleForm.fuel_type
    ) {
      showError("Error", "Please fill all required fields");
      return;
    }
    if (
      vehicleForm.vehicle_type === "BUS" &&
      (!vehicleForm.vehicle_name ||
        !vehicleForm.start_point ||
        !vehicleForm.end_point)
    ) {
      showError(
        "Error",
        "Please fill all bus details (Name, Start/End Points)",
      );
      return;
    }

    try {
      const endpoint = isEditing
        ? "/api/admin/vehicles/update"
        : "/api/admin/vehicles/create";

      const body = isEditing
        ? buildVehiclePayload(vehicleForm, editingId)
        : buildVehiclePayload(vehicleForm);

      const res = await apiPost(endpoint, body);

      if (res.ok) {
        showSuccess(
          "Success",
          isEditing
            ? "Vehicle updated successfully!"
            : "Vehicle created successfully!",
        );
        const freshList = await fetchVehicles();
        // Keep detail modal in sync after an edit
        if (isEditing && editingId && selectedVehicle?.id === editingId) {
          const updated = freshList.find((v) => v.id === editingId);
          if (updated) setSelectedVehicle(updated);
        }
        setShowCreateModal(false);
        setVehicleForm(initialFormState);
        setIsEditing(false);
        setEditingId(null);
      } else {
        showError(
          "Error",
          `Failed to ${isEditing ? "update" : "create"} vehicle: ` +
            (await res.text()),
        );
      }
    } catch (err) {
      console.error(err);
      showError(
        "Error",
        `Error ${isEditing ? "updating" : "creating"} vehicle`,
      );
    }
  };

  // Helper to format date for API (convert dd-mm-yyyy to yyyy-mm-dd)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    return formatDateForInput(dateStr);
  };

  // Handle inline expiry date update
  const handleExpiryClick = (vehicle, field) => {
    setEditingExpiry({vehicleId: vehicle.id, field});
    const dateValue = vehicle[field];
    if (dateValue) {
      setExpiryFormValue(formatDateForInput(dateValue));
    } else {
      setExpiryFormValue("");
    }
  };

  const handleExpiryUpdate = async () => {
    if (!editingExpiry) return;

    const vehicle = vehicles.find((v) => v.id === editingExpiry.vehicleId);
    if (!vehicle) return;

    // Format all dates to YYYY-MM-DD
    const updatedVehicle = buildVehiclePayload({
      id: vehicle.id,
      vehicle_name: vehicle.vehicle_name || "",
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      fuel_type: vehicle.fuel_type,
      seating_capacity: vehicle.seating_capacity,
      status: vehicle.status,
      insurance_expire_date: formatDateForAPI(vehicle.insurance_expire_date),
      insurance_start_date: formatDateForAPI(vehicle.insurance_start_date),
      insurance_remarks: vehicle.insurance_remarks || "",
      fc_expire_date: formatDateForAPI(vehicle.fc_expire_date),
      fc_start_date: formatDateForAPI(vehicle.fc_start_date),
      fc_remarks: vehicle.fc_remarks || "",
      permit_expire_date: formatDateForAPI(vehicle.permit_expire_date),
      permit_start_date: formatDateForAPI(vehicle.permit_start_date),
      permit_remarks: vehicle.permit_remarks || "",
      [editingExpiry.field]: expiryFormValue || null,
    });

    try {
      const res = await apiPost("/api/admin/vehicles/update", updatedVehicle);

      if (res.ok) {
        fetchVehicles();
        setEditingExpiry(null);
        setExpiryFormValue("");
      } else {
        showError(
          "Error",
          "Failed to update expiry date: " + (await res.text()),
        );
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error updating expiry date");
    }
  };

  const cancelExpiryEdit = () => {
    setEditingExpiry(null);
    setExpiryFormValue("");
  };

  // Fetch document history for a specific vehicle
  const fetchDocumentHistory = async (vehicle) => {
    setHistoryVehicle(vehicle);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setHistoryFilter("all");
    try {
      const res = await apiGet(
        `/api/admin/vehicles/${vehicle.id}/document-history`,
      );
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
        setHistoryGrouped(data.grouped || {insurance: [], fc: [], permit: []});
      } else {
        setHistoryLogs([]);
        setHistoryGrouped({insurance: [], fc: [], permit: []});
      }
    } catch (err) {
      console.error("Error fetching document history:", err);
      setHistoryLogs([]);
      setHistoryGrouped({insurance: [], fc: [], permit: []});
    } finally {
      setHistoryLoading(false);
    }
  };

  // Get filtered history logs based on selected filter tab
  const getFilteredHistoryLogs = () => {
    if (historyFilter === "all") return historyLogs;
    return historyGrouped[historyFilter] || [];
  };

  // Format field name for display
  const formatFieldName = (fieldName) => {
    switch (fieldName) {
      case "start_date":
        return "Start Date";
      case "expire_date":
        return "Expiry Date";
      case "remarks":
        return "Remarks";
      default:
        return fieldName;
    }
  };

  // Format document type for display
  const formatDocType = (docType) => {
    switch (docType) {
      case "insurance":
        return "Insurance";
      case "fc":
        return "FC";
      case "permit":
        return "Permit";
      default:
        return docType;
    }
  };

  // Get doc type color
  const getDocTypeColor = (docType) => {
    switch (docType) {
      case "insurance":
        return "bg-skyblue/10 text-skyblue";
      case "fc":
        return "bg-green/10 text-green";
      case "permit":
        return "bg-primary/10 text-primary";
      default:
        return "bg-primarybg text-secondarytext";
    }
  };

  // Group history logs by date (changed_at format: "dd-mm-yyyy HH:MM:SS")
  const groupLogsByDate = (logs) => {
    const groups = {};
    logs.forEach((log) => {
      const datePart = log.changed_at
        ? log.changed_at.split(" ")[0]
        : "Unknown";
      if (!groups[datePart]) groups[datePart] = [];
      groups[datePart].push(log);
    });
    return Object.entries(groups).map(([date, items]) => ({date, items}));
  };

  // Format "dd-mm-yyyy" → "04 Mar 2026"
  const formatGroupDate = (dateStr) => {
    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return dateStr;
    const [, d, m, y] = match;
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  };

  // Get expiry stats
  const getExpiryStats = () => {
    let insuranceExpired = 0,
      insuranceCritical = 0;
    let fcExpired = 0,
      fcCritical = 0;
    let permitExpired = 0,
      permitCritical = 0;
    let pollutionExpired = 0,
      pollutionCritical = 0;
    let greenTaxExpired = 0,
      greenTaxCritical = 0;
    let mvTaxExpired = 0,
      mvTaxCritical = 0;

    vehicles.forEach((v) => {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);
      const pollutionDays = getDaysUntil(v.pollution_expire);
      const greenTaxDays = getDaysUntil(v.green_tax_expire);
      const mvTaxDays = getDaysUntil(v.mv_tax_expire);

      if (insDays !== null) {
        if (insDays < 0) insuranceExpired++;
        else if (insDays <= 30) insuranceCritical++;
      }
      if (fcDays !== null) {
        if (fcDays < 0) fcExpired++;
        else if (fcDays <= 30) fcCritical++;
      }
      if (permitDays !== null) {
        if (permitDays < 0) permitExpired++;
        else if (permitDays <= 30) permitCritical++;
      }
      if (pollutionDays !== null) {
        if (pollutionDays < 0) pollutionExpired++;
        else if (pollutionDays <= 30) pollutionCritical++;
      }
      if (greenTaxDays !== null) {
        if (greenTaxDays < 0) greenTaxExpired++;
        else if (greenTaxDays <= 30) greenTaxCritical++;
      }
      if (mvTaxDays !== null) {
        if (mvTaxDays < 0) mvTaxExpired++;
        else if (mvTaxDays <= 30) mvTaxCritical++;
      }
    });

    return {
      insurance: {expired: insuranceExpired, critical: insuranceCritical},
      fc: {expired: fcExpired, critical: fcCritical},
      permit: {expired: permitExpired, critical: permitCritical},
      pollution: {expired: pollutionExpired, critical: pollutionCritical},
      greenTax: {expired: greenTaxExpired, critical: greenTaxCritical},
      mvTax: {expired: mvTaxExpired, critical: mvTaxCritical},
    };
  };

  const expiryStats = getExpiryStats();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex bg-secondarybg rounded-md border border-primary/10 p-1.5 gap-1">
          <button
            onClick={() => setViewMode("fleet")}
            className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === "fleet"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Bus size={16} /> Fleet View
          </button>
          <button
            onClick={() => setViewMode("expiry")}
            className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === "expiry"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Shield size={16} /> Insurance/FC/Permit Status
            {expiryStats.insurance.expired +
              expiryStats.fc.expired +
              expiryStats.permit.expired +
              expiryStats.pollution.expired +
              expiryStats.greenTax.expired +
              expiryStats.mvTax.expired >
              0 && (
              <span className="ml-1 px-2 py-0.5 bg-red text-white text-xs rounded-md font-bold">
                {expiryStats.insurance.expired +
                  expiryStats.fc.expired +
                  expiryStats.permit.expired +
                  expiryStats.pollution.expired +
                  expiryStats.greenTax.expired +
                  expiryStats.mvTax.expired}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setVehicleForm(initialFormState);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-all font-semibold shadow-sm hover:shadow-md"
        >
          <Plus size={18} />
          Add New Vehicle
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">
                Total Vehicles
              </p>
              <p className="text-3xl font-bold text-primarytext">
                {vehicles?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-md">
              <Bus size={24} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">
                Buses
              </p>
              <p className="text-3xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "BUS").length || 0}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-md">
              <Bus size={24} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-green/10 hover:shadow-md hover:border-green/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">
                Cars
              </p>
              <p className="text-3xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "CAR").length || 0}
              </p>
            </div>
            <div className="p-3 bg-green/10 rounded-md">
              <Car size={24} className="text-green" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-pending/10 hover:shadow-md hover:border-pending/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">
                Battery Vehicles
              </p>
              <p className="text-3xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "BATTERY_VEHICLE")
                  .length || 0}
              </p>
            </div>
            <div className="p-3 bg-pending/10 rounded-md">
              <Zap size={24} className="text-pending" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-secondarytext/10 hover:shadow-md hover:border-secondarytext/20 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">
                Others
              </p>
              <p className="text-3xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "OTHER").length ||
                  0}
              </p>
            </div>
            <div className="p-3 bg-secondarytext/10 rounded-md">
              <Truck size={24} className="text-secondarytext" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Header - REMOVED */}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-secondarytext"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by vehicle number or bus name..."
            className="w-full pl-12 pr-4 py-3 bg-secondarybg border border-primary/10 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-primarytext placeholder:text-secondarytext/60 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="flex items-center gap-3 px-4 py-3 bg-secondarybg border border-primary/10 rounded-md hover:border-primary/30 transition-all min-w-52 text-sm"
          >
            {(() => {
              const opt = vehicleTypeOptions.find(
                (t) => t.value === filterType,
              );
              const Icon = opt?.icon || Bus;
              return (
                <>
                  <Icon size={16} className="text-primary" />
                  <span className="font-medium text-primarytext">
                    {opt?.label || "All Vehicles"}
                  </span>
                </>
              );
            })()}
            <ChevronDown
              size={16}
              className={`text-secondarytext ml-auto transition-transform duration-200 ${
                showTypeDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showTypeDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-full bg-secondarybg border border-primary/10 rounded-md shadow-lg z-30 py-1 animate-fadeIn">
              {vehicleTypeOptions.map((type) => {
                const Icon = type.icon;
                const count =
                  type.value === "ALL"
                    ? vehicles.length
                    : vehicles.filter((v) => v.vehicle_type === type.value)
                        .length;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setFilterType(type.value);
                      setShowTypeDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      filterType === type.value
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-primarytext hover:bg-primarybg"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{type.label}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        filterType === type.value
                          ? "bg-primary/20 text-primary"
                          : "bg-primarybg text-secondarytext"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Expiry Status View */}
      {viewMode === "expiry" && (
        <>
          {/* Expiry Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                key: "insurance",
                label: "Insurance",
                icon: Shield,
                color: "skyblue",
                stats: expiryStats.insurance,
              },
              {
                key: "fc",
                label: "FC (Fitness Certificate)",
                icon: FileCheck,
                color: "green",
                stats: expiryStats.fc,
              },
              {
                key: "permit",
                label: "Permit",
                icon: FileText,
                color: "primary",
                stats: expiryStats.permit,
              },
              {
                key: "pollution",
                label: "Pollution (PUC)",
                icon: AlertCircle,
                color: "pending",
                stats: expiryStats.pollution,
              },
              {
                key: "greenTax",
                label: "Green Tax",
                icon: RefreshCw,
                color: "green",
                stats: expiryStats.greenTax,
              },
              {
                key: "mvTax",
                label: "MV Tax",
                icon: FileText,
                color: "primary",
                stats: expiryStats.mvTax,
              },
            ].map((doc) => {
              const Icon = doc.icon;
              const hasIssues = doc.stats.expired > 0 || doc.stats.critical > 0;
              return (
                <div
                  key={doc.key}
                  className={`bg-secondarybg rounded-md p-5 shadow-sm border-l-4 ${
                    doc.stats.expired > 0
                      ? "border-l-red"
                      : doc.stats.critical > 0
                        ? "border-l-pending"
                        : `border-l-${doc.color}`
                  } border border-primary/10`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 bg-${doc.color}/10 text-${doc.color} rounded-md`}
                      >
                        <Icon size={20} />
                      </div>
                      <h4 className="font-bold text-primarytext text-sm">
                        {doc.label}
                      </h4>
                    </div>
                    {hasIssues && (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={14} className="text-red" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`flex flex-col items-center p-3 rounded-md ${doc.stats.expired > 0 ? "bg-red/10" : "bg-primarybg"}`}
                    >
                      <p
                        className={`text-2xl font-bold ${doc.stats.expired > 0 ? "text-red" : "text-secondarytext"}`}
                      >
                        {doc.stats.expired}
                      </p>
                      <p
                        className={`text-xs font-medium ${doc.stats.expired > 0 ? "text-red" : "text-secondarytext"}`}
                      >
                        Expired
                      </p>
                    </div>
                    <div
                      className={`flex flex-col items-center p-3 rounded-md ${doc.stats.critical > 0 ? "bg-pending/10" : "bg-primarybg"}`}
                    >
                      <p
                        className={`text-2xl font-bold ${doc.stats.critical > 0 ? "text-pending" : "text-secondarytext"}`}
                      >
                        {doc.stats.critical}
                      </p>
                      <p
                        className={`text-xs font-medium ${doc.stats.critical > 0 ? "text-pending" : "text-secondarytext"}`}
                      >
                        {"< 30 days"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expiry Table */}
          <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
            <div className="px-6 py-3 border-b border-primary/5 bg-primarybg/50 flex items-center justify-between">
              <p className="text-sm text-secondarytext">
                Click on a row to view full document details, edit, or see
                change history.
              </p>
              <span className="text-xs text-secondarytext bg-primarybg px-3 py-1 rounded-md">
                {filteredVehicles.length} vehicles
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primarybg/50 border-b border-primary/5">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <Shield size={12} /> Insurance
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileCheck size={12} /> FC
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileText size={12} /> Permit
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Pollution
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <RefreshCw size={12} /> Green Tax
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <FileText size={12} /> MV Tax
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    [...filteredVehicles]
                      .sort((a, b) => {
                        const aMin = Math.min(
                          getDaysUntil(a.insurance_expire_date) ?? 9999,
                          getDaysUntil(a.fc_expire_date) ?? 9999,
                          getDaysUntil(a.permit_expire_date) ?? 9999,
                          getDaysUntil(a.pollution_expire) ?? 9999,
                          getDaysUntil(a.green_tax_expire) ?? 9999,
                          getDaysUntil(a.mv_tax_expire) ?? 9999,
                        );
                        const bMin = Math.min(
                          getDaysUntil(b.insurance_expire_date) ?? 9999,
                          getDaysUntil(b.fc_expire_date) ?? 9999,
                          getDaysUntil(b.permit_expire_date) ?? 9999,
                          getDaysUntil(b.pollution_expire) ?? 9999,
                          getDaysUntil(b.green_tax_expire) ?? 9999,
                          getDaysUntil(b.mv_tax_expire) ?? 9999,
                        );
                        return aMin - bMin;
                      })
                      .map((v, idx) => {
                        const insDays = getDaysUntil(v.insurance_expire_date);
                        const fcDays = getDaysUntil(v.fc_expire_date);
                        const permitDays = getDaysUntil(v.permit_expire_date);
                        const pollutionDays = getDaysUntil(v.pollution_expire);
                        const greenTaxDays = getDaysUntil(v.green_tax_expire);
                        const mvTaxDays = getDaysUntil(v.mv_tax_expire);

                        // Render expiry date + days badge (table cell)
                        const renderExpiryCell = (expireDate, days) => (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-primarytext">
                              {expireDate || (
                                <span className="text-secondarytext/40 italic">
                                  Not set
                                </span>
                              )}
                            </span>
                            {days !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            )}
                          </div>
                        );

                        return (
                          <tr
                            key={v.id}
                            onClick={() => openDocDetailModal(v)}
                            className="hover:bg-primarybg/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-3 py-3 text-sm text-secondarytext font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {v.vehicle_type === "BUS" ? (
                                  <Bus size={15} className="text-primary" />
                                ) : v.vehicle_type === "CAR" ? (
                                  <Car size={15} className="text-green" />
                                ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                  <Zap size={15} className="text-pending" />
                                ) : (
                                  <Truck
                                    size={15}
                                    className="text-secondarytext"
                                  />
                                )}
                                <div>
                                  <span className="font-semibold text-primarytext text-sm group-hover:text-primary transition-colors">
                                    {v.vehicle_name || v.vehicle_number}
                                  </span>
                                  <p className="text-[10px] text-secondarytext font-mono">
                                    {v.vehicle_number}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.insurance_expire_date),
                                insDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.fc_expire_date),
                                fcDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.permit_expire_date),
                                permitDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.pollution_expire),
                                pollutionDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.green_tax_expire),
                                greenTaxDays,
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {renderExpiryCell(
                                formatDate(v.mv_tax_expire),
                                mvTaxDays,
                              )}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-12 text-center text-secondarytext"
                      >
                        No vehicles found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Vehicles Table - Fleet View */}
      {viewMode === "fleet" && (
        <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
          {loading ? (
            <Loading fullScreen={false} text="Loading fleet data..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg/50">
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Specs
                    </th>
                    {filterType === "BUS" && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Route
                      </th>
                    )}
                    <th className="px-6 py-4 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    filteredVehicles.map((v, index) => (
                      <tr
                        key={v.id}
                        onClick={() => openDetailModal(v)}
                        className={`group cursor-pointer transition-all duration-200 hover:bg-primary/5 ${
                          index !== filteredVehicles.length - 1
                            ? "border-b border-primary/5"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div
                              className={`h-12 w-12 rounded-md flex items-center justify-center shadow-sm ${
                                v.vehicle_type === "BUS"
                                  ? "bg-primary/10 text-primary"
                                  : v.vehicle_type === "CAR"
                                    ? "bg-green/10 text-green"
                                    : v.vehicle_type === "BATTERY_VEHICLE"
                                      ? "bg-pending/10 text-pending"
                                      : "bg-secondarytext/10 text-secondarytext"
                              }`}
                            >
                              {v.vehicle_type === "BUS" ? (
                                <Bus size={22} />
                              ) : v.vehicle_type === "CAR" ? (
                                <Car size={22} />
                              ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                <Zap size={22} />
                              ) : (
                                <Truck size={22} />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-primarytext text-base group-hover:text-primary transition-colors">
                                {getVehicleLabel(v)}
                              </div>
                              <div className="text-xs text-secondarytext mt-1">
                                <span className="font-medium">
                                  {v.vehicle_number}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md `}
                          >{v.vehicle_type}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-md ${v.fuel_type === "EV" ? "bg-primary/10" : "bg-primarybg"}`}
                              >
                                {v.fuel_type === "EV" ? (
                                  <Zap size={12} className="text-primary" />
                                ) : (
                                  <Fuel
                                    size={12}
                                    className="text-secondarytext"
                                  />
                                )}
                              </div>
                              <span className="text-sm font-medium text-primarytext">
                                {v.fuel_type}
                              </span>
                            </div>
                            <div className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md w-fit">
                              {v.seating_capacity} Seats
                            </div>
                          </div>
                        </td>
                        {filterType === "BUS" && (
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green shadow-sm"></div>
                                <span className="text-sm font-medium text-primarytext">
                                  {v.start_point || "-"}
                                </span>
                              </div>
                              <div className="ml-1 h-4 border-l-2 border-dashed border-secondarytext/30"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red shadow-sm"></div>
                                <span className="text-sm font-medium text-primarytext">
                                  {v.end_point || "-"}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md min-w-24 ${
                                normalizeStatus(v.status) === "available"
                                  ? "bg-green/10 text-green"
                                  : normalizeStatus(v.status) ===
                                      "not_available"
                                    ? "bg-red/10 text-red"
                                    : "bg-pending/10 text-pending"
                              }`}
                            >
                              {normalizeStatus(v.status) === "available" ? (
                                <CheckCircle size={14} />
                              ) : normalizeStatus(v.status) ===
                                "not_available" ? (
                                <AlertCircle size={14} />
                              ) : (
                                <AlertCircle size={14} />
                              )}
                              {normalizeStatus(v.status) === "available"
                                ? "Available"
                                : normalizeStatus(v.status) === "not_available"
                                  ? "Not Available"
                                  : "In Service"}
                            </span>
                            {v.replacement_vehicle_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-skyblue/10 text-skyblue">
                                <RefreshCw size={10} />
                                Replaced: {v.replacement_vehicle_number}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={filterType === "BUS" ? 5 : 4}
                        className="px-6 py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-primarybg rounded-md flex items-center justify-center">
                            <Bus size={32} className="text-secondarytext/50" />
                          </div>
                          <div>
                            <p className="text-primarytext font-medium mb-1">
                              No vehicles found
                            </p>
                            <p className="text-secondarytext text-sm">
                              Add a vehicle to get started
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vehicle Detail Modal */}
      {showDetailModal && selectedVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowDetailModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-md ${
                      selectedVehicle.vehicle_type === "BUS"
                        ? "bg-primary text-white"
                        : selectedVehicle.vehicle_type === "CAR"
                          ? "bg-green text-white"
                          : selectedVehicle.vehicle_type === "BATTERY_VEHICLE"
                            ? "bg-pending text-white"
                            : "bg-secondarytext text-white"
                    }`}
                  >
                    {selectedVehicle.vehicle_type === "BUS" ? (
                      <Bus size={22} />
                    ) : selectedVehicle.vehicle_type === "CAR" ? (
                      <Car size={22} />
                    ) : selectedVehicle.vehicle_type === "BATTERY_VEHICLE" ? (
                      <Zap size={22} />
                    ) : (
                      <Truck size={22} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      {getVehicleLabel(selectedVehicle)}
                    </h2>
                    <p className="text-sm text-secondarytext mt-0.5">
                      {selectedVehicle.vehicle_number} •{" "}
                      {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
                      normalizeStatus(selectedVehicle.status) === "available"
                        ? "bg-green/10 text-green"
                        : normalizeStatus(selectedVehicle.status) ===
                            "not_available"
                          ? "bg-red/10 text-red"
                          : "bg-pending/10 text-pending"
                    }`}
                  >
                    {normalizeStatus(selectedVehicle.status) === "available" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertCircle size={12} />
                    )}
                    {normalizeStatus(selectedVehicle.status) === "available"
                      ? "Available"
                      : normalizeStatus(selectedVehicle.status) ===
                          "not_available"
                        ? "Not Available"
                        : "In Service"}
                  </span>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Main Info Grid — always 2 columns */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Vehicle Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus size={15} className="text-primary" />
                      <h3 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Information
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Vehicle Number
                        </span>
                        <span className="text-sm font-semibold text-primarytext font-mono bg-secondarybg px-2 py-0.5 rounded-md border border-primary/10">
                          {selectedVehicle.vehicle_number}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">Type</span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                            selectedVehicle.vehicle_type === "BUS"
                              ? "bg-primary/10 text-primary"
                              : selectedVehicle.vehicle_type === "CAR"
                                ? "bg-green/10 text-green"
                                : selectedVehicle.vehicle_type ===
                                    "BATTERY_VEHICLE"
                                  ? "bg-pending/10 text-pending"
                                  : "bg-secondarytext/10 text-secondarytext"
                          }`}
                        >
                          {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                        </span>
                      </div>
                      {selectedVehicle.vehicle_name && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Name
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.vehicle_name}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.permit_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Permit No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.permit_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.additional_permit && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Additional Permit
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.additional_permit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Fuel size={15} className="text-primary" />
                      <h3 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Specifications
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Fuel Type
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                            selectedVehicle.fuel_type === "EV"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondarytext/10 text-secondarytext"
                          }`}
                        >
                          {selectedVehicle.fuel_type === "EV" ? (
                            <Zap size={11} />
                          ) : (
                            <Fuel size={11} />
                          )}
                          {selectedVehicle.fuel_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Seating Capacity
                        </span>
                        <span className="text-sm font-semibold text-primarytext bg-secondarybg px-2 py-0.5 rounded-md border border-primary/10">
                          {selectedVehicle.seating_capacity} Seats
                        </span>
                      </div>
                      {selectedVehicle.chassis_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Chassis No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.chassis_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.engine_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Engine No.
                          </span>
                          <span className="text-sm font-semibold text-primarytext font-mono">
                            {selectedVehicle.engine_number}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.insurance_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Insurance Amount
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            ₹
                            {Number(
                              selectedVehicle.insurance_amount,
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {selectedVehicle.road_tax_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Road Tax Amount
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            ₹
                            {Number(
                              selectedVehicle.road_tax_amount,
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Route Strip — Bus only, compact single row */}
                {selectedVehicle.vehicle_type === "BUS" && (
                  <div className="bg-primarybg rounded-md px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-primary" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Route
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-primarytext">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green inline-block" />
                        {selectedVehicle.start_point || "-"}
                      </span>
                      <span className="text-secondarytext/40 font-normal">
                        →
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red inline-block" />
                        {selectedVehicle.end_point || "-"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Replacement info strip — only when vehicle is replaced */}
                {selectedVehicle.replacement_vehicle_number && (
                  <div className="bg-skyblue/5 border border-skyblue/20 rounded-md px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="text-skyblue" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Replacement
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-skyblue">
                        {selectedVehicle.replacement_vehicle_number}
                      </span>
                      {selectedVehicle.replacement_reason && (
                        <span className="text-secondarytext capitalize">
                          {selectedVehicle.replacement_reason.replace(
                            /_/g,
                            " ",
                          )}
                        </span>
                      )}
                      {selectedVehicle.replacement_start_date && (
                        <span className="text-secondarytext">
                          {selectedVehicle.replacement_start_date} –{" "}
                          {selectedVehicle.replacement_end_date || "Ongoing"}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents & Expiry */}
                {(selectedVehicle.insurance_expire_date ||
                  selectedVehicle.fc_expire_date ||
                  selectedVehicle.permit_expire_date ||
                  selectedVehicle.pollution_expire ||
                  selectedVehicle.green_tax_expire ||
                  selectedVehicle.mv_tax_expire) && (
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                          Documents & Expiry
                        </h3>
                      </div>
                      <button
                        onClick={() => fetchDocumentHistory(selectedVehicle)}
                        className="flex items-center gap-1.5 text-xs text-primary font-semibold px-3 py-1.5 bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                      >
                        <History size={12} /> View History
                      </button>
                    </div>

                    {/* Insurance / FC / Permit */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedVehicle.insurance_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield size={13} className="text-skyblue" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              Insurance
                            </span>
                          </div>
                          {selectedVehicle.insurance_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From:{" "}
                              {formatDate(selectedVehicle.insurance_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.insurance_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.insurance_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                          {selectedVehicle.insurance_remarks && (
                            <p className="text-[10px] text-secondarytext mt-1.5 italic">
                              {selectedVehicle.insurance_remarks}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedVehicle.fc_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <FileCheck size={13} className="text-green" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              FC
                            </span>
                          </div>
                          {selectedVehicle.fc_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From: {formatDate(selectedVehicle.fc_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.fc_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.fc_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                          {selectedVehicle.fc_remarks && (
                            <p className="text-[10px] text-secondarytext mt-1.5 italic">
                              {selectedVehicle.fc_remarks}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedVehicle.permit_expire_date && (
                        <div className="bg-secondarybg rounded-md p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={13} className="text-primary" />
                            <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                              Permit
                            </span>
                          </div>
                          {selectedVehicle.permit_start_date && (
                            <p className="text-xs text-secondarytext mb-1">
                              From:{" "}
                              {formatDate(selectedVehicle.permit_start_date)}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primarytext">
                            {formatDate(selectedVehicle.permit_expire_date)}
                          </p>
                          {(() => {
                            const days = getDaysUntil(
                              selectedVehicle.permit_expire_date,
                            );
                            return days !== null ? (
                              <span
                                className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : `${days}d left`}
                              </span>
                            ) : null;
                          })()}
                          {selectedVehicle.permit_remarks && (
                            <p className="text-[10px] text-secondarytext mt-1.5 italic">
                              {selectedVehicle.permit_remarks}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pollution / Green Tax / MV Tax */}
                    {(selectedVehicle.pollution_expire ||
                      selectedVehicle.green_tax_expire ||
                      selectedVehicle.mv_tax_expire) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {selectedVehicle.pollution_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <AlertCircle size={13} className="text-pending" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                Pollution (PUC)
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.pollution_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.pollution_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {selectedVehicle.green_tax_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <RefreshCw size={13} className="text-green" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                Green Tax
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.green_tax_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.green_tax_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {selectedVehicle.mv_tax_expire && (
                          <div className="bg-secondarybg rounded-md p-3 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <FileText size={13} className="text-primary" />
                              <span className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                                MV Tax
                              </span>
                            </div>
                            <p className="text-sm font-bold text-primarytext">
                              {formatDate(selectedVehicle.mv_tax_expire)}
                            </p>
                            {(() => {
                              const days = getDaysUntil(
                                selectedVehicle.mv_tax_expire,
                              );
                              return days !== null ? (
                                <span
                                  className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(days)}`}
                                >
                                  {days < 0
                                    ? `${Math.abs(days)}d overdue`
                                    : `${days}d left`}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with Actions */}
              <div className="px-6 py-4 border-t border-primary/10 flex justify-end items-center gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(selectedVehicle.id);
                  }}
                  className="px-5 py-2.5 border border-red text-red hover:bg-red/10 rounded-md font-semibold transition-colors text-sm flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedVehicle);
                  }}
                  className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-colors text-sm flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit Vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Vehicle Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto animate-overlayFadeIn"
          onClick={() => {
            setShowCreateModal(false);
            setVehicleForm(initialFormState);
            setIsEditing(false);
            setEditingId(null);
          }}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-primarybg/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-primary">
                      {isEditing ? (
                        <Edit2 className="text-secondarybg" size={24} />
                      ) : (
                        <Bus className="text-secondarybg" size={24} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-primarytext">
                        {isEditing ? "Edit Vehicle" : "Add New Vehicle"}
                      </h2>
                      <p className="text-sm text-secondarytext">
                        {isEditing
                          ? "Update vehicle information"
                          : "Register a new vehicle to the fleet"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setVehicleForm(initialFormState);
                      setIsEditing(false);
                      setEditingId(null);
                    }}
                    className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Vehicle Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Car size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Vehicle Information
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {/* Vehicle Category */}
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-2">
                          Category *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {vehicleTypeOptions
                            .filter((type) => type.value !== "ALL")
                            .map((type) => (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() =>
                                  setVehicleForm({
                                    ...vehicleForm,
                                    vehicle_type: type.value,
                                  })
                                }
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium border transition-all ${
                                  vehicleForm.vehicle_type === type.value
                                    ? "bg-primary/10 border-primary text-primary ring-1 ring-primary"
                                    : "bg-secondarybg border-primarybg text-secondarytext hover:bg-secondarybg/80 hover:border-primary/20"
                                }`}
                              >
                                <type.icon size={15} />
                                {type.label}
                              </button>
                            ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Vehicle Name *
                        </label>
                        <input
                          placeholder="e.g., Bus-01, Staff Car"
                          value={vehicleForm.vehicle_name}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              vehicle_name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Registration Number *
                        </label>
                        <input
                          placeholder="e.g., TN36AB1234"
                          value={vehicleForm.vehicle_number}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              vehicle_number: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Fuel size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Specifications
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Status *
                        </label>
                        <CustomDropdown
                          value={vehicleForm.status}
                          onChange={(val) =>
                            setVehicleForm({...vehicleForm, status: val})
                          }
                          isWhite
                          options={[
                            {
                              value: "available",
                              label: "Available",
                              icon: CheckCircle,
                              iconColor: "text-green-500",
                            },
                            {
                              value: "in_service",
                              label: "In Service",
                              icon: Wrench,
                              iconColor: "text-pending",
                            },
                            {
                              value: "not_available",
                              label: "Not Available",
                              icon: XCircle,
                              iconColor: "text-red-500",
                            },
                          ]}
                          width="w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Fuel Type *
                          </label>
                          <CustomDropdown
                            value={vehicleForm.fuel_type}
                            onChange={(val) =>
                              setVehicleForm({...vehicleForm, fuel_type: val})
                            }
                            isWhite
                            options={[
                              {value: "DIESEL", label: "Diesel", icon: Fuel},
                              {value: "PETROL", label: "Petrol", icon: Fuel},
                              {value: "CNG", label: "CNG", icon: Fuel},
                              {value: "EV", label: "Electric", icon: Zap},
                            ]}
                            width="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Seating Capacity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={vehicleForm.seating_capacity}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                seating_capacity: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      {/* Route Details (Bus Only) */}
                      {vehicleForm.vehicle_type === "BUS" && (
                        <>
                          <div className="pt-2 border-t border-primarybg">
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              Start Point
                            </label>
                            <input
                              placeholder="e.g., Main Campus"
                              value={vehicleForm.start_point}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  start_point: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              End Point
                            </label>
                            <input
                              placeholder="e.g., Central Station"
                              value={vehicleForm.end_point}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  end_point: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Insurance & FC Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Insurance & FC
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Insurance Start Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.insurance_start_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                insurance_start_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Insurance Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.insurance_expire_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                insurance_expire_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Insurance Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g., 25000.00"
                          value={vehicleForm.insurance_amount}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              insurance_amount: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Insurance Remarks
                        </label>
                        <textarea
                          placeholder="e.g., Policy number, provider name..."
                          value={vehicleForm.insurance_remarks}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              insurance_remarks: e.target.value,
                            })
                          }
                          rows={2}
                          className="w-full px-4 py-2 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext text-sm resize-none"
                        />
                      </div>
                      <div className="border-t border-primarybg pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              FC Start Date
                            </label>
                            <input
                              type="date"
                              value={vehicleForm.fc_start_date}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  fc_start_date: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-primarytext mb-1">
                              FC Expiry Date
                            </label>
                            <input
                              type="date"
                              value={vehicleForm.fc_expire_date}
                              onChange={(e) =>
                                setVehicleForm({
                                  ...vehicleForm,
                                  fc_expire_date: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          FC Remarks
                        </label>
                        <textarea
                          placeholder="e.g., Certificate number, agency..."
                          value={vehicleForm.fc_remarks}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              fc_remarks: e.target.value,
                            })
                          }
                          rows={2}
                          className="w-full px-4 py-2 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Permit & Registration Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileCheck size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Permit & Registration
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Chassis Number
                          </label>
                          <input
                            placeholder="e.g., MAT448208..."
                            value={vehicleForm.chassis_number}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                chassis_number: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Engine Number
                          </label>
                          <input
                            placeholder="e.g., 497TC14..."
                            value={vehicleForm.engine_number}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                engine_number: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Permit Number
                          </label>
                          <input
                            placeholder="e.g., TN/36/..."
                            value={vehicleForm.permit_number}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                permit_number: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Additional Permit
                          </label>
                          <input
                            placeholder="e.g., All India Permit"
                            value={vehicleForm.additional_permit}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                additional_permit: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Permit Start Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.permit_start_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                permit_start_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Permit Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.permit_expire_date}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                permit_expire_date: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Permit Remarks
                        </label>
                        <textarea
                          placeholder="e.g., Permit type, issuing authority..."
                          value={vehicleForm.permit_remarks}
                          onChange={(e) =>
                            setVehicleForm({
                              ...vehicleForm,
                              permit_remarks: e.target.value,
                            })
                          }
                          rows={2}
                          className="w-full px-4 py-2 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext text-sm resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 border-t border-primarybg pt-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Road Tax Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g., 5000.00"
                            value={vehicleForm.road_tax_amount}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                road_tax_amount: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-t border-primarybg pt-3">
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Pollution Expire
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.pollution_expire}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                pollution_expire: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            Green Tax Expire
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.green_tax_expire}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                green_tax_expire: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-primarytext mb-1">
                            MV Tax Expire
                          </label>
                          <input
                            type="date"
                            value={vehicleForm.mv_tax_expire}
                            onChange={(e) =>
                              setVehicleForm({
                                ...vehicleForm,
                                mv_tax_expire: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-xs text-secondarytext">
                          <Calendar
                            size={14}
                            className="inline mr-1.5 text-primary"
                          />
                          All changes to document dates are tracked in the audit
                          log. You'll get alerts when documents are about to
                          expire.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-primarybg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setVehicleForm(initialFormState);
                      setIsEditing(false);
                      setEditingId(null);
                    }}
                    className="px-5 py-2.5 bg-red-50 text-red hover:bg-red-100 border border-red-200 rounded-md transition-colors font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-5 py-2.5 bg-primary text-white rounded-md hover:bg-green-700 transition-colors font-semibold text-sm flex items-center gap-2"
                  >
                    {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                    {isEditing ? "Update Vehicle" : "Create Vehicle"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal (opened from expiry table row click) */}
      {showDocDetailModal && docDetailVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowDocDetailModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-xl overflow-hidden my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-md ${
                        docDetailVehicle.vehicle_type === "BUS"
                          ? "bg-primary text-white"
                          : docDetailVehicle.vehicle_type === "CAR"
                            ? "bg-green text-white"
                            : docDetailVehicle.vehicle_type ===
                                "BATTERY_VEHICLE"
                              ? "bg-pending text-white"
                              : "bg-secondarytext text-white"
                      }`}
                    >
                      {docDetailVehicle.vehicle_type === "BUS" ? (
                        <Bus size={20} />
                      ) : docDetailVehicle.vehicle_type === "CAR" ? (
                        <Car size={20} />
                      ) : docDetailVehicle.vehicle_type ===
                        "BATTERY_VEHICLE" ? (
                        <Zap size={20} />
                      ) : (
                        <Truck size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primarytext">
                        {docDetailVehicle.vehicle_name ||
                          docDetailVehicle.vehicle_number}
                      </h3>
                      <p className="text-sm text-secondarytext">
                        {docDetailVehicle.vehicle_number} — Document Details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDocDetailModal(false)}
                    className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Document Cards */}
              <div className="p-6 space-y-4">
                {[
                  {
                    key: "insurance",
                    label: "Insurance",
                    icon: Shield,
                    color: "skyblue",
                    startDate: docDetailVehicle.insurance_start_date,
                    expiryDate: docDetailVehicle.insurance_expire_date,
                    remarks: docDetailVehicle.insurance_remarks,
                    days: getDaysUntil(docDetailVehicle.insurance_expire_date),
                  },
                  {
                    key: "fc",
                    label: "FC (Fitness Certificate)",
                    icon: FileCheck,
                    color: "green",
                    startDate: docDetailVehicle.fc_start_date,
                    expiryDate: docDetailVehicle.fc_expire_date,
                    remarks: docDetailVehicle.fc_remarks,
                    days: getDaysUntil(docDetailVehicle.fc_expire_date),
                  },
                  {
                    key: "permit",
                    label: "Permit",
                    icon: FileText,
                    color: "primary",
                    startDate: docDetailVehicle.permit_start_date,
                    expiryDate: docDetailVehicle.permit_expire_date,
                    remarks: docDetailVehicle.permit_remarks,
                    days: getDaysUntil(docDetailVehicle.permit_expire_date),
                  },
                ].map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <div
                      key={doc.key}
                      className={`bg-primarybg rounded-md p-4 border-l-4 ${
                        doc.days !== null && doc.days < 0
                          ? "border-l-red"
                          : doc.days !== null && doc.days <= 30
                            ? "border-l-pending"
                            : `border-l-${doc.color}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={`text-${doc.color}`} />
                          <h4 className="font-bold text-primarytext text-sm">
                            {doc.label}
                          </h4>
                        </div>
                        {doc.days !== null && (
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(doc.days)}`}
                          >
                            {doc.days < 0
                              ? `${Math.abs(doc.days)} days overdue`
                              : `${doc.days} days left`}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-secondarytext uppercase tracking-wide font-semibold mb-0.5">
                            Start Date
                          </p>
                          <p className="text-sm font-medium text-primarytext">
                            {formatDate(doc.startDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-secondarytext uppercase tracking-wide font-semibold mb-0.5">
                            Expiry Date
                          </p>
                          <p className="text-sm font-medium text-primarytext">
                            {formatDate(doc.expiryDate)}
                          </p>
                        </div>
                      </div>
                      {doc.remarks && (
                        <div className="mt-2 pt-2 border-t border-primary/5">
                          <div className="flex items-start gap-1.5">
                            <MessageSquare
                              size={11}
                              className="text-secondarytext mt-0.5 shrink-0"
                            />
                            <p className="text-xs text-secondarytext italic">
                              {doc.remarks}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-primary/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    setShowDocDetailModal(false);
                    fetchDocumentHistory(docDetailVehicle);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-secondarytext hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                >
                  <History size={15} />
                  View History
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDocDetailModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowDocDetailModal(false);
                      handleEdit(docDetailVehicle);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors text-sm font-semibold"
                  >
                    <Edit2 size={15} />
                    Edit Documents
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document History Modal */}
      {showHistoryModal && historyVehicle && (
        <div
          className="fixed inset-0 bg-black/60 overflow-y-auto z-50 animate-overlayFadeIn"
          onClick={() => setShowHistoryModal(false)}
        >
          <div className="flex items-start justify-center min-h-full p-4">
            <div
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-md">
                      <History size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primarytext">
                        Document Change History
                      </h3>
                      <p className="text-sm text-secondarytext">
                        {historyVehicle.vehicle_name ||
                          historyVehicle.vehicle_number}{" "}
                        — {historyVehicle.vehicle_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 mt-4 bg-primarybg rounded-md p-1">
                  {[
                    {key: "all", label: "All"},
                    {key: "insurance", label: "Insurance"},
                    {key: "fc", label: "FC"},
                    {key: "permit", label: "Permit"},
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setHistoryFilter(tab.key)}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                        historyFilter === tab.key
                          ? "bg-primary text-white shadow-sm"
                          : "text-secondarytext hover:text-primarytext hover:bg-secondarybg"
                      }`}
                    >
                      {tab.label}
                      {tab.key !== "all" &&
                        historyGrouped[tab.key]?.length > 0 && (
                          <span
                            className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                              historyFilter === tab.key
                                ? "bg-white/20"
                                : "bg-primarybg"
                            }`}
                          >
                            {historyGrouped[tab.key].length}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 max-h-[62vh] overflow-y-auto space-y-1">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loading fullScreen={false} text="Loading history..." />
                  </div>
                ) : getFilteredHistoryLogs().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-secondarytext">
                    <div className="p-4 bg-primarybg rounded-full mb-3">
                      <History size={28} className="opacity-25" />
                    </div>
                    <p className="font-semibold text-sm">
                      No change history found
                    </p>
                    <p className="text-xs mt-1 text-secondarytext/60">
                      Changes will appear here after document details are
                      updated.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupLogsByDate(getFilteredHistoryLogs()).map(
                      ({date, items: dateLogs}) => (
                        <div key={date}>
                          {/* ── Date Group Header ── */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full shrink-0">
                              <Calendar size={11} className="text-primary" />
                              <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                                {formatGroupDate(date)}
                              </span>
                            </div>
                            <div className="flex-1 h-px bg-primary/10" />
                            <span className="text-[10px] text-secondarytext shrink-0">
                              {dateLogs.length} change
                              {dateLogs.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* ── Column header row (shown once per group) ── */}
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1.5 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondarytext/50 text-left pl-3">
                              Previous
                            </span>
                            <span className="w-px" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondarytext/50 text-left pl-3">
                              Changed to
                            </span>
                          </div>

                          {/* ── Cards for this date ── */}
                          <div className="space-y-2">
                            {dateLogs.map((log) => (
                              <div
                                key={log.id}
                                className="rounded-md border border-primary/10 bg-secondarybg overflow-hidden shadow-sm"
                              >
                                {/* Card header: doc type + field + time + user */}
                                <div className="flex items-center justify-between px-4 py-2 bg-primarybg border-b border-primary/10">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getDocTypeColor(log.document_type)}`}
                                    >
                                      {formatDocType(log.document_type)}
                                    </span>
                                    <span className="text-xs font-semibold text-primarytext">
                                      {formatFieldName(log.field_name)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-secondarytext">
                                    <Clock size={10} />
                                    <span>
                                      {log.changed_at?.split(" ")[1] || ""}
                                    </span>
                                    <span className="opacity-30 mx-0.5">·</span>
                                    <User size={10} />
                                    <span>{log.changed_by_name}</span>
                                  </div>
                                </div>

                                {/* Two-column value row */}
                                <div className="grid grid-cols-2 divide-x divide-primary/10">
                                  {/* Left — Previous value */}
                                  <div className="px-4 py-2.5">
                                    {log.old_value ? (
                                      <p className="text-sm font-medium text-red/80 line-through">
                                        {log.old_value}
                                      </p>
                                    ) : (
                                      <p className="text-sm italic text-secondarytext/35">
                                        —
                                      </p>
                                    )}
                                  </div>

                                  {/* Right — Changed to value */}
                                  <div className="px-4 py-2.5 bg-green/4">
                                    {log.new_value ? (
                                      <p className="text-sm font-semibold text-green">
                                        {log.new_value}
                                      </p>
                                    ) : (
                                      <p className="text-sm italic text-secondarytext/35">
                                        —
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-primary/10 flex justify-between items-center">
                <p className="text-xs text-secondarytext">
                  {getFilteredHistoryLogs().length} change
                  {getFilteredHistoryLogs().length !== 1 ? "s" : ""} recorded
                </p>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-5 py-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
