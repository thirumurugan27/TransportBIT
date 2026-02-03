import React, {useState, useEffect} from "react";
import {Zap, Users, Plus, Trash2, X, Calendar, Truck} from "lucide-react";
import {showError, showConfirm} from "../../../utils/swal";
import {formatVehicleLabel} from "../../../utils/vehicleLabel";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function EVAssignmentsList() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAssign, setNewAssign] = useState({
    vehicle_id: "",
    cluster_id: "",
    start_date: "",
    end_date: "",
  });

  // Dropdowns
  const [evVehicles, setEvVehicles] = useState([]);
  const [clusters, setClusters] = useState([]);

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
      // Fetch EV vehicles
      const vRes = await fetch(`${API_BASE}/api/admin/ev-vehicles`);
      if (vRes.ok) setEvVehicles(await vRes.json());

      // Fetch Clusters
      const cRes = await fetch(`${API_BASE}/api/admin/clusters`);
      if (cRes.ok) setClusters(await cRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/ev-assignments/create`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          vehicle_id: parseInt(newAssign.vehicle_id),
          cluster_id: parseInt(newAssign.cluster_id),
          start_date: newAssign.start_date,
          end_date: newAssign.end_date,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchAssignments();
        setNewAssign({
          vehicle_id: "",
          cluster_id: "",
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
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
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
                        {formatVehicleLabel(item)}
                      </p>
                      <p className="text-xs text-secondarytext">
                        {item.vehicle_number}
                      </p>
                      <p className="text-sm text-secondarytext">
                        {item.start_date === item.end_date
                          ? item.start_date
                          : `${item.start_date} to ${item.end_date}`}
                      </p>
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
          <div className="bg-secondarybg rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 z-10 bg-secondarybg px-8 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-primarytext">
                Assign EV to Cluster
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext hover:text-primarytext rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-8 py-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select EV Vehicle
                </label>
                <select
                  required
                  value={newAssign.vehicle_id}
                  onChange={(e) =>
                    setNewAssign({...newAssign, vehicle_id: e.target.value})
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Choose Vehicle...</option>
                  {evVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVehicleLabel(v)} ({v.seating_capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Cluster
                </label>
                <select
                  required
                  value={newAssign.cluster_id}
                  onChange={(e) =>
                    setNewAssign({...newAssign, cluster_id: e.target.value})
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Choose Cluster...</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.driver_count || 0} drivers)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newAssign.start_date}
                    onChange={(e) =>
                      setNewAssign({...newAssign, start_date: e.target.value})
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newAssign.end_date}
                    onChange={(e) =>
                      setNewAssign({...newAssign, end_date: e.target.value})
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 text-secondarytext bg-primarybg border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-primary text-secondarybg rounded-lg hover:bg-primarydull transition-colors font-semibold shadow-sm flex items-center gap-2"
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
            className="bg-secondarybg rounded-xl shadow-xl w-full max-w-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
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
                className="text-secondarytext hover:text-primarytext rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  EV Vehicle
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                  <Truck size={16} className="text-green-600" />
                  <span className="text-gray-900 font-medium font-mono">
                    {formatVehicleLabel(selectedDetail)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                  Assigned Cluster
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-lg">
                  <Users size={16} className="text-primary" />
                  <span className="text-gray-900 font-medium">
                    {selectedDetail.cluster_name}
                  </span>
                  <span className="ml-auto text-sm text-secondarytext">
                    {selectedDetail.driver_count} drivers
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-2">
                    Start Date
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-lg">
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
                  <div className="flex items-center gap-2 px-4 py-3 bg-primarybg border border-gray-200 rounded-lg">
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
                  className="px-6 py-3 text-secondarytext bg-primarybg border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailModal(false);
                    handleDelete(selectedDetail.id);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-sm flex items-center gap-2"
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
