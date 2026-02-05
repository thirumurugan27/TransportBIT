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
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-700">
          Substitutions & Temporary Assignments
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
        >
          <Plus size={18} /> Create New
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-md shadow-sm border border-gray-100">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-md mb-4"></div>
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
                        <p className="font-medium text-gray-900 line-through">
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
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 z-10 bg-secondarybg flex justify-between items-center px-8 py-5 border-b border-gray-100">
              <h3 className="text-2xl font-bold text-primarytext">
                New Temporary Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext hover:text-primarytext rounded-md p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-8 py-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100 flex items-start gap-3">
                <AlertCircle
                  className="text-blue-600 mt-0.5 flex-shrink-0"
                  size={20}
                />
                <p className="text-sm text-blue-700">
                  This will override existing assignments for the selected
                  dates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newTemp.start_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, start_date: e.target.value})
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newTemp.end_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, end_date: e.target.value})
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Original Driver (Unavailable){" "}
                  <span className="text-red-500">*</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Replacement Driver <span className="text-red-500">*</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shift <span className="text-red-500">*</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vehicle <span className="text-red-500">*</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason
                </label>
                <textarea
                  rows="3"
                  value={newTemp.reason}
                  onChange={(e) =>
                    setNewTemp({...newTemp, reason: e.target.value})
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="e.g. Medical leave replacement"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 text-secondarytext bg-primarybg border border-gray-200 rounded-md hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors font-semibold shadow-sm"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl w-full max-w-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-primarytext">
                Temporary Assignment Details
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-secondarytext hover:text-primarytext rounded-md p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Original Driver
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
                    <User size={16} className="text-red-600" />
                    <span className="text-gray-900 font-medium line-through decoration-red-500 decoration-2">
                      {selectedDetail.original_driver_name}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Replacement Driver
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-md">
                    <User size={16} className="text-green-600" />
                    <span className="text-gray-900 font-medium">
                      {selectedDetail.replacement_driver_name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Start Date
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                    <Calendar size={16} className="text-primary" />
                    <span className="text-gray-900 font-medium">
                      {selectedDetail.start_date}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    End Date
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                    <Calendar size={16} className="text-primary" />
                    <span className="text-gray-900 font-medium">
                      {selectedDetail.end_date || selectedDetail.start_date}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  Shift Details
                </label>
                <div className="px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-primary" />
                    <span className="text-gray-900 font-semibold">
                      {selectedDetail.shift_name || "Default Shift"}
                    </span>
                  </div>
                  {selectedDetail.slots && selectedDetail.slots.length > 0 ? (
                    <div className="space-y-2">
                      <span className="text-xs text-secondarytext block">
                        Time Slots
                      </span>
                      {selectedDetail.slots.map((slot, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200"
                        >
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Clock size={12} className="text-primary" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(slot.start_time)}
                          </span>
                          <span className="text-gray-400 text-sm">→</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(slot.end_time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    selectedDetail.start_time && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200">
                        <span className="font-medium text-gray-900 text-sm">
                          {formatTimeAMPM(selectedDetail.start_time)} →{" "}
                          {formatTimeAMPM(selectedDetail.end_time)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  Vehicle
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                  <Truck size={16} className="text-primary" />
                  <span className="text-gray-900 font-medium font-mono">
                    {formatVehicleLabel(selectedDetail)}
                  </span>
                </div>
              </div>

              {selectedDetail.reason && (
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Reason
                  </label>
                  <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-gray-900 italic">
                      {selectedDetail.reason}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-3 text-secondarytext bg-primarybg border border-gray-200 rounded-md hover:bg-gray-100 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailModal(false);
                    handleCancel(selectedDetail.id);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold shadow-sm flex items-center gap-2"
                >
                  <Trash2 size={18} /> Cancel Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
