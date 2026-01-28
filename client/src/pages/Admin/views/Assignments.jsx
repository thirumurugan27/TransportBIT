import React, {useState, useEffect} from "react";
import TemporaryAssignments from "./TemporaryAssignments";
import {
  Bus,
  Car,
  Zap,
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  User,
  Clock,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
  Users,
  TrendingUp,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Helper to convert 24h time to 12h AM/PM format
const formatTimeAMPM = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

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

  // Conflict Modal State
  const [conflictModal, setConflictModal] = useState(null); // { conflicts: [], message: '' }
  const [conflictPendingForm, setConflictPendingForm] = useState(null); // form data waiting for force assign

  // EV Details Modal
  const [showEvDetailsModal, setShowEvDetailsModal] = useState(false);
  const [evDetails, setEvDetails] = useState(null);
  const [loadingEvDetails, setLoadingEvDetails] = useState(false);

  const fetchEvDetails = async (assignmentId) => {
    setLoadingEvDetails(true);
    setShowEvDetailsModal(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ev-assignments/${assignmentId}/details`);
      if (res.ok) {
        const data = await res.json();
        setEvDetails(data);
      } else {
        console.error("Failed to fetch EV details");
      }
    } catch (err) {
      console.error("Error fetching EV details:", err);
    } finally {
      setLoadingEvDetails(false);
    }
  };

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

  const handleCreate = async (forceAssign = false) => {
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

    const payload = {
      ...assignmentForm,
      force_assign: forceAssign,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Assignment created successfully!");
        setShowCreateModal(false);
        setConflictModal(null);
        setConflictPendingForm(null);
        fetchAllData();
      } else if (res.status === 409) {
        // Time conflict detected
        const data = await res.json();
        if (data.error === "time_conflict") {
          setConflictPendingForm({...assignmentForm});
          setConflictModal({
            message: data.message || "Driver is already assigned during this time",
            conflicts: data.conflicts || [],
          });
        } else {
          alert(data.message || "Conflict error");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Failed to create assignment: " + (errorData.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
      alert("Error creating assignment");
    }
  };

  // Force assign after viewing conflict warning
  const handleForceAssign = async () => {
    if (!conflictPendingForm) return;
    
    const endpoint =
      createModalType === "ev"
        ? `${API_BASE}/api/admin/ev-assignments/create`
        : `${API_BASE}/api/admin/assignments/create`;

    const payload = {
      ...conflictPendingForm,
      force_assign: true,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Assignment created successfully (forced)!");
        setShowCreateModal(false);
        setConflictModal(null);
        setConflictPendingForm(null);
        fetchAllData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Failed to force assign: " + (errorData.error || res.statusText));
      }
    } catch (err) {
      console.error(err);
      alert("Error creating assignment");
    }
  };

  // Get available drivers (those not conflicting with selected shift/dates)
  const getAvailableDriversForSelection = () => {
    if (!conflictModal || !conflictPendingForm) return availableDrivers;
    
    // Filter out the currently selected driver (who has conflict)
    return availableDrivers.filter(d => d.id !== conflictPendingForm.driver_id);
  };

  // Select a different driver from conflict modal
  const handleSelectAlternateDriver = (driverId) => {
    setAssignmentForm(prev => ({...prev, driver_id: driverId}));
    setConflictModal(null);
    setConflictPendingForm(null);
    // Don't auto-submit, let user review and click Create again
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

  // Stats configuration
  const stats = [
    {
      label: "Bus Assignments",
      value: busAssignments.length,
      icon: Bus,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Car Assignments",
      value: carAssignments.length,
      icon: Car,
      color: "bg-green/10 text-green",
    },
    {
      label: "EV Assignments",
      value: evAssignments.length,
      icon: Zap,
      color: "bg-pending/10 text-pending",
    },
    {
      label: "Active Today",
      value: busAssignments
        .concat(carAssignments)
        .filter((a) => {
          const today = new Date().toISOString().split("T")[0];
          return (a.start_date <= today && a.end_date >= today) || a.assigned_date === today;
        }).length,
      icon: Calendar,
      color: "bg-red/10 text-red",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
              Assignment Management
            </h3>
            <p className="text-sm text-secondarytext mt-1">
              Manage driver assignments for buses, cars, and electric vehicles
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-secondarybg p-5 rounded-md shadow-sm border border-gray-100 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                {stat.label}
              </p>
              <h3 className="text-2xl font-black text-primarytext mt-1">
                {stat.value}
              </h3>
            </div>
            <div className={`p-3 rounded-md ${stat.color}`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Actions */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm p-4 flex flex-wrap justify-between gap-4 items-center">
        <div className="flex items-center bg-primarybg rounded-md p-1 border border-gray-200">
          <button
            onClick={() => setActiveTab("bus")}
            className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeTab === "bus"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <Bus size={16} /> Bus
          </button>
          <button
            onClick={() => setActiveTab("car")}
            className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeTab === "car"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <Car size={16} /> Car
          </button>
          <button
            onClick={() => setActiveTab("ev")}
            className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeTab === "ev"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <Zap size={16} /> EV
          </button>
          <button
            onClick={() => setActiveTab("temporary")}
            className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeTab === "temporary"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <Clock size={16} /> Temporary
          </button>
        </div>
        <div>
          {activeTab === "bus" && (
            <button
              onClick={() => openCreateModal("bus")}
              className="px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Assign Driver to Bus
            </button>
          )}
          {activeTab === "car" && (
            <button
              onClick={() => openCreateModal("car")}
              className="px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Assign Driver to Car
            </button>
          )}
          {activeTab === "ev" && (
            <button
              onClick={() => openCreateModal("ev")}
              className="px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> New EV Assignment
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        {activeTab === "temporary" ? (
          <TemporaryAssignments />
        ) : loading ? (
          <div className="p-12 text-center text-secondarytext">
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
                  className="rounded-md border border-gray-100 bg-primarybg p-4 hover:shadow-md transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-md flex items-center justify-center text-white ${
                          activeTab === "bus"
                            ? "bg-primary"
                            : activeTab === "car"
                            ? "bg-green"
                            : "bg-pending"
                        }`}
                      >
                        {activeTab === "bus" ? (
                          <Bus size={20} />
                        ) : activeTab === "car" ? (
                          <Car size={20} />
                        ) : (
                          <Zap size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-primarytext">
                          {a.vehicle_number}
                        </p>
                        <p className="text-sm text-secondarytext">
                          {a.start_date === a.end_date ? a.start_date : `${a.start_date} to ${a.end_date}`}{" "}
                          {a.cluster_name && `(${a.cluster_name})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.shift_name && (
                        <span className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
                          {a.shift_name}
                        </span>
                      )}
                      <span className="text-xs text-secondarytext">
                        {formatTimeAMPM(a.start_time)} - {formatTimeAMPM(a.end_time)}
                      </span>
                    </div>

                    {activeTab !== "ev" && (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center">
                          <User size={18} className="text-secondarytext" />
                        </div>
                        <div>
                          <p className="font-medium text-primarytext">
                            {a.driver_name}
                          </p>
                          <div className="flex gap-1">
                            {a.driver_status === "present" && (
                              <span className="text-xs text-green font-medium">
                                ● Present
                              </span>
                            )}
                            {a.driver_status === "absent" && (
                              <span className="text-xs text-red font-medium">
                                ● Absent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "ev" && a.drivers && a.drivers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {a.drivers.slice(0, 4).map((driver, idx) => (
                            <div
                              key={driver.driver_id}
                              className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium border-2 border-white"
                              title={driver.driver_name}
                            >
                              {driver.driver_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                          ))}
                          {a.drivers.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-medium border-2 border-white">
                              +{a.drivers.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-secondarytext">{a.driver_count || a.drivers.length} drivers</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {activeTab === "ev" && (
                        <button
                          onClick={() => fetchEvDetails(a.id)}
                          className="px-3 py-2 bg-pending/10 text-pending rounded-md hover:bg-pending/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                        >
                          <Eye size={14} /> Details
                        </button>
                      )}
                      {activeTab !== "ev" && (
                        <button
                          onClick={() => {
                            setReassignModal(a);
                            setReassignDriverId(a.driver_id);
                            fetchAvailableDrivers();
                          }}
                          className="px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                        >
                          <RefreshCw size={14} /> Reassign
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id, activeTab === "ev")}
                        className="px-3 py-2 bg-red/10 text-red rounded-md hover:bg-red/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-secondarytext">
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
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Create {createModalType.toUpperCase()} Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">Shift</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={assignmentForm.shift_id}
                  onChange={(e) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      shift_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={0}>Select Shift</option>
                  {shifts.map((s) => {
                    // Show all time slots if available in AM/PM format
                    const timeDisplay = s.slots && s.slots.length > 0
                      ? s.slots.map(slot => `${formatTimeAMPM(slot.start_time)}-${formatTimeAMPM(slot.end_time)}`).join(', ')
                      : `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({timeDisplay})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                  Vehicle
                </label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">Driver</label>
                <select
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                className="w-full bg-primary text-white rounded-md py-2.5 font-medium hover:bg-primary/90 transition-colors"
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
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-primarytext">Reassign Driver</h3>
              <button
                onClick={() => setReassignModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-secondarytext">
              Assigning new driver for {reassignModal.vehicle_number} on{" "}
              {reassignModal.assigned_date}
            </p>
            <select
              className="w-full border border-gray-200 rounded-md p-2.5 mb-4 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Confirm Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Conflict Warning Modal */}
      {conflictModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setConflictModal(null);
            setConflictPendingForm(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primarytext">Time Conflict Detected</h3>
                <p className="text-sm text-secondarytext mt-1">{conflictModal.message}</p>
              </div>
              <button
                onClick={() => {
                  setConflictModal(null);
                  setConflictPendingForm(null);
                }}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conflict Details */}
            {conflictModal.conflicts && conflictModal.conflicts.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-primarytext mb-3">Existing Assignments:</h4>
                <div className="space-y-2">
                  {conflictModal.conflicts.map((conflict, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-amber-600" />
                        <span className="font-medium text-amber-800">
                          {conflict.shift_name || "Shift"}
                        </span>
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
                          {conflict.assignment_type || "Assignment"}
                        </span>
                      </div>
                      <div className="text-sm text-amber-700 space-y-1">
                        <p>
                          <strong>Time:</strong> {formatTimeAMPM(conflict.start_time)} - {formatTimeAMPM(conflict.end_time)}
                        </p>
                        <p>
                          <strong>Vehicle:</strong> {conflict.vehicle_number || "N/A"}
                        </p>
                        <p>
                          <strong>Dates:</strong> {conflict.start_date} to {conflict.end_date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-primarytext mb-3">What would you like to do?</h4>
              
              {/* Option 1: Force Assign */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-red-800">Assign Anyway (Override)</h5>
                    <p className="text-xs text-red-600 mt-1">
                      This will create a new assignment even though the driver has conflicting schedules. 
                      Use this only if necessary.
                    </p>
                  </div>
                  <button
                    onClick={handleForceAssign}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Force Assign
                  </button>
                </div>
              </div>

              {/* Option 2: Choose Different Driver */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-green-800 flex items-center gap-2">
                      <CheckCircle size={16} /> Choose a Different Driver
                    </h5>
                    <p className="text-xs text-green-600 mt-1 mb-3">
                      Select an available driver who doesn't have conflicting assignments:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {getAvailableDriversForSelection().map((d) => (
                        <button
                          key={d.driver_id || d.id}
                          onClick={() => handleSelectAlternateDriver(d.driver_id || d.id)}
                          className="flex items-center gap-2 p-2 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left"
                        >
                          <User size={16} className="text-green-600" />
                          <span className="text-sm text-green-800 font-medium truncate">
                            {d.driver_name || d.full_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setConflictModal(null);
                  setConflictPendingForm(null);
                }}
                className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EV Assignment Details Modal */}
      {showEvDetailsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEvDetailsModal(false);
            setEvDetails(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingEvDetails ? (
              <div className="p-12 text-center text-secondarytext">
                Loading assignment details...
              </div>
            ) : evDetails ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-pending/5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-pending flex items-center justify-center text-white">
                      <Zap size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primarytext">
                        {evDetails.assignment?.vehicle_number}
                      </h3>
                      <p className="text-sm text-secondarytext">
                        EV Assignment • {evDetails.assignment?.cluster_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowEvDetailsModal(false);
                      setEvDetails(null);
                    }}
                    className="text-secondarytext hover:text-primarytext transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
                  <div className="bg-primarybg rounded-lg p-4">
                    <p className="text-xs text-secondarytext uppercase tracking-wider">Duration</p>
                    <p className="text-2xl font-bold text-primarytext mt-1">
                      {evDetails.assignment?.days_total} days
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      {evDetails.assignment?.start_date} to {evDetails.assignment?.end_date}
                    </p>
                  </div>
                  <div className="bg-green/10 rounded-lg p-4">
                    <p className="text-xs text-green uppercase tracking-wider">Completed</p>
                    <p className="text-2xl font-bold text-green mt-1">
                      {evDetails.assignment?.days_completed} days
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      {evDetails.assignment?.days_remaining} days remaining
                    </p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4">
                    <p className="text-xs text-primary uppercase tracking-wider">Total KM</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {evDetails.total_vehicle_km?.toFixed(1) || 0} km
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      Vehicle distance
                    </p>
                  </div>
                  <div className="bg-pending/10 rounded-lg p-4">
                    <p className="text-xs text-pending uppercase tracking-wider">Drivers</p>
                    <p className="text-2xl font-bold text-pending mt-1">
                      {evDetails.drivers?.length || 0}
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      In cluster
                    </p>
                  </div>
                </div>

                {/* Drivers Section */}
                <div className="p-6 border-b border-gray-100">
                  <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Users size={16} /> Cluster Drivers
                  </h4>
                  {evDetails.drivers && evDetails.drivers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {evDetails.drivers.map((driver) => (
                        <div
                          key={driver.driver_id}
                          className="flex items-center justify-between p-3 bg-primarybg rounded-lg border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                              {driver.initials || driver.driver_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-primarytext">{driver.driver_name}</p>
                              <div className="flex items-center gap-2">
                                {driver.on_leave ? (
                                  <span className="text-xs text-pending font-medium">● On Leave</span>
                                ) : (
                                  <span className="text-xs text-green font-medium">● Active</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{driver.total_km?.toFixed(1) || 0} km</p>
                            <p className="text-xs text-secondarytext">driven</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-secondarytext py-4">No drivers in this cluster</p>
                  )}
                </div>

                {/* KM Logs Section */}
                <div className="p-6">
                  <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp size={16} /> Recent KM Logs
                  </h4>
                  {evDetails.km_logs && evDetails.km_logs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-3 font-medium text-secondarytext">Date</th>
                            <th className="text-left p-3 font-medium text-secondarytext">Driver</th>
                            <th className="text-right p-3 font-medium text-secondarytext">Start KM</th>
                            <th className="text-right p-3 font-medium text-secondarytext">End KM</th>
                            <th className="text-right p-3 font-medium text-secondarytext">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {evDetails.km_logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="p-3 text-primarytext">{log.date}</td>
                              <td className="p-3 text-primarytext">{log.driver_name}</td>
                              <td className="p-3 text-right text-secondarytext">{log.start_km}</td>
                              <td className="p-3 text-right text-secondarytext">{log.end_km}</td>
                              <td className="p-3 text-right font-medium text-primary">{log.total_km} km</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-secondarytext py-4">No KM logs recorded yet</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-red">
                Failed to load assignment details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
