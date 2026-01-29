import React, {useState, useEffect} from "react";
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Helper to calculate days until expiry
const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get status color based on days remaining
const getStatusColor = (days) => {
  if (days === null) return "bg-gray-100 text-gray-500";
  if (days < 0) return "bg-red-500 text-white"; // Expired
  if (days <= 30) return "bg-red-100 text-red-700"; // Critical
  if (days <= 90) return "bg-amber-100 text-amber-700"; // Warning
  return "bg-green-100 text-green-700"; // OK
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

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

  // Form State
  const initialFormState = {
    vehicle_type: "BUS",
    vehicle_number: "",
    seating_capacity: 0,
    fuel_type: "DIESEL",
    bus_name: "",
    start_point: "",
    end_point: "",
    insurance_expire_date: "",
    fc_expire_date: "",
    permit_expire_date: "",
  };
  const [vehicleForm, setVehicleForm] = useState(initialFormState);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicles`);
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
      (v.bus_name &&
        v.bus_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getVehicleLabel = (v) => {
    if (v.bus_name) {
      return v.bus_name;
    }
    return v.vehicle_number;
  };

  const handleEdit = (vehicle) => {
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type,
      vehicle_number: vehicle.vehicle_number,
      seating_capacity: vehicle.seating_capacity,
      fuel_type: vehicle.fuel_type,
      bus_name: vehicle.bus_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
      insurance_expire_date: vehicle.insurance_expire_date || "",
      fc_expire_date: vehicle.fc_expire_date || "",
      permit_expire_date: vehicle.permit_expire_date || "",
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
      const res = await fetch(
        `${API_BASE}/api/admin/vehicles/delete?id=${id}`,
        {
          method: "DELETE",
        },
      );
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
      !vehicleForm.seating_capacity ||
      !vehicleForm.fuel_type
    ) {
      showError("Error", "Please fill all required fields");
      return;
    }
    if (
      vehicleForm.vehicle_type === "BUS" &&
      (!vehicleForm.bus_name ||
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
      const url = isEditing
        ? `${API_BASE}/api/admin/vehicles/update`
        : `${API_BASE}/api/admin/vehicles/create`;

      const body = isEditing ? {...vehicleForm, id: editingId} : vehicleForm;

      const res = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });

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
      const res = await fetch(`${API_BASE}/api/admin/vehicles/update`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(updatedVehicle),
      });

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
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex bg-secondarybg rounded-md border border-gray-200 p-1 gap-1">
          <button
            onClick={() => setViewMode("fleet")}
            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === "fleet"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primarybg"
            }`}
          >
            <Bus size={16} /> Fleet View
          </button>
          <button
            onClick={() => setViewMode("expiry")}
            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === "expiry"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primarybg"
            }`}
          >
            <Shield size={16} /> Insurance/FC/Permit Status
            {expiryStats.insurance.expired +
              expiryStats.fc.expired +
              expiryStats.permit.expired >
              0 && (
              <span className="ml-1 px-2 py-0.5 bg-red text-white text-xs rounded-full font-semibold">
                {expiryStats.insurance.expired +
                  expiryStats.fc.expired +
                  expiryStats.permit.expired}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondarytext mb-1">
                Total Vehicles
              </p>
              <p className="text-2xl font-bold text-primarytext">
                {vehicles?.length || 0}
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-md">
              <Bus size={20} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondarytext mb-1">
                Buses
              </p>
              <p className="text-2xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "BUS").length || 0}
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-md">
              <Bus size={20} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondarytext mb-1">
                Cars
              </p>
              <p className="text-2xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "CAR").length || 0}
              </p>
            </div>
            <div className="p-2.5 bg-green/10 rounded-md">
              <Car size={20} className="text-green" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondarytext mb-1">
                Battery Vehicles
              </p>
              <p className="text-2xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "BATTERY_VEHICLE")
                  .length || 0}
              </p>
            </div>
            <div className="p-2.5 bg-pending/10 rounded-md">
              <Zap size={20} className="text-pending" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondarytext mb-1">
                Others
              </p>
              <p className="text-2xl font-bold text-primarytext">
                {vehicles?.filter((v) => v.vehicle_type === "OTHER").length ||
                  0}
              </p>
            </div>
            <div className="p-2.5 bg-secondarytext/10 rounded-md">
              <Truck size={20} className="text-secondarytext" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex justify-between items-center bg-secondarybg p-5 rounded-md border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-primarytext">
            Vehicle Management
          </h2>
          <p className="text-sm text-secondarytext">
            Manage your entire fleet and assets
          </p>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setVehicleForm(initialFormState);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          Add New Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by vehicle number or bus name..."
            className="w-full pl-10 pr-4 py-2.5 bg-secondarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-primarytext placeholder:text-secondarytext"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-secondarybg rounded-md border border-gray-200 p-1 gap-1">
          {["ALL", "BUS", "CAR", "BATTERY_VEHICLE", "OTHER"].map((type) => {
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`min-w-[100px] px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  filterType === type
                    ? "bg-primary text-white shadow-sm"
                    : "text-secondarytext hover:bg-primarybg"
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
                                  {v.bus_name || v.vehicle_number} (
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
                                    className="px-2 py-1 text-sm border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
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
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.insurance_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {insDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(insDays)}`}
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
                                    className="px-2 py-1 text-sm border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "fc_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-green-50 rounded border border-transparent hover:border-green-200 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.fc_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fcDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(fcDays)}`}
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
                                    className="px-2 py-1 text-sm border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleExpiryUpdate}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelExpiryEdit}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleExpiryClick(v, "permit_expire_date")
                                  }
                                  className="px-2 py-1 text-sm text-gray-700 hover:bg-purple-50 rounded border border-transparent hover:border-purple-200 transition-all cursor-pointer"
                                  title="Click to update"
                                >
                                  {formatDate(v.permit_expire_date)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permitDays !== null ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(permitDays)}`}
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
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-secondarytext flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p>Loading fleet data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primarybg border-b border-gray-200">
                  <tr>
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    filteredVehicles.map((v) => (
                      <tr
                        key={v.id}
                        className="hover:bg-primarybg transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div
                              className={`h-11 w-11 rounded-md flex items-center justify-center transition-colors ${
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
                                <Bus size={20} />
                              ) : v.vehicle_type === "CAR" ? (
                                <Car size={20} />
                              ) : v.vehicle_type === "BATTERY_VEHICLE" ? (
                                <Zap size={20} />
                              ) : (
                                <Truck size={20} />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-primarytext">
                                {getVehicleLabel(v)}
                              </div>
                              <div className="text-xs text-secondarytext font-mono mt-0.5">
                                #{v.id} • {v.vehicle_number}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {v.vehicle_type === "BUS" && (
                            <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                              College Bus
                            </span>
                          )}
                          {v.vehicle_type === "CAR" &&
                            v.seating_capacity <= 5 && (
                              <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-green/10 text-green border border-green/20">
                                Car (5-Seater)
                              </span>
                            )}
                          {v.vehicle_type === "CAR" &&
                            v.seating_capacity > 5 && (
                              <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-green/10 text-green border border-green/20">
                                Car (7-Seater)
                              </span>
                            )}
                          {v.vehicle_type === "BATTERY_VEHICLE" && (
                            <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-pending/10 text-pending border border-pending/20">
                              Battery Vehicle
                            </span>
                          )}
                          {v.vehicle_type === "OTHER" && (
                            <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-secondarytext/10 text-secondarytext border border-secondarytext/20">
                              Special Purpose
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-xs font-medium text-primarytext">
                              {v.fuel_type === "EV" ? (
                                <Zap size={14} className="text-primary" />
                              ) : (
                                <Fuel
                                  size={14}
                                  className="text-secondarytext"
                                />
                              )}
                              {v.fuel_type}
                            </div>
                            <div className="text-xs text-secondarytext">
                              {v.seating_capacity} Seats
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-secondarytext">
                          {v.vehicle_type === "BUS" ? (
                            <div className="flex flex-col text-xs gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                                <span className="font-medium text-primarytext">
                                  {v.start_point || "?"}
                                </span>
                              </div>
                              <div className="h-3 border-l border-gray-200 ml-[3px]"></div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-red"></div>
                                <span className="font-medium text-primarytext">
                                  {v.end_point || "?"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-secondarytext">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${
                              v.status === "available"
                                ? "bg-green/10 text-green border-green/20"
                                : "bg-pending/10 text-pending border-pending/20"
                            }`}
                          >
                            {v.status === "available" ? (
                              <CheckCircle size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {v.status === "available"
                              ? "Available"
                              : "In Service"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="p-2 text-secondarytext hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                              onClick={() => handleEdit(v)}
                              title="Edit Vehicle"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="p-2 text-secondarytext hover:text-red hover:bg-red/10 rounded-md transition-all"
                              onClick={() => handleDelete(v.id)}
                              title="Delete Vehicle"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-secondarytext"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-primarybg rounded-full flex items-center justify-center">
                            <Bus size={24} className="text-secondarytext" />
                          </div>
                          <p>No vehicles found. Add one to get started.</p>
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

      {/* Create Vehicle Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
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
                          ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
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
                    Vehicle Name / Route Name
                  </label>
                  <input
                    placeholder="e.g., Route A Express or Staff Car"
                    value={vehicleForm.bus_name}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        bus_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none font-mono uppercase transition-all"
                  />
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    min="1"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className="w-full px-4 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 transition-all font-bold shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-xl transform hover:-translate-y-0.5"
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
