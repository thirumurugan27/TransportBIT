import React, {useState, useEffect, useRef} from "react";
import TemporaryAssignments from "./TemporaryAssignments";
import VehicleReplacements from "./VehicleReplacements";
import Loading from "../../../components/ui/Loading";
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
  Users,
  TrendingUp,
  Search,
  Filter,
  Truck,
  FileText,
  Check,
  ChevronDown,
} from "lucide-react";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";
import {useToast} from "../../../context/ToastContext";
import {showConfirm, showError, showSuccess} from "../../../utils/swal";
import SearchableSelect from "../../../components/ui/SearchableSelect";

import {apiGet, apiPost, apiDelete} from "../../../utils/api";

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
  // If already contains AM/PM, return as-is (backend pre-formatted)
  if (/[AP]M/i.test(time24)) return time24.trim();
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

// Convert "HH:MM" to minutes since midnight for comparison
const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Check if two time ranges overlap
const timesOverlap = (s1, e1, s2, e2) => {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);
  return start1 < end2 && start2 < end1;
};

// Detect time conflicts between selected shifts
// Returns array of [shiftName1, shiftName2] pairs that conflict
const detectInterShiftConflicts = (selectedShifts) => {
  const conflictPairs = [];
  for (let i = 0; i < selectedShifts.length; i++) {
    for (let j = i + 1; j < selectedShifts.length; j++) {
      if (
        timesOverlap(
          selectedShifts[i].start_time,
          selectedShifts[i].end_time,
          selectedShifts[j].start_time,
          selectedShifts[j].end_time,
        )
      ) {
        conflictPairs.push([selectedShifts[i].name, selectedShifts[j].name]);
      }
    }
  }
  return conflictPairs;
};

const getAssignmentStatusClasses = (status) => {
  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus === "active" || normalizedStatus === "assigned") {
    return "bg-green text-white";
  }

  if (normalizedStatus === "cancelled") {
    return "bg-red text-white";
  }

  if (normalizedStatus === "completed") {
    return "bg-green text-white";
  }

  return "bg-gray-600 text-white";
};

const canCancelRegularAssignment = (status) => {
  const normalizedStatus = (status || "").toLowerCase();
  return normalizedStatus !== "cancelled" && normalizedStatus !== "completed";
};

// Multi-Shift Select Component with checkboxes
function MultiShiftSelect({shifts, selectedIds, onChange, formatTimeAMPM}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredShifts = shifts.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const timeDisplay = `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`;
    return (
      (s.name || "").toLowerCase().includes(q) ||
      timeDisplay.toLowerCase().includes(q)
    );
  });

  const toggleShift = (shiftId) => {
    if (selectedIds.includes(shiftId)) {
      onChange(selectedIds.filter((id) => id !== shiftId));
    } else {
      onChange([...selectedIds, shiftId]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-md p-2.5 bg-primarybg text-left cursor-pointer"
      >
        <span
          className={`text-sm ${selectedIds.length > 0 ? "text-primarytext" : "text-secondarytext"}`}
        >
          {selectedIds.length > 0
            ? `${selectedIds.length} shift${selectedIds.length > 1 ? "s" : ""} selected`
            : "Click to select shifts..."}
        </span>
        <ChevronDown
          size={16}
          className={`text-secondarytext transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondarytext"
              />
              <input
                type="text"
                placeholder="Search shifts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Select All / Clear */}
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === shifts.length) {
                  onChange([]);
                } else {
                  onChange(shifts.map((s) => s.id));
                }
              }}
              className="text-xs text-primary font-medium cursor-pointer"
            >
              {selectedIds.length === shifts.length
                ? "Clear All"
                : "Select All"}
            </button>
            <span className="text-xs text-secondarytext">
              {selectedIds.length}/{shifts.length}
            </span>
          </div>

          {/* Options */}
          <div className="overflow-y-auto max-h-52">
            {filteredShifts.length === 0 ? (
              <p className="p-3 text-sm text-secondarytext text-center">
                No shifts found
              </p>
            ) : (
              filteredShifts.map((s) => {
                const isSelected = selectedIds.includes(s.id);
                const timeDisplay = `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`;

                // Check if this shift would conflict with already selected shifts
                const wouldConflict =
                  !isSelected &&
                  selectedIds.length > 0 &&
                  (() => {
                    const selectedShifts = shifts.filter((sh) =>
                      selectedIds.includes(sh.id),
                    );
                    return selectedShifts.some((sel) =>
                      timesOverlap(
                        s.start_time,
                        s.end_time,
                        sel.start_time,
                        sel.end_time,
                      ),
                    );
                  })();

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleShift(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer ${
                      isSelected ? "bg-primary/10" : ""
                    } ${wouldConflict ? "bg-red/5" : ""}`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>

                    {/* Shift Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primarytext truncate">
                          {s.name}
                        </span>
                        {wouldConflict && (
                          <span className="text-[10px] font-medium text-red bg-red/10 px-1.5 py-0.5 rounded">
                            OVERLAP
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-secondarytext">
                        {timeDisplay}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Assignments() {
  const {showToast} = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bus"); // bus, car, ev, other, temporary, replacements
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
  const [defaultMappings, setDefaultMappings] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState(null); // bus, car, ev

  const [assignmentForm, setAssignmentForm] = useState({
    vehicle_id: 0,
    vehicle_group_id: 0,
    driver_id: 0,
    cluster_id: 0,
    shift_ids: [],
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

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterShift, setFilterShift] = useState(""); // empty means all
  const [filterStatus, setFilterStatus] = useState(""); // empty means all
  const [showFilters, setShowFilters] = useState(false);
  const todayDate = new Date().toISOString().split("T")[0];
  const [filterRange, setFilterRange] = useState("today"); // today, week, month, all, custom
  const [filterStartDate, setFilterStartDate] = useState(todayDate);
  const [filterEndDate, setFilterEndDate] = useState(todayDate);

  // Lifted search state for Temporary and Replacements tabs
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [replSearchQuery, setReplSearchQuery] = useState("");
  const [replStatusFilter, setReplStatusFilter] = useState("all");
  const [replOpenCreateModal, setReplOpenCreateModal] = useState(false);

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

  const defaultDriverByVehicleId = defaultMappings.reduce((acc, mapping) => {
    if (mapping?.vehicle_id && mapping?.driver_name) {
      acc[String(mapping.vehicle_id)] = mapping.driver_name;
    }
    return acc;
  }, {});

  const defaultVehicleByDriverId = defaultMappings.reduce((acc, mapping) => {
    if (mapping?.driver_id) {
      const vehicleLabel =
        mapping?.vehicle_name || mapping?.vehicle_number || null;
      if (vehicleLabel) {
        acc[String(mapping.driver_id)] = vehicleLabel;
      }
    }
    return acc;
  }, {});

  const fetchAssignmentDetails = async (assignmentId, isTemp = false) => {
    setLoadingDetails(true);
    setShowDetailsModal(true);
    try {
      const res = await apiGet(
        `/api/admin/assignments/${assignmentId}?is_temp=${isTemp}`,
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
      const res = await apiGet(
        `/api/admin/ev-assignments/${assignmentId}/details`,
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
      const res = await apiGet("/api/admin/clusters");
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
      const res = await apiPost("/api/admin/ev-assignments/reassign", {
        assignment_id: evReassignData.assignment_id,
        new_cluster_id: parseInt(evReassignData.new_cluster_id),
        start_date: evReassignData.start_date,
        end_date: evReassignData.end_date,
        reason: evReassignData.reason,
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
      const buildAssignmentUrl = (category) => {
        const params = new URLSearchParams({
          category,
          range: filterRange,
        });

        if (filterRange === "custom") {
          params.set("start_date", filterStartDate);
          params.set("end_date", filterEndDate);
        }

        return `/api/admin/assignments/by-category?${params.toString()}`;
      };

      const evParams = new URLSearchParams({range: filterRange});
      if (filterRange === "custom") {
        evParams.set("start_date", filterStartDate);
        evParams.set("end_date", filterEndDate);
      }

      const [bus, car, ev, other, s, v, d, c, vg, mappings] = await Promise.all(
        [
          apiGet(buildAssignmentUrl("BUS")).then((r) => r.json()),
          apiGet(buildAssignmentUrl("CAR")).then((r) => r.json()),
          apiGet(`/api/admin/ev-assignments?${evParams.toString()}`).then((r) =>
            r.json(),
          ),
          apiGet(buildAssignmentUrl("OTHER")).then((r) => r.json()),
          apiGet("/api/admin/shifts").then((r) => r.json()),
          apiGet("/api/admin/vehicles").then((r) => r.json()),
          apiGet("/api/admin/drivers").then((r) => r.json()),
          apiGet("/api/admin/clusters").then((r) => r.json()),
          apiGet("/api/admin/vehicle-groups").then((r) => r.json()),
          apiGet("/api/admin/default-vehicle-drivers")
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ],
      );

      setBusAssignments(bus || []);
      setCarAssignments(car || []);
      setEvAssignments(ev || []);
      setOtherAssignments(other || []);
      setShifts(s || []);
      setVehicles(v || []);
      setDrivers(d || []);
      setClusters(c || []);
      setVehicleGroups(vg || []);
      setDefaultMappings(mappings || []);
    } catch (err) {
      console.error("Error fetching assignments data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [filterRange, filterStartDate, filterEndDate]);

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
      if (filterStatus === "not_marked") {
        filtered = filtered.filter(
          (a) => a.driver_status !== "present" && a.driver_status !== "absent",
        );
      } else {
        filtered = filtered.filter((a) => a.driver_status === filterStatus);
      }
    }

    // Keep a stable, clean default order by vehicle/group name.
    filtered.sort((a, b) => {
      const compareA = (
        a.vehicle_name ||
        a.vehicle_number ||
        a.vehicle_group_name ||
        ""
      ).toLowerCase();
      const compareB = (
        b.vehicle_name ||
        b.vehicle_number ||
        b.vehicle_group_name ||
        ""
      ).toLowerCase();

      if (compareA < compareB) return -1;
      if (compareA > compareB) return 1;
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
      const res = await apiGet("/api/admin/drivers");
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
      shift_ids: [],
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
          assignmentForm.shift_ids.length > 0 &&
          assignmentForm.start_date &&
          assignmentForm.end_date;

    if (!isValid) {
      showToast("Please fill all required fields", "warning");
      return;
    }

    // Check for time conflicts between selected shifts before submitting
    if (assignmentForm.shift_ids.length > 1 && !forceAssign) {
      const selectedShifts = shifts.filter((s) =>
        assignmentForm.shift_ids.includes(s.id),
      );
      const conflictPairs = detectInterShiftConflicts(selectedShifts);
      if (conflictPairs.length > 0) {
        const names = conflictPairs
          .map((p) => `"${p[0]}" and "${p[1]}"`)
          .join(", ");
        showToast(`Selected shifts have overlapping times: ${names}`, "error");
        return;
      }
    }

    const endpoint =
      createModalType === "ev"
        ? "/api/admin/ev-assignments/create"
        : "/api/admin/assignments/create";

    // For EV with multiple shifts, create one assignment per shift
    if (createModalType === "ev" && assignmentForm.shift_ids.length > 1) {
      let successCount = 0;
      let failCount = 0;

      await Promise.all(
        assignmentForm.shift_ids.map(async (shiftId) => {
          try {
            const shiftPayload = {
              ...assignmentForm,
              shift_ids: [shiftId],
              vehicle_category: "EV",
              force_assign: forceAssign,
              created_by: getCreatorIdFromToken() || undefined,
            };
            const res = await apiPost(
              "/api/admin/ev-assignments/create",
              shiftPayload,
            );
            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        }),
      );

      if (successCount > 0) {
        showToast(
          `${successCount} EV assignment${successCount > 1 ? "s" : ""} created successfully!`,
          "success",
        );
        setShowCreateModal(false);
        setConflictModal(null);
        setConflictPendingForm(null);
        fetchAllData();
      }
      if (failCount > 0) {
        showToast(
          `${failCount} assignment${failCount > 1 ? "s" : ""} failed to create`,
          "error",
        );
      }
      return;
    }

    const payload = {
      ...assignmentForm,
      shift_ids: assignmentForm.shift_ids,
      vehicle_category: createModalType.toUpperCase(),
      force_assign: forceAssign,
      created_by: getCreatorIdFromToken() || undefined,
    };

    try {
      const res = await apiPost(endpoint, payload);

      if (res.ok) {
        const data = await res.json();
        showToast("Assignment created successfully!", "success");
        setShowCreateModal(false);

        setConflictModal(null);
        setConflictPendingForm(null);
        fetchAllData();
      } else if (res.status === 409) {
        // Driver or vehicle conflict detected
        const data = await res.json();
        if (data.error === "time_conflict") {
          setConflictPendingForm({...assignmentForm});
          setConflictModal({
            conflict_type: "driver",
            message:
              data.message || "Driver is already assigned during this time",
            conflicts: data.conflicts || [],
            conflicting_drivers: data.conflicting_drivers || null,
          });
        } else if (data.error === "vehicle_conflict") {
          setConflictPendingForm({...assignmentForm});
          setConflictModal({
            conflict_type: "vehicle",
            message:
              data.message ||
              "Vehicle is already assigned during this time range",
            conflicts: data.conflicts || [],
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
        ? "/api/admin/ev-assignments/create"
        : "/api/admin/assignments/create";

    const payload = {
      ...conflictPendingForm,
      force_assign: true,
      created_by: getCreatorIdFromToken() || undefined,
    };

    try {
      const res = await apiPost(endpoint, payload);

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
    shiftIds,
    startDate,
    endDate,
  ) => {
    if (
      !shiftIds ||
      (Array.isArray(shiftIds) ? shiftIds.length === 0 : !shiftIds) ||
      !startDate
    )
      return;

    const shiftIdsParam = Array.isArray(shiftIds)
      ? shiftIds.join(",")
      : shiftIds;
    const end = endDate || startDate;

    const availabilityPromises = drivers.map(async (driver) => {
      try {
        const response = await apiGet(
          `/api/admin/assignments/check-driver-conflict?driver_id=${driver.driver_id || driver.id}&shift_ids=${shiftIdsParam}&start_date=${startDate}&end_date=${end}`,
        );
        const data = await response.json();
        return {
          driverId: driver.driver_id || driver.id,
          available: !data.conflict,
          conflict_date: data.conflict_date || "",
          conflicts: data.conflicts || [],
        };
      } catch (error) {
        console.error("Error checking driver availability:", error);
        return {
          driverId: driver.driver_id || driver.id,
          available: true,
          conflict_date: "",
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
  const checkVehicleAvailability = async (
    vehicleList,
    shiftIds,
    startDate,
    endDate,
  ) => {
    if (
      !shiftIds ||
      (Array.isArray(shiftIds) ? shiftIds.length === 0 : !shiftIds) ||
      !startDate
    )
      return;

    const shiftIdsParam = Array.isArray(shiftIds)
      ? shiftIds.join(",")
      : shiftIds;
    const end = endDate || startDate;

    const availabilityPromises = vehicleList.map(async (vehicle) => {
      try {
        const response = await apiGet(
          `/api/admin/assignments/check-vehicle-conflict?vehicle_id=${vehicle.id}&shift_ids=${shiftIdsParam}&start_date=${startDate}&end_date=${end}`,
        );
        const data = await response.json();
        return {
          vehicleId: vehicle.id,
          available: !data.conflict,
          conflict_date: data.conflict_date || "",
          conflicts: data.conflicts || [],
        };
      } catch (error) {
        console.error("Error checking vehicle availability:", error);
        return {
          vehicleId: vehicle.id,
          available: true,
          conflict_date: "",
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
        conflictPendingForm.shift_ids || [],
        conflictPendingForm.start_date,
        conflictPendingForm.end_date,
      );
    }
  }, [conflictModal, conflictPendingForm]);

  // Check driver availability when shift or date changes in create modal
  useEffect(() => {
    if (
      showCreateModal &&
      assignmentForm.shift_ids.length > 0 &&
      assignmentForm.start_date &&
      availableDrivers.length > 0
    ) {
      checkDriverAvailability(
        availableDrivers,
        assignmentForm.shift_ids,
        assignmentForm.start_date,
        assignmentForm.end_date,
      );
    }
  }, [
    showCreateModal,
    assignmentForm.shift_ids,
    assignmentForm.start_date,
    assignmentForm.end_date,
    availableDrivers,
  ]);

  // Check vehicle availability when shift or date changes in create modal
  useEffect(() => {
    if (
      showCreateModal &&
      assignmentForm.shift_ids.length > 0 &&
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
        assignmentForm.shift_ids,
        assignmentForm.start_date,
        assignmentForm.end_date,
      );
    }
  }, [
    showCreateModal,
    assignmentForm.shift_ids,
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
      const res = await apiDelete(`${endpoint}?id=${id}`);
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

  const handleCancelAssignment = async (id) => {
    const isConfirmed = await showConfirm(
      "Cancel assignment?",
      "This assignment will be marked as cancelled and the driver will no longer be scheduled for this work.",
    );
    if (!isConfirmed) return;

    try {
      const res = await apiPost("/api/admin/assignments/cancel", {id});
      if (res.ok) {
        showToast("Assignment cancelled successfully", "success");
        fetchAllData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || "Failed to cancel assignment", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to cancel assignment", "error");
    }
  };

  const handleReassign = async () => {
    if (!reassignModal || !reassignDriverId) return;
    try {
      const res = await apiPost("/api/admin/assignments/update", {
        assignment_id: reassignModal.id,
        driver_id: reassignDriverId,
        status: "assigned",
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

  const openAssignmentDetailsFromRow = (assignment) => {
    if (activeTab === "ev") {
      fetchEvDetails(assignment.id);
      return;
    }

    fetchAssignmentDetails(assignment.id, assignment.is_temporary_replacement);
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm p-4 flex flex-col xl:flex-row xl:justify-between gap-4 items-stretch xl:items-center">
        <div className="flex flex-wrap items-center bg-primarybg rounded-md p-1 border border-gray-200 gap-1">
          <button
            onClick={() => setActiveTab("bus")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "bus"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <Bus size={16} /> Bus
          </button>
          <button
            onClick={() => setActiveTab("car")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "car"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <Car size={16} /> Car
          </button>
          <button
            onClick={() => setActiveTab("ev")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "ev"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <Zap size={16} /> EV
          </button>
          <button
            onClick={() => setActiveTab("other")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "other"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <Truck size={16} /> Other
          </button>
          <button
            onClick={() => setActiveTab("temporary")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "temporary"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <Clock size={16} /> Temporary
          </button>
          <button
            onClick={() => setActiveTab("replacements")}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "replacements"
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext"
            }`}
          >
            <RefreshCw size={16} /> Replacements
          </button>
        </div>
        <div className="w-full xl:w-auto">
          {activeTab === "bus" && (
            <button
              onClick={() => openCreateModal("bus")}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Assign Driver to Bus
            </button>
          )}
          {activeTab === "car" && (
            <button
              onClick={() => openCreateModal("car")}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Assign Driver to Car
            </button>
          )}
          {activeTab === "ev" && (
            <button
              onClick={() => openCreateModal("ev")}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> New EV Assignment
            </button>
          )}
          {activeTab === "other" && (
            <button
              onClick={() => openCreateModal("other")}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Create Temporary Assignment
            </button>
          )}
          {activeTab === "replacements" && (
            <button
              onClick={() => {
                setReplOpenCreateModal(true);
                setTimeout(() => setReplOpenCreateModal(false), 100);
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-md font-medium shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> New Replacement
            </button>
          )}
        </div>
      </div>

      {/* Search, Sort, and Filter Bar */}
      {activeTab === "temporary" && (
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <CustomSearch
              value={tempSearchQuery}
              onChange={setTempSearchQuery}
              placeholder="Search by vehicle, driver, shift..."
              className="flex-1"
            />
          </div>
        </div>
      )}
      {activeTab === "replacements" && (
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <CustomSearch
              value={replSearchQuery}
              onChange={setReplSearchQuery}
              placeholder="Search by vehicle, driver, reason..."
              className="flex-1"
            />
            <div className="lg:w-48">
              <CustomDropdown
                value={replStatusFilter}
                onChange={setReplStatusFilter}
                options={[
                  {value: "all", label: "All Status"},
                  {value: "pending", label: "Pending"},
                  {value: "approved", label: "Active"},
                  {value: "completed", label: "Completed"},
                  {value: "rejected", label: "Rejected"},
                ]}
                width="w-full"
              />
            </div>
          </div>
        </div>
      )}
      {activeTab !== "temporary" && activeTab !== "replacements" && (
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            {/* Search */}
            <CustomSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by vehicle, driver, shift, or group..."
              className="flex-1"
            />

            {/* Time Range */}
            <div className="lg:w-48">
              <CustomDropdown
                value={filterRange}
                onChange={setFilterRange}
                options={[
                  {value: "today", label: "Today"},
                  {value: "week", label: "This Week"},
                  {value: "month", label: "This Month"},
                  {value: "all", label: "All Time"},
                  {value: "custom", label: "Custom Range"},
                ]}
                width="w-full"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full lg:w-auto h-10.5 px-6 rounded-md font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                showFilters ||
                filterShift ||
                filterStatus ||
                filterRange !== "today"
                  ? "bg-primary text-white shadow-sm"
                  : "border border-gray-200 bg-primarybg text-primarytext"
              }`}
            >
              <Filter size={16} /> Filters
              {(filterShift || filterStatus || filterRange !== "today") && (
                <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {(filterShift ? 1 : 0) +
                    (filterStatus ? 1 : 0) +
                    (filterRange !== "today" ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Custom Date Range */}
                {filterRange === "custom" && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg text-primarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={filterEndDate}
                        min={filterStartDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg text-primarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                  </>
                )}

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
                        {value: "not_marked", label: "Not Marked"},
                      ]}
                      width="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Clear Filters */}
              {(filterShift || filterStatus || filterRange !== "today") && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setFilterShift("");
                      setFilterStatus("");
                      setFilterRange("today");
                      setFilterStartDate(todayDate);
                      setFilterEndDate(todayDate);
                    }}
                    className="px-4 py-2 text-red-600 rounded-md text-sm font-semibold cursor-pointer"
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
      {activeTab === "replacements" ? (
        <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-100">
          <VehicleReplacements
            searchQuery={replSearchQuery}
            statusFilter={replStatusFilter}
            openCreateModal={replOpenCreateModal}
          />
        </div>
      ) : (
        <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-100">
          {activeTab === "temporary" ? (
            <TemporaryAssignments
              openModal={openTempModal}
              searchQuery={tempSearchQuery}
            />
          ) : loading ? (
            <Loading fullScreen={false} text="Loading assignments..." />
          ) : (
            <div className="overflow-x-auto">
              {getCurrentAssignments().length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-primarybg border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider w-10">
                        S.No
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        {activeTab === "ev" ? "Vehicle Group" : "Vehicle"}
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        {activeTab === "ev" ? "Driver Group" : "Driver"}
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Shift
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Date Range
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getCurrentAssignments().map((a, idx) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => openAssignmentDetailsFromRow(a)}
                      >
                        {/* # */}
                        <td className="px-4 py-3.5 text-sm text-secondarytext font-medium">
                          {idx + 1}
                        </td>

                        {/* Vehicle Info */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-sm font-semibold text-primarytext leading-tight">
                              {a.vehicle_name ||
                                a.vehicle_number ||
                                a.vehicle_group_name ||
                                "—"}
                            </p>
                            {a.vehicle_name && a.vehicle_number && (
                              <p className="text-xs text-secondarytext">
                                {a.vehicle_number}
                              </p>
                            )}
                            {a.vehicle_status === "under_maintenance" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-pending/10 text-pending mt-0.5">
                                <AlertTriangle size={9} /> In Service
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Driver / Association */}
                        <td className="px-4 py-3.5">
                          <div>
                            <span className="text-sm font-medium text-primarytext block">
                              {a.driver_name || a.cluster_name || "—"}
                            </span>
                            {a.drivers && a.drivers.length > 0 && (
                              <span className="text-xs text-secondarytext">
                                {a.driver_count || a.drivers.length} drivers
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Shift */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-sm font-medium text-primarytext">
                              {a.shift_name || "—"}
                            </p>
                            {(a.start_time ||
                              a.shift_start_time ||
                              a.end_time ||
                              a.shift_end_time) && (
                              <p className="text-xs text-secondarytext">
                                {formatTimeAMPM(
                                  a.start_time || a.shift_start_time,
                                )}{" "}
                                –{" "}
                                {formatTimeAMPM(a.end_time || a.shift_end_time)}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Date Range */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-sm text-primarytext">
                            <Calendar
                              size={13}
                              className="text-secondarytext shrink-0"
                            />
                            <span>
                              {a.start_date === a.end_date
                                ? a.start_date
                                : `${a.start_date} – ${a.end_date}`}
                            </span>
                          </div>
                          {a.cluster_name && !a.drivers && (
                            <p className="text-xs text-secondarytext mt-0.5">
                              {a.cluster_name}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {(a.status || "").toLowerCase() === "cancelled" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red/10 text-red text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red" />{" "}
                              Cancelled
                            </span>
                          ) : a.driver_status === "present" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green/10 text-green text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-green" />{" "}
                              Present
                            </span>
                          ) : a.driver_status === "absent" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red/10 text-red text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red" />{" "}
                              Absent
                            </span>
                          ) : a.driver_status === "scheduled" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{" "}
                              Scheduled
                            </span>
                          ) : a.driver_status === "on_leave" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-600 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{" "}
                              On Leave
                            </span>
                          ) : a.driver_status ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-secondarytext text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{" "}
                              Not Marked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-secondarytext text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />{" "}
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-16 text-secondarytext">
                  <div className="mb-3">
                    {activeTab === "bus" ? (
                      <Bus size={32} className="mx-auto text-gray-300" />
                    ) : activeTab === "car" ? (
                      <Car size={32} className="mx-auto text-gray-300" />
                    ) : activeTab === "other" ? (
                      <Truck size={32} className="mx-auto text-gray-300" />
                    ) : (
                      <Zap size={32} className="mx-auto text-gray-300" />
                    )}
                  </div>
                  <p className="font-medium text-sm mb-1">
                    {searchQuery ||
                    filterShift ||
                    filterStatus ||
                    filterRange !== "today"
                      ? "No assignments match your filters"
                      : `No ${activeTab} assignments found`}
                  </p>
                  {(searchQuery ||
                    filterShift ||
                    filterStatus ||
                    filterRange !== "today") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterShift("");
                        setFilterStatus("");
                        setFilterRange("today");
                        setFilterStartDate(todayDate);
                        setFilterEndDate(todayDate);
                      }}
                      className="mt-2 px-4 py-2 text-primary rounded-md text-sm font-medium cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h3 className="text-lg font-bold text-primarytext">
                Create {createModalType.toUpperCase()} Assignment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondarytext cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Shift Selection - Multi-select for all assignment types */}
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Shifts{" "}
                  {assignmentForm.shift_ids.length > 0 && (
                    <span className="text-primary font-normal normal-case">
                      ({assignmentForm.shift_ids.length} selected)
                    </span>
                  )}
                </label>

                {/* Selected Shifts as Chips */}
                {assignmentForm.shift_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {assignmentForm.shift_ids.map((sid) => {
                      const s = shifts.find((sh) => sh.id === sid);
                      if (!s) return null;
                      const timeDisplay =
                        s.slots && s.slots.length > 0
                          ? s.slots
                              .map(
                                (slot) =>
                                  `${formatTimeAMPM(slot.start_time)}-${formatTimeAMPM(slot.end_time)}`,
                              )
                              .join(", ")
                          : `${formatTimeAMPM(s.start_time)}-${formatTimeAMPM(s.end_time)}`;
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1.5 rounded-md border border-primary/20"
                        >
                          <Clock size={12} />
                          {s.name} ({timeDisplay})
                          <button
                            type="button"
                            onClick={() =>
                              setAssignmentForm({
                                ...assignmentForm,
                                shift_ids: assignmentForm.shift_ids.filter(
                                  (id) => id !== sid,
                                ),
                              })
                            }
                            className="ml-0.5 text-primary/60 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Multi-Select Shift Dropdown */}
                <div className="relative">
                  <MultiShiftSelect
                    shifts={shifts}
                    selectedIds={assignmentForm.shift_ids}
                    onChange={(newIds) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        shift_ids: newIds,
                      })
                    }
                    formatTimeAMPM={formatTimeAMPM}
                  />
                </div>

                {/* EV info: how many assignments will be created */}
                {createModalType === "ev" &&
                  assignmentForm.shift_ids.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-pending/10 border border-pending/20 rounded-md">
                      <Zap size={12} className="text-pending shrink-0" />
                      <span className="text-xs font-medium text-pending">
                        {assignmentForm.shift_ids.length > 1
                          ? `${assignmentForm.shift_ids.length} shifts selected — creates ${assignmentForm.shift_ids.length} separate EV assignments`
                          : "1 shift selected — creates 1 EV assignment"}
                      </span>
                    </div>
                  )}

                {/* Inter-Shift Conflict Warning (non-EV only, since EV creates separate assignments) */}
                {createModalType !== "ev" &&
                  assignmentForm.shift_ids.length > 1 &&
                  (() => {
                    const selectedShifts = shifts.filter((s) =>
                      assignmentForm.shift_ids.includes(s.id),
                    );
                    const conflictPairs =
                      detectInterShiftConflicts(selectedShifts);
                    if (conflictPairs.length === 0) return null;
                    return (
                      <div className="mt-2 p-3 bg-red/10 border border-red/30 rounded-md">
                        <div className="flex items-start gap-2">
                          <AlertTriangle
                            size={16}
                            className="text-red shrink-0 mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-bold text-red">
                              Time Conflict Between Selected Shifts
                            </p>
                            {conflictPairs.map((pair, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-red/80 mt-0.5"
                              >
                                "{pair[0]}" overlaps with "{pair[1]}"
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>

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
                          assignmentForm.shift_ids.length > 0 &&
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
                          const conflictDate = availability.conflict_date
                            ? `on ${availability.conflict_date}`
                            : `from ${conflict.start_date} to ${conflict.end_date}`;
                          conflictInfo = `${v.vehicle_number} • Conflict ${conflictDate}`;
                        }

                        const defaultDriver =
                          defaultDriverByVehicleId[String(v.id)] || null;

                        return {
                          value: v.id,
                          label: v.vehicle_name || v.vehicle_number,
                          subtitle: defaultDriver
                            ? `${conflictInfo} • Default driver: ${defaultDriver}`
                            : conflictInfo,
                          available: isAvailable,
                          availableText:
                            hasAvailabilityData && !isAvailable
                              ? `Conflict: ${availability.conflicts?.[0]?.shift_name || "Same shift"}`
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
                        assignmentForm.shift_ids.length > 0 &&
                        assignmentForm.start_date &&
                        availability !== undefined;
                      const defaultVehicle =
                        defaultVehicleByDriverId[String(driverId)] || null;
                      const subtitleParts = [];
                      if (d.license_type) {
                        subtitleParts.push(`License: ${d.license_type}`);
                      }
                      if (defaultVehicle) {
                        subtitleParts.push(
                          `Default vehicle: ${defaultVehicle}`,
                        );
                      }
                      return {
                        value: driverId,
                        label: d.driver_name || d.full_name,
                        subtitle:
                          subtitleParts.length > 0
                            ? subtitleParts.join(" • ")
                            : undefined,
                        available: hasAvailabilityData
                          ? availability?.available !== false
                          : true,
                        availableText:
                          hasAvailabilityData &&
                          availability?.available === false
                            ? availability.conflict_date
                              ? `Conflict on ${availability.conflict_date}`
                              : "Has Conflict"
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
                className="w-full bg-primary text-white rounded-md py-2.5 font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                {createModalType === "ev" &&
                assignmentForm.shift_ids.length > 1 ? (
                  <>
                    <Zap size={15} />
                    Create {assignmentForm.shift_ids.length} EV Assignments
                  </>
                ) : (
                  "Create Assignment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setReassignModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-primarytext">
                Reassign Driver
              </h3>
              <button
                onClick={() => setReassignModal(null)}
                className="text-secondarytext cursor-pointer"
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
                const defaultVehicle =
                  defaultVehicleByDriverId[String(driverId)] || null;
                const subtitleParts = [];
                if (d.license_type) {
                  subtitleParts.push(`License: ${d.license_type}`);
                }
                if (defaultVehicle) {
                  subtitleParts.push(`Default vehicle: ${defaultVehicle}`);
                }
                return {
                  value: driverId,
                  label: d.driver_name || d.full_name,
                  subtitle:
                    subtitleParts.length > 0
                      ? subtitleParts.join(" • ")
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
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
              <button
                onClick={() => setReassignModal(null)}
                className="w-full sm:w-auto px-4 py-2 text-secondarytext rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md cursor-pointer"
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
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => {
            setConflictModal(null);
            setConflictPendingForm(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-2xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-md flex items-center justify-center shrink-0">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primarytext">
                  {conflictModal.conflict_type === "vehicle"
                    ? "Vehicle Conflict Detected"
                    : "Driver Time Conflict Detected"}
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
                className="text-secondarytext cursor-pointer"
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
                  {conflictModal.conflict_type === "vehicle"
                    ? "Vehicle Already Assigned:"
                    : "Conflicting Assignments:"}
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
                          {conflict.assignment_type === "REGULAR" ||
                          conflict.assignment_type === "assignment"
                            ? "Bus/Car Assignment"
                            : conflict.assignment_type === "EV_CLUSTER"
                              ? "EV Assignment"
                              : conflict.assignment_type ===
                                    "TEMP_REPLACEMENT" ||
                                  conflict.assignment_type === "temporary"
                                ? "Temp Replacement"
                                : conflict.assignment_type === "VEHICLE_REQUEST"
                                  ? "Vehicle Request"
                                  : conflict.assignment_type || "Assignment"}
                        </span>
                      </div>
                      <div className="text-sm text-amber-700 space-y-1">
                        <p>
                          <strong>Time:</strong>{" "}
                          {formatTimeAMPM(conflict.start_time)} -{" "}
                          {formatTimeAMPM(conflict.end_time)}
                        </p>
                        {conflict.driver_name && (
                          <p>
                            <strong>Driver:</strong> {conflict.driver_name}
                          </p>
                        )}
                        {conflict.vehicle_number && (
                          <p>
                            <strong>Vehicle:</strong> {conflict.vehicle_number}
                          </p>
                        )}
                        <p>
                          <strong>Dates:</strong> {conflict.start_date} to{" "}
                          {conflict.end_date}
                        </p>
                        {conflict.faculty_name && (
                          <p>
                            <strong>Requested by:</strong>{" "}
                            {conflict.faculty_name}
                          </p>
                        )}
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
                      {conflictModal.conflict_type === "vehicle"
                        ? "This will assign the vehicle even though it already has a conflicting schedule. Use only when necessary."
                        : "This will create a new assignment even though the driver has conflicting schedules. Use this only if necessary."}
                    </p>
                  </div>
                  <button
                    onClick={handleForceAssign}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium whitespace-nowrap cursor-pointer"
                  >
                    Force Assign
                  </button>
                </div>
              </div>

              {/* Option 2: Choose Different Driver (only for driver conflicts, non-EV) */}
              {conflictModal.conflict_type !== "vehicle" &&
                createModalType !== "ev" && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h5 className="font-medium text-green-800 flex items-center gap-2">
                          <CheckCircle size={16} /> Choose a Different Driver
                        </h5>
                        <p className="text-xs text-green-600 mt-1 mb-3">
                          Select an available driver who doesn't have
                          conflicting assignments:
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
                                className={`flex items-center gap-2 p-3 border rounded-md text-left cursor-pointer ${
                                  isAvailable
                                    ? "bg-green-50 border-green-300"
                                    : "bg-gray-100 border-gray-300 opacity-75"
                                }`}
                                title={
                                  isAvailable
                                    ? "Available - No conflicts"
                                    : "Has conflicting assignments"
                                }
                              >
                                <div
                                  className={`w-2 h-2 rounded-md shrink-0 ${
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
                                    className="text-green-600 shrink-0"
                                  />
                                )}
                                {!isAvailable && (
                                  <AlertTriangle
                                    size={14}
                                    className="text-gray-500 shrink-0"
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
                className="px-4 py-2 text-secondarytext rounded-md cursor-pointer"
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
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => {
            setShowEvDetailsModal(false);
            setEvDetails(null);
          }}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingEvDetails ? (
              <Loading
                fullScreen={false}
                text="Loading assignment details..."
              />
            ) : evDetails ? (
              <>
                {/* Clean Header */}
                <div className="p-4 sm:p-6 border-b border-gray-200 bg-white rounded-t-xl">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex items-start gap-3 sm:gap-4">
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
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400">•</span>
                            <span>
                              {evDetails.shift_name || "Default Schedule"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowEvDetailsModal(false);
                        setEvDetails(null);
                      }}
                      className="text-gray-400 cursor-pointer"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Shift Details */}
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Clock size={14} /> Shift Details
                    </h4>
                    <div className="bg-white rounded-md p-3 border border-primary/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock size={13} className="text-primary" />
                        </div>
                        <span className="text-sm font-semibold text-primarytext">
                          {evDetails.shift_name || "Default"}
                        </span>
                      </div>
                      {evDetails.shift_start_time && (
                        <span className="text-xs font-medium text-secondarytext bg-gray-100 px-2.5 py-1 rounded-md whitespace-nowrap">
                          {formatTimeAMPM(evDetails.shift_start_time)} –{" "}
                          {formatTimeAMPM(evDetails.shift_end_time)}
                        </span>
                      )}
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
                        <span
                          className={`font-medium px-2 py-0.5 rounded-md text-xs ${getAssignmentStatusClasses(
                            evDetails.status || "active",
                          )}`}
                        >
                          {evDetails.status || "active"}
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
                  <div className="px-4 sm:px-6 pb-4">
                    <div className="bg-primarybg rounded-md p-4">
                      <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                        <Zap size={14} /> Assigned Vehicles (
                        {evDetails.vehicles.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                <div className="px-4 sm:px-6 pb-4">
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Users size={14} /> Cluster Drivers (
                      {evDetails.drivers?.length || 0})
                    </h4>
                    {evDetails.drivers && evDetails.drivers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button
                    onClick={() => {
                      const assignmentId =
                        evDetails.id || evDetails.assignment_id;
                      setShowEvDetailsModal(false);
                      setEvDetails(null);
                      handleDelete(assignmentId, true);
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-red text-white rounded-md cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowEvDetailsModal(false);
                      setShowEvReassignModal(true);
                      setEvReassignData({
                        assignment_id: evDetails.id || evDetails.assignment_id,
                        cluster_id: evDetails.cluster_id,
                        new_cluster_id: "",
                        start_date: evDetails.start_date,
                        end_date: evDetails.end_date,
                        reason: "",
                      });
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-md cursor-pointer"
                  >
                    Reassign Cluster
                  </button>
                  <button
                    onClick={() => {
                      setShowEvDetailsModal(false);
                      setEvDetails(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-secondarytext rounded-md cursor-pointer"
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
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setShowEvReassignModal(false)}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-white rounded-t-xl">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
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
                  className="text-gray-400 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 sm:p-6 space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex flex-col sm:flex-row gap-3">
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
            <div className="p-4 sm:p-6 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => setShowEvReassignModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 text-gray-600 rounded-md font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEvReassign}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white rounded-md flex items-center justify-center gap-2 font-medium cursor-pointer"
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
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
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
              <Loading
                fullScreen={false}
                size="small"
                text="Loading assignment details..."
              />
            ) : assignmentDetails?.assignment ? (
              <>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
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
                    className="text-secondarytext cursor-pointer"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                          Shift Time
                        </span>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200">
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Clock size={14} className="text-primary" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(
                              assignmentDetails.slots?.[0]?.start_time ||
                                assignmentDetails.assignment.start_time,
                            )}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatTimeAMPM(
                              assignmentDetails.slots?.[0]?.end_time ||
                                assignmentDetails.assignment.end_time,
                            )}
                          </span>
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
                          className={`font-medium px-2 py-0.5 rounded-md text-xs ${getAssignmentStatusClasses(
                            assignmentDetails.assignment.status,
                          )}`}
                        >
                          {assignmentDetails.assignment.status}
                        </span>
                      </div>
                      {(
                        assignmentDetails.assignment.status || ""
                      ).toLowerCase() === "cancelled" && (
                        <div className="flex justify-between">
                          <span className="text-secondarytext">
                            Cancelled on
                          </span>
                          <span className="font-medium text-primarytext">
                            {assignmentDetails.assignment.cancelled_date ||
                              "N/A"}
                          </span>
                        </div>
                      )}
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
                <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button
                    onClick={() => {
                      const assignmentId = assignmentDetails.assignment.id;
                      setShowDetailsModal(false);
                      setAssignmentDetails(null);
                      handleDelete(assignmentId, false);
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-white rounded-md bg-red cursor-pointer"
                  >
                    Delete
                  </button>
                  {canCancelRegularAssignment(
                    assignmentDetails.assignment.status,
                  ) && (
                    <button
                      onClick={() => {
                        const assignmentId = assignmentDetails.assignment.id;
                        setShowDetailsModal(false);
                        setAssignmentDetails(null);
                        handleCancelAssignment(assignmentId);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-amber-700 text-white rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setReassignModal(assignmentDetails.assignment);
                      setReassignDriverId(
                        assignmentDetails.assignment.driver_id,
                      );
                      fetchAvailableDrivers();
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Reassign Driver
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setAssignmentDetails(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-secondarytext bg-gray-100 rounded-md cursor-pointer"
                  >
                    Close
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
