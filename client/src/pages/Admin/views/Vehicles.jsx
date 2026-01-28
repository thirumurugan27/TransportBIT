import React, {useState, useEffect} from "react";
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
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
    if (v.vehicle_type === "BUS") return `${v.vehicle_number} (${v.bus_name})`;
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
    if (!window.confirm("Are you sure you want to delete this vehicle?"))
      return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vehicles/delete?id=${id}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        alert("Vehicle deleted successfully!");
        fetchVehicles();
      } else {
        alert("Failed to delete vehicle: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting vehicle");
    }
  };

  const handleSubmit = async () => {
    if (
      !vehicleForm.vehicle_type ||
      !vehicleForm.vehicle_number ||
      !vehicleForm.seating_capacity ||
      !vehicleForm.fuel_type
    ) {
      alert("Please fill all required fields");
      return;
    }
    if (
      vehicleForm.vehicle_type === "BUS" &&
      (!vehicleForm.bus_name ||
        !vehicleForm.start_point ||
        !vehicleForm.end_point)
    ) {
      alert("Please fill all bus details (Name, Start/End Points)");
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
        alert(
          isEditing
            ? "Vehicle updated successfully!"
            : "Vehicle created successfully!"
        );
        fetchVehicles();
        setShowCreateModal(false);
        setVehicleForm(initialFormState);
        setIsEditing(false);
        setEditingId(null);
      } else {
        alert(
          `Failed to ${isEditing ? "update" : "create"} vehicle: ` +
            (await res.text())
        );
      }
    } catch (err) {
      console.error(err);
      alert(`Error ${isEditing ? "updating" : "creating"} vehicle`);
    }
  };

  // Helper to format date for API (YYYY-MM-DD only)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    return dateStr.split('T')[0];
  };

  // Handle inline expiry date update
  const handleExpiryClick = (vehicle, field) => {
    setEditingExpiry({ vehicleId: vehicle.id, field });
    // Extract just the date part (YYYY-MM-DD) from the stored value
    const dateValue = vehicle[field];
    if (dateValue) {
      setExpiryFormValue(dateValue.split('T')[0]);
    } else {
      setExpiryFormValue("");
    }
  };

  const handleExpiryUpdate = async () => {
    if (!editingExpiry) return;
    
    const vehicle = vehicles.find(v => v.id === editingExpiry.vehicleId);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedVehicle),
      });

      if (res.ok) {
        fetchVehicles();
        setEditingExpiry(null);
        setExpiryFormValue("");
      } else {
        alert("Failed to update expiry date: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      alert("Error updating expiry date");
    }
  };

  const cancelExpiryEdit = () => {
    setEditingExpiry(null);
    setExpiryFormValue("");
  };

  // Get expiry stats
  const getExpiryStats = () => {
    let insuranceExpired = 0, insuranceCritical = 0;
    let fcExpired = 0, fcCritical = 0;
    let permitExpired = 0, permitCritical = 0;

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
      insurance: { expired: insuranceExpired, critical: insuranceCritical },
      fc: { expired: fcExpired, critical: fcCritical },
      permit: { expired: permitExpired, critical: permitCritical },
    };
  };

  const expiryStats = getExpiryStats();

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setViewMode("fleet")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === "fleet"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Bus size={16} /> Fleet View
          </button>
          <button
            onClick={() => setViewMode("expiry")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === "expiry"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Shield size={16} /> Insurance/FC/Permit Status
            {(expiryStats.insurance.expired + expiryStats.fc.expired + expiryStats.permit.expired) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {expiryStats.insurance.expired + expiryStats.fc.expired + expiryStats.permit.expired}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Buses
            </h4>
            <p className="text-3xl font-bold text-gray-800">
              {vehicles?.filter((v) => v.vehicle_type === "BUS").length || 0}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Bus size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Electric
            </h4>
            <p className="text-3xl font-bold text-purple-600">
              {vehicles?.filter((v) => v.fuel_type === "EV").length || 0}
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Zap size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Cars
            </h4>
            <p className="text-3xl font-bold text-emerald-600">
              {vehicles?.filter((v) => v.vehicle_type === "CAR").length || 0}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Car size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Others
            </h4>
            <p className="text-3xl font-bold text-gray-600">
              {vehicles?.filter(
                (v) => v.vehicle_type === "OTHER" || v.vehicle_type === "VAN"
              ).length || 0}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-gray-600">
            <Truck size={24} />
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Vehicle Management
          </h2>
          <p className="text-sm text-gray-500">
            Manage your entire fleet and assets
          </p>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setVehicleForm(initialFormState);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-md shadow-[var(--color-primary)]/25"
        >
          <Plus size={18} />
          Add New Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by vehicle number or bus name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
          {["ALL", "BUS", "CAR", "VAN", "OTHER"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                filterType === type
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {type === "ALL"
                ? "All"
                : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry Status View */}
      {viewMode === "expiry" && (
        <>
          {/* Expiry Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Shield size={20} />
                </div>
                <h4 className="font-bold text-gray-800">Insurance</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{expiryStats.insurance.expired}</p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{expiryStats.insurance.critical}</p>
                  <p className="text-xs text-amber-600 font-medium">{"< 30 days"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <FileCheck size={20} />
                </div>
                <h4 className="font-bold text-gray-800">FC (Fitness Certificate)</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{expiryStats.fc.expired}</p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{expiryStats.fc.critical}</p>
                  <p className="text-xs text-amber-600 font-medium">{"< 30 days"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <h4 className="font-bold text-gray-800">Permit</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{expiryStats.permit.expired}</p>
                  <p className="text-xs text-red-600 font-medium">Expired</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{expiryStats.permit.critical}</p>
                  <p className="text-xs text-amber-600 font-medium">{"< 30 days"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">💡 Tip:</span> Click on any expiry date cell to update it directly
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Insurance Expire</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">FC Expire</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Permit Expire</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVehicles && filteredVehicles.length > 0 ? (
                    [...filteredVehicles].sort((a, b) => {
                      const aMin = Math.min(
                        getDaysUntil(a.insurance_expire_date) ?? 9999,
                        getDaysUntil(a.fc_expire_date) ?? 9999,
                        getDaysUntil(a.permit_expire_date) ?? 9999
                      );
                      const bMin = Math.min(
                        getDaysUntil(b.insurance_expire_date) ?? 9999,
                        getDaysUntil(b.fc_expire_date) ?? 9999,
                        getDaysUntil(b.permit_expire_date) ?? 9999
                      );
                      return aMin - bMin;
                    }).map((v, idx) => {
                      const insDays = getDaysUntil(v.insurance_expire_date);
                      const fcDays = getDaysUntil(v.fc_expire_date);
                      const permitDays = getDaysUntil(v.permit_expire_date);

                      return (
                        <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {v.vehicle_type === "BUS" ? (
                                <Bus size={16} className="text-blue-500" />
                              ) : (
                                <Car size={16} className="text-green-500" />
                              )}
                              <span className="font-semibold text-gray-900">{v.vehicle_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.vehicle_type}</td>

                          {/* Insurance Expire - Clickable */}
                          <td className="px-4 py-3 text-center">
                            {editingExpiry?.vehicleId === v.id && editingExpiry?.field === "insurance_expire_date" ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="date"
                                  value={expiryFormValue}
                                  onChange={(e) => setExpiryFormValue(e.target.value)}
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
                                onClick={() => handleExpiryClick(v, "insurance_expire_date")}
                                className="px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                                title="Click to update"
                              >
                                {formatDate(v.insurance_expire_date)}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {insDays !== null ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(insDays)}`}>
                                {insDays < 0 ? `${Math.abs(insDays)} overdue` : insDays}
                              </span>
                            ) : <span className="text-gray-400">-</span>}
                          </td>

                          {/* FC Expire - Clickable */}
                          <td className="px-4 py-3 text-center">
                            {editingExpiry?.vehicleId === v.id && editingExpiry?.field === "fc_expire_date" ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="date"
                                  value={expiryFormValue}
                                  onChange={(e) => setExpiryFormValue(e.target.value)}
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
                                onClick={() => handleExpiryClick(v, "fc_expire_date")}
                                className="px-2 py-1 text-sm text-gray-700 hover:bg-green-50 rounded border border-transparent hover:border-green-200 transition-all cursor-pointer"
                                title="Click to update"
                              >
                                {formatDate(v.fc_expire_date)}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {fcDays !== null ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(fcDays)}`}>
                                {fcDays < 0 ? `${Math.abs(fcDays)} overdue` : fcDays}
                              </span>
                            ) : <span className="text-gray-400">-</span>}
                          </td>

                          {/* Permit Expire - Clickable */}
                          <td className="px-4 py-3 text-center">
                            {editingExpiry?.vehicleId === v.id && editingExpiry?.field === "permit_expire_date" ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="date"
                                  value={expiryFormValue}
                                  onChange={(e) => setExpiryFormValue(e.target.value)}
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
                                onClick={() => handleExpiryClick(v, "permit_expire_date")}
                                className="px-2 py-1 text-sm text-gray-700 hover:bg-purple-50 rounded border border-transparent hover:border-purple-200 transition-all cursor-pointer"
                                title="Click to update"
                              >
                                {formatDate(v.permit_expire_date)}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {permitDays !== null ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(permitDays)}`}>
                                {permitDays < 0 ? `${Math.abs(permitDays)} overdue` : permitDays}
                              </span>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mb-4"></div>
            <p>Loading fleet data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Vehicle Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Specs
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Route / Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles && filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-12 w-12 rounded-lg flex items-center justify-center text-xl transition-colors ${
                              v.vehicle_type === "BUS"
                                ? "bg-blue-50 text-blue-600"
                                : v.fuel_type === "EV"
                                ? "bg-purple-50 text-purple-600"
                                : v.vehicle_type === "CAR"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-gray-50 text-gray-600"
                            }`}
                          >
                            {v.vehicle_type === "BUS" ? (
                              <Bus size={20} />
                            ) : v.vehicle_type === "CAR" ? (
                              <Car size={20} />
                            ) : (
                              <Truck size={20} />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {getVehicleLabel(v)}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              #{v.id} • {v.vehicle_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {v.vehicle_type === "BUS" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            College Bus
                          </span>
                        )}
                        {v.vehicle_type === "CAR" &&
                          v.seating_capacity <= 5 && (
                            <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Car (5-Seater)
                            </span>
                          )}
                        {v.vehicle_type === "CAR" && v.seating_capacity > 5 && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Car (7-Seater)
                          </span>
                        )}
                        {v.vehicle_type === "VAN" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Van
                          </span>
                        )}
                        {v.vehicle_type === "OTHER" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                            Special Purpose
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            {v.fuel_type === "EV" ? (
                              <Zap size={14} className="text-purple-500" />
                            ) : (
                              <Fuel size={14} className="text-gray-400" />
                            )}
                            {v.fuel_type}
                          </div>
                          <div className="text-xs text-gray-500">
                            {v.seating_capacity} Seats
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {v.vehicle_type === "BUS" ? (
                          <div className="flex flex-col text-xs gap-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                              <span className="font-medium text-gray-700">
                                {v.start_point || "?"}
                              </span>
                            </div>
                            <div className="h-3 border-l border-gray-200 ml-[3px]"></div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                              <span className="font-medium text-gray-700">
                                {v.end_point || "?"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${
                            v.status === "available"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
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
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            onClick={() => handleEdit(v)}
                            title="Edit Vehicle"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            onClick={() => handleDelete(v.id)}
                            title="Delete Vehicle"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Bus size={24} className="text-gray-400" />
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
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {isEditing ? "Edit" : "Create"}{" "}
                {vehicleForm.vehicle_type === "BUS" ? "Bus" : "Vehicle"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
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
                  {["BUS", "CAR", "VAN", "OTHER"].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setVehicleForm({...vehicleForm, vehicle_type: type})
                      }
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
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
                      {type === "VAN" && (
                        <>
                          <Truck size={16} /> Van
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
                {vehicleForm.vehicle_type === "BUS" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bus Name / Route Name
                    </label>
                    <input
                      placeholder="e.g., Route A Express"
                      value={vehicleForm.bus_name}
                      onChange={(e) =>
                        setVehicleForm({
                          ...vehicleForm,
                          bus_name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    />
                  </div>
                )}

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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none font-mono uppercase transition-all"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    min="1"
                  />
                </div>
              </div>

              {/* Route Details (Bus Only) */}
              {vehicleForm.vehicle_type === "BUS" && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Insurance, FC & Permit Dates */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className="w-full px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all font-bold shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-xl transform hover:-translate-y-0.5"
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
