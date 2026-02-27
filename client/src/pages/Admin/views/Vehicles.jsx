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
} from "lucide-react";

import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import CustomDropdown from "../../../components/ui/CustomDropdown";

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

const VEHICLE_TYPE_OPTIONS = [
  {value: "ALL", label: "All Vehicles", icon: Bus},
  {value: "BUS", label: "College Bus", icon: Bus},
  {value: "CAR", label: "Car", icon: Car},
  {value: "BATTERY_VEHICLE", label: "Battery Vehicle", icon: Zap},
  {value: "OTHER", label: "Others", icon: Truck},
];

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
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

  // Form State
  const initialFormState = {
    vehicle_type: "BUS",
    vehicle_number: "",
    seating_capacity: 0,
    fuel_type: "DIESEL",
    vehicle_name: "",
    start_point: "",
    end_point: "",
    insurance_expire_date: "",
    fc_expire_date: "",
    permit_expire_date: "",
    status: "available",
  };
  const [vehicleForm, setVehicleForm] = useState(initialFormState);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/vehicles");
      const data = await res.json();
      setVehicles(data || []);
    } catch (err) {
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
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

  // Get vehicle type display name
  const getVehicleTypeLabel = (type) => {
    switch (type) {
      case "BUS":
        return "College Bus";
      case "CAR":
        return "Car";
      case "BATTERY_VEHICLE":
        return "Battery Vehicle";
      case "OTHER":
        return "Others";
      default:
        return type;
    }
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
      seating_capacity: vehicle.seating_capacity ?? "NA",
      fuel_type: vehicle.fuel_type || "NA",
      status: normalizeStatus(vehicle.status),
      vehicle_name: vehicle.vehicle_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
      insurance_expire_date: formatDateForInput(vehicle.insurance_expire_date),
      fc_expire_date: formatDateForInput(vehicle.fc_expire_date),
      permit_expire_date: formatDateForInput(vehicle.permit_expire_date),
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

      const body = isEditing ? {...vehicleForm, id: editingId} : vehicleForm;

      const res = await apiPost(endpoint, body);

      if (res.ok) {
        showSuccess(
          "Success",
          isEditing
            ? "Vehicle updated successfully!"
            : "Vehicle created successfully!",
        );
        fetchVehicles();
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
    const updatedVehicle = {
      id: vehicle.id,
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      fuel_type: vehicle.fuel_type,
      seating_capacity: vehicle.seating_capacity,
      status: vehicle.status,
      insurance_expire_date: formatDateForAPI(vehicle.insurance_expire_date),
      fc_expire_date: formatDateForAPI(vehicle.fc_expire_date),
      permit_expire_date: formatDateForAPI(vehicle.permit_expire_date),
      [editingExpiry.field]: expiryFormValue || null,
    };

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

  // Get expiry stats
  const getExpiryStats = () => {
    let insuranceExpired = 0,
      insuranceCritical = 0;
    let fcExpired = 0,
      fcCritical = 0;
    let permitExpired = 0,
      permitCritical = 0;

    vehicles.forEach((v) => {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);

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
    });

    return {
      insurance: {expired: insuranceExpired, critical: insuranceCritical},
      fc: {expired: fcExpired, critical: fcCritical},
      permit: {expired: permitExpired, critical: permitCritical},
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
              expiryStats.permit.expired >
              0 && (
              <span className="ml-1 px-2 py-0.5 bg-red text-white text-xs rounded-md font-bold">
                {expiryStats.insurance.expired +
                  expiryStats.fc.expired +
                  expiryStats.permit.expired}
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
              const opt = VEHICLE_TYPE_OPTIONS.find(
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
              {VEHICLE_TYPE_OPTIONS.map((type) => {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-skyblue/10 text-skyblue rounded-md">
                  <Shield size={20} />
                </div>
                <h4 className="font-bold text-primarytext">Insurance</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red/5 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red">
                    {expiryStats.insurance.expired}
                  </p>
                  <p className="text-xs text-red font-medium">Expired</p>
                </div>
                <div className="bg-pending/10 p-3 rounded-md">
                  <p className="text-2xl font-bold text-pending">
                    {expiryStats.insurance.critical}
                  </p>
                  <p className="text-xs text-pending font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green/10 text-green rounded-md">
                  <FileCheck size={20} />
                </div>
                <h4 className="font-bold text-primarytext">
                  FC (Fitness Certificate)
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red/5 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red">
                    {expiryStats.fc.expired}
                  </p>
                  <p className="text-xs text-red font-medium">Expired</p>
                </div>
                <div className="bg-pending/10 p-3 rounded-md">
                  <p className="text-2xl font-bold text-pending">
                    {expiryStats.fc.critical}
                  </p>
                  <p className="text-xs text-pending font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  <FileText size={20} />
                </div>
                <h4 className="font-bold text-primarytext">Permit</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red/5 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red">
                    {expiryStats.permit.expired}
                  </p>
                  <p className="text-xs text-red font-medium">Expired</p>
                </div>
                <div className="bg-pending/10 p-3 rounded-md">
                  <p className="text-2xl font-bold text-pending">
                    {expiryStats.permit.critical}
                  </p>
                  <p className="text-xs text-pending font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Table */}
          <div className="bg-secondarybg rounded-md shadow-sm border border-primary/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-primary/5 bg-primarybg/50">
              <p className="text-sm text-secondarytext">
                <span className="font-medium text-primarytext">Tip:</span> Click
                on any expiry date cell to update it directly
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primarybg/50 border-b border-primary/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      S.No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Insurance Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      FC Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Permit Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Days
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
                        );
                        const bMin = Math.min(
                          getDaysUntil(b.insurance_expire_date) ?? 9999,
                          getDaysUntil(b.fc_expire_date) ?? 9999,
                          getDaysUntil(b.permit_expire_date) ?? 9999,
                        );
                        return aMin - bMin;
                      })
                      .map((v, idx) => {
                        const insDays = getDaysUntil(v.insurance_expire_date);
                        const fcDays = getDaysUntil(v.fc_expire_date);
                        const permitDays = getDaysUntil(v.permit_expire_date);

                        return (
                          <tr
                            key={v.id}
                            className="hover:bg-primarybg/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-secondarytext font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {v.vehicle_type === "BUS" ? (
                                  <Bus size={16} className="text-primary" />
                                ) : v.vehicle_type === "CAR" ? (
                                  <Car size={16} className="text-green" />
                                ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                  <Zap size={16} className="text-pending" />
                                ) : (
                                  <Truck
                                    size={16}
                                    className="text-secondarytext"
                                  />
                                )}
                                <span className="font-semibold text-primarytext">
                                  {v.vehicle_name || v.vehicle_number}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondarytext">
                              {getVehicleTypeLabel(v.vehicle_type)}
                            </td>

                            {/* Insurance Expire - Clickable */}
                            <td className="px-4 py-3 text-center">
                              {editingExpiry?.vehicleId === v.id &&
                              editingExpiry?.field ===
                                "insurance_expire_date" ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="date"
                                    value={expiryFormValue}
                                    onChange={(e) =>
                                      setExpiryFormValue(e.target.value)
                                    }
                                    className="px-2 py-1 text-sm border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green hover:bg-green/10 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-secondarytext hover:bg-primarybg rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(
                                      v,
                                      "insurance_expire_date",
                                    )
                                  }
                                  className="px-2 py-1 text-sm text-primarytext hover:bg-skyblue/10 rounded-md border border-transparent hover:border-skyblue/20 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.insurance_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {insDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded-md text-xs font-bold ${getStatusColor(insDays)}`}
                                >
                                  {insDays < 0
                                    ? `${Math.abs(insDays)} overdue`
                                    : insDays}
                                </span>
                              ) : (
                                <span className="text-secondarytext/60">-</span>
                              )}
                            </td>

                            {/* FC Expire - Clickable */}
                            <td className="px-4 py-3 text-center">
                              {editingExpiry?.vehicleId === v.id &&
                              editingExpiry?.field === "fc_expire_date" ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="date"
                                    value={expiryFormValue}
                                    onChange={(e) =>
                                      setExpiryFormValue(e.target.value)
                                    }
                                    className="px-2 py-1 text-sm border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green hover:bg-green/10 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-secondarytext hover:bg-primarybg rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "fc_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-primarytext hover:bg-green/10 rounded-md border border-transparent hover:border-green/20 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.fc_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fcDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded-md text-xs font-bold ${getStatusColor(fcDays)}`}
                                >
                                  {fcDays < 0
                                    ? `${Math.abs(fcDays)} overdue`
                                    : fcDays}
                                </span>
                              ) : (
                                <span className="text-secondarytext/60">-</span>
                              )}
                            </td>

                            {/* Permit Expire - Clickable */}
                            <td className="px-4 py-3 text-center">
                              {editingExpiry?.vehicleId === v.id &&
                              editingExpiry?.field === "permit_expire_date" ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="date"
                                    value={expiryFormValue}
                                    onChange={(e) =>
                                      setExpiryFormValue(e.target.value)
                                    }
                                    className="px-2 py-1 text-sm border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green hover:bg-green/10 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-secondarytext hover:bg-primarybg rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "permit_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-primarytext hover:bg-primary/5 rounded-md border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.permit_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permitDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded-md text-xs font-bold ${getStatusColor(permitDays)}`}
                                >
                                  {permitDays < 0
                                    ? `${Math.abs(permitDays)} overdue`
                                    : permitDays}
                                </span>
                              ) : (
                                <span className="text-secondarytext/60">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
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
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md ${
                              v.vehicle_type === "BUS"
                                ? "bg-primary/10 text-primary"
                                : v.vehicle_type === "CAR"
                                  ? "bg-green/10 text-green"
                                  : v.vehicle_type === "BATTERY_VEHICLE"
                                    ? "bg-pending/10 text-pending"
                                    : "bg-secondarytext/10 text-secondarytext"
                            }`}
                          >
                            {v.vehicle_type === "BUS" && (
                              <>
                                <Bus size={12} />
                                College Bus
                              </>
                            )}
                            {v.vehicle_type === "CAR" && (
                              <>
                                <Car size={12} />
                                {v.seating_capacity <= 5
                                  ? "Car (5-Seater)"
                                  : "Car (7-Seater)"}
                              </>
                            )}
                            {v.vehicle_type === "BATTERY_VEHICLE" && (
                              <>
                                <Zap size={12} />
                                Battery Vehicle
                              </>
                            )}
                            {v.vehicle_type === "OTHER" && (
                              <>
                                <Truck size={12} />
                                Special Purpose
                              </>
                            )}
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
              className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-modalSlideIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-primary/10 flex items-start justify-between">
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
                      <Bus size={24} />
                    ) : selectedVehicle.vehicle_type === "CAR" ? (
                      <Car size={24} />
                    ) : selectedVehicle.vehicle_type === "BATTERY_VEHICLE" ? (
                      <Zap size={24} />
                    ) : (
                      <Truck size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-primarytext">
                      {getVehicleLabel(selectedVehicle)}
                    </h3>
                    <p className="text-sm text-secondarytext mt-0.5">
                      {selectedVehicle.vehicle_number} •{" "}
                      {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Vehicle Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Vehicle Information
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Vehicle Number
                        </span>
                        <span className="text-sm font-semibold text-primarytext font-mono">
                          {selectedVehicle.vehicle_number}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">Type</span>
                        <span className="text-sm font-semibold text-primarytext">
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
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Fuel size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Specifications
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Fuel Type
                        </span>
                        <span className="text-sm font-semibold text-primarytext">
                          {selectedVehicle.fuel_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Seating Capacity
                        </span>
                        <span className="text-sm font-semibold text-primarytext">
                          {selectedVehicle.seating_capacity} Seats
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Route Details (for Bus) */}
                  {selectedVehicle.vehicle_type === "BUS" && (
                    <div className="bg-primarybg rounded-md p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={16} className="text-primary" />
                        <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                          Route Details
                        </h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Start Point
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.start_point || "-"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            End Point
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.end_point || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Status
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Current Status
                        </span>
                        <span
                          className={`px-3 py-1 rounded-md text-xs font-semibold ${
                            normalizeStatus(selectedVehicle.status) ===
                            "available"
                              ? "bg-green/20 text-green"
                              : normalizeStatus(selectedVehicle.status) ===
                                  "not_available"
                                ? "bg-red/20 text-red"
                                : "bg-pending/20 text-pending"
                          }`}
                        >
                          {normalizeStatus(selectedVehicle.status) ===
                          "available"
                            ? "Available"
                            : normalizeStatus(selectedVehicle.status) ===
                                "not_available"
                              ? "Not Available"
                              : "In Service"}
                        </span>
                      </div>
                      {selectedVehicle.replacement_vehicle_number && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-secondarytext">
                              Replacement Vehicle
                            </span>
                            <span className="px-3 py-1 rounded-md text-xs font-semibold bg-skyblue/20 text-skyblue">
                              {selectedVehicle.replacement_vehicle_number}
                            </span>
                          </div>
                          {selectedVehicle.replacement_reason && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-secondarytext">
                                Reason
                              </span>
                              <span className="text-sm font-medium text-primarytext capitalize">
                                {selectedVehicle.replacement_reason.replace(
                                  /_/g,
                                  " ",
                                )}
                              </span>
                            </div>
                          )}
                          {selectedVehicle.replacement_start_date && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-secondarytext">
                                Replacement Period
                              </span>
                              <span className="text-sm font-medium text-primarytext">
                                {selectedVehicle.replacement_start_date} -{" "}
                                {selectedVehicle.replacement_end_date ||
                                  "Ongoing"}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expiry Details */}
                {(selectedVehicle.insurance_expire_date ||
                  selectedVehicle.fc_expire_date ||
                  selectedVehicle.permit_expire_date) && (
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Documents & Expiry
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-secondarybg rounded-md border border-primary/10">
                        <p className="text-xs text-secondarytext mb-1">
                          Insurance
                        </p>
                        <p className="text-sm font-semibold text-primarytext">
                          {formatDate(selectedVehicle.insurance_expire_date)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-secondarybg rounded-md border border-primary/10">
                        <p className="text-xs text-secondarytext mb-1">FC</p>
                        <p className="text-sm font-semibold text-primarytext">
                          {formatDate(selectedVehicle.fc_expire_date)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-secondarybg rounded-md border border-primary/10">
                        <p className="text-xs text-secondarytext mb-1">
                          Permit
                        </p>
                        <p className="text-sm font-semibold text-primarytext">
                          {formatDate(selectedVehicle.permit_expire_date)}
                        </p>
                      </div>
                    </div>
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
                          {[
                            {value: "BUS", label: "Bus", icon: Bus},
                            {value: "CAR", label: "Car", icon: Car},
                            {
                              value: "BATTERY_VEHICLE",
                              label: "Battery Vehicle",
                              icon: Zap,
                            },
                            {value: "OTHER", label: "Other", icon: AlertCircle},
                          ].map((type) => (
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
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Insurance Expire Date
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
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          FC (Fitness Certificate) Expire Date
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

                  {/* Permit Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileCheck size={18} className="text-primary" />
                      <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                        Permit Details
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Permit Expire Date
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
                      <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-xs text-secondarytext">
                          <Calendar
                            size={14}
                            className="inline mr-1.5 text-primary"
                          />
                          Expiry dates help track document renewals. You'll get
                          alerts when documents are about to expire.
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
                    className="px-5 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-semibold text-sm flex items-center gap-2"
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
    </div>
  );
}
