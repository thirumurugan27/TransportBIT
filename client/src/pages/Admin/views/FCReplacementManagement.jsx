import React, { useState, useEffect } from "react";
import {
  Car,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  FileText,
  ChevronDown,
  Bell,
  Edit2,
  Trash2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function FCReplacementManagement() {
  const [requests, setRequests] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState("all");
  const [vehicleAlerts, setVehicleAlerts] = useState({ alerts: [], total: 0 });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    request_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    notes: "",
  });

  // Form state for new request
  const [formData, setFormData] = useState({
    vehicle_id: "",
    driver_id: "",
    start_date: "",
    end_date: "",
    reason: "fc_renewal",
    notes: "",
    replacement_vehicle_id: "",
  });

  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleDrivers, setVehicleDrivers] = useState([]); // Drivers assigned to selected vehicle
  const [isEVAssignment, setIsEVAssignment] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, driversRes, vehiclesRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/fc-replacements?status=${filter}`),
        fetch(`${API_BASE}/api/admin/drivers`),
        fetch(`${API_BASE}/api/admin/vehicles`),
        fetch(`${API_BASE}/api/admin/vehicles/alerts`),
      ]);

      const requestsData = await requestsRes.json();
      const driversData = await driversRes.json();
      const vehiclesData = await vehiclesRes.json();
      const alertsData = await alertsRes.json();

      setRequests(requestsData || []);
      setDrivers(driversData || []);
      setVehicles(vehiclesData || []);
      setVehicleAlerts(alertsData || { alerts: [], total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch drivers assigned to a specific vehicle
  const fetchVehicleDrivers = async (vehicleId) => {
    if (!vehicleId) {
      setVehicleDrivers([]);
      setIsEVAssignment(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/fc-replacements/vehicle-drivers?vehicle_id=${vehicleId}`);
      const data = await res.json();
      setVehicleDrivers(data || []);
      
      // Check if it's an EV assignment (cluster-based)
      const hasEVDrivers = data?.some(d => d.is_ev);
      setIsEVAssignment(hasEVDrivers);
      
      // Auto-select first driver if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, driver_id: data[0].id.toString() }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailableVehicles = async (startDate, endDate, excludeId) => {
    if (!startDate || !endDate) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/fc-replacements/available-vehicles?start_date=${startDate}&end_date=${endDate}&exclude_vehicle_id=${excludeId}`
      );
      const data = await res.json();
      setAvailableVehicles(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/fc-replacements/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          vehicle_id: parseInt(formData.vehicle_id),
          driver_id: parseInt(formData.driver_id),
          replacement_vehicle_id: formData.replacement_vehicle_id
            ? parseInt(formData.replacement_vehicle_id)
            : null,
          requested_by_role: "admin",
          requested_by_id: 1, // Admin ID
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({
          vehicle_id: "",
          driver_id: "",
          start_date: "",
          end_date: "",
          reason: "fc_renewal",
          notes: "",
          replacement_vehicle_id: "",
        });
        setVehicleDrivers([]);
        setIsEVAssignment(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (replacementVehicleId) => {
    if (!selectedRequest) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/fc-replacements/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          replacement_vehicle_id: parseInt(replacementVehicleId),
          approved_by_id: 1,
        }),
      });

      if (res.ok) {
        setShowApproveModal(false);
        setSelectedRequest(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      await fetch(`${API_BASE}/api/admin/fc-replacements/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          rejected_by: 1,
          reason: reason,
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleComplete = async (requestId) => {
    if (!confirm("Mark this replacement as completed and reassign driver to original vehicle?")) return;

    try {
      await fetch(`${API_BASE}/api/admin/fc-replacements/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Open edit modal
  const openEditModal = (request) => {
    setEditFormData({
      request_id: request.id,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason,
      notes: request.notes || "",
    });
    setSelectedRequest(request);
    setShowEditModal(true);
  };

  // Handle edit request
  const handleEditRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/fc-replacements/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: parseInt(editFormData.request_id),
          start_date: editFormData.start_date,
          end_date: editFormData.end_date,
          reason: editFormData.reason,
          notes: editFormData.notes,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedRequest(null);
        setEditFormData({
          request_id: "",
          start_date: "",
          end_date: "",
          reason: "",
          notes: "",
        });
        fetchData();
        alert("Request updated successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update request");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating request");
    }
  };

  // Handle delete request
  const handleDelete = async (requestId) => {
    if (!confirm("Are you sure you want to delete this replacement request? This action cannot be undone.")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/fc-replacements/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (res.ok) {
        fetchData();
        alert("Request deleted successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete request");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting request");
    }
  };

  const openApproveModal = (request) => {
    setSelectedRequest(request);
    fetchAvailableVehicles(request.start_date, request.end_date, request.vehicle_id);
    setShowApproveModal(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-pending/10 text-pending",
      approved: "bg-primary/10 text-primary",
      completed: "bg-green/10 text-green",
      rejected: "bg-red/10 text-red",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return styles[status] || "bg-gray-100 text-gray-500";
  };

  const getReasonLabel = (reason) => {
    const labels = {
      fc_renewal: "FC Renewal",
      insurance_renewal: "Insurance Renewal",
      permit_renewal: "Permit Renewal",
      maintenance: "Maintenance",
    };
    return labels[reason] || reason;
  };

  // Get driver for selected vehicle
  const getVehicleDriver = (vehicleId) => {
    // This would need to be fetched from assignments
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">
            FC/Insurance Replacement Management
          </h1>
          <p className="text-secondarytext mt-1">
            Manage temporary vehicle replacements for FC, Insurance, or Permit renewals
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md font-medium hover:bg-primarydull transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Replacement
        </button>
      </div>

      {/* Vehicle Alerts Section */}
      {vehicleAlerts.total > 0 && (
        <div className="bg-pending/10 border border-pending/20 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-pending" />
            <h3 className="font-semibold text-pending">
              Vehicles Requiring Attention ({vehicleAlerts.total})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicleAlerts.alerts?.slice(0, 6).map((v) => (
              <div
                key={v.id}
                className="bg-white p-3 rounded-md border border-pending/20 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-primarytext">{v.vehicle_number}</p>
                  <p className="text-xs text-secondarytext">{v.vehicle_type}</p>
                </div>
                <div className="text-right text-sm">
                  {v.insurance_days !== null && v.insurance_days <= 10 && (
                    <p className={v.insurance_days < 0 ? "text-red font-semibold" : "text-pending"}>
                      Ins: {v.insurance_days < 0 ? "Expired" : `${v.insurance_days}d`}
                    </p>
                  )}
                  {v.fc_days !== null && v.fc_days <= 10 && (
                    <p className={v.fc_days < 0 ? "text-red font-semibold" : "text-pending"}>
                      FC: {v.fc_days < 0 ? "Expired" : `${v.fc_days}d`}
                    </p>
                  )}
                  {v.permit_days !== null && v.permit_days <= 10 && (
                    <p className={v.permit_days < 0 ? "text-red font-semibold" : "text-pending"}>
                      Permit: {v.permit_days < 0 ? "Expired" : `${v.permit_days}d`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-secondarytext font-medium">Status:</span>
          {["all", "pending", "approved", "completed", "rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                filter === status
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-secondarytext hover:bg-gray-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="ml-auto text-secondarytext hover:text-primary"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Vehicle
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Driver
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Replacement
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Period
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Reason
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Status
              </th>
              <th className="text-left p-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-primarybg border-t-primary rounded-full animate-spin mx-auto"></div>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-secondarytext">
                  No replacement requests found
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-semibold text-primarytext">{req.vehicle_number}</p>
                        <p className="text-xs text-secondarytext">{req.vehicle_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-primarytext">{req.driver_name}</span>
                    </div>
                    {req.driver_notified && (
                      <span className="inline-flex items-center gap-1 text-xs text-green mt-1">
                        <Bell className="w-3 h-3" /> Notified
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {req.replacement_vehicle_number ? (
                      <span className="font-medium text-green">{req.replacement_vehicle_number}</span>
                    ) : (
                      <span className="text-secondarytext text-sm">Not assigned</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-primarytext">{req.start_date} to {req.end_date}</p>
                      {req.days_remaining > 0 && req.status === "approved" && (
                        <p className="text-xs text-pending">{req.days_remaining} days remaining</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{getReasonLabel(req.reason)}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                        req.status
                      )}`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {req.status === "pending" && (
                        <>
                          <button
                            onClick={() => openApproveModal(req)}
                            className="p-1.5 bg-green/10 text-green rounded hover:bg-green/20"
                            title="Approve & Assign"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="p-1.5 bg-red/10 text-red rounded hover:bg-red/20"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <button
                          onClick={() => handleComplete(req.id)}
                          className="px-2 py-1 bg-green/10 text-green rounded text-xs font-medium hover:bg-green/20"
                        >
                          Complete
                        </button>
                      )}
                      {/* Edit and Delete buttons for pending/approved status */}
                      {(req.status === "pending" || req.status === "approved") && (
                        <>
                          <button
                            onClick={() => openEditModal(req)}
                            className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                            title="Edit Request"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red"
                            title="Delete Request"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-primarytext mb-4">
              Create Vehicle Replacement Request
            </h2>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Vehicle Going for Service
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => {
                    const vehicleId = e.target.value;
                    setFormData({ ...formData, vehicle_id: vehicleId, driver_id: "" });
                    fetchVehicleDrivers(vehicleId);
                    if (formData.start_date && formData.end_date) {
                      fetchAvailableVehicles(formData.start_date, formData.end_date, vehicleId);
                    }
                  }}
                  className="w-full border rounded-md p-2"
                  required
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Selection with Suggestions */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Driver {isEVAssignment && <span className="text-primary text-xs">(EV Cluster Assignment)</span>}
                </label>
                
                {/* Show suggested drivers if vehicle is selected */}
                {vehicleDrivers.length > 0 && (
                  <div className="mb-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <p className="text-xs text-primary font-medium mb-2">
                      {isEVAssignment ? "👥 Cluster Drivers (Group Assignment)" : "👤 Assigned Driver(s)"}:
                    </p>
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
                          {d.is_incharge && <span className="ml-1 text-xs">⭐</span>}
                          {d.cluster_name && <span className="ml-1 text-gray-400">({d.cluster_name})</span>}
                        </button>
                      ))}
                    </div>
                    {isEVAssignment && (
                      <p className="text-xs text-secondarytext mt-2">
                        💡 This is an EV cluster assignment. All {vehicleDrivers.length} drivers in the cluster will be notified.
                      </p>
                    )}
                  </div>
                )}

                <select
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className="w-full border rounded-md p-2"
                  required
                >
                  <option value="">
                    {vehicleDrivers.length > 0 ? "Or select a different driver" : "Select Driver"}
                  </option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => {
                      setFormData({ ...formData, start_date: e.target.value });
                      if (formData.vehicle_id && formData.end_date) {
                        fetchAvailableVehicles(e.target.value, formData.end_date, formData.vehicle_id);
                      }
                    }}
                    className="w-full border rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => {
                      setFormData({ ...formData, end_date: e.target.value });
                      if (formData.vehicle_id && formData.start_date) {
                        fetchAvailableVehicles(formData.start_date, e.target.value, formData.vehicle_id);
                      }
                    }}
                    className="w-full border rounded-md p-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Reason
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full border rounded-md p-2"
                  required
                >
                  <option value="fc_renewal">FC Renewal</option>
                  <option value="insurance_renewal">Insurance Renewal</option>
                  <option value="permit_renewal">Permit Renewal</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Replacement Vehicle (Optional - Auto-approved if selected)
                </label>
                <select
                  value={formData.replacement_vehicle_id}
                  onChange={(e) => setFormData({ ...formData, replacement_vehicle_id: e.target.value })}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">Select Replacement Vehicle</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.vehicle_type}) - {v.seating_capacity} seats
                    </option>
                  ))}
                </select>
                {availableVehicles.length === 0 && formData.start_date && formData.end_date && (
                  <p className="text-xs text-pending mt-1">
                    No vehicles available for selected dates. Please select dates first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-md p-2"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setVehicleDrivers([]);
                    setIsEVAssignment(false);
                    setFormData({
                      vehicle_id: "",
                      driver_id: "",
                      start_date: "",
                      end_date: "",
                      reason: "fc_renewal",
                      notes: "",
                      replacement_vehicle_id: "",
                    });
                  }}
                  className="px-4 py-2 border rounded-md text-secondarytext hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull"
                >
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-primarytext mb-4">
              Approve & Assign Replacement Vehicle
            </h2>
            <div className="bg-gray-50 rounded-md p-4 mb-4">
              <p className="text-sm">
                <span className="font-medium">Vehicle:</span> {selectedRequest.vehicle_number}
              </p>
              <p className="text-sm">
                <span className="font-medium">Driver:</span> {selectedRequest.driver_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Period:</span> {selectedRequest.start_date} to{" "}
                {selectedRequest.end_date}
              </p>
              <p className="text-sm">
                <span className="font-medium">Reason:</span> {getReasonLabel(selectedRequest.reason)}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-secondarytext">
                Select Replacement Vehicle:
              </p>
              {availableVehicles.length === 0 ? (
                <p className="text-center text-pending py-4">
                  No vehicles available for the selected dates
                </p>
              ) : (
                availableVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleApprove(v.id)}
                    className="w-full p-3 border rounded-md text-left hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-primarytext">{v.vehicle_number}</p>
                        <p className="text-xs text-secondarytext">
                          {v.vehicle_type} • {v.seating_capacity} seats • {v.fuel_type}
                        </p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                }}
                className="px-4 py-2 border rounded-md text-secondarytext hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-primarytext mb-4">
              Edit Replacement Request
            </h2>
            <div className="bg-gray-50 rounded-md p-4 mb-4">
              <p className="text-sm">
                <span className="font-medium">Vehicle:</span> {selectedRequest.vehicle_number}
              </p>
              <p className="text-sm">
                <span className="font-medium">Driver:</span> {selectedRequest.driver_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Status:</span>{" "}
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusBadge(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
              </p>
            </div>

            <form onSubmit={handleEditRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.start_date}
                    onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                    className="w-full border rounded-md p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.end_date}
                    onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                    className="w-full border rounded-md p-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Reason
                </label>
                <select
                  value={editFormData.reason}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  className="w-full border rounded-md p-2"
                  required
                >
                  <option value="fc_renewal">FC Renewal</option>
                  <option value="insurance_renewal">Insurance Renewal</option>
                  <option value="permit_renewal">Permit Renewal</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Notes
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full border rounded-md p-2"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRequest(null);
                    setEditFormData({
                      request_id: "",
                      start_date: "",
                      end_date: "",
                      reason: "",
                      notes: "",
                    });
                  }}
                  className="px-4 py-2 border rounded-md text-secondarytext hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull"
                >
                  Update Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
