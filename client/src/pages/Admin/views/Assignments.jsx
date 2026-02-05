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
  Search,
  Filter,
  Truck,
  FileText,
} from "lucide-react";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";
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
  const [activeTab, setActiveTab] = useState("bus"); // bus, car, ev, other, temporary
  const [openTempModal, setOpenTempModal] = useState(false);

  // Data
  const [busAssignments, setBusAssignments] = useState([]);
  const [carAssignments, setCarAssignments] = useState([]);
  const [evAssignments, setEvAssignments] = useState([]);
  const [otherAssignments, setOtherAssignments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [vehicleGroups, setVehicleGroups] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState(null); // bus, car, ev

  const [assignmentForm, setAssignmentForm] = useState({
    vehicle_id: 0,
    vehicle_group_id: 0,
    driver_id: 0,
    cluster_id: 0,
    shift_id: 0,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    description: "",
  });

  // Reassign Modal
  const [reassignModal, setReassignModal] = useState(null); // null or assignment object
  const [reassignDriverId, setReassignDriverId] = useState(0);

  // Conflict Modal State
  const [conflictModal, setConflictModal] = useState(null); // { conflicts: [], message: '' }
  const [conflictPendingForm, setConflictPendingForm] = useState(null); // form data waiting for force assign
  const [driverAvailabilityMap, setDriverAvailabilityMap] = useState({}); // Map of driver_id -> {available: boolean, conflicts: []}
  const [vehicleAvailabilityMap, setVehicleAvailabilityMap] = useState({}); // Map of vehicle_id -> {available: boolean, conflicts: []}

  // Assignment Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // EV Details Modal
  const [showEvDetailsModal, setShowEvDetailsModal] = useState(false);
  const [evDetails, setEvDetails] = useState(null);
  const [loadingEvDetails, setLoadingEvDetails] = useState(false);

  // Sort and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("vehicle"); // vehicle, driver, date
  const [sortOrder, setSortOrder] = useState("asc"); // asc, desc
  const [filterShift, setFilterShift] = useState(""); // empty means all
  const [filterStatus, setFilterStatus] = useState(""); // empty means all
  const [showFilters, setShowFilters] = useState(false);

  // EV Reassignment Modal States
  const [showEvReassignModal, setShowEvReassignModal] = useState(false);
  const [evReassignData, setEvReassignData] = useState({
    assignment_id: null,
    cluster_id: null,
    new_cluster_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const fetchAssignmentDetails = async (assignmentId, isTemp = false) => {
    setLoadingDetails(true);
    setShowDetailsModal(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/assignments/${assignmentId}?is_temp=${isTemp}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAssignmentDetails(data);
      } else {
        console.error("Failed to fetch assignment details");
      }
    } catch (err) {
      console.error("Error fetching assignment details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

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

  const fetchClusters = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clusters`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setClusters(await res.json());
      }
    } catch (err) {
      console.error("Error fetching clusters:", err);
    }
  };

  const handleEvReassign = async () => {
    if (
      !evReassignData.new_cluster_id ||
      !evReassignData.start_date ||
      !evReassignData.end_date ||
      !evReassignData.reason
    ) {
      showError("Please fill all required fields");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/ev-assignments/reassign`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignment_id: evReassignData.assignment_id,
          new_cluster_id: parseInt(evReassignData.new_cluster_id),
          start_date: evReassignData.start_date,
          end_date: evReassignData.end_date,
          reason: evReassignData.reason,
        }),
      });

      if (res.ok) {
        showSuccess("EV assignment reassigned successfully");
        setShowEvReassignModal(false);
        setEvReassignData({
          assignment_id: null,
          cluster_id: null,
          new_cluster_id: "",
          start_date: "",
          end_date: "",
          reason: "",
        });
        fetchAssignments();
      } else {
        const data = await res.json();
        showError(data.error || "Failed to reassign EV assignment");
      }
    } catch (err) {
      console.error("Error reassigning EV assignment:", err);
      showError("Failed to reassign EV assignment");
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bus, car, ev, other, s, v, d, c, vg] = await Promise.all([
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=BUS`,
        ).then((r) => r.json()),
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=CAR`,
        ).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/ev-assignments`).then((r) => r.json()),
        fetch(
          `${API_BASE}/api/admin/assignments/by-category?category=OTHER`,
        ).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicles`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/drivers`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/clusters`).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/vehicle-groups`).then((r) => r.json()),
      ]);

      setBusAssignments(bus || []);
      setCarAssignments(car || []);
      setEvAssignments(ev || []);
      setOtherAssignments(other || []);
      setShifts(s || []);
      setVehicles(v || []);
      setDrivers(d || []);
      setClusters(c || []);
      setVehicleGroups(vg || []);
    } catch (err) {
      console.error("Error fetching assignments data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter and Sort Logic
  const getFilteredAndSortedAssignments = (assignments) => {
    let filtered = [...assignments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const vehicleName = (
          a.vehicle_name ||
          a.vehicle_number ||
          a.vehicle_group_name ||
          ""
        ).toLowerCase();
        const driverName = (a.driver_name || "").toLowerCase();
        const shiftName = (a.shift_name || "").toLowerCase();
        const clusterName = (a.cluster_name || "").toLowerCase();
        return (
          vehicleName.includes(query) ||
          driverName.includes(query) ||
          shiftName.includes(query) ||
          clusterName.includes(query)
        );
      });
    }

    // Shift filter
    if (filterShift) {
      filtered = filtered.filter((a) => a.shift_id === parseInt(filterShift));
    }

    // Status filter (for non-EV assignments)
    if (filterStatus && activeTab !== "ev") {
      filtered = filtered.filter((a) => a.driver_status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      let compareA, compareB;

      switch (sortBy) {
        case "vehicle":
          compareA = (
            a.vehicle_name ||
            a.vehicle_number ||
            a.vehicle_group_name ||
            ""
          ).toLowerCase();
          compareB = (
            b.vehicle_name ||
            b.vehicle_number ||
            b.vehicle_group_name ||
            ""
          ).toLowerCase();
          break;
        case "driver":
          compareA = (a.driver_name || "").toLowerCase();
          compareB = (b.driver_name || "").toLowerCase();
          break;
        case "date":
          compareA = new Date(a.start_date);
          compareB = new Date(b.start_date);
          break;
        default:
          return 0;
      }

      if (compareA < compareB) return sortOrder === "asc" ? -1 : 1;
      if (compareA > compareB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const getCurrentAssignments = () => {
    const rawAssignments =
      activeTab === "bus"
        ? busAssignments
        : activeTab === "car"
          ? carAssignments
          : activeTab === "other"
            ? otherAssignments
            : evAssignments;
    return getFilteredAndSortedAssignments(rawAssignments);
  };

  // Fetch available drivers when opening modal
  const fetchAvailableDrivers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
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
      vehicle_group_id: 0,
      driver_id: 0,
      cluster_id: 0,
      shift_id: 0,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      description: "",
    });
    fetchAvailableDrivers();
    setShowCreateModal(true);
  };

  const handleCreate = async (forceAssign = false) => {
    // Validate based on assignment type
    let isValid =
      createModalType === "ev"
        ? assignmentForm.vehicle_group_id &&
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
      vehicle_category: createModalType.toUpperCase(),
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
        const data = await res.json();
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

  // Check driver availability when shift or date changes in create modal
  useEffect(() => {
    if (
      showCreateModal &&
      assignmentForm.shift_id &&
      assignmentForm.start_date &&
      availableDrivers.length > 0
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
      label: "Other Vehicles",
      value: otherAssignments.length,
      icon: Truck,
      color: "bg-orange-100 text-orange-600",
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
            onClick={() => setActiveTab("other")}
            className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeTab === "other"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <Truck size={16} /> Other
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
          {activeTab === "other" && (
            <button
              onClick={() => openCreateModal("other")}
              className="px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Assign Other Vehicle
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

      {/* Search, Sort, and Filter Bar */}
      {activeTab !== "temporary" && (
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            {/* Search */}
            <CustomSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by vehicle, driver, shift, or group..."
              className="flex-1"
            />

            {/* Sort By */}
            <div className="lg:w-48">
              <CustomDropdown
                value={sortBy}
                onChange={setSortBy}
                options={[
                  {value: "vehicle", label: "Sort by Vehicle"},
                  {value: "driver", label: "Sort by Driver"},
                  {value: "date", label: "Sort by Date"},
                ]}
                width="w-full"
              />
            </div>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="w-full lg:w-auto h-[42px] px-4 border border-gray-200 rounded-md bg-primarybg hover:bg-gray-50 transition-all flex items-center justify-center"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              <span className="text-lg">{sortOrder === "asc" ? "↑" : "↓"}</span>
            </button>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full lg:w-auto h-[42px] px-6 rounded-md font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                showFilters || filterShift || filterStatus
                  ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                  : "border border-gray-200 bg-primarybg text-primarytext hover:border-primary hover:text-primary"
              }`}
            >
              <Filter size={16} /> Filters
              {(filterShift || filterStatus) && (
                <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {(filterShift ? 1 : 0) + (filterStatus ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shift Filter */}
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    Filter by Shift
                  </label>
                  <CustomDropdown
                    value={filterShift}
                    onChange={setFilterShift}
                    options={[
                      {value: "", label: "All Shifts"},
                      ...shifts.map((s) => ({
                        value: String(s.id),
                        label: s.name,
                      })),
                    ]}
                    width="w-full"
                  />
                </div>

                {/* Status Filter (only for non-EV) */}
                {activeTab !== "ev" && (
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                      Filter by Driver Status
                    </label>
                    <CustomDropdown
                      value={filterStatus}
                      onChange={setFilterStatus}
                      options={[
                        {value: "", label: "All Status"},
                        {value: "present", label: "Present"},
                        {value: "absent", label: "Absent"},
                      ]}
                      width="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Clear Filters */}
              {(filterShift || filterStatus) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setFilterShift("");
                      setFilterStatus("");
                    }}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors text-sm font-semibold"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            {getCurrentAssignments().length > 0 ? (
              getCurrentAssignments().map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-gray-100 bg-primarybg p-4 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-[0.99]"
                  onClick={() => {
                    if (activeTab === "ev") {
                      fetchEvDetails(a.id);
                    } else {
                      fetchAssignmentDetails(a.id, a.is_temporary_replacement);
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
                              : activeTab === "other"
                                ? "bg-orange-500"
                                : "bg-pending"
                        }`}
                      >
                        {activeTab === "bus" ? (
                          <Bus size={20} />
                        ) : activeTab === "car" ? (
                          <Car size={20} />
                        ) : activeTab === "other" ? (
                          <Truck size={20} />
                        ) : (
                          <Zap size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-primarytext">
                          {activeTab === "ev"
                            ? a.vehicle_group_name || "EV Assignment"
                            : a.vehicle_name || a.vehicle_number}
                        </p>
                        <p className="text-xs text-secondarytext">
                          {activeTab === "ev" ? (
                            <span className="flex items-center gap-1">
                              {a.cluster_name}{" "}
                              <span className="opacity-50">•</span>{" "}
                              {a.shift_name || "Any Shift"}
                            </span>
                          ) : (
                            a.vehicle_number
                          )}
                        </p>
                        <p className="text-sm text-secondarytext">
                          {a.start_date === a.end_date
                            ? a.start_date
                            : `${a.start_date} to ${a.end_date}`}{" "}
                          {activeTab !== "ev" &&
                            a.cluster_name &&
                            `(${a.cluster_name})`}
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
                            {formatTimeAMPM(a.start_time || a.shift_start_time)}{" "}
                            - {formatTimeAMPM(a.end_time || a.shift_end_time)}
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

                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activeTab !== "ev" ? (
                        <>
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
                        </>
                      ) : (
                        <button
                          onClick={() => handleDelete(a.id, true)}
                          className="px-3 py-2 bg-red/10 text-red rounded-md hover:bg-red/20 transition-colors text-sm font-medium flex items-center gap-1.5"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-secondarytext">
                <p>
                  {searchQuery || filterShift || filterStatus
                    ? `No assignments match your search or filter criteria`
                    : `No assignments found for ${activeTab}`}
                </p>
                {(searchQuery || filterShift || filterStatus) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterShift("");
                      setFilterStatus("");
                    }}
                    className="mt-3 px-4 py-2 text-primary hover:bg-primary/10 rounded-md transition-colors text-sm font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
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
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1">
                    End Date
                  </label>
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

              {/* Shift Selection - For Bus, Car, and Other types */}
              {createModalType !== "ev" && (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
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

                  {/* Shift Details Display */}
                  {assignmentForm.shift_id > 0 &&
                    (() => {
                      const selectedShift = shifts.find(
                        (s) => s.id === assignmentForm.shift_id,
                      );
                      if (!selectedShift) return null;

                      const hasSlots =
                        selectedShift.slots && selectedShift.slots.length > 0;

                      return (
                        <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-md">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-sm font-bold text-primarytext">
                                {selectedShift.name}
                              </h4>
                              {selectedShift.description && (
                                <p className="text-xs text-secondarytext mt-0.5">
                                  {selectedShift.description}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-primary bg-white px-2 py-1 rounded-md">
                              {hasSlots
                                ? `${selectedShift.slots.length} Slots`
                                : "Single Shift"}
                            </span>
                          </div>

                          {hasSlots ? (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Time Slots
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {selectedShift.slots.map((slot, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-primary/10"
                                  >
                                    <Clock
                                      size={14}
                                      className="text-primary shrink-0"
                                    />
                                    <span className="text-sm font-medium text-primarytext">
                                      {formatTimeAMPM(slot.start_time)} -{" "}
                                      {formatTimeAMPM(slot.end_time)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-primary/10">
                              <Clock
                                size={14}
                                className="text-primary shrink-0"
                              />
                              <span className="text-sm font-medium text-primarytext">
                                {formatTimeAMPM(selectedShift.start_time)} -{" "}
                                {formatTimeAMPM(selectedShift.end_time)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              )}

              {createModalType === "ev" ? (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Vehicle Group
                  </label>
                  <SearchableSelect
                    value={assignmentForm.vehicle_group_id}
                    onChange={(val) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        vehicle_group_id: parseInt(val) || 0,
                      })
                    }
                    placeholder="Select Vehicle Group"
                    options={vehicleGroups.map((vg) => ({
                      value: vg.id,
                      label: vg.name,
                      subtitle: `${vg.vehicle_count || 0} EV vehicles`,
                    }))}
                    emptyMessage="No vehicle groups available"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
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
              )}
              {createModalType === "ev" ? (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
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
                    options={clusters.map((c) => ({
                      value: c.id,
                      label: c.name,
                      subtitle: `${c.driver_count || 0} drivers`,
                    }))}
                    emptyMessage="No driver groups available"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
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

              {/* Description Field */}
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="Enter assignment description (optional)"
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  value={assignmentForm.description || ""}
                  onChange={(e) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <button
                onClick={() => handleCreate()}
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
            className="bg-white rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingEvDetails ? (
              <div className="p-16 text-center">
                <div className="animate-spin inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-md mb-4"></div>
                <p className="text-secondarytext">
                  Loading assignment details...
                </p>
              </div>
            ) : evDetails ? (
              <>
                {/* Clean Header */}
                <div className="p-6 border-b border-gray-200 bg-white rounded-t-xl">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-md bg-green-600 flex items-center justify-center shadow-md">
                        <Zap size={24} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                          {evDetails.vehicle_group_name ||
                            "EV Group Assignment"}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                          <span className="font-medium text-primary">
                            {evDetails.cluster_name}
                          </span>
                          <span>•</span>
                          <span>{evDetails.shift_name || "Shift"}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowEvDetailsModal(false);
                        setEvDetails(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Shift Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Clock size={14} /> Shift Details
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Shift Name
                        </span>
                        <span className="font-semibold text-primarytext">
                          {evDetails.shift_name || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Start Time
                        </span>
                        <span className="font-semibold text-primarytext">
                          {formatTimeAMPM(evDetails.shift_start_time)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          End Time
                        </span>
                        <span className="font-semibold text-primarytext">
                          {formatTimeAMPM(evDetails.shift_end_time)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Period */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Calendar size={14} /> Assignment Period
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Start Date</span>
                        <span className="font-medium text-primarytext">
                          {evDetails.start_date}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">End Date</span>
                        <span className="font-medium text-primarytext">
                          {evDetails.end_date}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Created At</span>
                        <span className="font-medium text-primarytext">
                          {evDetails.created_at || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Status</span>
                        <span className="font-medium px-2 py-0.5 rounded-md text-xs bg-green/20 text-green">
                          assigned
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cluster Information */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Users size={14} /> Cluster Information
                    </h4>
                    <div className="space-y-2">
                      {evDetails.vehicle_group_name && (
                        <div className="flex justify-between">
                          <span className="text-secondarytext">
                            Vehicle Group
                          </span>
                          <span className="font-medium text-primarytext">
                            {evDetails.vehicle_group_name}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Cluster Name</span>
                        <span className="font-medium text-primarytext">
                          {evDetails.cluster_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">
                          Total Drivers
                        </span>
                        <span className="font-medium text-primarytext">
                          {evDetails.drivers?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <TrendingUp size={14} /> Assignment Statistics
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Total Days</span>
                        <span className="font-medium text-primarytext">
                          {evDetails.days_total || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">
                          Days Completed
                        </span>
                        <span className="font-medium text-green-600">
                          {evDetails.days_completed || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">
                          Days Remaining
                        </span>
                        <span className="font-medium text-amber-600">
                          {evDetails.days_remaining || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Total KM</span>
                        <span className="font-medium text-primary">
                          {evDetails.total_km?.toFixed(1) || "0.0"} km
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Vehicles Section */}
                {evDetails.vehicles && evDetails.vehicles.length > 0 && (
                  <div className="px-6 pb-4">
                    <div className="bg-primarybg rounded-md p-4">
                      <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                        <Zap size={14} /> Assigned Vehicles (
                        {evDetails.vehicles.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {evDetails.vehicles.map((v) => (
                          <div
                            key={v.id}
                            className="bg-green-50 p-3 rounded-md flex items-center gap-2.5"
                          >
                            <div className="w-10 h-10 bg-green-600 rounded-md flex items-center justify-center text-white shrink-0">
                              <Zap size={16} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-primarytext truncate">
                                {v.vehicle_number}
                              </p>
                              {v.vehicle_type && (
                                <p className="text-xs text-secondarytext truncate">
                                  {v.vehicle_type}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cluster Drivers Section */}
                <div className="px-6 pb-4">
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Users size={14} /> Cluster Drivers (
                      {evDetails.drivers?.length || 0})
                    </h4>
                    {evDetails.drivers && evDetails.drivers.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {evDetails.drivers.map((driver) => (
                          <div
                            key={driver.driver_id}
                            className="flex items-center justify-between p-3 bg-white rounded-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-md bg-primary text-white flex items-center justify-center text-base font-bold">
                                {driver.initials ||
                                  driver.driver_name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-primarytext">
                                  {driver.driver_name}
                                </p>
                                {driver.on_leave ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
                                    <CheckCircle size={10} />
                                    On Leave
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-medium">
                                    <CheckCircle size={10} />
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-primary">
                                {driver.total_km?.toFixed(1) || "0.0"}
                              </p>
                              <p className="text-xs text-secondarytext">km</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-secondarytext">
                        <Users size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No drivers in this cluster</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowEvDetailsModal(false);
                      setEvDetails(null);
                    }}
                    className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="p-16 text-center">
                <AlertTriangle
                  size={48}
                  className="mx-auto mb-4 text-red-500"
                />
                <p className="text-red-600 font-medium">
                  Failed to load assignment details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EV Reassignment Modal */}
      {showEvReassignModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEvReassignModal(false)}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-white rounded-t-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center shadow-md">
                    <RefreshCw size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Reassign EV Cluster
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Change cluster assignment during specific period
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEvReassignModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* New Cluster Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Cluster <span className="text-red-500">*</span>
                </label>
                <select
                  value={evReassignData.new_cluster_id}
                  onChange={(e) =>
                    setEvReassignData({
                      ...evReassignData,
                      new_cluster_id: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                >
                  <option value="">Select a cluster</option>
                  {clusters
                    .filter((c) => c.id !== evReassignData.cluster_id)
                    .map((cluster) => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.name} ({cluster.driver_count || 0} drivers)
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={evReassignData.start_date}
                    onChange={(e) =>
                      setEvReassignData({
                        ...evReassignData,
                        start_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={evReassignData.end_date}
                    onChange={(e) =>
                      setEvReassignData({
                        ...evReassignData,
                        end_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={evReassignData.reason}
                  onChange={(e) =>
                    setEvReassignData({
                      ...evReassignData,
                      reason: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Enter reason for reassignment..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3">
                <AlertTriangle
                  size={20}
                  className="text-blue-600 shrink-0 mt-0.5"
                />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important Note:</p>
                  <p>
                    This will create a temporary cluster reassignment for the
                    specified period. The original assignment will remain for
                    periods outside this date range.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowEvReassignModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-md transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEvReassign}
                className="px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <RefreshCw size={16} />
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Details Modal */}
      {showDetailsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => {
            setShowDetailsModal(false);
            setAssignmentDetails(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetails ? (
              <div className="p-12 text-center text-secondarytext">
                Loading assignment details...
              </div>
            ) : assignmentDetails?.assignment ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-md flex items-center justify-center text-white ${
                        assignmentDetails.assignment.vehicle_type === "BUS"
                          ? "bg-primary"
                          : "bg-green"
                      }`}
                    >
                      {assignmentDetails.assignment.vehicle_type === "BUS" ? (
                        <Bus size={28} />
                      ) : (
                        <Car size={28} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primarytext">
                        {assignmentDetails.assignment.vehicle_name ||
                          assignmentDetails.assignment.vehicle_number}
                      </h3>
                      <p className="text-sm text-secondarytext">
                        {assignmentDetails.assignment.vehicle_number} •{" "}
                        {assignmentDetails.assignment.vehicle_type}
                        {assignmentDetails.is_temporary && (
                          <span className="ml-2 px-2 py-0.5 bg-pending/20 text-pending text-xs rounded-md font-medium">
                            Temporary
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setAssignmentDetails(null);
                    }}
                    className="text-secondarytext hover:text-primarytext transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Shift Info */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Clock size={14} /> Shift Details
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Shift Name
                        </span>
                        <span className="font-semibold text-primarytext">
                          {assignmentDetails.assignment.shift_name}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-3">
                        <span className="text-sm text-secondarytext block mb-3">
                          Time Slots
                        </span>
                        <div className="space-y-2">
                          {assignmentDetails.slots &&
                          assignmentDetails.slots.length > 0 ? (
                            assignmentDetails.slots.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 hover:border-primary/40 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
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
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200">
                              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Clock size={14} className="text-primary" />
                              </div>
                              <span className="font-medium text-gray-900 text-sm">
                                {formatTimeAMPM(
                                  assignmentDetails.assignment.start_time,
                                )}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-900 text-sm">
                                {formatTimeAMPM(
                                  assignmentDetails.assignment.end_time,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date Info */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Calendar size={14} /> Assignment Period
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Start Date</span>
                        <span className="font-medium text-primarytext">
                          {assignmentDetails.assignment.start_date}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">End Date</span>
                        <span className="font-medium text-primarytext">
                          {assignmentDetails.assignment.end_date}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Status</span>
                        <span
                          className={`font-medium px-2 py-0.5 rounded-md text-xs ${
                            assignmentDetails.assignment.status === "active" ||
                            assignmentDetails.assignment.status === "assigned"
                              ? "bg-green/20 text-green"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {assignmentDetails.assignment.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {assignmentDetails.assignment.description && (
                    <div className="bg-primarybg rounded-md p-4">
                      <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                        <FileText size={14} /> Description
                      </h4>
                      <p className="text-primarytext">
                        {assignmentDetails.assignment.description}
                      </p>
                    </div>
                  )}

                  {/* Driver Info */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <User size={14} /> Driver Information
                    </h4>
                    <div className="space-y-2">
                      {assignmentDetails.is_temporary ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-secondarytext">
                              Original Driver
                            </span>
                            <span className="font-medium text-primarytext">
                              {
                                assignmentDetails.assignment
                                  .original_driver_name
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondarytext">
                              Replacement Driver
                            </span>
                            <span className="font-medium text-primary">
                              {
                                assignmentDetails.assignment
                                  .replacement_driver_name
                              }
                            </span>
                          </div>
                          {assignmentDetails.assignment.reason && (
                            <div className="flex justify-between">
                              <span className="text-secondarytext">Reason</span>
                              <span className="font-medium text-primarytext">
                                {assignmentDetails.assignment.reason}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-secondarytext">
                            Assigned Driver
                          </span>
                          <span className="font-medium text-primarytext">
                            {assignmentDetails.assignment.driver_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Audit Info */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <TrendingUp size={14} /> Created Info
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondarytext">Created By</span>
                        <span className="font-medium text-primarytext">
                          {assignmentDetails.assignment.created_by_name ||
                            "System"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setAssignmentDetails(null);
                    }}
                    className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setReassignModal(assignmentDetails.assignment);
                      setReassignDriverId(
                        assignmentDetails.assignment.driver_id,
                      );
                      fetchAvailableDrivers();
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} /> Reassign Driver
                  </button>
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
