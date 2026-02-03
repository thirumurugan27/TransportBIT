import React, {useEffect, useState} from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Users,
  Clock,
  Loader2,
  X,
  Search,
  Filter,
  Check,
} from "lucide-react";
import {showError, showSuccess, showConfirm} from "../../../utils/swal";
import {getAuthHeaders} from "../../../utils/auth";

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
      setClusterForm({
        name: item.name,
        description: item.description || "",
        shift_id: item.shift_id || "",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        valid_from: item.valid_from ? formatDateForInput(item.valid_from) : "",
        valid_to: item.valid_to ? formatDateForInput(item.valid_to) : "",
        driver_ids: item.driver_ids || [],
      });
    } else if (type === "vehicle-group") {
      setVehicleGroupForm({
        name: item.name,
        description: item.description || "",
        vehicle_ids: item.vehicle_ids || [],
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

  const handleCreateOrUpdateCluster = async () => {
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
      } else {
        showError("Error", "Failed: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Error processing group");
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

      if (vehicleGroupForm.vehicle_ids.length > 0) {
        const assignRes = await fetch(
          `${API_BASE}/api/admin/vehicle-groups/${groupId}/assign-vehicles`,
          {
            method: "POST",
            credentials: "include",
            headers: {"Content-Type": "application/json", ...getAuthHeaders()},
            body: JSON.stringify({
              vehicle_ids: vehicleGroupForm.vehicle_ids,
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
      isEditing && driver.cluster_id === editingId;
    const matchesUnassigned = showOnlyUnassigned
      ? !driver.cluster_id || isCurrentlyAssignedToThisGroup
      : true;
    return matchesSearch && matchesUnassigned;
  });

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
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4">
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
                {clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-md transition-all group border border-gray-100 relative"
                  >
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(cluster, "cluster")}
                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete("/api/admin/clusters/delete", cluster.id)
                        }
                        className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-primarytext mb-1">
                        {cluster.name}
                      </h3>
                      <p className="text-sm text-secondarytext line-clamp-2 min-h-10">
                        {cluster.description || "No description provided"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-3 py-2 rounded-md">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-primarytext">
                          {cluster.driver_count || 0} Drivers
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-3 py-2 rounded-md">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-secondarytext">
                          {cluster.valid_from && cluster.valid_to
                            ? `${cluster.valid_from} to ${cluster.valid_to}`
                            : "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {clusters.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <Users className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      No driver groups found
                    </p>
                    <p className="text-sm text-secondarytext">
                      Create a group to organize your drivers and schedules
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Vehicle Groups Tab */}
            {activeTab === "vehicle-groups" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {vehicleGroups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-md transition-all group border border-gray-100 relative"
                  >
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(group, "vehicle-group")}
                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
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
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-primarytext mb-1">
                        {group.name}
                      </h3>
                      <p className="text-sm text-secondarytext line-clamp-2 min-h-10">
                        {group.description || "No description provided"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-3 py-2 rounded-md">
                        <Users className="w-4 h-4 text-pending shrink-0" />
                        <span className="font-semibold text-primarytext">
                          {group.vehicle_count || 0} EV Vehicles
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm bg-primarybg px-3 py-2 rounded-md">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-secondarytext">
                          {group.valid_from && group.valid_to
                            ? `${group.valid_from} to ${group.valid_to}`
                            : "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {vehicleGroups.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <Users className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      No vehicle groups found
                    </p>
                    <p className="text-sm text-secondarytext">
                      Create a group to organize your EV vehicles
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Shifts Tab */}
            {activeTab === "shifts" && (
              <div className="space-y-3">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-white rounded-md p-5 shadow-sm hover:shadow-md transition-all border border-gray-100 group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-primarytext mb-2">
                          {shift.name}
                        </h3>
                        <p className="text-sm text-secondarytext mb-3">
                          {shift.description || "No description"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {shift.slots && shift.slots.length > 0 ? (
                            shift.slots.map((slot, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-md text-sm font-semibold border border-primary/20"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                {formatTimeAMPM(slot.start_time)} -{" "}
                                {formatTimeAMPM(slot.end_time)}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-md text-sm font-semibold border border-primary/20">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimeAMPM(shift.start_time)} -{" "}
                              {formatTimeAMPM(shift.end_time)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(shift, "shift")}
                          className="p-2.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete("/api/admin/shifts/delete", shift.id)
                          }
                          className="p-2.5 text-red hover:bg-red/10 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {shifts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-primarybg rounded-md border-2 border-dashed border-gray-200">
                    <Clock className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-bold text-secondarytext mb-1">
                      No shifts created yet
                    </p>
                    <p className="text-sm text-secondarytext">
                      Create a shift to manage driver timings
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
          <div className="bg-white rounded-md shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-primarybg flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-primarytext">
                  {isEditing ? "Edit" : "Create"}{" "}
                  {modalType === "cluster"
                    ? "Driver Group"
                    : modalType === "vehicle-group"
                      ? "Vehicle Group"
                      : "Shift"}
                </h3>
                <p className="text-xs text-secondarytext mt-1">
                  {modalType === "cluster"
                    ? "Configure group details and assign drivers"
                    : modalType === "vehicle-group"
                      ? "Configure group details and assign EV vehicles"
                      : "Set up shift timings and description"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {modalType === "cluster" ? (
                // Driver Group Form
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Group Name *
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="e.g. Morning Batch A"
                      value={clusterForm.name}
                      onChange={(e) =>
                        setClusterForm({...clusterForm, name: e.target.value})
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      placeholder="Details about this group..."
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
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                        Valid From
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
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
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                        Valid To
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
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
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                        Assign Drivers
                      </label>
                      <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-md font-bold">
                        {clusterForm.driver_ids.length} Selected
                      </span>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex gap-3 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search drivers..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                          value={driverSearch}
                          onChange={(e) => setDriverSearch(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={() =>
                          setShowOnlyUnassigned(!showOnlyUnassigned)
                        }
                        className={`px-4 py-2.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${
                          showOnlyUnassigned
                            ? "bg-primary text-white"
                            : "bg-primarybg text-secondarytext hover:bg-gray-200"
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        Unassigned
                      </button>
                    </div>

                    {/* Driver List */}
                    <div className="h-64 overflow-y-auto space-y-2 bg-primarybg rounded-md p-3 border border-gray-100">
                      {filteredDrivers.length > 0 ? (
                        filteredDrivers.map((driver) => {
                          const isSelected = clusterForm.driver_ids.includes(
                            driver.id,
                          );
                          return (
                            <label
                              key={driver.id}
                              className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-all border ${
                                isSelected
                                  ? "bg-primary/10 border-primary shadow-sm"
                                  : "bg-white border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "bg-white border-gray-300"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setClusterForm((prev) => ({
                                          ...prev,
                                          driver_ids: [
                                            ...prev.driver_ids,
                                            driver.id,
                                          ],
                                        }));
                                      } else {
                                        setClusterForm((prev) => ({
                                          ...prev,
                                          driver_ids: prev.driver_ids.filter(
                                            (id) => id !== driver.id,
                                          ),
                                        }));
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-primarytext">
                                    {driver.full_name || driver.name}
                                  </p>
                                  <p className="text-xs text-secondarytext">
                                    {driver.cluster_id
                                      ? `Assigned to ${driver.cluster_name || "a group"}`
                                      : "Available"}
                                  </p>
                                </div>
                              </div>
                              {driver.cluster_id && !isSelected && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                                  Assigned
                                </span>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 text-secondarytext text-sm">
                          No drivers match your search
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : modalType === "vehicle-group" ? (
                // Vehicle Group Form
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Group Name *
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
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
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Description
                    </label>
                    <textarea
                      rows="3"
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      placeholder="Details about this group..."
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
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                        Valid From
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
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
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                        Valid To
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
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
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                        Assign Vehicles
                      </label>
                      <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-md font-bold">
                        {vehicleGroupForm.vehicle_ids.length} Selected
                      </span>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex gap-3 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search vehicles..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={() =>
                          setShowOnlyUnassignedVehicles(
                            !showOnlyUnassignedVehicles,
                          )
                        }
                        className={`px-4 py-2.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${
                          showOnlyUnassignedVehicles
                            ? "bg-primary text-white"
                            : "bg-primarybg text-secondarytext hover:bg-gray-200"
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        Unassigned
                      </button>
                    </div>

                    {/* Vehicle List */}
                    <div className="h-64 overflow-y-auto space-y-2 bg-primarybg rounded-md p-3 border border-gray-100">
                      {vehicles
                        .filter((vehicle) => {
                          const matchesSearch =
                            vehicle.vehicle_number
                              .toLowerCase()
                              .includes(vehicleSearch.toLowerCase()) ||
                            (vehicle.registration_number &&
                              vehicle.registration_number
                                .toLowerCase()
                                .includes(vehicleSearch.toLowerCase()));
                          const matchesFilter =
                            !showOnlyUnassignedVehicles || !vehicle.group_id;
                          return matchesSearch && matchesFilter;
                        })
                        .map((vehicle) => {
                          const isSelected =
                            vehicleGroupForm.vehicle_ids.includes(vehicle.id);
                          return (
                            <label
                              key={vehicle.id}
                              className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-all border ${
                                isSelected
                                  ? "bg-primary/10 border-primary shadow-sm"
                                  : "bg-white border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "bg-white border-gray-300"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setVehicleGroupForm({
                                        ...vehicleGroupForm,
                                        vehicle_ids: checked
                                          ? [
                                              ...vehicleGroupForm.vehicle_ids,
                                              vehicle.id,
                                            ]
                                          : vehicleGroupForm.vehicle_ids.filter(
                                              (id) => id !== vehicle.id,
                                            ),
                                      });
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-primarytext">
                                    {vehicle.vehicle_number}
                                  </p>
                                  <p className="text-xs text-secondarytext">
                                    {vehicle.registration_number ||
                                      "No registration"}
                                  </p>
                                </div>
                              </div>
                              {vehicle.group_id && !isSelected && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                                  Assigned
                                </span>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                // Shift Form
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Shift Name *
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="e.g. General Shift"
                      value={shiftForm.name}
                      onChange={(e) =>
                        setShiftForm({...shiftForm, name: e.target.value})
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wide mb-2">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-primarybg focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                      rows="3"
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
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide">
                        Time Slots
                      </label>
                      <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-md font-bold">
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
                          <span className="text-xs font-bold text-secondarytext bg-white px-2 py-1 rounded-md">
                            #{index + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-secondarytext uppercase mb-1.5">
                                Start Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                                value={slot.start_time}
                                onChange={(e) => {
                                  const newSlots = [...shiftForm.slots];
                                  newSlots[index].start_time = e.target.value;
                                  setShiftForm({...shiftForm, slots: newSlots});
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-secondarytext uppercase mb-1.5">
                                End Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
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
                      className="mt-3 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md text-sm font-bold text-secondarytext hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Time Slot
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-primarybg border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-white text-secondarytext border border-gray-200 rounded-md font-semibold hover:bg-gray-50 transition-colors text-sm shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={
                  modalType === "cluster"
                    ? handleCreateOrUpdateCluster
                    : modalType === "vehicle-group"
                      ? handleCreateOrUpdateVehicleGroup
                      : handleCreateOrUpdateShift
                }
                className="px-5 py-2.5 bg-primary text-white rounded-md font-bold hover:bg-primarydull transition-all shadow-md hover:shadow-lg text-sm"
              >
                {isEditing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
