import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
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
  Plus,
  X,
  Users,
} from "lucide-react";

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
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleDrivers, setVehicleDrivers] = useState([]);
  const [clusterDrivers, setClusterDrivers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [fcReplacements, setFcReplacements] = useState([]);
  
  const [formData, setFormData] = useState({
    driver_id: "",
    start_date: "",
    end_date: "",
    reason: "fc_renewal",
    notes: "",
  });

  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      // Fetch all vehicles (incharge can see all but focus on their cluster's)
      const res = await apiGet(`/api/admin/vehicles`);
      const data = await res.json();
      setVehicles(data || []);
    } catch (err) {
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterDrivers = async () => {
    try {
      const res = await apiGet(`/api/incharge/cluster-drivers?incharge_id=${inchargeId}`);
      const data = await res.json();
      // Map to the format we need
      const drivers = (data || []).map(d => ({
        id: d.driver_id,
        full_name: d.full_name,
        is_incharge: false
      }));
      setClusterDrivers(drivers);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFCReplacements = async () => {
    try {
      const res = await apiGet(`/api/incharge/fc-replacements?incharge_id=${inchargeId}`);
      const data = await res.json();
      setFcReplacements(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicleDrivers = async (vehicleId) => {
    try {
      const res = await apiGet(`/api/admin/fc-replacements/vehicle-drivers?vehicle_id=${vehicleId}`);
      const data = await res.json();
      setVehicleDrivers(data || []);
      
      // Auto-select first driver if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, driver_id: data[0].id.toString() }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (inchargeId) {
      fetchVehicles();
      fetchClusterDrivers();
      fetchFCReplacements();
    }
  }, [inchargeId]);

  // Open request modal
  const openRequestModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    fetchVehicleDrivers(vehicle.id);
    setFormData({
      driver_id: "",
      start_date: "",
      end_date: "",
      reason: "fc_renewal",
      notes: "",
    });
    setShowRequestModal(true);
  };

  // Submit FC replacement request
  const handleSubmitRequest = async () => {
    if (!formData.driver_id || !formData.start_date || !formData.end_date) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost("/api/incharge/fc-replacement/request", {
        vehicle_id: selectedVehicle.id,
        driver_id: parseInt(formData.driver_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        notes: formData.notes,
        incharge_id: inchargeId,
      });

      if (res.ok) {
        setShowRequestModal(false);
        alert("FC replacement request submitted for admin approval");
        fetchFCReplacements();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to submit request");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if vehicle has existing request
  const hasExistingRequest = (vehicleId) => {
    return fcReplacements.some(r => 
      r.vehicle_id === vehicleId && 
      ['pending', 'approved'].includes(r.status)
    );
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
    if (filterType !== "ALL" && v.vehicle_type !== filterType) return false;
    if (searchQuery && !v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase())) return false;

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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Admin Approval' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approved' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
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
              View vehicle status and request FC/Insurance replacements
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

      {/* My FC Replacement Requests */}
      {fcReplacements.length > 0 && (
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
          <h4 className="font-bold text-primarytext mb-4 flex items-center gap-2">
            <Wrench className="text-primary" size={18} />
            My FC/Insurance Replacement Requests
          </h4>
          <div className="space-y-3">
            {fcReplacements.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primarytext">{req.vehicle_number}</span>
                    <span className="text-xs text-secondarytext capitalize">({req.reason})</span>
                  </div>
                  <p className="text-xs text-secondarytext mt-1">
                    {new Date(req.start_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - {new Date(req.end_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {req.replacement_vehicle_number && (
                    <span className="text-sm text-green flex items-center gap-1">
                      <RotateCcw size={14} /> {req.replacement_vehicle_number}
                    </span>
                  )}
                  {getStatusBadge(req.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedVehicles.length > 0 ? (
                  sortedVehicles.map((v, idx) => {
                    const insDays = getDaysUntil(v.insurance_expire_date);
                    const fcDays = getDaysUntil(v.fc_expire_date);
                    const permitDays = getDaysUntil(v.permit_expire_date);
                    const needsAttention = (insDays !== null && insDays <= 30) || (fcDays !== null && fcDays <= 30) || (permitDays !== null && permitDays <= 30);

                    // Format date helper
                    const formatExpireDate = (dateStr) => {
                      if (!dateStr) return "-";
                      const date = new Date(dateStr);
                      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    };

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
                        
                        {/* Insurance */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-primarytext">{formatExpireDate(v.insurance_expire_date)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {insDays !== null ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(insDays)}`}>
                              {insDays < 0 ? `${Math.abs(insDays)} overdue` : insDays}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>

                        {/* FC */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-primarytext">{formatExpireDate(v.fc_expire_date)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {fcDays !== null ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(fcDays)}`}>
                              {fcDays < 0 ? `${Math.abs(fcDays)} overdue` : fcDays}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>

                        {/* Permit */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-primarytext">{formatExpireDate(v.permit_expire_date)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {permitDays !== null ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(permitDays)}`}>
                              {permitDays < 0 ? `${Math.abs(permitDays)} overdue` : permitDays}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 text-center">
                          {hasExistingRequest(v.id) ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">Request Pending</span>
                          ) : needsAttention && v.status !== 'under_maintenance' ? (
                            <button
                              onClick={() => openRequestModal(v)}
                              className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 flex items-center gap-1 mx-auto"
                            >
                              <Plus size={12} /> Request Replacement
                            </button>
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

      {/* Request Modal */}
      {showRequestModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primarytext">Request FC/Insurance Replacement</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Vehicle Info */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">Vehicle</label>
                <div className="p-3 bg-gray-50 rounded-md flex items-center gap-2">
                  {selectedVehicle.vehicle_type === "BUS" ? <Bus size={16} className="text-blue-500" /> : <Car size={16} className="text-green-500" />}
                  <span className="font-semibold">{selectedVehicle.vehicle_number}</span>
                  <span className="text-secondarytext text-sm">({selectedVehicle.vehicle_type})</span>
                </div>
              </div>

              {/* Driver Selection with Suggestions */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Driver <span className="text-red-500">*</span>
                </label>
                
                {vehicleDrivers.length > 0 && (
                  <div className="mb-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <p className="text-xs text-primary font-medium mb-2">👤 Assigned Driver(s):</p>
                    <div className="flex flex-wrap gap-2">
                      {vehicleDrivers.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, driver_id: d.id.toString() })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            formData.driver_id === d.id.toString()
                              ? "bg-primary text-white"
                              : "bg-white text-primarytext border border-gray-200 hover:border-primary"
                          }`}
                        >
                          {d.full_name}
                          {d.is_incharge && <span className="ml-1">⭐</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <select
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  required
                >
                  <option value="">
                    {vehicleDrivers.length > 0 ? "Or select from cluster drivers" : "Select Driver"}
                  </option>
                  {clusterDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} {d.is_incharge ? "(Incharge)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Replacement Type */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">Replacement Type</label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="fc_renewal">FC (Fitness Certificate)</option>
                  <option value="insurance_renewal">Insurance</option>
                  <option value="permit_renewal">Permit</option>
                  <option value="maintenance">General Maintenance</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  placeholder="Additional notes..."
                />
              </div>
              
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This request will be sent to the admin for approval. 
                  Once approved, a replacement vehicle will be assigned and the driver will be notified.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-secondarytext hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || !formData.driver_id || !formData.start_date || !formData.end_date}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
