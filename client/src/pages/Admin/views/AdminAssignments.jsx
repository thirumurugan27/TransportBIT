import React, {useState, useEffect} from "react";
import TemporaryAssignments from "./TemporaryAssignments";
import EVAssignmentsList from "./EVAssignmentsList";
import {showError, showConfirm} from "../../../utils/swal";
import {formatVehicleLabel} from "../../../utils/vehicleLabel";
import {
  Calendar,
  User,
  Truck,
  Clock,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminAssignments() {
  const [activeTab, setActiveTab] = useState("regular"); // regular, temporary, ev, other
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    if (activeTab === "regular" || activeTab === "other") {
      fetchAssignments();
    }
  }, [activeTab]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/assignments`);
      const data = await res.json();
      setAssignments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    // Only fetch if not already fetched
    if (drivers.length > 0) return;
    try {
      const [dRes, vRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/drivers`),
        fetch(`${API_BASE}/api/admin/vehicles`),
        fetch(`${API_BASE}/api/admin/shifts`),
      ]);
      if (dRes.ok) setDrivers(await dRes.json());
      if (vRes.ok) setVehicles(await vRes.json());
      if (sRes.ok) setShifts(await sRes.json());
    } catch (err) {
      console.error("Error fetching dropdowns", err);
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this assignment?",
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/assignments/delete`, {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({id: parseInt(id)}),
      });
      if (res.ok) {
        fetchAssignments();
      } else {
        showError("Error", "Failed to delete assignment");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (assignment) => {
    setEditingAssignment({
      ...assignment,
      driver_id: assignment.driver_id, // Ensure these fields exist in your API response
      vehicle_id: assignment.vehicle_id,
      shift_id: assignment.shift_id,
    });
    fetchDropdowns();
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/assignments/update`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          id: editingAssignment.id,
          driver_id: parseInt(editingAssignment.driver_id),
          vehicle_id: parseInt(editingAssignment.vehicle_id),
          shift_id: parseInt(editingAssignment.shift_id),
          assigned_date: editingAssignment.assigned_date,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchAssignments();
      } else {
        showError("Error", "Failed to update assignment");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (activeTab === "other") {
      return a.vehicle_type !== "BUS" && a.vehicle_type !== "CAR";
    }
    // Regular tab usually implies Bus/Car standard assignments
    if (activeTab === "regular") {
      return true;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Assignment Management
        </h2>
      </div>

      {/* Custom Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-6 overflow-x-auto pb-1">
          {[
            {id: "regular", label: "Regular Assignments"},
            {id: "temporary", label: "Temporary & Subs"},
            {id: "ev", label: "EV & Clusters"},
            {id: "other", label: "Other Vehicles"},
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition-all duration-200
                ${
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "temporary" ? (
        <TemporaryAssignments />
      ) : activeTab === "ev" ? (
        <EVAssignmentsList />
      ) : (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
              <p>Loading assignments...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        <Calendar
                          size={48}
                          className="mx-auto mb-3 opacity-20"
                        />
                        <p>No assignments found for this category.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((assignment) => (
                      <tr
                        key={assignment.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-sm">
                            <span className="font-medium text-gray-900 flex items-center gap-2">
                              <Calendar size={14} className="text-gray-400" />{" "}
                              {assignment.assigned_date}
                            </span>
                            <span className="text-gray-500 flex items-center gap-2 mt-1">
                              <Clock size={14} className="text-gray-400" />{" "}
                              {assignment.shift_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400" />
                            <span className="font-medium">
                              {assignment.driver_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Truck size={16} className="text-gray-400" />
                            <span>{formatVehicleLabel(assignment)}</span>
                          </div>
                          <div className="text-xs text-gray-400 ml-6">
                            {assignment.vehicle_type}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              assignment.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {assignment.status === "COMPLETED" ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {assignment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(assignment)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(assignment.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Edit Assignment
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Driver
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={editingAssignment.driver_id || ""}
                  onChange={(e) =>
                    setEditingAssignment({
                      ...editingAssignment,
                      driver_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Vehicle
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={editingAssignment.vehicle_id || ""}
                  onChange={(e) =>
                    setEditingAssignment({
                      ...editingAssignment,
                      vehicle_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVehicleLabel(v)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Shift
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={editingAssignment.shift_id || ""}
                  onChange={(e) =>
                    setEditingAssignment({
                      ...editingAssignment,
                      shift_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shift_name} ({s.start_time}-{s.end_time})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 flex items-center gap-2"
                >
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
