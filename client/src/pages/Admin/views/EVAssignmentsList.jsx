import React, {useState, useEffect} from "react";
import {Zap, Users, Plus, Trash2, X, Calendar, Truck} from "lucide-react";
import {showError, showConfirm} from "../../../utils/swal";
import {formatVehicleLabel} from "../../../utils/vehicleLabel";
import {formatTime} from "../../../utils/dateFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function EVAssignmentsList() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAssign, setNewAssign] = useState({
    vehicle_group_id: "",
    cluster_id: "",
    shift_id: "",
    start_date: "",
    end_date: "",
  });

  // Dropdowns
  const [clusters, setClusters] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [vehicleGroups, setVehicleGroups] = useState([]);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    fetchAssignments();
    fetchDropdowns();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ev-assignments`);
      if (res.ok) {
        setAssignments((await res.json()) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      // Fetch Clusters
      const cRes = await fetch(`${API_BASE}/api/admin/clusters`);
      if (cRes.ok) setClusters(await cRes.json());

      // Fetch Shifts
      const sRes = await fetch(`${API_BASE}/api/admin/shifts`);
      if (sRes.ok) setShifts(await sRes.json());

      // Fetch Vehicle Groups
      const vgRes = await fetch(`${API_BASE}/api/admin/vehicle-groups`);
      if (vgRes.ok) setVehicleGroups(await vgRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        vehicle_group_id: parseInt(newAssign.vehicle_group_id),
        cluster_id: parseInt(newAssign.cluster_id),
        start_date: newAssign.start_date,
        end_date: newAssign.end_date,
        shift_id: parseInt(newAssign.shift_id),
      };

      if (!newAssign.vehicle_group_id)
        return showError("Error", "Please select a vehicle group");

      const res = await fetch(`${API_BASE}/api/admin/ev-assignments/create`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchAssignments();
        setNewAssign({
          vehicle_group_id: "",
          cluster_id: "",
          shift_id: "",
          start_date: "",
          end_date: "",
        });
      } else {
        const err = await res.json();
        showError("Error", err.message || err.error);
      }
    } catch (err) {
      showError("Error", "Error creating assignment");
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this assignment?",
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/ev-assignments/delete?id=${id}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        fetchAssignments();
      } else {
        showError("Error", "Failed to delete");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-700">
          EV Cluster Assignments
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
        >
          <Zap size={18} fill="currentColor" /> Assign Cluster to EV
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-md mb-4"></div>
            <p>Loading EV assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Zap size={48} className="mx-auto mb-3 opacity-20" />
            <p>No active EV cluster assignments.</p>
          </div>
        ) : (
          <div className="p-4 grid gap-4">
            {assignments.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-gray-100 bg-primarybg p-4 hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                  setSelectedDetail(item);
                  setShowDetailModal(true);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md flex items-center justify-center text-white bg-pending">
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-primarytext">
                        {item.vehicle_group_name
                          ? `Group: ${item.vehicle_group_name}`
                          : formatVehicleLabel(item)}
                      </p>
                      <p className="text-xs text-secondarytext">
                        {item.vehicle_group_name
                          ? `${item.vehicle_count} Vehicles`
                          : item.vehicle_number}
                      </p>
                      <p className="text-sm text-secondarytext">
                        {item.start_date === item.end_date
                          ? item.start_date
                          : `${item.start_date} to ${item.end_date}`}
                      </p>
                      {item.shift_name && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-medium">
                            Shift: {item.shift_name}
                          </span>
                          {item.shift_slot_time && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 font-medium">
                              Slot: {item.shift_slot_time}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
                      {item.cluster_name}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-secondarytext">
                      <Users size={16} className="text-gray-400" />
                      <span className="font-medium">
                        {item.driver_count} Drivers
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Assignment"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded-md">
                  <Zap
                    className="text-green-600"
                    size={20}
                    fill="currentColor"
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  Assign EV to Cluster
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Vehicle Group
                </label>
                <select
                  required
                  value={newAssign.vehicle_group_id}
                  onChange={(e) =>
                    setNewAssign({
                      ...newAssign,
                      vehicle_group_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Choose Group...</option>
                  {vehicleGroups.map((vg) => (
                    <option key={vg.id} value={vg.id}>
                      {vg.name} ({vg.vehicle_count || 0} vehicles)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Cluster (Drivers)
                </label>
                <select
                  required
                  value={newAssign.cluster_id}
                  onChange={(e) =>
                    setNewAssign({...newAssign, cluster_id: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Choose Cluster...</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.driver_count || 0} drivers)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Shift (Optional)
                </label>
                <select
                  value={newAssign.shift_id}
                  onChange={(e) =>
                    setNewAssign({...newAssign, shift_id: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Use Cluster Default</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatTime(s.start_time)} -{" "}
                      {formatTime(s.end_time)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newAssign.start_date}
                    onChange={(e) =>
                      setNewAssign({...newAssign, start_date: e.target.value})
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newAssign.end_date}
                    onChange={(e) =>
                      setNewAssign({...newAssign, end_date: e.target.value})
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
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
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} /> Assign Cluster
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
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-md">
                  <Zap
                    className="text-green-600"
                    size={20}
                    fill="currentColor"
                  />
                </div>
                <h3 className="text-2xl font-bold text-primarytext">
                  EV Assignment Details
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-secondarytext hover:text-primarytext rounded-md p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  EV{" "}
                  {selectedDetail.vehicle_group_name
                    ? "Vehicle Group"
                    : "Vehicle"}
                </label>
                <div className="flex flex-col gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-green-600" />
                    <span className="text-gray-900 font-medium font-mono">
                      {selectedDetail.vehicle_group_name ||
                        formatVehicleLabel(selectedDetail)}
                    </span>
                  </div>
                  {selectedDetail.vehicles &&
                    selectedDetail.vehicles.length > 0 &&
                    selectedDetail.vehicle_group_name && (
                      <div className="mt-2 text-sm text-gray-600 pl-6 border-l-2 border-green-200">
                        {selectedDetail.vehicles
                          .map((v) => v.vehicle_number)
                          .join(", ")}
                      </div>
                    )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  Assigned Cluster
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                  <Users size={16} className="text-primary" />
                  <span className="text-gray-900 font-medium">
                    {selectedDetail.cluster_name}
                  </span>
                  <span className="ml-auto text-sm text-secondarytext">
                    {selectedDetail.driver_count} drivers
                  </span>
                </div>
              </div>

              {selectedDetail.shift_name && (
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Shift
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-md">
                    <Calendar
                      size={16}
                      className="text-[var(--color-primary)]"
                    />
                    <span className="text-gray-900 font-medium">
                      {selectedDetail.shift_name}
                    </span>
                  </div>
                </div>
              )}

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
                      {selectedDetail.end_date}
                    </span>
                  </div>
                </div>
              </div>

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
                    handleDelete(selectedDetail.id);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold shadow-sm flex items-center gap-2"
                >
                  <Trash2 size={18} /> Delete Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
