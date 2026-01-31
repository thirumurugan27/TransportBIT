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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cluster
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Drivers
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      <Zap size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No active EV cluster assignments.</p>
                    </td>
                  </tr>
                ) : (
                  assignments.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <Truck size={16} className="text-gray-400" />
                          {formatVehicleLabel(item)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-primary)] font-medium">
                        {item.cluster_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          <span>
                            {item.start_date}{" "}
                            <span className="text-gray-400">→</span>{" "}
                            {item.end_date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-gray-400" />
                          {item.driver_count} Drivers
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Assignment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded-full">
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
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select EV Vehicle
                </label>
                <select
                  required
                  value={newAssign.vehicle_id}
                  onChange={(e) =>
                    setNewAssign({...newAssign, vehicle_id: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Cluster
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
    </div>
  );
}
