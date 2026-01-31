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

// Helper to convert 24h time to 12h AM/PM format
const formatTimeAMPM = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export default function TemporaryAssignments() {
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

  useEffect(() => {
    fetchTempAssignments();
    fetchDropdowns();
  }, []);

  const fetchTempAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/temporary-assignments`);
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
        fetch(`${API_BASE}/api/admin/drivers`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicles`).then((r) => r.json()),
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
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            original_driver_id: parseInt(newTemp.original_driver_id),
            replacement_driver_id: parseInt(newTemp.replacement_driver_id),
            start_date: newTemp.start_date,
            end_date: newTemp.end_date || newTemp.start_date,
            reason: newTemp.reason,
            shift_id: parseInt(newTemp.shift_id) || 0,
            vehicle_id: parseInt(newTemp.vehicle_id) || 0,
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
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
            <p>Loading temporary assignments...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Driver Change
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Context (Veh/Shift)
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tempAssignments.length > 0 ? (
                  tempAssignments.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 line-through decoration-red-500 decoration-2">
                            {t.original_driver_name}
                          </span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="font-medium text-[var(--color-primary)]">
                            {t.replacement_driver_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {t.start_date}
                          {t.end_date !== t.start_date && (
                            <span className="text-gray-500 font-normal">
                              {" "}
                              → {t.end_date}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            <span>{t.shift_name || "Default Shift"}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Truck size={12} className="text-gray-400" />
                            <span className="font-mono text-xs">
                              {formatVehicleLabel(t)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 italic">
                        {t.reason || "No reason provided"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCancel(t.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors inline-flex items-center gap-1"
                          title="Cancel Assignment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      <FileText size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No temporary substitutions active.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                New Temporary Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"
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
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTemp.start_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, start_date: e.target.value})
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newTemp.end_date}
                    onChange={(e) =>
                      setNewTemp({...newTemp, end_date: e.target.value})
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
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

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Shift *
                  </label>
                  <SearchableSelect
                    value={newTemp.shift_id}
                    onChange={(val) => setNewTemp({...newTemp, shift_id: val})}
                    placeholder="Select Shift"
                    options={shifts.map((s) => ({
                      value: s.id,
                      label: s.shift_name,
                      subtitle: `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`,
                    }))}
                    emptyMessage="No shifts available"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Vehicle *
                  </label>
                  <SearchableSelect
                    value={newTemp.vehicle_id}
                    onChange={(val) =>
                      setNewTemp({...newTemp, vehicle_id: val})
                    }
                    placeholder="Select Vehicle"
                    options={vehicles.map((v) => ({
                      value: v.id,
                      label: formatVehicleLabel(v),
                      subtitle: v.vehicle_type,
                    }))}
                    emptyMessage="No vehicles available"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Reason
                </label>
                <textarea
                  rows="2"
                  value={newTemp.reason}
                  onChange={(e) =>
                    setNewTemp({...newTemp, reason: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="e.g. Medical leave replacement"
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 transition-colors"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
