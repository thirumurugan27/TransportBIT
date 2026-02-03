import React, {useState, useEffect} from "react";
import {showError, showConfirm} from "../../../utils/swal";
import {formatVehicleLabel} from "../../../utils/vehicleLabel";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Plus,
  Trash2,
  X,
  User,
  Calendar,
  Clock,
  ArrowRight,
  Truck,
  FileText,
  AlertCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const getCreatorIdFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const id = payload?.user_id;
    return typeof id === "number" ? id : null;
  } catch {
    return null;
  }
};

// Helper to convert 24h time to 12h AM/PM format
const formatTimeAMPM = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export default function TemporaryAssignments({openModal}) {
  const [tempAssignments, setTempAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemp, setNewTemp] = useState({
    original_driver_id: "",
    replacement_driver_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    shift_id: "",
    vehicle_id: "",
  });

  // Dropdown Data
  const [drivers, setDrivers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    fetchTempAssignments();
    fetchDropdowns();
  }, []);

  // Listen to openModal prop changes
  useEffect(() => {
    if (openModal) {
      setShowCreateModal(true);
    }
  }, [openModal]);

  const fetchTempAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/temporary-assignments`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setTempAssignments((await res.json()) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [driversRes, shiftsRes, vehiclesRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/drivers`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicles`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
      ]);
      setDrivers(driversRes || []);
      setShifts(shiftsRes || []);
      setVehicles(vehiclesRes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (
      !newTemp.original_driver_id ||
      !newTemp.replacement_driver_id ||
      !newTemp.start_date ||
      !newTemp.shift_id ||
      !newTemp.vehicle_id
    ) {
      showError("Error", "Please fill required fields");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/temporary-assignments/create`,
        {
          method: "POST",
          credentials: "include",
          headers: {"Content-Type": "application/json", ...getAuthHeaders()},
          body: JSON.stringify({
            original_driver_id: parseInt(newTemp.original_driver_id),
            replacement_driver_id: parseInt(newTemp.replacement_driver_id),
            start_date: newTemp.start_date,
            end_date: newTemp.end_date || newTemp.start_date,
            reason: newTemp.reason,
            shift_id: parseInt(newTemp.shift_id) || 0,
            vehicle_id: parseInt(newTemp.vehicle_id) || 0,
            created_by: getCreatorIdFromToken() || undefined,
          }),
        },
      );

      if (res.ok) {
        setShowCreateModal(false);
        fetchTempAssignments();
        // Reset form
        setNewTemp({
          original_driver_id: "",
          replacement_driver_id: "",
          start_date: "",
          end_date: "",
          reason: "",
          shift_id: "",
          vehicle_id: "",
        });
      } else {
        const err = await res.json();
        showError("Error", err.error || "Unknown error");
      }
    } catch (err) {
      showError("Error", err.message);
    }
  };

  const handleCancel = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to cancel this assignment?",
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/temporary-assignments/${id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) {
        fetchTempAssignments();
      } else {
        showError("Error", "Error cancelling");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-md shadow-sm border border-gray-100">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
          <p>Loading temporary assignments...</p>
        </div>
      ) : tempAssignments.length === 0 ? (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-20" />
          <p>No temporary substitutions active.</p>
        </div>
      ) : (
        <div className="p-4 grid gap-4">
          {tempAssignments.map((t) => (
            <div
              key={t.id}
              className="rounded-md border border-gray-100 bg-primarybg p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => {
                setSelectedDetail(t);
                setShowDetailModal(true);
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-md flex items-center justify-center text-white bg-pending">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-primarytext">
                      {formatVehicleLabel(t)}
                    </p>
                    <p className="text-xs text-secondarytext">
                      {t.vehicle_number}
                    </p>
                    <p className="text-sm text-secondarytext">
                      {t.start_date === t.end_date
                        ? t.start_date
                        : `${t.start_date} to ${t.end_date}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.shift_name && (
                    <span className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
                      {t.shift_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center">
                        <User size={18} className="text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Original</p>
                        <p className="font-medium text-gray-900 ">
                          {t.original_driver_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-gray-400" />
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-md bg-green-100 flex items-center justify-center">
                        <User size={18} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Replacement</p>
                        <p className="font-medium text-primary">
                          {t.replacement_driver_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel(t.id);
                    }}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Cancel Assignment"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                New Temporary Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex items-start gap-3">
                <AlertCircle className="text-blue-600 mt-0.5" size={18} />
                <p className="text-xs text-blue-700">
                  This will override existing assignments for the selected
                  dates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTemp.start_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, start_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newTemp.end_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, end_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Original Driver (Unavailable) *
                </label>
                <SearchableSelect
                  value={newTemp.original_driver_id}
                  onChange={(val) =>
                    setNewTemp({...newTemp, original_driver_id: val})
                  }
                  placeholder="Select Original Driver"
                  options={drivers.map((d) => ({
                    value: d.id,
                    label: d.full_name,
                    subtitle: d.cluster_id
                      ? `Cluster ${d.cluster_id}`
                      : undefined,
                  }))}
                  emptyMessage="No drivers available"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Replacement Driver *
                </label>
                <SearchableSelect
                  value={newTemp.replacement_driver_id}
                  onChange={(val) =>
                    setNewTemp({
                      ...newTemp,
                      replacement_driver_id: val,
                    })
                  }
                  placeholder="Select Substitute Driver"
                  options={drivers
                    .filter(
                      (d) => d.id !== parseInt(newTemp.original_driver_id),
                    )
                    .map((d) => ({
                      value: d.id,
                      label: d.full_name,
                    }))}
                  emptyMessage="No drivers available"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Shift *
                </label>
                <SearchableSelect
                  value={newTemp.shift_id}
                  onChange={(val) => setNewTemp({...newTemp, shift_id: val})}
                  placeholder="Select Shift"
                  options={shifts.map((s) => {
                    const timeDisplay =
                      s.slots && s.slots.length > 0
                        ? s.slots
                            .map(
                              (slot) =>
                                `${formatTimeAMPM(slot.start_time)}-${formatTimeAMPM(slot.end_time)}`,
                            )
                            .join(", ")
                        : `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`;
                    return {
                      value: s.id,
                      label: s.name,
                      subtitle: timeDisplay,
                    };
                  })}
                  emptyMessage="No shifts available"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Vehicle *
                </label>
                <SearchableSelect
                  value={newTemp.vehicle_id}
                  onChange={(val) => setNewTemp({...newTemp, vehicle_id: val})}
                  placeholder="Select Vehicle"
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: formatVehicleLabel(v),
                    subtitle: v.vehicle_type,
                  }))}
                  emptyMessage="No vehicles available"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Reason
                </label>
                <textarea
                  rows="2"
                  value={newTemp.reason}
                  onChange={(e) =>
                    setNewTemp({...newTemp, reason: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. Medical leave replacement"
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-secondarytext bg-primarybg border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-pending flex items-center justify-center shadow-md">
                    <Clock size={28} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Temporary Assignment
                    </h2>
                    <p className="text-sm text-gray-600">
                      {formatVehicleLabel(selectedDetail)} •{" "}
                      {selectedDetail.vehicle_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content Sections */}
            <div className="p-6 space-y-4">
              {/* Driver Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Driver */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} className="text-red-600" />
                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      Original Driver
                    </h4>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedDetail.original_driver_name}
                  </p>
                </div>

                {/* Replacement Driver */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} className="text-green-600" />
                    <h4 className="text-xs font-bold text-green-900 uppercase tracking-wider">
                      Replacement Driver
                    </h4>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedDetail.replacement_driver_name}
                  </p>
                </div>
              </div>

              {/* Assignment Period */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-blue-600" />
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Assignment Period
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600 block mb-1">
                      Start Date
                    </span>
                    <span className="font-semibold text-gray-900">
                      {selectedDetail.start_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 block mb-1">
                      End Date
                    </span>
                    <span className="font-semibold text-gray-900">
                      {selectedDetail.end_date || selectedDetail.start_date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift Details */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-gray-700" />
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Shift Details
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Shift Name</span>
                    <span className="font-semibold text-gray-900">
                      {selectedDetail.shift_name || "Default Shift"}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <span className="text-sm text-gray-600 block mb-2">
                      Time Slots
                    </span>
                    <div className="space-y-2">
                      {selectedDetail.slots &&
                      selectedDetail.slots.length > 0 ? (
                        selectedDetail.slots.map((slot, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Clock size={14} className="text-primary" />
                            </div>
                            <span className="font-medium text-gray-900 text-sm">
                              {formatTimeAMPM(slot.start_time)}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-gray-900 text-sm">
                              {formatTimeAMPM(slot.end_time)}
                            </span>
                          </div>
                        ))
                      ) : selectedDetail.start_time ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Clock size={14} className="text-primary" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(selectedDetail.start_time)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(selectedDetail.end_time)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No time slots specified
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={16} className="text-gray-700" />
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Vehicle
                  </h4>
                </div>
                <p className="text-lg font-semibold text-gray-900 font-mono">
                  {formatVehicleLabel(selectedDetail)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedDetail.vehicle_number}
                </p>
              </div>

              {/* Reason */}
              {selectedDetail.reason && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-blue-600" />
                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Reason
                    </h4>
                  </div>
                  <p className="text-gray-900 italic">
                    {selectedDetail.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailModal(false);
                  handleCancel(selectedDetail.id);
                }}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
              >
                <Trash2 size={16} />
                Cancel Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
