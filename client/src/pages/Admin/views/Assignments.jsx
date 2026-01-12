import React, {useState, useEffect} from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function Assignments() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bus"); // bus, car, ev

  // Data
  const [busAssignments, setBusAssignments] = useState([]);
  const [carAssignments, setCarAssignments] = useState([]);
  const [evAssignments, setEvAssignments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState(null); // bus, car, ev

  const [assignmentForm, setAssignmentForm] = useState({
    vehicle_id: 0,
    driver_id: 0,
    shift_id: 0,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  });

  // Reassign Modal
  const [reassignModal, setReassignModal] = useState(null); // null or assignment object
  const [reassignDriverId, setReassignDriverId] = useState(0);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bus, car, ev, s, v, d] = await Promise.all([
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=BUS`
        ).then((r) => r.json()),
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=CAR`
        ).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/ev-assignments`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicles`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/drivers`).then((r) => r.json()),
      ]);

      setBusAssignments(bus || []);
      setCarAssignments(car || []);
      setEvAssignments(ev || []);
      setShifts(s || []);
      setVehicles(v || []);
      setDrivers(d || []);
    } catch (err) {
      console.error("Error fetching assignments data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch available drivers when opening modal
  const fetchAvailableDrivers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers`);
      const allDrivers = await res.json();
      // Filter logic can be improved based on backend availability check
      // For now, using client side 'status' if available, or just all drivers
      // filtering out those on leave is done in render
      setAvailableDrivers(allDrivers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = (type) => {
    setCreateModalType(type);
    setAssignmentForm({
      vehicle_id: 0,
      driver_id: 0,
      shift_id: 0,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
    });
    fetchAvailableDrivers();
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (
      !assignmentForm.vehicle_id ||
      !assignmentForm.driver_id ||
      !assignmentForm.shift_id ||
      !assignmentForm.start_date ||
      !assignmentForm.end_date
    ) {
      alert("Please fill all fields");
      return;
    }

    const endpoint =
      createModalType === "ev"
        ? `${API_BASE}/api/admin/ev-assignments/create`
        : `${API_BASE}/api/admin/assignments/create`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(assignmentForm),
      });

      if (res.ok) {
        alert("Assignment created successfully!");
        setShowCreateModal(false);
        fetchAllData();
      } else {
        alert("Failed to create assignment: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      alert("Error creating assignment");
    }
  };

  const handleDelete = async (id, isEv = false) => {
    if (!window.confirm("Are you sure?")) return;
    const endpoint = isEv
      ? "/api/admin/ev-assignments/delete"
      : "/api/admin/assignments/delete";
    try {
      const res = await fetch(`${API_BASE}${endpoint}?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("Deleted successfully");
        fetchAllData();
      } else {
        alert("Failed to delete");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassign = async () => {
    if (!reassignModal || !reassignDriverId) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/assignments/update`, {
        method: "POST", // Assumed update endpoint from legacy code
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          assignment_id: reassignModal.id,
          driver_id: reassignDriverId,
          status: "assigned",
        }),
      });
      if (res.ok) {
        alert("Reassigned successfully");
        setReassignModal(null);
        fetchAllData();
      } else {
        alert("Failed to reassign");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-blue-500 flex items-center justify-center text-white text-xl">
              🚌
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                BUS
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {busAssignments.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-emerald-500 flex items-center justify-center text-white text-xl">
              🚗
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                CAR
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {carAssignments.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-amber-500 flex items-center justify-center text-white text-xl">
              ⚡
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                EV
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {evAssignments.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-rose-500 flex items-center justify-center text-white text-xl">
              📅
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                TODAY
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {
                  busAssignments
                    .concat( {
                        const today = new Date().toISOString().split("T")[0];
                        return a.start_date <= today && a.end_date >= today;
                      }
                        a.assigned_date ===
                        new Date().toISOString().split("T")[0]
                    ).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex flex-wrap justify-between gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("bus")}
            className={`px-5 py-2.5 rounded-md font-medium transition-all ${
              activeTab === "bus"
                ? "bg-rose-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🚌 Bus
          </button>
          <button
            onClick={() => setActiveTab("car")}
            className={`px-5 py-2.5 rounded-md font-medium transition-all ${
              activeTab === "car"
                ? "bg-rose-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🚗 Car
          </button>
          <button
            onClick={() => setActiveTab("ev")}
            className={`px-5 py-2.5 rounded-md font-medium transition-all ${
              activeTab === "ev"
                ? "bg-rose-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            ⚡ EV
          </button>
        </div>
        <div>
          {activeTab === "bus" && (
            <button
              onClick={() => openCreateModal("bus")}
              className="px-5 py-2.5 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors font-medium shadow-sm"
            >
              + Assign Driver to Bus
            </button>
          )}
          {activeTab === "car" && (
            <button
              onClick={() => openCreateModal("car")}
              className="px-5 py-2.5 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors font-medium shadow-sm"
            >
              + Assign Driver to Car
            </button>
          )}
          {activeTab === "ev" && (
            <button
              onClick={() => openCreateModal("ev")}
              className="px-5 py-2.5 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors font-medium shadow-sm"
            >
              + New EV Assignment
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading assignments...
          </div>
        ) : (
          <div className="p-4 grid gap-4">
            {(activeTab === "bus"
              ? busAssignments
              : activeTab === "car"
              ? carAssignments
              : evAssignments
            ).length > 0 ? (
              (activeTab === "bus"
                ? busAssignments
                : activeTab === "car"
                ? carAssignments
                : evAssignments
              ).map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-md flex items-center justify-center text-white text-2xl font-bold ${
                          activeTab === "bus"
                            ? "bg-blue-500"
                            : activeTab === "car"
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                      >
                        {activeTab === "bus"
                          ? "🚌"
                          : activeTab === "car"
                          ? "🚗"
                          : "⚡"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {a.vehicle_number}
                        </p>
                        <p clstart_date === a.end_date ? a.start_date : `${a.start_date} to ${a.end_date}`-sm text-gray-500">
                          {a.assigned_date}{" "}
                          {a.cluster_name && `(${a.cluster_name})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.shift_name && (
                        <span className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 text-sm font-medium">
                          {a.shift_name}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {a.start_time} - {a.end_time}
                      </span>
                    </div>

                    {activeTab !== "ev" && (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-lg">
                          👤
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {a.driver_name}
                          </p>
                          <div className="flex gap-1">
                            {a.driver_status === "present" && (
                              <span className="text-xs text-green-600">
                                ✅ Present
                              </span>
                            )}
                            {a.driver_status === "absent" && (
                              <span className="text-xs text-red-600">
                                ❌ Absent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {activeTab !== "ev" && (
                        <button
                          onClick={() => {
                            setReassignModal(a);
                            setReassignDriverId(a.driver_id);
                            fetchAvailableDrivers();
                          }}
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          🔄 Reassign
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id, activeTab === "ev")}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p>No assignments found for {activeTab}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                Create {createModalType.toUpperCase()} Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md p-2"
                    value={assignmentForm.start_date}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        start_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md p-2"
                    value={assignmentForm.end_date}
                    min={assignmentForm.start_date}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        end_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shift</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={assignmentForm.shift_id}
                  onChange={(e) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      shift_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={0}>Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time}-{s.end_time})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle
                </label>
                <select
                  className="w-full border rounded-md p-2"
                  value={assignmentForm.vehicle_id}
                  onChange={(e) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      vehicle_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={0}>Select Vehicle</option>
                  {vehicles
                    .filter(
                      (v) =>
                        v.vehicle_type === createModalType.toUpperCase() ||
                        (createModalType === "ev" && v.fuel_type === "EV")
                    )
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_number} ({v.model || v.vehicle_type})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Driver</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={assignmentForm.driver_id}
                  onChange={(e) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      driver_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={0}>Select Driver</option>
                  {availableDrivers.map((d) => (
                    <option
                      key={d.driver_id || d.id}
                      value={d.driver_id || d.id}
                    >
                      {d.driver_name || d.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreate}
                className="w-full bg-primary text-white rounded-md py-2 font-medium hover:bg-blue-700"
              >
                Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setReassignModal(null)}
        >
          <div
            className="bg-white rounded-md shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Reassign Driver</h3>
            <p className="mb-4 text-sm text-gray-600">
              Assigning new driver for {reassignModal.vehicle_number} on{" "}
              {reassignModal.assigned_date}
            </p>
            <select
              className="w-full border rounded-md p-2 mb-4"
              value={reassignDriverId}
              onChange={(e) => setReassignDriverId(parseInt(e.target.value))}
            >
              <option value={0}>Select Driver</option>
              {availableDrivers.map((d) => (
                <option key={d.driver_id || d.id} value={d.driver_id || d.id}>
                  {d.driver_name || d.full_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReassignModal(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700"
              >
                Confirm Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
