import React, {useEffect, useState, useMemo} from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Users,
  Clock,
  Loader2,
  Check,
  X,
  Search,
  Filter,
  UserPlus,
  Car,
} from "lucide-react";
import {showError, showSuccess, showConfirm} from "../../../utils/swal";
import {getAuthHeaders} from "../../../utils/auth";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";

const API_BASE = import.meta.env.VITE_API_BASE;

function formatTimeAMPM(time24) {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${minutes} ${period}`;
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ScheduleManagement() {
  const [activeTab, setActiveTab] = useState("groups");
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState([]);
  const [vehicleGroups, setVehicleGroups] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("cluster");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showOnlyUnassignedVehicles, setShowOnlyUnassignedVehicles] =
    useState(false);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [vehicleFuelFilter, setVehicleFuelFilter] = useState("all");

  // Search, filter, sort states for tabs
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState("name-asc");
  const [vehicleGroupSearch, setVehicleGroupSearch] = useState("");
  const [vehicleGroupSort, setVehicleGroupSort] = useState("name-asc");
  const [shiftSearch, setShiftSearch] = useState("");
  const [shiftSort, setShiftSort] = useState("name-asc");

  // Member management state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberModalType, setMemberModalType] = useState("cluster"); // "cluster" or "vehicle-group"
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [newMemberForm, setNewMemberForm] = useState({
    item_id: "",
    valid_from: "",
    valid_to: "",
  });
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState(null); // "cluster", "vehicle-group", "shift"
  const [detailMembers, setDetailMembers] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [clusterForm, setClusterForm] = useState({
    name: "",
    description: "",
    shift_id: "",
    start_time: "",
    end_time: "",
    valid_from: "",
    valid_to: "",
    driver_ids: [],
  });

  const [vehicleGroupForm, setVehicleGroupForm] = useState({
    name: "",
    description: "",
    vehicle_ids: [],
    valid_from: "",
    valid_to: "",
  });

  const [shiftForm, setShiftForm] = useState({
    name: "",
    description: "",
    slots: [{start_time: "09:00", end_time: "17:00"}],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        clustersRes,
        vehicleGroupsRes,
        shiftsRes,
        driversRes,
        vehiclesRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/admin/clusters`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/admin/vehicle-groups`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/admin/shifts`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/admin/drivers`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/admin/vehicles`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);

      if (clustersRes.ok) {
        const data = await clustersRes.json();
        setClusters(data || []);
      }
      if (vehicleGroupsRes.ok) {
        const data = await vehicleGroupsRes.json();
        setVehicleGroups(data || []);
      }
      if (shiftsRes.ok) {
        const data = await shiftsRes.json();
        setShifts(data || []);
      }
      if (driversRes.ok) {
        const data = await driversRes.json();
        setDrivers(data || []);
      }
      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        setVehicles(data || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      showError("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Member Management Functions
  const openMemberModal = async (groupId, groupName, type) => {
    setSelectedGroupId(groupId);
    setSelectedGroupName(groupName);
    setMemberModalType(type);
    setShowMemberModal(true);
    setLoadingMembers(true);
    setNewMemberForm({item_id: "", valid_from: "", valid_to: ""});
    setMemberSearch("");

    try {
      if (type === "cluster") {
        const [membersRes, availableRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/clusters/${groupId}/members`, {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
          fetch(`${API_BASE}/api/admin/drivers`, {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
        ]);
        if (membersRes.ok) setGroupMembers((await membersRes.json()) || []);
        if (availableRes.ok)
          setAvailableItems((await availableRes.json()) || []);
      } else {
        const [membersRes, availableRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/vehicle-groups/${groupId}/members`, {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
          fetch(`${API_BASE}/api/admin/vehicles`, {
            credentials: "include",
            headers: getAuthHeaders(),
          }),
        ]);
        if (membersRes.ok) setGroupMembers((await membersRes.json()) || []);
        if (availableRes.ok)
          setAvailableItems((await availableRes.json()) || []);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      showError("Error", "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async () => {
    if (
      !newMemberForm.item_id ||
      !newMemberForm.valid_from ||
      !newMemberForm.valid_to
    ) {
      showError("Error", "Please select an item and date range");
      return;
    }

    try {
      const endpoint =
        memberModalType === "cluster"
          ? `/api/admin/clusters/${selectedGroupId}/add-member`
          : `/api/admin/vehicle-groups/${selectedGroupId}/add-member`;

      const payload =
        memberModalType === "cluster"
          ? {
              driver_id: parseInt(newMemberForm.item_id),
              valid_from: newMemberForm.valid_from,
              valid_to: newMemberForm.valid_to,
            }
          : {
              vehicle_id: parseInt(newMemberForm.item_id),
              valid_from: newMemberForm.valid_from,
              valid_to: newMemberForm.valid_to,
            };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess("Success", "Member added successfully!");
        setNewMemberForm({item_id: "", valid_from: "", valid_to: ""});
        openMemberModal(selectedGroupId, selectedGroupName, memberModalType);
        fetchData();
      } else if (res.status === 409) {
        const data = await res.json();
        if (data.conflicts && data.conflicts.length > 0) {
          const confirmed = await showConfirm(
            "Driver Already Assigned",
            data.conflicts.join("\n") + "\n\nDo you want to proceed anyway?",
          );
          if (confirmed) {
            const forceRes = await fetch(`${API_BASE}${endpoint}`, {
              method: "POST",
              credentials: "include",
              headers: {"Content-Type": "application/json", ...getAuthHeaders()},
              body: JSON.stringify({...payload, force: true}),
            });
            if (forceRes.ok) {
              showSuccess("Success", "Member added successfully!");
              setNewMemberForm({item_id: "", valid_from: "", valid_to: ""});
              openMemberModal(selectedGroupId, selectedGroupName, memberModalType);
              fetchData();
            } else {
              showError("Error", "Failed to add member");
            }
          }
        }
      } else {
        const errorData = await res.json();
        showError("Error", errorData.error || "Failed to add member");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error adding member");
    }
  };

  const handleRemoveMember = async (memberId) => {
    const isConfirmed = await showConfirm(
      "Remove Member?",
      "This will remove the membership record.",
    );
    if (!isConfirmed) return;

    try {
      const endpoint =
        memberModalType === "cluster"
          ? `/api/admin/clusters/${selectedGroupId}/remove-member?member_id=${memberId}`
          : `/api/admin/vehicle-groups/${selectedGroupId}/remove-member?member_id=${memberId}`;

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        showSuccess("Success", "Member removed successfully!");
        openMemberModal(selectedGroupId, selectedGroupName, memberModalType);
        fetchData();
      } else {
        showError("Error", "Failed to remove member");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error removing member");
    }
  };

  // Open detail modal
  const openDetailModal = async (item, type) => {
    setDetailItem(item);
    setDetailType(type);
    setShowDetailModal(true);
    setLoadingDetails(true);
    setDetailMembers([]);

    try {
      if (type === "cluster") {
        const res = await fetch(
          `${API_BASE}/api/admin/clusters/${item.id}/members`,
          {
            credentials: "include",
            headers: getAuthHeaders(),
          },
        );
        if (res.ok) {
          const data = await res.json();
          setDetailMembers(data || []);
        } else {
          // Fallback: filter drivers by cluster_id
          const clusterDrivers = drivers.filter(
            (d) => d.cluster_id === item.id,
          );
          setDetailMembers(clusterDrivers);
        }
      } else if (type === "vehicle-group") {
        const res = await fetch(
          `${API_BASE}/api/admin/vehicle-groups/${item.id}/members`,
          {
            credentials: "include",
            headers: getAuthHeaders(),
          },
        );
        if (res.ok) {
          const data = await res.json();
          setDetailMembers(data || []);
        } else {
          // Fallback: filter vehicles by vehicle_group_id
          const groupVehicles = vehicles.filter(
            (v) => v.vehicle_group_id === item.id,
          );
          setDetailMembers(groupVehicles);
        }
      }
    } catch (err) {
      console.error("Error fetching details:", err);
      // Use fallback data
      if (type === "cluster") {
        setDetailMembers(drivers.filter((d) => d.cluster_id === item.id));
      } else if (type === "vehicle-group") {
        setDetailMembers(
          vehicles.filter((v) => v.vehicle_group_id === item.id),
        );
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = async (endpoint, id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "This action cannot be undone.",
    );
    if (!isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}${endpoint}?id=${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showSuccess("Success", "Deleted successfully!");
        fetchData();
      } else {
        showError("Error", "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error deleting item");
    }
  };

  const openEditModal = (item, type) => {
    setModalType(type);
    setIsEditing(true);
    setEditingId(item.id);

    if (type === "cluster") {
      const currentDriverIds = drivers
        .filter((d) => Number(d.cluster_id) === Number(item.id))
        .map((d) => Number(d.id));
      setClusterForm({
        name: item.name,
        description: item.description || "",
        shift_id: item.shift_id || "",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        valid_from: item.valid_from ? formatDateForInput(item.valid_from) : "",
        valid_to: item.valid_to ? formatDateForInput(item.valid_to) : "",
        driver_ids: (item.driver_ids || currentDriverIds || []).map((id) =>
          Number(id),
        ),
      });
    } else if (type === "vehicle-group") {
      const currentVehicleIds = vehicles
        .filter((v) => Number(v.vehicle_group_id) === Number(item.id))
        .map((v) => Number(v.id));
      setVehicleGroupForm({
        name: item.name,
        description: item.description || "",
        vehicle_ids: (item.vehicle_ids || currentVehicleIds || []).map((id) =>
          Number(id),
        ),
        valid_from: item.valid_from ? formatDateForInput(item.valid_from) : "",
        valid_to: item.valid_to ? formatDateForInput(item.valid_to) : "",
      });
    } else if (type === "shift") {
      const existingSlots =
        item.slots && item.slots.length > 0
          ? item.slots.map((slot) => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
            }))
          : [{start_time: item.start_time, end_time: item.end_time}];

      setShiftForm({
        name: item.name,
        description: item.description || "",
        slots: existingSlots,
      });
    }
    setShowModal(true);
  };

  const handleCreateOrUpdateCluster = async (force = false) => {
    if (!clusterForm.name) {
      showError("Error", "Name is required");
      return;
    }

    const endpoint = isEditing
      ? "/api/admin/clusters/update"
      : "/api/admin/clusters/create-with-schedule";

    const basePayload = isEditing
      ? {...clusterForm, id: editingId}
      : clusterForm;
    const payload = {
      ...basePayload,
      force,
      shift_id:
        basePayload.shift_id === "" ? null : parseInt(basePayload.shift_id),
    };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess(
          "Success",
          `Group ${isEditing ? "updated" : "created"} successfully!`,
        );
        setShowModal(false);
        fetchData();
        setClusterForm({
          name: "",
          description: "",
          shift_id: "",
          start_time: "",
          end_time: "",
          valid_from: "",
          valid_to: "",
          driver_ids: [],
        });
      } else if (res.status === 409) {
        const data = await res.json();
        if (data.conflicts && data.conflicts.length > 0) {
          const confirmed = await showConfirm(
            "Driver Already Assigned",
            data.conflicts.join("\n") + "\n\nDo you want to proceed anyway?",
          );
          if (confirmed) {
            await handleCreateOrUpdateCluster(true);
          }
        }
      } else {
        const errorData = await res.json().catch(() => null);
        showError("Error", errorData?.error || "Failed to process group");
      }
    } catch (err) {
      console.error("Create/update cluster error:", err);
      showError("Error", err.message || "Error processing group");
    }
  };

  const handleCreateOrUpdateShift = async () => {
    if (!shiftForm.name || shiftForm.slots.length === 0) {
      showError(
        "Error",
        "Please fill shift name and add at least one time slot",
      );
      return;
    }

    for (const slot of shiftForm.slots) {
      if (!slot.start_time || !slot.end_time) {
        showError("Error", "Please fill all time slots completely");
        return;
      }
    }

    const endpoint = isEditing
      ? "/api/admin/shifts/update"
      : "/api/admin/shifts/create";

    const payload = isEditing
      ? {
          id: editingId,
          name: shiftForm.name,
          description: shiftForm.description,
          start_time: shiftForm.slots[0]?.start_time || "09:00",
          end_time: shiftForm.slots[0]?.end_time || "17:00",
          slots: shiftForm.slots,
        }
      : {
          name: shiftForm.name,
          description: shiftForm.description,
          slots: shiftForm.slots,
        };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess("Success", `Shift ${isEditing ? "updated" : "created"}!`);
        setShowModal(false);
        fetchData();
        setShiftForm({
          name: "",
          description: "",
          slots: [{start_time: "09:00", end_time: "17:00"}],
        });
      } else {
        showError("Error", "Failed to process shift");
      }
    } catch (e) {
      console.error(e);
      showError("Error", "Error processing shift");
    }
  };

  const handleCreateOrUpdateVehicleGroup = async () => {
    if (!vehicleGroupForm.name) {
      showError("Error", "Group name is required");
      return;
    }

    try {
      let groupId = editingId;

      if (isEditing) {
        const res = await fetch(
          `${API_BASE}/api/admin/vehicle-groups/${editingId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: {"Content-Type": "application/json", ...getAuthHeaders()},
            body: JSON.stringify({
              name: vehicleGroupForm.name,
              description: vehicleGroupForm.description,
              valid_from: vehicleGroupForm.valid_from,
              valid_to: vehicleGroupForm.valid_to,
            }),
          },
        );
        if (!res.ok) {
          const errorData = await res.json();
          showError(
            "Error",
            errorData.error || "Failed to update vehicle group",
          );
          return;
        }
      } else {
        const res = await fetch(`${API_BASE}/api/admin/vehicle-groups/create`, {
          method: "POST",
          credentials: "include",
          headers: {"Content-Type": "application/json", ...getAuthHeaders()},
          body: JSON.stringify({
            name: vehicleGroupForm.name,
            description: vehicleGroupForm.description,
            valid_from: vehicleGroupForm.valid_from,
            valid_to: vehicleGroupForm.valid_to,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json();
          showError(
            "Error",
            errorData.error || "Failed to create vehicle group",
          );
          return;
        }
        const result = await res.json();
        groupId = result.id;
      }

      if (vehicleGroupForm.vehicle_ids.length > 0 || isEditing) {
        // When editing, always clear and reassign; when creating, just assign
        const assignRes = await fetch(
          `${API_BASE}/api/admin/vehicle-groups/${groupId}/assign-vehicles`,
          {
            method: "POST",
            credentials: "include",
            headers: {"Content-Type": "application/json", ...getAuthHeaders()},
            body: JSON.stringify({
              vehicle_ids:
                vehicleGroupForm.vehicle_ids.length > 0
                  ? vehicleGroupForm.vehicle_ids
                  : [],
              clear_existing: isEditing,
            }),
          },
        );
        if (!assignRes.ok) {
          showError("Warning", "Group saved but failed to assign vehicles");
        }
      }

      showSuccess(
        "Success",
        `Vehicle group ${isEditing ? "updated" : "created"} successfully!`,
      );
      setShowModal(false);
      fetchData();
      setVehicleGroupForm({
        name: "",
        description: "",
        vehicle_ids: [],
        valid_from: "",
        valid_to: "",
      });
    } catch (err) {
      console.error(err);
      showError("Error", "Error processing vehicle group");
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (!driver) return false;
    const driverName = driver.full_name || driver.name || "";
    const matchesSearch = driverName
      .toLowerCase()
      .includes((driverSearch || "").toLowerCase());
    const isCurrentlyAssignedToThisGroup =
      isEditing && Number(driver.cluster_id) === Number(editingId);
    const matchesUnassigned = showOnlyUnassigned
      ? !driver.cluster_id || isCurrentlyAssignedToThisGroup
      : true;
    return matchesSearch && matchesUnassigned;
  });

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!vehicle) return false;
    const name =
      vehicle.vehicle_name ||
      vehicle.vehicle_number ||
      vehicle.registration_number ||
      "";
    const matchesSearch = name
      .toLowerCase()
      .includes((vehicleSearch || "").toLowerCase());
    const groupAssignment =
      vehicle.vehicle_group_id !== undefined
        ? vehicle.vehicle_group_id
        : vehicle.cluster_id;
    const isCurrentlyInThisGroup =
      isEditing && Number(groupAssignment) === Number(editingId);
    const matchesUnassigned = showOnlyUnassignedVehicles
      ? !groupAssignment || isCurrentlyInThisGroup
      : true;
    const matchesType =
      vehicleTypeFilter === "all"
        ? true
        : vehicle.vehicle_type === vehicleTypeFilter;
    const matchesFuel =
      vehicleFuelFilter === "all"
        ? true
        : vehicle.fuel_type &&
          vehicle.fuel_type.toUpperCase() === vehicleFuelFilter.toUpperCase();
    return matchesSearch && matchesUnassigned && matchesType && matchesFuel;
  });

  const toggleDriverSelection = (driverId) => {
    const id = Number(driverId);
    setClusterForm((prev) => {
      const exists = prev.driver_ids.includes(id);
      const driver_ids = exists
        ? prev.driver_ids.filter((dId) => dId !== id)
        : [...prev.driver_ids, id];
      return {...prev, driver_ids};
    });
  };

  const toggleVehicleSelection = (vehicleId) => {
    const id = Number(vehicleId);
    setVehicleGroupForm((prev) => {
      const exists = prev.vehicle_ids.includes(id);
      const vehicle_ids = exists
        ? prev.vehicle_ids.filter((vId) => vId !== id)
        : [...prev.vehicle_ids, id];
      return {...prev, vehicle_ids};
    });
  };

  // Filtered and sorted clusters (driver groups)
  const filteredClusters = useMemo(() => {
    let result = clusters.filter(
      (cluster) =>
        cluster.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
        (cluster.description || "")
          .toLowerCase()
          .includes(groupSearch.toLowerCase()),
    );

    result.sort((a, b) => {
      switch (groupSort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "drivers-asc":
          return (a.driver_count || 0) - (b.driver_count || 0);
        case "drivers-desc":
          return (b.driver_count || 0) - (a.driver_count || 0);
        default:
          return 0;
      }
    });
    return result;
  }, [clusters, groupSearch, groupSort]);

  // Filtered and sorted vehicle groups
  const filteredVehicleGroups = useMemo(() => {
    let result = vehicleGroups.filter(
      (group) =>
        group.name.toLowerCase().includes(vehicleGroupSearch.toLowerCase()) ||
        (group.description || "")
          .toLowerCase()
          .includes(vehicleGroupSearch.toLowerCase()),
    );

    result.sort((a, b) => {
      switch (vehicleGroupSort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "vehicles-asc":
          return (a.vehicle_count || 0) - (b.vehicle_count || 0);
        case "vehicles-desc":
          return (b.vehicle_count || 0) - (a.vehicle_count || 0);
        default:
          return 0;
      }
    });
    return result;
  }, [vehicleGroups, vehicleGroupSearch, vehicleGroupSort]);

  // Filtered and sorted shifts
  const filteredShifts = useMemo(() => {
    let result = shifts.filter(
      (shift) =>
        shift.name.toLowerCase().includes(shiftSearch.toLowerCase()) ||
        (shift.description || "")
          .toLowerCase()
          .includes(shiftSearch.toLowerCase()),
    );

    result.sort((a, b) => {
      const getFirstStartTime = (shift) => {
        if (shift.slots && shift.slots.length > 0) {
          return shift.slots[0].start_time || "00:00";
        }
        return shift.start_time || "00:00";
      };

      switch (shiftSort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "time-asc":
          return getFirstStartTime(a).localeCompare(getFirstStartTime(b));
        case "time-desc":
          return getFirstStartTime(b).localeCompare(getFirstStartTime(a));
        default:
          return 0;
      }
    });
    return result;
  }, [shifts, shiftSearch, shiftSort]);

  return (
    <div className="space-y-6 pb-12 font-sans text-primarytext">
      {/* Header Section */}
      <div className="bg-linear-to-r from-primary/5 to-primarydull/5 rounded-md p-6 border border-primary/10">
        <h1 className="text-3xl font-bold text-primarytext flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary" />
          Schedule Management
        </h1>
        <p className="text-secondarytext mt-2 text-sm">
          Manage driver groups, vehicle groups, shifts and schedules for
          efficient operations
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Driver Groups
              </p>
              <p className="text-2xl font-bold text-primarytext mt-1">
                {clusters.length}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-md">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Vehicle Groups
              </p>
              <p className="text-2xl font-bold text-primarytext mt-1">
                {vehicleGroups.length}
              </p>
            </div>
            <div className="p-3 bg-pending/10 rounded-md">
              <Users className="w-6 h-6 text-pending" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Active Shifts
              </p>
              <p className="text-2xl font-bold text-primarytext mt-1">
                {shifts.length}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-md">
              <Clock className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Assigned Drivers
              </p>
              <p className="text-2xl font-bold text-primarytext mt-1">
                {drivers.filter((d) => d.cluster_id).length}
              </p>
            </div>
            <div className="p-3 bg-green/10 rounded-md">
              <Check className="w-6 h-6 text-green" />
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-md p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                Available Drivers
              </p>
              <p className="text-2xl font-bold text-primarytext mt-1">
                {drivers.filter((d) => !d.cluster_id).length}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-md">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Create Button */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-6 py-2.5 rounded-md text-sm font-bold transition-all ${
                activeTab === "groups"
                  ? "bg-primary text-white shadow-md"
                  : "bg-primarybg text-secondarytext hover:bg-primary/10"
              }`}
            >
              Driver Groups
            </button>
            <button
              onClick={() => setActiveTab("vehicle-groups")}
              className={`px-6 py-2.5 rounded-md text-sm font-bold transition-all ${
                activeTab === "vehicle-groups"
                  ? "bg-primary text-white shadow-md"
                  : "bg-primarybg text-secondarytext hover:bg-primary/10"
              }`}
            >
              Vehicle Groups
            </button>
            <button
              onClick={() => setActiveTab("shifts")}
              className={`px-6 py-2.5 rounded-md text-sm font-bold transition-all ${
                activeTab === "shifts"
                  ? "bg-primary text-white shadow-md"
                  : "bg-primarybg text-secondarytext hover:bg-primary/10"
              }`}
            >
              Shifts & Timings
            </button>
          </div>

          <button
            onClick={() => {
              setModalType(
                activeTab === "groups"
                  ? "cluster"
                  : activeTab === "vehicle-groups"
                    ? "vehicle-group"
                    : "shift",
              );
              setIsEditing(false);
              setEditingId(null);
              setClusterForm({
                name: "",
                description: "",
                shift_id: "",
                start_time: "",
                end_time: "",
                valid_from: "",
                valid_to: "",
                driver_ids: [],
              });
              setVehicleGroupForm({
                name: "",
                description: "",
                vehicle_ids: [],
                valid_from: "",
                valid_to: "",
              });
              setShiftForm({
                name: "",
                description: "",
                slots: [{start_time: "09:00", end_time: "17:00"}],
              });
              setDriverSearch("");
              setShowOnlyUnassigned(false);
              setVehicleSearch("");
              setShowOnlyUnassignedVehicles(false);
              setShowModal(true);
            }}
            className="px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primarydull transition-all font-bold flex items-center gap-2 text-sm shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create{" "}
            {activeTab === "groups"
              ? "Group"
              : activeTab === "vehicle-groups"
                ? "Vehicle Group"
                : "Shift"}
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Driver Groups Tab Controls */}
          {activeTab === "groups" && (
            <>
              <CustomSearch
                value={groupSearch}
                onChange={setGroupSearch}
                placeholder="Search driver groups..."
                className="flex-1 max-w-md"
              />
              <CustomDropdown
                value={groupSort}
                onChange={setGroupSort}
                options={[
                  {value: "name-asc", label: "Name (A-Z)"},
                  {value: "name-desc", label: "Name (Z-A)"},
                  {value: "drivers-desc", label: "Most Drivers"},
                  {value: "drivers-asc", label: "Least Drivers"},
                ]}
              />
            </>
          )}

          {/* Vehicle Groups Tab Controls */}
          {activeTab === "vehicle-groups" && (
            <>
              <CustomSearch
                value={vehicleGroupSearch}
                onChange={setVehicleGroupSearch}
                placeholder="Search vehicle groups..."
                className="flex-1 max-w-md"
              />
              <CustomDropdown
                value={vehicleGroupSort}
                onChange={setVehicleGroupSort}
                options={[
                  {value: "name-asc", label: "Name (A-Z)"},
                  {value: "name-desc", label: "Name (Z-A)"},
                  {value: "vehicles-desc", label: "Most Vehicles"},
                  {value: "vehicles-asc", label: "Least Vehicles"},
                ]}
              />
            </>
          )}

          {/* Shifts Tab Controls */}
          {activeTab === "shifts" && (
            <>
              <CustomSearch
                value={shiftSearch}
                onChange={setShiftSearch}
                placeholder="Search shifts..."
                className="flex-1 max-w-md"
              />
              <CustomDropdown
                value={shiftSort}
                onChange={setShiftSort}
                options={[
                  {value: "name-asc", label: "Name (A-Z)"},
                  {value: "name-desc", label: "Name (Z-A)"},
                  {value: "time-asc", label: "Start Time (Early)"},
                  {value: "time-desc", label: "Start Time (Late)"},
                ]}
              />
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm p-6 min-h-100">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-96">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="text-secondarytext text-sm">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Driver Groups Tab */}
            {activeTab === "groups" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredClusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    onClick={() => openDetailModal(cluster, "cluster")}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-lg transition-all group border border-gray-100 relative overflow-hidden cursor-pointer"
                  >
                    {/* Decorative top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary to-primary/50"></div>

                    {/* Action Buttons */}
                    <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(cluster, "cluster");
                        }}
                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(
                            "/api/admin/clusters/delete",
                            cluster.id,
                          );
                        }}
                        className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="mb-4 mt-2">
                      <h3 className="text-lg font-bold text-primarytext mb-1 pr-16">
                        {cluster.name}
                      </h3>
                      {cluster.description && (
                        <p className="text-sm text-secondarytext line-clamp-2 min-h-10">
                          {cluster.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-linear-to-r from-primary/5 to-primary/10 px-4 py-3 rounded-md border border-primary/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/15 rounded-md">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <span className="text-xl font-bold text-primary">
                              {cluster.driver_count || 0}
                            </span>
                            <span className="text-sm text-secondarytext ml-2">
                              Drivers
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-4 py-2.5 rounded-md">
                        <Calendar className="w-4 h-4 text-secondarytext shrink-0" />
                        <span className="text-secondarytext">
                          {cluster.valid_from && cluster.valid_to
                            ? `${cluster.valid_from} to ${cluster.valid_to}`
                            : "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredClusters.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <div className="p-4 bg-primary/10 rounded-md mb-4">
                      <Users className="w-12 h-12 text-primary/50" />
                    </div>
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      {groupSearch
                        ? "No matching driver groups"
                        : "No driver groups found"}
                    </p>
                    <p className="text-sm text-secondarytext">
                      {groupSearch
                        ? "Try a different search term"
                        : "Create a group to organize your drivers and schedules"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Vehicle Groups Tab */}
            {activeTab === "vehicle-groups" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredVehicleGroups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => openDetailModal(group, "vehicle-group")}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-lg transition-all group border border-gray-100 relative overflow-hidden cursor-pointer"
                  >
                    {/* Decorative top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-pending to-pending/50"></div>

                    {/* Action Buttons */}
                    <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(group, "vehicle-group");
                        }}
                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const isConfirmed = await showConfirm(
                            "Are you sure?",
                            "Do you really want to delete this vehicle group?",
                          );
                          if (!isConfirmed) return;
                          try {
                            const res = await fetch(
                              `${API_BASE}/api/admin/vehicle-groups/${group.id}`,
                              {
                                method: "DELETE",
                                credentials: "include",
                                headers: getAuthHeaders(),
                              },
                            );
                            if (res.ok) {
                              showSuccess("Success", "Deleted successfully");
                              fetchData();
                            } else {
                              showError("Error", "Failed to delete");
                            }
                          } catch (err) {
                            console.error(err);
                            showError("Error", "Error deleting group");
                          }
                        }}
                        className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="mb-4 mt-2">
                      <h3 className="text-lg font-bold text-primarytext mb-1 pr-16">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-sm text-secondarytext line-clamp-2 min-h-10">
                          {group.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-linear-to-r from-pending/5 to-pending/10 px-4 py-3 rounded-md border border-pending/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-pending/15 rounded-md">
                            <Car className="w-5 h-5 text-pending" />
                          </div>
                          <div>
                            <span className="text-xl font-bold text-pending">
                              {group.vehicle_count || 0}
                            </span>
                            <span className="text-sm text-secondarytext ml-2">
                              EV Vehicles
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-4 py-2.5 rounded-md">
                        <Calendar className="w-4 h-4 text-secondarytext shrink-0" />
                        <span className="text-secondarytext">
                          {group.valid_from && group.valid_to
                            ? `${group.valid_from} to ${group.valid_to}`
                            : "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredVehicleGroups.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <div className="p-4 bg-pending/10 rounded-md mb-4">
                      <Car className="w-12 h-12 text-pending/50" />
                    </div>
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      {vehicleGroupSearch
                        ? "No matching vehicle groups"
                        : "No vehicle groups found"}
                    </p>
                    <p className="text-sm text-secondarytext">
                      {vehicleGroupSearch
                        ? "Try a different search term"
                        : "Create a group to organize your EV vehicles"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Shifts Tab */}
            {activeTab === "shifts" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredShifts.map((shift) => (
                  <div
                    key={shift.id}
                    onClick={() => openDetailModal(shift, "shift")}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-lg transition-all border border-gray-100 group relative overflow-hidden cursor-pointer"
                  >
                    {/* Decorative top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-green to-green/50"></div>

                    {/* Action Buttons */}
                    <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(shift, "shift");
                        }}
                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete("/api/admin/shifts/delete", shift.id);
                        }}
                        className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="mb-4 mt-2">
                      <h3 className="text-lg font-bold text-primarytext mb-1 pr-16">
                        {shift.name}
                      </h3>
                      {shift.description && (
                        <p className="text-sm text-secondarytext line-clamp-2 min-h-10">
                          {shift.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-linear-to-r from-green/5 to-green/10 px-4 py-3 rounded-md border border-green/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green/15 rounded-md">
                            <Clock className="w-5 h-5 text-green" />
                          </div>
                          <div>
                            <span className="text-xl font-bold text-green">
                              {shift.slots?.length || 1}
                            </span>
                            <span className="text-sm text-secondarytext ml-2">
                              Time Slot
                              {(shift.slots?.length || 1) !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Time Slots */}
                      <div className="space-y-2">
                        {shift.slots && shift.slots.length > 0 ? (
                          shift.slots.slice(0, 3).map((slot, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 bg-primarybg px-3 py-2 rounded-md text-sm"
                            >
                              <Clock className="w-3.5 h-3.5 text-secondarytext" />
                              <span className="font-medium text-primarytext">
                                {formatTimeAMPM(slot.start_time)} -{" "}
                                {formatTimeAMPM(slot.end_time)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 bg-primarybg px-3 py-2 rounded-md text-sm">
                            <Clock className="w-3.5 h-3.5 text-secondarytext" />
                            <span className="font-medium text-primarytext">
                              {formatTimeAMPM(shift.start_time)} -{" "}
                              {formatTimeAMPM(shift.end_time)}
                            </span>
                          </div>
                        )}
                        {shift.slots && shift.slots.length > 3 && (
                          <p className="text-xs text-secondarytext text-center">
                            +{shift.slots.length - 3} more slots
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredShifts.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <div className="p-4 bg-green/10 rounded-md mb-4">
                      <Clock className="w-12 h-12 text-green/50" />
                    </div>
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      {shiftSearch
                        ? "No matching shifts"
                        : "No shifts created yet"}
                    </p>
                    <p className="text-sm text-secondarytext">
                      {shiftSearch
                        ? "Try a different search term"
                        : "Create a shift to manage driver timings"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-md ${
                    modalType === "cluster"
                      ? "bg-primary"
                      : modalType === "vehicle-group"
                        ? "bg-pending"
                        : "bg-green"
                  }`}
                >
                  {modalType === "cluster" ? (
                    <Users className="w-6 h-6 text-white" />
                  ) : modalType === "vehicle-group" ? (
                    <Car className="w-6 h-6 text-white" />
                  ) : (
                    <Clock className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primarytext">
                    {isEditing ? "Edit" : "Create"}{" "}
                    {modalType === "cluster"
                      ? "Driver Group"
                      : modalType === "vehicle-group"
                        ? "Vehicle Group"
                        : "Shift"}
                  </h3>
                  <p className="text-sm text-secondarytext mt-0.5">
                    {modalType === "cluster"
                      ? "Configure group details and validity period"
                      : modalType === "vehicle-group"
                        ? "Configure group details and validity period"
                        : "Set up shift name and time slots"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {modalType === "cluster" ? (
                // Driver Group Form with driver selection
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Group Name <span className="text-red">*</span>
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="e.g. Morning Batch A"
                      value={clusterForm.name}
                      onChange={(e) =>
                        setClusterForm({...clusterForm, name: e.target.value})
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      placeholder="Enter a brief description for this group..."
                      rows="3"
                      value={clusterForm.description}
                      onChange={(e) =>
                        setClusterForm({
                          ...clusterForm,
                          description: e.target.value,
                        })
                      }
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-2">
                        Valid From
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        value={clusterForm.valid_from}
                        onChange={(e) =>
                          setClusterForm({
                            ...clusterForm,
                            valid_from: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-2">
                        Valid To
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        value={clusterForm.valid_to}
                        onChange={(e) =>
                          setClusterForm({
                            ...clusterForm,
                            valid_to: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Driver Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-primarytext">
                        Assign Drivers
                      </h4>
                      <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-md font-bold">
                        {clusterForm.driver_ids.length} selected
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search drivers..."
                          className="w-full pl-9 pr-3 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          value={driverSearch}
                          onChange={(e) => setDriverSearch(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowOnlyUnassigned(!showOnlyUnassigned)
                        }
                        className={`px-3 py-2.5 rounded-md border text-xs font-semibold flex items-center gap-2 transition-colors ${
                          showOnlyUnassigned
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-secondarytext border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        Unassigned only
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredDrivers.length > 0 ? (
                        filteredDrivers.map((driver) => {
                          const isSelected = clusterForm.driver_ids.includes(
                            Number(driver.id),
                          );
                          const statusLabel = driver.cluster_id
                            ? Number(driver.cluster_id) === Number(editingId)
                              ? "Assigned here"
                              : "Assigned to another group"
                            : "Unassigned";

                          return (
                            <label
                              key={driver.id}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-gray-200 bg-white hover:border-primary/60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleDriverSelection(driver.id)
                                  }
                                  className="w-4 h-4 text-primary focus:ring-primary"
                                />
                                <div>
                                  <p className="text-sm font-semibold text-primarytext">
                                    {driver.full_name ||
                                      driver.name ||
                                      "Unnamed driver"}
                                  </p>
                                  <p className="text-xs text-secondarytext">
                                    {statusLabel}
                                  </p>
                                </div>
                              </div>
                              {driver.phone && (
                                <span className="text-xs text-secondarytext">
                                  {driver.phone}
                                </span>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-sm text-secondarytext bg-primarybg border border-dashed border-gray-200 rounded-md px-3 py-4 text-center">
                          No drivers match the current filters.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-md p-4 border border-primary/10">
                    <p className="text-sm text-secondarytext">
                      <span className="font-semibold text-primarytext">
                        Tip:
                      </span>{" "}
                      Leave dates empty for a permanent group. You can assign
                      drivers now or later.
                    </p>
                  </div>
                </div>
              ) : modalType === "vehicle-group" ? (
                // Vehicle Group Form with vehicle selection
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Group Name <span className="text-red">*</span>
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="e.g. EV Group A"
                      value={vehicleGroupForm.name}
                      onChange={(e) =>
                        setVehicleGroupForm({
                          ...vehicleGroupForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Description
                    </label>
                    <textarea
                      rows="3"
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      placeholder="Enter a brief description for this group..."
                      value={vehicleGroupForm.description}
                      onChange={(e) =>
                        setVehicleGroupForm({
                          ...vehicleGroupForm,
                          description: e.target.value,
                        })
                      }
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-2">
                        Valid From
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        value={vehicleGroupForm.valid_from}
                        onChange={(e) =>
                          setVehicleGroupForm({
                            ...vehicleGroupForm,
                            valid_from: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-2">
                        Valid To
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                        value={vehicleGroupForm.valid_to}
                        onChange={(e) =>
                          setVehicleGroupForm({
                            ...vehicleGroupForm,
                            valid_to: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Vehicle Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-primarytext">
                        Assign Vehicles
                      </h4>
                      <span className="text-xs bg-pending/10 text-pending px-3 py-1 rounded-md font-bold">
                        {vehicleGroupForm.vehicle_ids.length} selected
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search vehicles..."
                          className="w-full pl-9 pr-3 py-2.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-pending focus:ring-2 focus:ring-pending/20"
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                        />
                      </div>
                      <CustomDropdown
                        value={vehicleTypeFilter}
                        onChange={setVehicleTypeFilter}
                        options={[
                          {value: "all", label: "All Types"},
                          {value: "BUS", label: "Bus"},
                          {value: "CAR", label: "Car"},
                          {value: "BATTERY_VEHICLE", label: "Battery Vehicle"},
                          {value: "OTHER", label: "Other"},
                        ]}
                        width="w-40"
                      />
                      <CustomDropdown
                        value={vehicleFuelFilter}
                        onChange={setVehicleFuelFilter}
                        options={[
                          {value: "all", label: "All Fuels"},
                          {value: "PETROL", label: "Petrol"},
                          {value: "DIESEL", label: "Diesel"},
                          {value: "EV", label: "Electric"},
                          {value: "CNG", label: "CNG"},
                        ]}
                        width="w-36"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowOnlyUnassignedVehicles(
                            !showOnlyUnassignedVehicles,
                          )
                        }
                        className={`px-3 py-2.5 rounded-md border text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                          showOnlyUnassignedVehicles
                            ? "bg-pending text-white border-pending"
                            : "bg-white text-secondarytext border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        Unassigned only
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredVehicles.length > 0 ? (
                        filteredVehicles.map((vehicle) => {
                          const isSelected =
                            vehicleGroupForm.vehicle_ids.includes(
                              Number(vehicle.id),
                            );
                          const groupAssignment =
                            vehicle.vehicle_group_id !== undefined
                              ? vehicle.vehicle_group_id
                              : vehicle.cluster_id;
                          const statusLabel = groupAssignment
                            ? Number(groupAssignment) === Number(editingId)
                              ? "Assigned here"
                              : "Assigned to another group"
                            : "Unassigned";

                          return (
                            <label
                              key={vehicle.id}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-pending bg-pending/5"
                                  : "border-gray-200 bg-white hover:border-pending/60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleVehicleSelection(vehicle.id)
                                  }
                                  className="w-4 h-4 text-pending focus:ring-pending"
                                />
                                <div>
                                  <p className="text-sm font-semibold text-primarytext">
                                    {vehicle.vehicle_name ||
                                      // vehicle.vehicle_number ||
                                      "Unnamed vehicle"}
                                  </p>
                                  <p className="text-xs text-secondarytext">
                                    {statusLabel}
                                  </p>
                                </div>
                              </div>
                              {vehicle.type && (
                                <span className="text-xs text-secondarytext">
                                  {vehicle.type}
                                </span>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-sm text-secondarytext bg-primarybg border border-dashed border-gray-200 rounded-md px-3 py-4 text-center">
                          No vehicles match the current filters.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-pending/5 rounded-md p-4 border border-pending/10">
                    <p className="text-sm text-secondarytext">
                      <span className="font-semibold text-primarytext">
                        Tip:
                      </span>{" "}
                      Leave dates empty for a permanent group. You can assign
                      vehicles now or later.
                    </p>
                  </div>
                </div>
              ) : (
                // Shift Form
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Shift Name <span className="text-red">*</span>
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="e.g. General Shift"
                      value={shiftForm.name}
                      onChange={(e) =>
                        setShiftForm({...shiftForm, name: e.target.value})
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      rows="2"
                      placeholder="Optional description for this shift..."
                      value={shiftForm.description}
                      onChange={(e) =>
                        setShiftForm({
                          ...shiftForm,
                          description: e.target.value,
                        })
                      }
                    ></textarea>
                  </div>

                  {/* Time Slots */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-primarytext">
                        Time Slots
                      </label>
                      <span className="text-xs bg-green/10 text-green px-3 py-1.5 rounded-md font-bold">
                        {shiftForm.slots.length} Slot
                        {shiftForm.slots.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {shiftForm.slots.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 bg-primarybg p-4 rounded-md border border-gray-200"
                        >
                          <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-primary bg-primary/10 rounded-md">
                            {index + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-secondarytext mb-1.5">
                                Start Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                                value={slot.start_time}
                                onChange={(e) => {
                                  const newSlots = [...shiftForm.slots];
                                  newSlots[index].start_time = e.target.value;
                                  setShiftForm({...shiftForm, slots: newSlots});
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-secondarytext mb-1.5">
                                End Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                                value={slot.end_time}
                                onChange={(e) => {
                                  const newSlots = [...shiftForm.slots];
                                  newSlots[index].end_time = e.target.value;
                                  setShiftForm({...shiftForm, slots: newSlots});
                                }}
                              />
                            </div>
                          </div>
                          {shiftForm.slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newSlots = shiftForm.slots.filter(
                                  (_, i) => i !== index,
                                );
                                setShiftForm({...shiftForm, slots: newSlots});
                              }}
                              className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShiftForm({
                          ...shiftForm,
                          slots: [
                            ...shiftForm.slots,
                            {start_time: "09:00", end_time: "17:00"},
                          ],
                        });
                      }}
                      className="mt-3 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md text-sm font-semibold text-secondarytext hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Time Slot
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
              >
                Close
              </button>
              <button
                onClick={
                  modalType === "cluster"
                    ? () => handleCreateOrUpdateCluster()
                    : modalType === "vehicle-group"
                      ? handleCreateOrUpdateVehicleGroup
                      : handleCreateOrUpdateShift
                }
                className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-all text-sm flex items-center gap-2"
              >
                {isEditing ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-md bg-primary">
                  {memberModalType === "cluster" ? (
                    <Users className="w-6 h-6 text-white" />
                  ) : (
                    <Car className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primarytext">
                    {selectedGroupName}
                  </h3>
                  <p className="text-sm text-secondarytext mt-0.5">
                    Manage{" "}
                    {memberModalType === "cluster" ? "Drivers" : "Vehicles"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemberModal(false)}
                className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Add New Member Section */}
              <div className="bg-primarybg rounded-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                    Add New{" "}
                    {memberModalType === "cluster" ? "Driver" : "Vehicle"}
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-secondarytext uppercase mb-1">
                      {memberModalType === "cluster" ? "Driver" : "Vehicle"} *
                    </label>
                    <select
                      className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                      value={newMemberForm.item_id}
                      onChange={(e) =>
                        setNewMemberForm({
                          ...newMemberForm,
                          item_id: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        Select{" "}
                        {memberModalType === "cluster" ? "Driver" : "Vehicle"}
                      </option>
                      {availableItems
                        .filter((item) => {
                          const name =
                            memberModalType === "cluster"
                              ? item.full_name || item.name || ""
                              : item.vehicle_number || "";
                          return name
                            .toLowerCase()
                            .includes(memberSearch.toLowerCase());
                        })
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {memberModalType === "cluster"
                              ? item.full_name || item.name
                              : item.vehicle_number}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase mb-1">
                      Valid From *
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                      value={newMemberForm.valid_from}
                      onChange={(e) =>
                        setNewMemberForm({
                          ...newMemberForm,
                          valid_from: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase mb-1">
                      Valid To *
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                      value={newMemberForm.valid_to}
                      onChange={(e) =>
                        setNewMemberForm({
                          ...newMemberForm,
                          valid_to: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddMember}
                  className="mt-4 px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-all text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </button>
              </div>

              {/* Current Members List */}
              <div className="bg-primarybg rounded-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  {memberModalType === "cluster" ? (
                    <Users className="w-4 h-4 text-primary" />
                  ) : (
                    <Car className="w-4 h-4 text-primary" />
                  )}
                  <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                    Current Members ({groupMembers.length})
                  </h4>
                </div>

                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : groupMembers.length === 0 ? (
                  <div className="text-center py-6 text-secondarytext text-sm bg-white rounded-md border border-dashed border-gray-200">
                    No members added yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-md">
                            {memberModalType === "cluster" ? (
                              <Users className="w-4 h-4 text-primary" />
                            ) : (
                              <Car className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-primarytext">
                              {memberModalType === "cluster"
                                ? member.driver_name
                                : member.vehicle_number}
                            </p>
                            <p className="text-xs text-secondarytext">
                              {member.valid_from} - {member.valid_to}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowMemberModal(false)}
                className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-md ${
                    detailType === "cluster"
                      ? "bg-primary"
                      : detailType === "vehicle-group"
                        ? "bg-pending"
                        : "bg-green"
                  }`}
                >
                  {detailType === "cluster" ? (
                    <Users className="w-6 h-6 text-white" />
                  ) : detailType === "vehicle-group" ? (
                    <Car className="w-6 h-6 text-white" />
                  ) : (
                    <Clock className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primarytext">
                    {detailItem.name}
                  </h3>
                  <p className="text-sm text-secondarytext mt-0.5">
                    {detailItem.description ||
                      (detailType === "cluster"
                        ? "Driver Group"
                        : detailType === "vehicle-group"
                          ? "Vehicle Group"
                          : "Shift")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shift Time Slots - Only for Shifts */}
                {detailType === "shift" && (
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Time Slots
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {detailItem.slots && detailItem.slots.length > 0 ? (
                        detailItem.slots.map((slot, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 bg-white border border-primary/20 px-4 py-3 rounded-md"
                          >
                            <div className="p-2 bg-primary/10 rounded-md">
                              <Clock className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium text-primarytext">
                              {formatTimeAMPM(slot.start_time)}
                            </span>
                            <span className="text-secondarytext">→</span>
                            <span className="font-medium text-primarytext">
                              {formatTimeAMPM(slot.end_time)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-3 bg-white border border-primary/20 px-4 py-3 rounded-md">
                          <div className="p-2 bg-primary/10 rounded-md">
                            <Clock className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium text-primarytext">
                            {formatTimeAMPM(detailItem.start_time)}
                          </span>
                          <span className="text-secondarytext">→</span>
                          <span className="font-medium text-primarytext">
                            {formatTimeAMPM(detailItem.end_time)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validity Period - For Clusters and Vehicle Groups */}
                {(detailType === "cluster" ||
                  detailType === "vehicle-group") && (
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Validity Period
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Start Date
                        </span>
                        <span className="text-sm font-semibold text-primarytext">
                          {detailItem.valid_from || "Not Set"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          End Date
                        </span>
                        <span className="text-sm font-semibold text-primarytext">
                          {detailItem.valid_to || "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Group Info */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    {detailType === "cluster" ? (
                      <Users className="w-4 h-4 text-primary" />
                    ) : detailType === "vehicle-group" ? (
                      <Car className="w-4 h-4 text-primary" />
                    ) : (
                      <Clock className="w-4 h-4 text-primary" />
                    )}
                    <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                      {detailType === "cluster"
                        ? "Driver Information"
                        : detailType === "vehicle-group"
                          ? "Vehicle Information"
                          : "Shift Information"}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Total{" "}
                        {detailType === "cluster"
                          ? "Drivers"
                          : detailType === "vehicle-group"
                            ? "Vehicles"
                            : "Slots"}
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {detailType === "shift"
                          ? detailItem.slots?.length || 1
                          : detailMembers.length}
                      </span>
                    </div>
                    {detailType !== "shift" && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Status
                        </span>
                        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-green/20 text-green">
                          Active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Members List - For Clusters and Vehicle Groups */}
              {(detailType === "cluster" || detailType === "vehicle-group") && (
                <div className="mt-4 bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    {detailType === "cluster" ? (
                      <Users className="w-4 h-4 text-primary" />
                    ) : (
                      <Car className="w-4 h-4 text-primary" />
                    )}
                    <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                      {detailType === "cluster"
                        ? "Assigned Drivers"
                        : "Assigned Vehicles"}{" "}
                      ({detailMembers.length})
                    </h4>
                  </div>
                  {loadingDetails ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : detailMembers.length === 0 ? (
                    <div className="text-center py-6 text-secondarytext text-sm bg-white rounded-md border border-dashed border-gray-200">
                      No {detailType === "cluster" ? "drivers" : "vehicles"}{" "}
                      assigned to this group
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {detailMembers.map((member, idx) => (
                        <div
                          key={member.id || idx}
                          className="inline-flex items-center gap-2
                           bg-primary/10 px-3 py-2 rounded-md border border-primary/20"
                        >
                          {detailType === "cluster" ? (
                            <Users className="w-4 h-4 text-primary" />
                          ) : (
                            <Car className="w-4 h-4 text-primary" />
                          )}
                          <span className="font-medium text-primarytext text-sm">
                            {detailType === "cluster"
                              ? member.driver_name ||
                                member.full_name ||
                                member.name ||
                                "Unknown"
                              : member.vehicle_name ||
                                member.vehicle_number ||
                                "Unknown"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end items-center gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md font-semibold transition-colors text-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(detailItem, detailType);
                }}
                className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold hover:bg-primarydull transition-all text-sm flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit{" "}
                {detailType === "cluster"
                  ? "Group"
                  : detailType === "vehicle-group"
                    ? "Group"
                    : "Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
