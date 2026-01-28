import React, {useState, useEffect} from "react";
import {
  Shield,
  FileCheck,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bus,
  Car,
  Filter,
  Download,
  Search,
  RefreshCw,
  Wrench,
  RotateCcw,
  Save,
  X,
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

const getStatusBg = (days) => {
  if (days === null) return "bg-gray-50";
  if (days < 0) return "bg-red-50"; // Expired
  if (days <= 30) return "bg-red-50"; // Critical
  if (days <= 90) return "bg-amber-50"; // Warning
  return "bg-green-50"; // OK
};

export default function InsuranceFCStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("ALL"); // ALL, BUS, CAR
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, EXPIRED, CRITICAL, WARNING, OK
  const [searchQuery, setSearchQuery] = useState("");

  // Inline expiry edit state
  const [editingExpiry, setEditingExpiry] = useState(null); // { vehicleId, field }
  const [expiryFormValue, setExpiryFormValue] = useState("");

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

  // Handle inline expiry date click
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

  // Helper to format date for API (YYYY-MM-DD only)
  const formatDateForAPI = (dateStr) => {
    if (!dateStr) return null;
    // Already in YYYY-MM-DD format from input[type="date"]
    return dateStr.split('T')[0];
  };

  // Handle inline expiry date update
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

  // Calculate stats
  const getVehicleStats = () => {
    let insuranceExpired = 0, insuranceCritical = 0, insuranceWarning = 0;
    let fcExpired = 0, fcCritical = 0, fcWarning = 0;
    let permitExpired = 0, permitCritical = 0, permitWarning = 0;

    vehicles.forEach((v) => {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);

      if (insDays !== null) {
        if (insDays < 0) insuranceExpired++;
        else if (insDays <= 30) insuranceCritical++;
        else if (insDays <= 90) insuranceWarning++;
      }
      if (fcDays !== null) {
        if (fcDays < 0) fcExpired++;
        else if (fcDays <= 30) fcCritical++;
        else if (fcDays <= 90) fcWarning++;
      }
      if (permitDays !== null) {
        if (permitDays < 0) permitExpired++;
        else if (permitDays <= 30) permitCritical++;
        else if (permitDays <= 90) permitWarning++;
      }
    });

    return {
      insurance: { expired: insuranceExpired, critical: insuranceCritical, warning: insuranceWarning },
      fc: { expired: fcExpired, critical: fcCritical, warning: fcWarning },
      permit: { expired: permitExpired, critical: permitCritical, warning: permitWarning },
    };
  };

  const stats = getVehicleStats();

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    // Type filter
    if (filterType !== "ALL" && v.vehicle_type !== filterType) return false;

    // Search filter
    if (searchQuery && !v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Status filter
    if (filterStatus !== "ALL") {
      if (filterStatus === "MAINTENANCE") {
        return v.status === 'under_maintenance';
      }
      
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);

      const isExpired = (insDays !== null && insDays < 0) || (fcDays !== null && fcDays < 0) || (permitDays !== null && permitDays < 0);
      const isCritical = (insDays !== null && insDays >= 0 && insDays <= 30) || (fcDays !== null && fcDays >= 0 && fcDays <= 30) || (permitDays !== null && permitDays >= 0 && permitDays <= 30);
      const isWarning = (insDays !== null && insDays > 30 && insDays <= 90) || (fcDays !== null && fcDays > 30 && fcDays <= 90) || (permitDays !== null && permitDays > 30 && permitDays <= 90);

      if (filterStatus === "EXPIRED" && !isExpired) return false;
      if (filterStatus === "CRITICAL" && !isCritical) return false;
      if (filterStatus === "WARNING" && !isWarning) return false;
    }

    return true;
  });

  // Sort by most urgent first
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
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
  });

  // Export to CSV
  const exportCSV = () => {
    const headers = ["S.No", "Vehicle", "Type", "Insurance Expire", "Insurance Days", "FC Expire", "FC Days", "Permit Expire", "Permit Days"];
    const rows = sortedVehicles.map((v, idx) => [
      idx + 1,
      v.vehicle_number,
      v.vehicle_type,
      v.insurance_expire_date || "-",
      getDaysUntil(v.insurance_expire_date) ?? "-",
      v.fc_expire_date || "-",
      getDaysUntil(v.fc_expire_date) ?? "-",
      v.permit_expire_date || "-",
      getDaysUntil(v.permit_expire_date) ?? "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vehicle_insurance_fc_status_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
              <Shield className="text-primary" /> Insurance, FC & Permit Status
            </h3>
            <p className="text-sm text-secondarytext mt-1">
              Track and manage vehicle insurance, fitness certificates, and permits
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchVehicles}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Insurance Stats */}
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
              <Shield size={20} />
            </div>
            <h4 className="font-bold text-primarytext">Insurance</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-red-50 p-2 rounded-md">
              <p className="text-xl font-bold text-red-600">{stats.insurance.expired}</p>
              <p className="text-xs text-red-600">Expired</p>
            </div>
            <div className="bg-amber-50 p-2 rounded-md">
              <p className="text-xl font-bold text-amber-600">{stats.insurance.critical}</p>
              <p className="text-xs text-amber-600">{"< 30 days"}</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded-md">
              <p className="text-xl font-bold text-yellow-600">{stats.insurance.warning}</p>
              <p className="text-xs text-yellow-600">{"< 90 days"}</p>
            </div>
          </div>
        </div>

        {/* FC Stats */}
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 text-green-600 rounded-md">
              <FileCheck size={20} />
            </div>
            <h4 className="font-bold text-primarytext">Fitness Certificate (FC)</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-red-50 p-2 rounded-md">
              <p className="text-xl font-bold text-red-600">{stats.fc.expired}</p>
              <p className="text-xs text-red-600">Expired</p>
            </div>
            <div className="bg-amber-50 p-2 rounded-md">
              <p className="text-xl font-bold text-amber-600">{stats.fc.critical}</p>
              <p className="text-xs text-amber-600">{"< 30 days"}</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded-md">
              <p className="text-xl font-bold text-yellow-600">{stats.fc.warning}</p>
              <p className="text-xs text-yellow-600">{"< 90 days"}</p>
            </div>
          </div>
        </div>

        {/* Permit Stats */}
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-md">
              <FileText size={20} />
            </div>
            <h4 className="font-bold text-primarytext">Permit</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-red-50 p-2 rounded-md">
              <p className="text-xl font-bold text-red-600">{stats.permit.expired}</p>
              <p className="text-xs text-red-600">Expired</p>
            </div>
            <div className="bg-amber-50 p-2 rounded-md">
              <p className="text-xl font-bold text-amber-600">{stats.permit.critical}</p>
              <p className="text-xs text-amber-600">{"< 30 days"}</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded-md">
              <p className="text-xl font-bold text-yellow-600">{stats.permit.warning}</p>
              <p className="text-xs text-yellow-600">{"< 90 days"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm text-secondarytext font-medium">
          <Filter size={16} /> Filters:
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="BUS">🚌 Bus</option>
          <option value="CAR">🚗 Car</option>
          <option value="VAN">🚐 Van</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
        >
          <option value="ALL">All Status</option>
          <option value="EXPIRED">🔴 Expired</option>
          <option value="CRITICAL">🟠 Critical ({"<"} 30 days)</option>
          <option value="WARNING">🟡 Warning ({"<"} 90 days)</option>
          <option value="MAINTENANCE">🔧 Under Maintenance</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <p className="text-sm text-secondarytext">
            <span className="font-medium text-primarytext">💡 Tip:</span> Click on any expiry date to update it directly
          </p>
        </div>
        {loading ? (
          <div className="p-12 text-center text-secondarytext">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">S.No</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Insurance Expire</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">FC Expire</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Permit Expire</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Replacement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedVehicles.length > 0 ? (
                  sortedVehicles.map((v, idx) => {
                    const insDays = getDaysUntil(v.insurance_expire_date);
                    const fcDays = getDaysUntil(v.fc_expire_date);
                    const permitDays = getDaysUntil(v.permit_expire_date);

                    return (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-primarytext font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {v.vehicle_type === "BUS" ? <Bus size={16} className="text-blue-500" /> : <Car size={16} className="text-green-500" />}
                            <span className="font-medium text-primarytext">{v.vehicle_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-secondarytext">{v.vehicle_type}</td>
                        
                        {/* Vehicle Status */}
                        <td className="px-4 py-3 text-center">
                          {v.status === 'under_maintenance' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                              <Wrench size={12} /> Maintenance
                            </span>
                          ) : v.status === 'available' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              <CheckCircle size={12} /> Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded capitalize">
                              {v.status}
                            </span>
                          )}
                        </td>
                        
                        {/* Insurance - Clickable */}
                        <td className="px-4 py-3 text-center text-sm">
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
                              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all ${getStatusBg(insDays)}`}
                              title="Click to update"
                            >
                              {v.insurance_expire_date 
                                ? new Date(v.insurance_expire_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})
                                : "Set date"}
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

                        {/* FC - Clickable */}
                        <td className="px-4 py-3 text-center text-sm">
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
                              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:ring-2 hover:ring-green-300 transition-all ${getStatusBg(fcDays)}`}
                              title="Click to update"
                            >
                              {v.fc_expire_date 
                                ? new Date(v.fc_expire_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})
                                : "Set date"}
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

                        {/* Permit - Clickable */}
                        <td className="px-4 py-3 text-center text-sm">
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
                              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all ${getStatusBg(permitDays)}`}
                              title="Click to update"
                            >
                              {v.permit_expire_date 
                                ? new Date(v.permit_expire_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})
                                : "Set date"}
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

                        {/* Replacement Info */}
                        <td className="px-4 py-3 text-center">
                          {v.fc_replacement_id ? (
                            <div className="text-xs">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-medium ${
                                v.fc_replacement_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                v.fc_replacement_status === 'approved' || v.fc_replacement_status === 'active' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                <RotateCcw size={12} />
                                {v.replacement_vehicle_number || v.fc_replacement_status}
                              </span>
                              {v.fc_start_date && v.fc_end_date && (
                                <div className="text-gray-500 mt-1">
                                  {new Date(v.fc_start_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - {new Date(v.fc_end_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="11" className="px-4 py-12 text-center text-secondarytext">
                      No vehicles found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
