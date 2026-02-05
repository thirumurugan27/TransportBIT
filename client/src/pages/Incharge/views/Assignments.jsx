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
import {useToast} from "../../../context/ToastContext";
import {showConfirm, showError, showSuccess} from "../../../utils/swal";
import SearchableSelect from "../../../components/ui/SearchableSelect";

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

export default function Assignments() {
  const {showToast} = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bus"); // bus, car, ev
  const [openTempModal, setOpenTempModal] = useState(false);

  // Data
  const [busAssignments, setBusAssignments] = useState([]);
  const [carAssignments, setCarAssignments] = useState([]);
  const [evAssignments, setEvAssignments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [clusters, setClusters] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState(null); // bus, car, ev

  const [assignmentForm, setAssignmentForm] = useState({
    vehicle_id: 0,
    driver_id: 0,
    cluster_id: 0,
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
  const [driverAvailabilityMap, setDriverAvailabilityMap] = useState({}); // Map of driver_id -> {available: boolean, conflicts: []}
  const [vehicleAvailabilityMap, setVehicleAvailabilityMap] = useState({}); // Map of vehicle_id -> {available: boolean, conflicts: []}

  // EV Details Modal
  const [showEvDetailsModal, setShowEvDetailsModal] = useState(false);
  const [evDetails, setEvDetails] = useState(null);
  const [loadingEvDetails, setLoadingEvDetails] = useState(false);

  const fetchEvDetails = async (assignmentId) => {
    setLoadingEvDetails(true);
    setShowEvDetailsModal(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/ev-assignments/${assignmentId}/details`,
      );
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
      const [bus, car, ev, s, v, d, c] = await Promise.all([
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=BUS`,
        ).then((r) => r.json()),
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=CAR`,
        ).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/ev-assignments`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicles`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/drivers`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/clusters`).then((r) => r.json()),
      ]);

      setBusAssignments(bus || []);
      setCarAssignments(car || []);
      setEvAssignments(ev || []);
      setShifts(s || []);
      setVehicles(v || []);
      setDrivers(d || []);
      setClusters(c || []);
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
      cluster_id: 0,
      shift_id: 0,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
    });
    fetchAvailableDrivers();
    setShowCreateModal(true);
  };

  const handleCreate = async (forceAssign = false) => {
    // Validate based on assignment type
    const isValid =
      createModalType === "ev"
        ? assignmentForm.vehicle_id &&
          assignmentForm.cluster_id &&
          assignmentForm.start_date &&
          assignmentForm.end_date
        : assignmentForm.vehicle_id &&
          assignmentForm.driver_id &&
          assignmentForm.shift_id &&
          assignmentForm.start_date &&
          assignmentForm.end_date;

    if (!isValid) {
      showToast("Please fill all required fields", "warning");
      return;
    }

    const endpoint =
      createModalType === "ev"
        ? `${API_BASE}/api/admin/ev-assignments/create`
        : `${API_BASE}/api/admin/assignments/create`;

    const payload = {
      ...assignmentForm,
      force_assign: forceAssign,
      created_by: getCreatorIdFromToken() || undefined,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Assignment created successfully!", "success");
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
            message:
              data.message || "Driver is already assigned during this time",
            conflicts: data.conflicts || [],
            conflicting_drivers: data.conflicting_drivers || null,
          });
        } else {
          showToast(data.message || "Conflict error", "error");
        }
      } else if (res.status === 400) {
        const data = await res.json();
        if (data.error === "cluster_configuration_error") {
          showToast(data.message, "error");
          setShowCreateModal(false);
        } else {
          showToast(data.error || "Invalid request", "error");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(
          "Failed to create assignment: " + (errorData.error || res.statusText),
          "error",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating assignment", "error");
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
      created_by: getCreatorIdFromToken() || undefined,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Assignment created successfully (forced)!", "success");
        setShowCreateModal(false);
        setConflictModal(null);
        setConflictPendingForm(null);
        fetchAllData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(
          "Failed to force assign: " + (errorData.error || res.statusText),
          "error",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating assignment", "error");
    }
  };

  // Get available drivers (those not conflicting with selected shift/dates)
  const getAvailableDriversForSelection = () => {
    if (!conflictModal || !conflictPendingForm) return availableDrivers;

    // Filter out the currently selected driver (who has conflict)
    return availableDrivers.filter(
      (d) => d.id !== conflictPendingForm.driver_id,
    );
  };

  // Check driver availability and update availability map
  const checkDriverAvailability = async (
    drivers,
    shiftId,
    startDate,
    endDate,
  ) => {
    if (!shiftId || !startDate) return;

    const availabilityPromises = drivers.map(async (driver) => {
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/assignments/check-driver-conflict?driver_id=${driver.driver_id || driver.id}&shift_id=${shiftId}&date=${startDate}`,
        );
        const data = await response.json();
        return {
          driverId: driver.driver_id || driver.id,
          available: !data.conflict,
          conflicts: data.conflicts || [],
        };
      } catch (error) {
        console.error("Error checking driver availability:", error);
        return {
          driverId: driver.driver_id || driver.id,
          available: true,
          conflicts: [],
        };
      }
    });

    const results = await Promise.all(availabilityPromises);
    const availabilityMap = {};
    results.forEach((result) => {
      availabilityMap[result.driverId] = result;
    });
    setDriverAvailabilityMap(availabilityMap);
  };

  // Check vehicle availability and update availability map
  const checkVehicleAvailability = async (vehicleList, shiftId, startDate) => {
    if (!shiftId || !startDate) return;

    const availabilityPromises = vehicleList.map(async (vehicle) => {
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/assignments/check-vehicle-conflict?vehicle_id=${vehicle.id}&shift_id=${shiftId}&date=${startDate}`,
        );
        const data = await response.json();
        return {
          vehicleId: vehicle.id,
          available: !data.conflict,
          conflicts: data.conflicts || [],
        };
      } catch (error) {
        console.error("Error checking vehicle availability:", error);
        return {
          vehicleId: vehicle.id,
          available: true,
          conflicts: [],
        };
      }
    });

    const results = await Promise.all(availabilityPromises);
    const availabilityMap = {};
    results.forEach((result) => {
      availabilityMap[result.vehicleId] = result;
    });
    setVehicleAvailabilityMap(availabilityMap);
  };

  // Check availability when shift or date changes for create modal
  useEffect(() => {
    if (
      showCreateModal &&
      createModalType !== "ev" &&
      assignmentForm.shift_id &&
      assignmentForm.start_date
    ) {
      checkDriverAvailability(
        availableDrivers,
        assignmentForm.shift_id,
        assignmentForm.start_date,
        assignmentForm.end_date,
      );
    }
  }, [
    showCreateModal,
    assignmentForm.shift_id,
    assignmentForm.start_date,
    assignmentForm.end_date,
    availableDrivers,
  ]);

  // Check vehicle availability when shift or date changes in create modal
  useEffect(() => {
    if (
      showCreateModal &&
      assignmentForm.shift_id &&
      assignmentForm.start_date &&
      vehicles.length > 0
    ) {
      const filteredVehicles = vehicles.filter(
        (v) =>
          v.vehicle_type === createModalType?.toUpperCase() ||
          (createModalType === "ev" && v.fuel_type === "EV"),
      );
      checkVehicleAvailability(
        filteredVehicles,
        assignmentForm.shift_id,
        assignmentForm.start_date,
      );
    }
  }, [
    showCreateModal,
    assignmentForm.shift_id,
    assignmentForm.start_date,
    vehicles,
    createModalType,
  ]);

  // Check availability when conflict modal opens
  useEffect(() => {
    if (conflictModal && conflictPendingForm) {
      const driversToCheck = getAvailableDriversForSelection();
      checkDriverAvailability(
        driversToCheck,
        conflictPendingForm.shift_id,
        conflictPendingForm.start_date,
        conflictPendingForm.end_date,
      );
    }
  }, [conflictModal, conflictPendingForm]);

  // Select a different driver from conflict modal
  const handleSelectAlternateDriver = (driverId) => {
    setAssignmentForm((prev) => ({...prev, driver_id: driverId}));
    setConflictModal(null);
    setConflictPendingForm(null);
    // Don't auto-submit, let user review and click Create again
  };

  const handleDelete = async (id, isEv = false) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Are you sure you want to delete this assignment?",
    );
    if (!isConfirmed) return;
    const endpoint = isEv
      ? "/api/admin/ev-assignments/delete"
      : "/api/admin/assignments/delete";
    try {
      const res = await fetch(`${API_BASE}${endpoint}?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Deleted successfully", "success");
        fetchAllData();
      } else {
        showToast("Failed to delete", "error");
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
        showToast("Reassigned successfully", "success");
        setReassignModal(null);
        fetchAllData();
      } else {
        showToast("Failed to reassign", "error");
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
      value: busAssignments.concat(carAssignments).filter((a) => {
        const today = new Date().toISOString().split("T")[0];
        return (
          (a.start_date <= today && a.end_date >= today) ||
          a.assigned_date === today
        );
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
          {activeTab === "temporary" && (
            <button
              onClick={() => {
                setOpenTempModal(true);
                setTimeout(() => setOpenTempModal(false), 100);
              }}
              className="px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Create Temporary Assignment
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        {activeTab === "temporary" ? (
          <TemporaryAssignments openModal={openTempModal} />
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
                  className="rounded-md border border-gray-100 bg-primarybg p-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (activeTab === "ev") {
                      fetchEvDetails(a.id);
                    }
                  }}
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
                          {a.vehicle_name || a.vehicle_number}
                        </p>
                        <p className="text-xs text-secondarytext">
                          {a.vehicle_number}
                        </p>
                        <p className="text-sm text-secondarytext">
                          {a.start_date === a.end_date
                            ? a.start_date
                            : `${a.start_date} to ${a.end_date}`}{" "}
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
                      <div className="flex flex-wrap gap-1">
                        {a.slots && a.slots.length > 0 ? (
                          a.slots.map((slot, idx) => (
                            <span
                              key={idx}
                              className="text-xs text-secondarytext px-2 py-0.5 rounded-md bg-gray-100"
                            >
                              {formatTimeAMPM(slot.start_time)} -{" "}
                              {formatTimeAMPM(slot.end_time)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-secondarytext">
                            {formatTimeAMPM(a.start_time)} -{" "}
                            {formatTimeAMPM(a.end_time)}
                          </span>
                        )}
                      </div>
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

                    {activeTab === "ev" &&
                      a.drivers &&
                      a.drivers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {a.drivers.slice(0, 4).map((driver, idx) => (
                              <div
                                key={driver.driver_id}
                                className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center text-xs font-medium border-2 border-white"
                                title={driver.driver_name}
                              >
                                {driver.driver_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)}
                              </div>
                            ))}
                            {a.drivers.length > 4 && (
                              <div className="w-8 h-8 rounded-md bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-medium border-2 border-white">
                                +{a.drivers.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-secondarytext">
                            {a.driver_count || a.drivers.length} drivers
                          </span>
                        </div>
                      )}

                    {activeTab !== "ev" && (
                      <div
                        className="flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                        <button
                          onClick={() => handleDelete(a.id, false)}
                          className="px-3 py-2 bg-red/10 text-red rounded-md hover:bg-red/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
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
            className="bg-secondarybg rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-secondarybg px-8 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-primarytext">
                Create {createModalType.toUpperCase()} Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-8 py-6 space-y-6 relative">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                    Start Date
                  </label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-md px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
              {createModalType !== "ev" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Shift
                  </label>
                  <SearchableSelect
                    value={assignmentForm.shift_id}
                    onChange={(val) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        shift_id: parseInt(val) || 0,
                      })
                    }
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
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vehicle
                </label>
                <SearchableSelect
                  value={assignmentForm.vehicle_id}
                  onChange={(val) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      vehicle_id: parseInt(val) || 0,
                    })
                  }
                  placeholder="Select Vehicle"
                  showAvailability={true}
                  options={vehicles
                    .filter(
                      (v) =>
                        v.vehicle_type === createModalType.toUpperCase() ||
                        (createModalType === "ev" && v.fuel_type === "EV"),
                    )
                    .map((v) => {
                      const availability = vehicleAvailabilityMap[v.id];
                      const hasAvailabilityData =
                        assignmentForm.shift_id > 0 &&
                        assignmentForm.start_date &&
                        availability !== undefined;
                      const isAvailable = hasAvailabilityData
                        ? availability?.available !== false
                        : true;

                      // Build conflict info for subtitle
                      let conflictInfo = `${v.vehicle_number} • ${v.vehicle_type}`;
                      if (
                        hasAvailabilityData &&
                        !isAvailable &&
                        availability?.conflicts?.length > 0
                      ) {
                        const conflict = availability.conflicts[0];
                        conflictInfo = `${v.vehicle_number} • Assigned: ${conflict.start_date} to ${conflict.end_date}`;
                      }

                      return {
                        value: v.id,
                        label: v.vehicle_name || v.vehicle_number,
                        subtitle: conflictInfo,
                        available: isAvailable,
                        availableText:
                          hasAvailabilityData && !isAvailable
                            ? `Assigned to ${availability.conflicts?.[0]?.driver_name || "driver"}`
                            : undefined,
                      };
                    })}
                  emptyMessage="No vehicles available"
                />
              </div>
              {createModalType === "ev" ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Driver Group
                  </label>
                  <SearchableSelect
                    value={assignmentForm.cluster_id}
                    onChange={(val) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        cluster_id: parseInt(val) || 0,
                      })
                    }
                    placeholder="Select Driver Group"
                    options={clusters.map((c) => {
                      const formatTime = (time) => {
                        if (!time) return "";
                        const [h, m] = time.split(":");
                        const hour = parseInt(h);
                        const ampm = hour >= 12 ? "PM" : "AM";
                        const hour12 = hour % 12 || 12;
                        return `${hour12}:${m} ${ampm}`;
                      };

                      let subtitle = `${c.driver_count || 0} drivers`;
                      if (c.shift_name && c.shift_start && c.shift_end) {
                        subtitle += ` • ${c.shift_name} (${formatTime(c.shift_start)}-${formatTime(c.shift_end)})`;
                      } else if (c.shift_name) {
                        subtitle += ` • ${c.shift_name}`;
                      } else if (c.start_time && c.end_time) {
                        subtitle += ` • ${formatTime(c.start_time)}-${formatTime(c.end_time)}`;
                      } else {
                        subtitle += " • No shift (configure required)";
                      }

                      return {
                        value: c.id,
                        label: c.name,
                        subtitle: subtitle,
                      };
                    })}
                    emptyMessage="No driver groups available"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Driver
                  </label>
                  <SearchableSelect
                    value={assignmentForm.driver_id}
                    onChange={(val) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        driver_id: parseInt(val) || 0,
                      })
                    }
                    placeholder="Select Driver"
                    showAvailability={true}
                    options={availableDrivers.map((d) => {
                      const driverId = d.driver_id || d.id;
                      const availability = driverAvailabilityMap[driverId];
                      const hasAvailabilityData =
                        assignmentForm.shift_id > 0 &&
                        assignmentForm.start_date &&
                        availability !== undefined;
                      return {
                        value: driverId,
                        label: d.driver_name || d.full_name,
                        subtitle: d.license_type
                          ? `License: ${d.license_type}`
                          : undefined,
                        available: hasAvailabilityData
                          ? availability?.available !== false
                          : true,
                        availableText:
                          hasAvailabilityData &&
                          availability?.available === false
                            ? "Has Conflict"
                            : undefined,
                      };
                    })}
                    emptyMessage="No drivers available"
                  />
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleCreate()}
                  className="w-full bg-primary text-white rounded-md py-3 font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Create Assignment
                </button>
              </div>
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
              <h3 className="text-lg font-bold text-primarytext">
                Reassign Driver
              </h3>
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
            <SearchableSelect
              value={reassignDriverId}
              onChange={(val) => setReassignDriverId(parseInt(val) || 0)}
              placeholder="Select Driver"
              showAvailability={true}
              options={availableDrivers.map((d) => {
                const driverId = d.driver_id || d.id;
                const availability = driverAvailabilityMap[driverId];
                return {
                  value: driverId,
                  label: d.driver_name || d.full_name,
                  subtitle: d.license_type
                    ? `License: ${d.license_type}`
                    : undefined,
                  available: availability?.available !== false,
                  availableText:
                    availability?.available === false
                      ? "Has Conflict"
                      : undefined,
                };
              })}
              emptyMessage="No drivers available"
            />
            <div className="flex gap-2 justify-end mt-4">
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
            className="bg-secondarybg rounded-md shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-md flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primarytext">
                  Time Conflict Detected
                </h3>
                <p className="text-sm text-secondarytext mt-1">
                  {conflictModal.message}
                </p>
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
            {conflictModal.conflicting_drivers &&
            conflictModal.conflicting_drivers.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-primarytext mb-3">
                  Conflicting Drivers in Cluster:
                </h4>
                <div className="space-y-4">
                  {conflictModal.conflicting_drivers.map(
                    (driverConflict, idx) => (
                      <div
                        key={idx}
                        className="bg-amber-50 border border-amber-200 rounded-md p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <User size={16} className="text-amber-600" />
                          <span className="font-medium text-amber-800">
                            {driverConflict.driver_name}
                          </span>
                        </div>
                        {driverConflict.conflicts &&
                          driverConflict.conflicts.map((conflict, cIdx) => (
                            <div
                              key={cIdx}
                              className="ml-6 mb-2 text-sm text-amber-700 space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-amber-600" />
                                <span className="font-medium">
                                  {conflict.shift_name || "Shift"}
                                </span>
                                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-md">
                                  {conflict.assignment_type || "Assignment"}
                                </span>
                              </div>
                              <p>
                                <strong>Time:</strong>{" "}
                                {formatTimeAMPM(conflict.start_time)} -{" "}
                                {formatTimeAMPM(conflict.end_time)}
                              </p>
                              <p>
                                <strong>Vehicle:</strong>{" "}
                                {conflict.vehicle_number || "N/A"}
                              </p>
                              <p>
                                <strong>Dates:</strong> {conflict.start_date} to{" "}
                                {conflict.end_date}
                              </p>
                            </div>
                          ))}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : conflictModal.conflicts &&
              conflictModal.conflicts.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-primarytext mb-3">
                  Existing Assignments:
                </h4>
                <div className="space-y-2">
                  {conflictModal.conflicts.map((conflict, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-50 border border-amber-200 rounded-md p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-amber-600" />
                        <span className="font-medium text-amber-800">
                          {conflict.shift_name || "Shift"}
                        </span>
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-md">
                          {conflict.assignment_type || "Assignment"}
                        </span>
                      </div>
                      <div className="text-sm text-amber-700 space-y-1">
                        <p>
                          <strong>Time:</strong>{" "}
                          {formatTimeAMPM(conflict.start_time)} -{" "}
                          {formatTimeAMPM(conflict.end_time)}
                        </p>
                        <p>
                          <strong>Vehicle:</strong>{" "}
                          {conflict.vehicle_number || "N/A"}
                        </p>
                        <p>
                          <strong>Dates:</strong> {conflict.start_date} to{" "}
                          {conflict.end_date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Options */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-primarytext mb-3">
                What would you like to do?
              </h4>

              {/* Option 1: Force Assign */}
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-red-800">
                      Assign Anyway (Override)
                    </h5>
                    <p className="text-xs text-red-600 mt-1">
                      This will create a new assignment even though the driver
                      has conflicting schedules. Use this only if necessary.
                    </p>
                  </div>
                  <button
                    onClick={handleForceAssign}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Force Assign
                  </button>
                </div>
              </div>

              {/* Option 2: Choose Different Driver (only for non-EV assignments) */}
              {createModalType !== "ev" && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h5 className="font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle size={16} /> Choose a Different Driver
                      </h5>
                      <p className="text-xs text-green-600 mt-1 mb-3">
                        Select an available driver who doesn't have conflicting
                        assignments:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {getAvailableDriversForSelection().map((d) => {
                          const driverId = d.driver_id || d.id;
                          const availability = driverAvailabilityMap[
                            driverId
                          ] || {available: true, conflicts: []};
                          const isAvailable = availability.available;

                          return (
                            <button
                              key={driverId}
                              onClick={() =>
                                handleSelectAlternateDriver(driverId)
                              }
                              className={`flex items-center gap-2 p-3 border rounded-md transition-all text-left ${
                                isAvailable
                                  ? "bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-400"
                                  : "bg-gray-100 border-gray-300 hover:bg-gray-200 opacity-75"
                              }`}
                              title={
                                isAvailable
                                  ? "Available - No conflicts"
                                  : "Has conflicting assignments"
                              }
                            >
                              <div
                                className={`w-2 h-2 rounded-md flex-shrink-0 ${
                                  isAvailable ? "bg-green-500" : "bg-gray-400"
                                }`}
                              />
                              <User
                                size={16}
                                className={
                                  isAvailable
                                    ? "text-green-600"
                                    : "text-gray-500"
                                }
                              />
                              <span
                                className={`text-sm font-medium truncate flex-1 ${
                                  isAvailable
                                    ? "text-green-800"
                                    : "text-gray-600"
                                }`}
                              >
                                {d.driver_name || d.full_name}
                              </span>
                              {isAvailable && (
                                <CheckCircle
                                  size={14}
                                  className="text-green-600 flex-shrink-0"
                                />
                              )}
                              {!isAvailable && (
                                <AlertTriangle
                                  size={14}
                                  className="text-gray-500 flex-shrink-0"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setConflictModal(null);
                  setConflictPendingForm(null);
                }}
                className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors"
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
            className="bg-secondarybg rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
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
                    <div className="w-14 h-14 rounded-md bg-pending flex items-center justify-center text-white">
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
                  <div className="bg-primarybg rounded-md p-4">
                    <p className="text-xs text-secondarytext uppercase tracking-wider">
                      Duration
                    </p>
                    <p className="text-2xl font-bold text-primarytext mt-1">
                      {evDetails.assignment?.days_total} days
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      {evDetails.assignment?.start_date} to{" "}
                      {evDetails.assignment?.end_date}
                    </p>
                  </div>
                  <div className="bg-green/10 rounded-md p-4">
                    <p className="text-xs text-green uppercase tracking-wider">
                      Completed
                    </p>
                    <p className="text-2xl font-bold text-green mt-1">
                      {evDetails.assignment?.days_completed} days
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      {evDetails.assignment?.days_remaining} days remaining
                    </p>
                  </div>
                  <div className="bg-primary/10 rounded-md p-4">
                    <p className="text-xs text-primary uppercase tracking-wider">
                      Total KM
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {evDetails.total_vehicle_km?.toFixed(1) || 0} km
                    </p>
                    <p className="text-xs text-secondarytext mt-1">
                      Vehicle distance
                    </p>
                  </div>
                  <div className="bg-pending/10 rounded-md p-4">
                    <p className="text-xs text-pending uppercase tracking-wider">
                      Drivers
                    </p>
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
                          className="flex items-center justify-between p-3 bg-primarybg rounded-md border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-primary text-white flex items-center justify-center text-sm font-bold">
                              {driver.initials ||
                                driver.driver_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-primarytext">
                                {driver.driver_name}
                              </p>
                              <div className="flex items-center gap-2">
                                {driver.on_leave ? (
                                  <span className="text-xs text-pending font-medium">
                                    ● On Leave
                                  </span>
                                ) : (
                                  <span className="text-xs text-green font-medium">
                                    ● Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {driver.total_km?.toFixed(1) || 0} km
                            </p>
                            <p className="text-xs text-secondarytext">driven</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-secondarytext py-4">
                      No drivers in this cluster
                    </p>
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
                            <th className="text-left p-3 font-medium text-secondarytext">
                              Date
                            </th>
                            <th className="text-left p-3 font-medium text-secondarytext">
                              Driver
                            </th>
                            <th className="text-right p-3 font-medium text-secondarytext">
                              Start KM
                            </th>
                            <th className="text-right p-3 font-medium text-secondarytext">
                              End KM
                            </th>
                            <th className="text-right p-3 font-medium text-secondarytext">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {evDetails.km_logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="p-3 text-primarytext">
                                {log.date}
                              </td>
                              <td className="p-3 text-primarytext">
                                {log.driver_name}
                              </td>
                              <td className="p-3 text-right text-secondarytext">
                                {log.start_km}
                              </td>
                              <td className="p-3 text-right text-secondarytext">
                                {log.end_km}
                              </td>
                              <td className="p-3 text-right font-medium text-primary">
                                {log.total_km} km
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-secondarytext py-4">
                      No KM logs recorded yet
                    </p>
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
