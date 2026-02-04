import React, {useState, useEffect} from "react";
import {showError, showSuccess, showConfirm} from "../../../utils/swal";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  Shield,
  Search,
  RefreshCw,
  Download,
  X,
  Trash2,
  Calendar,
  Loader2,
  Bus,
  Car,
  Battery,
  Truck,
  CircleGauge,
  CircleX,
  AlertTriangle,
  Clock,
} from "lucide-react";

// Get vehicle type icon
const VehicleIcon = ({type, size = 18}) => {
  const iconClass = "text-secondarytext";
  switch (type) {
    case "BUS":
      return <Bus size={size} className={iconClass} />;
    case "CAR":
      return <Car size={size} className={iconClass} />;
    case "BATTERY_VEHICLE":
      return <Battery size={size} className={iconClass} />;
    case "OTHER":
    default:
      return <Truck size={size} className={iconClass} />;
  }
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Parse dd-mm-yyyy date format from backend for calculations
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

// Display date from backend (already in dd-mm-yyyy format)
const formatDate = (dateStr) => dateStr || "-";

// Get status info based on days remaining
const getStatusInfo = (days) => {
  if (days === null)
    return {
      label: "Not Set",
      color: "bg-gray-100 text-secondarytext",
      dotColor: "bg-gray-400",
    };
  if (days < 0)
    return {label: "Expired", color: "bg-red/10 text-red", dotColor: "bg-red"};
  if (days <= 30)
    return {label: "Critical", color: "bg-red/10 text-red", dotColor: "bg-red"};
  if (days <= 90)
    return {
      label: "Warning",
      color: "bg-pending/10 text-pending",
      dotColor: "bg-pending",
    };
  return {
    label: "Valid",
    color: "bg-green/10 text-green",
    dotColor: "bg-green",
  };
};

// Get vehicle type label
const getVehicleTypeLabel = (type) => {
  switch (type) {
    case "BUS":
      return "Bus";
    case "CAR":
      return "Car";
    case "BATTERY_VEHICLE":
      return "Battery Vehicle";
    case "OTHER":
      return "Other";
    default:
      return type;
  }
};

export default function InsuranceFCStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [editForm, setEditForm] = useState({
    insurance_expire_date: "",
    fc_expire_date: "",
    permit_expire_date: "",
  });
  const [saving, setSaving] = useState(false);

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

  // Open detail modal
  const openVehicleDetail = (vehicle) => {
    setSelectedVehicle(vehicle);
    setEditForm({
      insurance_expire_date: vehicle.insurance_expire_date?.split("T")[0] || "",
      fc_expire_date: vehicle.fc_expire_date?.split("T")[0] || "",
      permit_expire_date: vehicle.permit_expire_date?.split("T")[0] || "",
    });
  };

  // Close modal
  const closeModal = () => {
    setSelectedVehicle(null);
    setEditForm({
      insurance_expire_date: "",
      fc_expire_date: "",
      permit_expire_date: "",
    });
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedVehicle) return;
    setSaving(true);

    try {
      const updatedVehicle = {
        id: selectedVehicle.id,
        vehicle_number: selectedVehicle.vehicle_number,
        vehicle_type: selectedVehicle.vehicle_type,
        fuel_type: selectedVehicle.fuel_type,
        seating_capacity: selectedVehicle.seating_capacity,
        status: selectedVehicle.status,
        bus_name: selectedVehicle.bus_name || "",
        start_point: selectedVehicle.start_point || "",
        end_point: selectedVehicle.end_point || "",
        insurance_expire_date: editForm.insurance_expire_date || null,
        fc_expire_date: editForm.fc_expire_date || null,
        permit_expire_date: editForm.permit_expire_date || null,
      };

      const res = await fetch(`${API_BASE}/api/admin/vehicles/update`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(updatedVehicle),
      });

      if (res.ok) {
        showSuccess("Success", "Vehicle details updated successfully");
        fetchVehicles();
        closeModal();
      } else {
        showError("Error", "Failed to update: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error updating vehicle");
    } finally {
      setSaving(false);
    }
  };

  // Delete vehicle
  const handleDelete = async () => {
    if (!selectedVehicle) return;

    const confirmed = await showConfirm(
      "Delete Vehicle?",
      `Are you sure you want to delete ${selectedVehicle.bus_name || selectedVehicle.vehicle_number}?`,
    );

    if (!confirmed) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vehicles/delete?id=${selectedVehicle.id}`,
        {method: "DELETE"},
      );

      if (res.ok) {
        showSuccess("Deleted", "Vehicle deleted successfully");
        fetchVehicles();
        closeModal();
      } else {
        showError("Error", "Failed to delete vehicle");
      }
    } catch (err) {
      showError("Error", "Error deleting vehicle");
    }
  };

  // Calculate stats
  const getStats = () => {
    let expired = 0,
      critical = 0,
      warning = 0;

    vehicles.forEach((v) => {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);

      const minDays = Math.min(
        insDays ?? 9999,
        fcDays ?? 9999,
        permitDays ?? 9999,
      );

      if (minDays < 0) expired++;
      else if (minDays <= 30) critical++;
      else if (minDays <= 90) warning++;
    });

    return {expired, critical, warning, total: vehicles.length};
  };

  const stats = getStats();

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (filterType !== "ALL" && v.vehicle_type !== filterType) return false;

    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      if (
        !v.vehicle_number.toLowerCase().includes(search) &&
        !(v.bus_name || "").toLowerCase().includes(search)
      )
        return false;
    }

    if (filterStatus !== "ALL") {
      const insDays = getDaysUntil(v.insurance_expire_date);
      const fcDays = getDaysUntil(v.fc_expire_date);
      const permitDays = getDaysUntil(v.permit_expire_date);
      const minDays = Math.min(
        insDays ?? 9999,
        fcDays ?? 9999,
        permitDays ?? 9999,
      );

      if (filterStatus === "EXPIRED" && minDays >= 0) return false;
      if (filterStatus === "CRITICAL" && (minDays < 0 || minDays > 30))
        return false;
      if (filterStatus === "WARNING" && (minDays <= 30 || minDays > 90))
        return false;
      if (filterStatus === "OK" && minDays <= 90) return false;
    }

    return true;
  });

  // Sort by urgency
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
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
  });

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Vehicle",
      "Type",
      "Insurance Expire",
      "FC Expire",
      "Permit Expire",
    ];
    const rows = sortedVehicles.map((v) => [
      v.bus_name || v.vehicle_number,
      v.vehicle_type,
      v.insurance_expire_date || "-",
      v.fc_expire_date || "-",
      v.permit_expire_date || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vehicle_status_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Get overall status for a vehicle
  const getVehicleOverallStatus = (v) => {
    const insDays = getDaysUntil(v.insurance_expire_date);
    const fcDays = getDaysUntil(v.fc_expire_date);
    const permitDays = getDaysUntil(v.permit_expire_date);
    const minDays = Math.min(
      insDays ?? 9999,
      fcDays ?? 9999,
      permitDays ?? 9999,
    );
    return getStatusInfo(minDays === 9999 ? null : minDays);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Insurance & Compliance
          </h1>
          <p className="text-sm text-secondarytext mt-1">
            Track vehicle insurance, FC, and permit expiry dates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchVehicles}
            className="px-4 py-2 bg-secondarybg border border-gray-200 text-secondarytext rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primarytext">
                {stats.total}
              </p>
              <p className="text-sm text-secondarytext">Total Vehicles</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CircleGauge size={20} className="text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red">{stats.expired}</p>
              <p className="text-sm text-secondarytext">Expired</p>
            </div>
            <div className="w-10 h-10 bg-red/10 rounded-lg flex items-center justify-center">
              <CircleX size={20} className="text-red" />
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red">{stats.critical}</p>
              <p className="text-sm text-secondarytext">Critical (&lt;30d)</p>
            </div>
            <div className="w-10 h-10 bg-red/10 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red" />
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-pending">{stats.warning}</p>
              <p className="text-sm text-secondarytext">Warning (&lt;90d)</p>
            </div>
            <div className="w-10 h-10 bg-pending/10 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-pending" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-secondarybg rounded-lg border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by vehicle number or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-primarybg border
               border-gray-200 rounded-lg text-sm focus:outline-none
                focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <CustomDropdown
            value={filterType}
            onChange={setFilterType}
            options={[
              {value: "ALL", label: "All Types"},
              {value: "BUS", label: "Bus"},
              {value: "CAR", label: "Car"},
              {value: "BATTERY_VEHICLE", label: "Battery Vehicle"},
              {value: "OTHER", label: "Other"},
            ]}
            width="w-40"
          />

          <CustomDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              {value: "ALL", label: "All Status"},
              {value: "EXPIRED", label: "Expired"},
              {value: "CRITICAL", label: "Critical (<30d)"},
              {value: "WARNING", label: "Warning (<90d)"},
              {value: "OK", label: "Valid"},
            ]}
            width="w-40"
          />

          {(searchQuery || filterType !== "ALL" || filterStatus !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterType("ALL");
                setFilterStatus("ALL");
              }}
              className="px-3 py-2 text-sm text-red hover:bg-red/10 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Vehicle List */}
      <div className="bg-secondarybg rounded-lg border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-secondarytext">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p>Loading vehicles...</p>
          </div>
        ) : sortedVehicles.length === 0 ? (
          <div className="p-12 text-center text-secondarytext">
            No vehicles found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-primarybg">
                  <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Insurance
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                    FC
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Permit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedVehicles.map((v) => {
                  const insDays = getDaysUntil(v.insurance_expire_date);
                  const fcDays = getDaysUntil(v.fc_expire_date);
                  const permitDays = getDaysUntil(v.permit_expire_date);
                  const overallStatus = getVehicleOverallStatus(v);

                  return (
                    <tr
                      key={v.id}
                      onClick={() => openVehicleDetail(v)}
                      className="hover:bg-primarybg cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-primarytext">
                          {v.bus_name || v.vehicle_number}
                        </p>
                        {v.bus_name && (
                          <p className="text-xs text-secondarytext">
                            {v.vehicle_number}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <VehicleIcon type={v.vehicle_type} />
                          <span className="text-sm text-secondarytext">
                            {getVehicleTypeLabel(v.vehicle_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-primarytext">
                            {formatDate(v.insurance_expire_date)}
                          </span>
                          {insDays !== null && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(insDays).color}`}
                            >
                              {insDays < 0
                                ? `${Math.abs(insDays)}d overdue`
                                : `${insDays}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-primarytext">
                            {formatDate(v.fc_expire_date)}
                          </span>
                          {fcDays !== null && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(fcDays).color}`}
                            >
                              {fcDays < 0
                                ? `${Math.abs(fcDays)}d overdue`
                                : `${fcDays}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-primarytext">
                            {formatDate(v.permit_expire_date)}
                          </span>
                          {permitDays !== null && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(permitDays).color}`}
                            >
                              {permitDays < 0
                                ? `${Math.abs(permitDays)}d overdue`
                                : `${permitDays}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${overallStatus.dotColor}`}
                          ></span>
                          <span className="text-sm text-secondarytext">
                            {overallStatus.label}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
          <div className="bg-secondarybg rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-primarytext">
                  {selectedVehicle.bus_name || selectedVehicle.vehicle_number}
                </h3>
                <p className="text-sm text-secondarytext">
                  {selectedVehicle.vehicle_number} •{" "}
                  {getVehicleTypeLabel(selectedVehicle.vehicle_type)}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-primarybg rounded-lg transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Insurance */}
              <div>
                <label className="block text-sm font-medium text-primarytext mb-2">
                  Insurance Expiry Date
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
                      size={16}
                    />
                    <input
                      type="date"
                      value={editForm.insurance_expire_date}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          insurance_expire_date: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {editForm.insurance_expire_date && (
                    <span
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusInfo(getDaysUntil(editForm.insurance_expire_date)).color}`}
                    >
                      {getDaysUntil(editForm.insurance_expire_date)}d
                    </span>
                  )}
                </div>
              </div>

              {/* FC */}
              <div>
                <label className="block text-sm font-medium text-primarytext mb-2">
                  Fitness Certificate (FC) Expiry Date
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
                      size={16}
                    />
                    <input
                      type="date"
                      value={editForm.fc_expire_date}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          fc_expire_date: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {editForm.fc_expire_date && (
                    <span
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusInfo(getDaysUntil(editForm.fc_expire_date)).color}`}
                    >
                      {getDaysUntil(editForm.fc_expire_date)}d
                    </span>
                  )}
                </div>
              </div>

              {/* Permit */}
              <div>
                <label className="block text-sm font-medium text-primarytext mb-2">
                  Permit Expiry Date
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
                      size={16}
                    />
                    <input
                      type="date"
                      value={editForm.permit_expire_date}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permit_expire_date: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {editForm.permit_expire_date && (
                    <span
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusInfo(getDaysUntil(editForm.permit_expire_date)).color}`}
                    >
                      {getDaysUntil(editForm.permit_expire_date)}d
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-primarybg">
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red hover:bg-red/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-secondarybg border border-gray-200 text-secondarytext rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
