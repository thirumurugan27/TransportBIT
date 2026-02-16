import React, {useState, useEffect} from "react";
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
  Trash2,
  Edit2,
  Search,
  Filter,
  Shield,
  FileCheck,
  FileText,
  Calendar,
  Save,
} from "lucide-react";

import {apiGet, apiPost, apiDelete} from "../../../utils/api";

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
  if (days === null) return "bg-gray-100 text-gray-500";
  if (days < 0) return "bg-red-500 text-white"; // Expired
  if (days <= 30) return "bg-red-100 text-red-700"; // Critical
  if (days <= 90) return "bg-amber-100 text-amber-700"; // Warning
  return "bg-green-100 text-green-700"; // OK
};

// Display date from backend (already in dd-mm-yyyy format)
const formatDate = (dateStr) => dateStr || "-";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter State
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("fleet"); // "fleet" or "expiry"

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Inline expiry edit state
  const [editingExpiry, setEditingExpiry] = useState(null); // { vehicleId, field }
  const [expiryFormValue, setExpiryFormValue] = useState("");

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
        return "Special Purpose";
      default:
        return type;
    }
  };

  const handleEdit = (vehicle) => {
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type,
      vehicle_number: vehicle.vehicle_number,
      seating_capacity: vehicle.seating_capacity,
      fuel_type: vehicle.fuel_type,
      status: vehicle.status || "available",
      vehicle_name: vehicle.vehicle_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
      insurance_expire_date: vehicle.insurance_expire_date
        ? vehicle.insurance_expire_date.split("T")[0]
        : "",
      fc_expire_date: vehicle.fc_expire_date
        ? vehicle.fc_expire_date.split("T")[0]
        : "",
      permit_expire_date: vehicle.permit_expire_date
        ? vehicle.permit_expire_date.split("T")[0]
        : "",
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

  // Helper to format date for API (YYYY-MM-DD only)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    return dateStr.split("T")[0];
  };

  // Handle inline expiry date update
  const handleExpiryClick = (vehicle, field) => {
    setEditingExpiry({vehicleId: vehicle.id, field});
    // Extract just the date part (YYYY-MM-DD) from the stored value
    const dateValue = vehicle[field];
    if (dateValue) {
      setExpiryFormValue(dateValue.split("T")[0]);
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
        <div className="flex bg-secondarybg rounded-md border border-primary/10 p-1.5 gap-1">
          {["ALL", "BUS", "CAR", "BATTERY_VEHICLE", "OTHER"].map((type) => {
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`min-w-24 px-4 py-2.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                  filterType === type
                    ? "bg-primary text-white shadow-sm"
                    : "text-secondarytext hover:bg-primary/5 hover:text-primary"
                }`}
              >
                {type === "ALL"
                  ? "All"
                  : type === "BATTERY_VEHICLE"
                    ? "Battery Vehicle"
                    : type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expiry Status View */}
      {viewMode === "expiry" && (
        <>
          {/* Expiry Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
                  <Shield size={20} />
                </div>
                <h4 className="font-bold text-gray-800">Insurance</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red-600">
                    {expiryStats.insurance.expired}
                  </p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-amber-600">
                    {expiryStats.insurance.critical}
                  </p>
                  <p className="text-xs text-amber-600 font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 text-green-600 rounded-md">
                  <FileCheck size={20} />
                </div>
                <h4 className="font-bold text-gray-800">
                  FC (Fitness Certificate)
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red-600">
                    {expiryStats.fc.expired}
                  </p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-amber-600">
                    {expiryStats.fc.critical}
                  </p>
                  <p className="text-xs text-amber-600 font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-md">
                  <FileText size={20} />
                </div>
                <h4 className="font-bold text-gray-800">Permit</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-red-600">
                    {expiryStats.permit.expired}
                  </p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-md">
                  <p className="text-2xl font-bold text-amber-600">
                    {expiryStats.permit.critical}
                  </p>
                  <p className="text-xs text-amber-600 font-medium">
                    {"< 30 days"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Table */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">💡 Tip:</span> Click
                on any expiry date cell to update it directly
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      S.No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Insurance Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      FC Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Permit Expire
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {v.vehicle_type === "BUS" ? (
                                  <Bus size={16} className="text-blue-500" />
                                ) : (
                                  <Car size={16} className="text-green-500" />
                                )}
                                <span className="font-semibold text-gray-900">
                                  {v.vehicle_name || v.vehicle_number} (
                                  {v.vehicle_number})
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {v.vehicle_type}
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
                                    className="p-1 text-green-600 hover:bg-green-50 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-md"
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
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-200 transition-all cursor-pointer"
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
                                <span className="text-gray-400">-</span>
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
                                    className="p-1 text-green-600 hover:bg-green-50 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "fc_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-green-50 rounded-md border border-transparent hover:border-green-200 transition-all cursor-pointer"
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
                                <span className="text-gray-400">-</span>
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
                                    className="p-1 text-green-600 hover:bg-green-50 rounded-md"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "permit_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-purple-50 rounded-md border border-transparent hover:border-purple-200 transition-all cursor-pointer"
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
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-6 py-12 text-center text-gray-500"
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Route / Location
                    </th>
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
                              <div className="text-xs text-secondarytext mt-1 flex items-center gap-2">
                                <span className="bg-primarybg px-2 py-0.5 rounded-md font-mono">
                                  #{v.id}
                                </span>
                                <span className="text-secondarytext/60">•</span>
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
                        <td className="px-6 py-5">
                          {v.vehicle_type === "BUS" ? (
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
                          ) : (
                            <span className="text-secondarytext text-sm">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md min-w-24 ${
                              v.status === "available"
                                ? "bg-green/10 text-green"
                                : v.status === "not_available"
                                  ? "bg-red/10 text-red"
                                  : "bg-pending/10 text-pending"
                            }`}
                          >
                            {v.status === "available" ? (
                              <CheckCircle size={14} />
                            ) : v.status === "not_available" ? (
                              <AlertCircle size={14} />
                            ) : (
                              <AlertCircle size={14} />
                            )}
                            {v.status === "available"
                              ? "Available"
                              : v.status === "not_available"
                                ? "Not Available"
                                : "In Service"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center">
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
          className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
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
                        <span className="text-sm text-secondarytext">Name</span>
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
                          selectedVehicle.status === "available"
                            ? "bg-green/20 text-green"
                            : selectedVehicle.status === "not_available"
                              ? "bg-red/20 text-red"
                              : "bg-pending/20 text-pending"
                        }`}
                      >
                        {selectedVehicle.status === "available"
                          ? "Available"
                          : selectedVehicle.status === "not_available"
                            ? "Not Available"
                            : "In Service"}
                      </span>
                    </div>
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
                    <div className="text-center p-3 bg-secondarybg rounded-md border border-gray-100">
                      <p className="text-xs text-secondarytext mb-1">
                        Insurance
                      </p>
                      <p className="text-sm font-semibold text-primarytext">
                        {formatDate(selectedVehicle.insurance_expire_date)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-secondarybg rounded-md border border-gray-100">
                      <p className="text-xs text-secondarytext mb-1">FC</p>
                      <p className="text-sm font-semibold text-primarytext">
                        {formatDate(selectedVehicle.fc_expire_date)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-secondarybg rounded-md border border-gray-100">
                      <p className="text-xs text-secondarytext mb-1">Permit</p>
                      <p className="text-sm font-semibold text-primarytext">
                        {formatDate(selectedVehicle.permit_expire_date)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end items-center gap-3">
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
      )}

      {/* Create Vehicle Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {isEditing ? "Edit" : "Create"}{" "}
                {vehicleForm.vehicle_type === "BUS" ? "Bus" : "Vehicle"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Vehicle Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Vehicle Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["BUS", "CAR", "BATTERY_VEHICLE", "OTHER"].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setVehicleForm({...vehicleForm, vehicle_type: type})
                      }
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium border transition-all ${
                        vehicleForm.vehicle_type === type
                          ? "bg-primary/10 border-primary text-primary ring-1 ring-primary"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      {type === "BUS" && (
                        <>
                          <Bus size={16} /> Bus
                        </>
                      )}
                      {type === "CAR" && (
                        <>
                          <Car size={16} /> Car
                        </>
                      )}
                      {type === "BATTERY_VEHICLE" && (
                        <>
                          <Zap size={16} /> Battery Vehicle
                        </>
                      )}
                      {type === "OTHER" && (
                        <>
                          <AlertCircle size={16} /> Other
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Name / Vehicle Number
                  </label>
                  <input
                    placeholder="e.g., bus-1,car-1 or Staff Car"
                    value={vehicleForm.vehicle_name}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        vehicle_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    placeholder="e.g., TN34 AB 1234"
                    value={vehicleForm.vehicle_number}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        vehicle_number: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono uppercase transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={vehicleForm.status}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                  >
                    <option value="available">✅ Available</option>
                    <option value="in_service">🚌 In Service</option>
                    <option value="not_available">❌ Not Available</option>
                  </select>
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuel Type
                  </label>
                  <select
                    value={vehicleForm.fuel_type}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        fuel_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                  >
                    <option value="DIESEL">🛢️ Diesel</option>
                    <option value="PETROL">⛽ Petrol</option>
                    <option value="CNG">🌿 CNG</option>
                    <option value="EV">⚡ Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    value={vehicleForm.seating_capacity}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        seating_capacity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    min="0"
                  />
                </div>
              </div>

              {/* Route Details (Bus Only) */}
              {vehicleForm.vehicle_type === "BUS" && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Route Details
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Insurance, FC & Permit Dates */}
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
                  📋 Insurance, FC & Permit Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className="w-full px-4 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-all font-bold shadow-lg shadow-primary/25 hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isEditing ? "Update" : "Create"} Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
