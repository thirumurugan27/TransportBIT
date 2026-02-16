import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import {showError, showConfirm, showSuccess} from "../../../utils/swal";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Clock,
  Calendar,
  Search,
  Check,
  X,
  Filter,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Helper to convert 24h time to 12h AM/PM format
const formatTimeAMPM = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

// Helper to convert DD-MM-YYYY to YYYY-MM-DD for input[type="date"]
const formatDateForInput = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export default function ScheduleManagement() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("groups"); // groups, shifts
  const [clusters, setClusters] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Search state for drivers selection
  const [driverSearch, setDriverSearch] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // 'cluster', 'shift'
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  const [shiftForm, setShiftForm] = useState({
    name: "",
    description: "",
    slots: [{start_time: "09:00", end_time: "17:00"}],
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? {Authorization: `Bearer ${token}`} : {};
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [c, s, d] = await Promise.all([
        fetch(`${API_BASE}/api/admin/clusters`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/shifts`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/drivers`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }).then((r) => r.json()),
      ]);
      setClusters(c || []);
      setShifts(s || []);
      setDrivers(d || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (endpoint, id) => {
    const isConfirmed = await showConfirm(
      "Are you sure?",
      "Do you really want to delete this item?",
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}${endpoint}?id=${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showSuccess("Success", "Deleted successfully");
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
      // Find drivers belonging to this group to pre-fill the form
      const currentDriverIds = drivers
        .filter((d) => d.cluster_id === item.id)
        .map((d) => d.id);

      setClusterForm({
        name: item.name,
        description: item.description || "",
        shift_id: item.default_shift_id || "",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        valid_from: formatDateForInput(item.valid_from) || "",
        valid_to: formatDateForInput(item.valid_to) || "",
        driver_ids: currentDriverIds,
      });
    } else {
      // Convert existing shift to slots format
      const existingSlots =
        item.slots && item.slots.length > 0
          ? item.slots.map((s) => ({
              start_time: s.start_time,
              end_time: s.end_time,
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
    const payload = isEditing
      ? {...clusterForm, id: editingId, force}
      : {...clusterForm, force};

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

    // Validate all slots have start and end time
    for (const slot of shiftForm.slots) {
      if (!slot.start_time || !slot.end_time) {
        showError("Error", "Please fill all time slots completely");
        return;
      }
    }

    const endpoint = isEditing
      ? "/api/admin/shifts/update"
      : "/api/admin/shifts/create";

    // Format payload for backend
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

  // Filter drivers for selection
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
    <div className="space-y-8 pb-12 font-sans text-primarytext animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primarytext">
            Schedule Management
          </h1>
          <p className="text-secondarytext mt-2 font-medium">
            Manage driver groups, shifts and schedules
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-secondarybg rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-1">
              Driver Groups
            </h4>
            <div className="text-3xl font-bold text-primarytext">
              {clusters.length}
            </div>
          </div>
          <div className="p-3 bg-primarybg rounded-md text-primary shadow-sm">
            <Users className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-1">
              Active Shifts
            </h4>
            <div className="text-3xl font-bold text-primarytext">
              {shifts.length}
            </div>
          </div>
          <div className="p-3 bg-primarybg rounded-md text-primary shadow-sm">
            <Clock className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-1">
              Assigned Drivers
            </h4>
            <div className="text-3xl font-bold text-primarytext">
              {drivers.filter((d) => d.cluster_id).length}
            </div>
          </div>
          <div className="p-3 bg-green/10 rounded-md text-green shadow-sm">
            <Check className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-1">
              Unassigned Drivers
            </h4>
            <div className="text-3xl font-bold text-primarytext">
              {drivers.filter((d) => !d.cluster_id).length}
            </div>
          </div>
          <div className="p-3 bg-primarybg rounded-md text-primary shadow-sm">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>
      {/* Tabs and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-200 pb-1">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("groups")}
            className={`pb-3 text-sm font-bold tracking-wide border-b-2 transition-colors ${
              activeTab === "groups"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Driver Groups
          </button>
          <button
            onClick={() => setActiveTab("shifts")}
            className={`pb-3 text-sm font-bold tracking-wide border-b-2 transition-colors ${
              activeTab === "shifts"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Shifts & Timings
          </button>
        </div>
        <div className="mb-2">
          <button
            onClick={() => {
              setModalType(activeTab === "groups" ? "cluster" : "shift");
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
              setShiftForm({
                name: "",
                description: "",
                slots: [{start_time: "09:00", end_time: "17:00"}],
              });
              setDriverSearch("");
              setShowOnlyUnassigned(false);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium flex items-center gap-2 text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create {activeTab === "groups" ? "Group" : "Shift"}
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden p-6 min-h-75">
        {loading ? (
          <Loading fullScreen={false} text="Loading data..." />
        ) : (
          <>
            {activeTab === "groups" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="bg-white rounded-md p-6 shadow-sm hover:shadow-md transition-shadow group relative border border-gray-100 flex flex-col h-full"
                  >
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(cluster, "cluster")}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete("/api/admin/clusters/delete", cluster.id)
                        }
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-primarytext">
                        {cluster.name}
                      </h3>
                      <p className="text-sm text-secondarytext mt-1 line-clamp-2 min-h-5">
                        {cluster.description || "No description provided."}
                      </p>
                    </div>

                    <div className="space-y-3 mt-auto">
                      <div className="flex items-center gap-3 text-sm text-secondarytext bg-gray-50 p-2 rounded-md">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium">
                          {cluster.driver_count || 0} Drivers
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-secondarytext bg-gray-50 p-2 rounded-md">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          {cluster.start_time && cluster.end_time
                            ? `${formatTimeAMPM(cluster.start_time)} - ${formatTimeAMPM(cluster.end_time)}`
                            : "No schedule"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-secondarytext bg-gray-50 p-2 rounded-md">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          {cluster.valid_from && cluster.valid_to
                            ? `${cluster.valid_from} to ${cluster.valid_to}`
                            : "Permanent"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {clusters.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-secondarytext bg-gray-50 rounded-md border border-dashed border-gray-200">
                    <Users className="w-12 h-12 mb-4 text-gray-300" />
                    <p className="text-lg font-medium">
                      No driver groups found
                    </p>
                    <p className="text-sm">
                      Create a group to organize your drivers and schedules.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "shifts" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-4 px-4 text-xs font-bold text-secondarytext uppercase tracking-widest bg-gray-50 rounded-tl-md">
                        Shift Name
                      </th>
                      <th className="py-4 px-4 text-xs font-bold text-secondarytext uppercase tracking-widest bg-gray-50">
                        Timing
                      </th>
                      <th className="py-4 px-4 text-xs font-bold text-secondarytext uppercase tracking-widest bg-gray-50">
                        Description
                      </th>
                      <th className="py-4 px-4 text-right text-xs font-bold text-secondarytext uppercase tracking-widest bg-gray-50 rounded-tr-md">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className="hover:bg-primarybg/30 transition-colors"
                      >
                        <td className="py-4 px-4 font-bold text-primarytext">
                          {shift.name}
                        </td>
                        <td className="py-4 px-4 text-sm text-secondarytext">
                          <div className="flex flex-wrap gap-1.5">
                            {shift.slots && shift.slots.length > 0 ? (
                              shift.slots.map((slot, idx) => (
                                <span
                                  key={idx}
                                  className="bg-white border border-gray-200 px-3 py-1 rounded-md text-xs font-medium text-primary shadow-sm"
                                >
                                  {formatTimeAMPM(slot.start_time)} -{" "}
                                  {formatTimeAMPM(slot.end_time)}
                                </span>
                              ))
                            ) : (
                              <span className="bg-white border border-gray-200 px-3 py-1 rounded-md text-xs font-medium text-primary shadow-sm">
                                {formatTimeAMPM(shift.start_time)} -{" "}
                                {formatTimeAMPM(shift.end_time)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-secondarytext">
                          {shift.description || "-"}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(shift, "shift")}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(
                                  "/api/admin/shifts/delete",
                                  shift.id,
                                )
                              }
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {shifts.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="py-16 text-center text-secondarytext italic bg-gray-50 rounded-b-md"
                        >
                          <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                          No shifts created yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-primarytext">
                  {isEditing ? "Edit" : "Create"}{" "}
                  {modalType === "cluster" ? "Driver Group" : "Shift"}
                </h3>
                <p className="text-xs text-secondarytext mt-0.5">
                  {modalType === "cluster"
                    ? "Configure group details and assign drivers"
                    : "Set up timing and description"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {modalType === "cluster" ? (
                <div className="space-y-6">
                  {/* Basic Info Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-primary border-b border-gray-100 pb-2 mb-4">
                      Group Details
                    </h4>
                    <div>
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                        Group Name
                      </label>
                      <input
                        className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                        placeholder="e.g. Morning Batch A"
                        value={clusterForm.name}
                        onChange={(e) =>
                          setClusterForm({...clusterForm, name: e.target.value})
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                          Description (Optional)
                        </label>
                        <textarea
                          className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                          placeholder="Details about this group..."
                          rows="4"
                          value={clusterForm.description}
                          onChange={(e) =>
                            setClusterForm({
                              ...clusterForm,
                              description: e.target.value,
                            })
                          }
                        ></textarea>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                            Select Shift
                          </label>
                          <SearchableSelect
                            value={clusterForm.shift_id}
                            onChange={(val) => {
                              const selectedShift = shifts.find(
                                (s) => s.id === parseInt(val),
                              );
                              if (selectedShift) {
                                setClusterForm({
                                  ...clusterForm,
                                  shift_id: val,
                                  start_time: selectedShift.start_time || "",
                                  end_time: selectedShift.end_time || "",
                                });
                              } else {
                                setClusterForm({
                                  ...clusterForm,
                                  shift_id: "",
                                  start_time: "",
                                  end_time: "",
                                });
                              }
                            }}
                            placeholder="Select a shift..."
                            options={shifts.map((shift) => {
                              const hasSlots =
                                shift.slots && shift.slots.length > 0;
                              const timeDisplay = hasSlots
                                ? shift.slots
                                    .map(
                                      (slot) =>
                                        `${formatTimeAMPM(slot.start_time)} - ${formatTimeAMPM(slot.end_time)}`,
                                    )
                                    .join(", ")
                                : `${formatTimeAMPM(shift.start_time)} - ${formatTimeAMPM(shift.end_time)}`;
                              return {
                                value: shift.id,
                                label: shift.name,
                                subtitle: timeDisplay,
                              };
                            })}
                            emptyMessage="No shifts available"
                          />
                        </div>
                        {clusterForm.shift_id &&
                          (() => {
                            const selectedShift = shifts.find(
                              (s) => s.id === parseInt(clusterForm.shift_id),
                            );
                            const hasSlots =
                              selectedShift?.slots &&
                              selectedShift.slots.length > 0;
                            const slotsToDisplay = hasSlots
                              ? selectedShift.slots
                              : [
                                  {
                                    start_time: selectedShift?.start_time,
                                    end_time: selectedShift?.end_time,
                                  },
                                ];

                            return (
                              <div>
                                <label className="block text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1">
                                  Shift Timings
                                </label>
                                <div className="space-y-2">
                                  {slotsToDisplay.map((slot, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm"
                                    >
                                      <Clock className="w-4 h-4 text-primary" />
                                      <span className="font-medium">
                                        {formatTimeAMPM(slot.start_time)} -{" "}
                                        {formatTimeAMPM(slot.end_time)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1">
                              Valid From
                            </label>
                            <input
                              type="date"
                              className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
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
                            <label className="block text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1">
                              Valid To
                            </label>
                            <input
                              type="date"
                              className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
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
                      </div>
                    </div>
                  </div>

                  {/* Driver Selection Section */}
                  <div>
                    <h4 className="flex justify-between items-center text-sm font-bold text-primary border-b border-gray-100 pb-2 mb-4 mt-6">
                      <span>Select Drivers</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                        {clusterForm.driver_ids.length} Selected
                      </span>
                    </h4>

                    <div className="bg-gray-50 rounded-md border border-gray-200 p-3">
                      {/* Search and Filter */}
                      <div className="flex gap-3 mb-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search drivers..."
                            className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                          />
                        </div>
                        <button
                          onClick={() =>
                            setShowOnlyUnassigned(!showOnlyUnassigned)
                          }
                          className={`px-3 py-2 rounded-md border text-xs font-medium flex items-center gap-2 transition-colors ${
                            showOnlyUnassigned
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-secondarytext border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          Unassigned Only
                        </button>
                      </div>

                      {/* Driver List */}
                      <div className="h-60 overflow-y-auto pr-1 custom-scrollbar space-y-2">
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
                                    ? "bg-white border-primary shadow-sm ring-1 ring-primary/50"
                                    : "bg-white border-gray-100 hover:border-gray-300"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
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
                                    <p
                                      className={`text-sm font-medium ${
                                        isSelected
                                          ? "text-primarytext"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      {driver.full_name || driver.name}
                                    </p>
                                    <p className="text-xs text-secondarytext">
                                      {driver.cluster_id
                                        ? `Assigned to ${driver.cluster_name}`
                                        : "Available"}
                                    </p>
                                  </div>
                                </div>

                                {driver.cluster_id && !isSelected && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-sm">
                                    Assigned
                                  </span>
                                )}
                              </label>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-secondarytext text-sm">
                            No drivers match your search.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Shift Form with Multiple Time Slots
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                      Shift Name
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                      placeholder="e.g. General Shift"
                      value={shiftForm.name}
                      onChange={(e) =>
                        setShiftForm({...shiftForm, name: e.target.value})
                      }
                    />
                  </div>

                  {/* Time Slots Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs font-bold text-secondarytext uppercase tracking-widest">
                        Time Slots
                      </label>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
                        {shiftForm.slots.length} slot
                        {shiftForm.slots.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {shiftForm.slots.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 bg-gray-50 p-3 rounded-md border border-gray-200"
                        >
                          <span className="text-xs font-bold text-secondarytext w-6">
                            #{index + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                                value={slot.start_time}
                                onChange={(e) => {
                                  const newSlots = [...shiftForm.slots];
                                  newSlots[index].start_time = e.target.value;
                                  setShiftForm({...shiftForm, slots: newSlots});
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-secondarytext uppercase mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
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
                              className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
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
                      className="mt-3 w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-secondarytext hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Time Slot
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                      Description
                    </label>
                    <textarea
                      className="w-full px-4 py-2.5 rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
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
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-md font-medium hover:bg-gray-50 transition-colors text-sm shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={
                  modalType === "cluster"
                    ? () => handleCreateOrUpdateCluster()
                    : handleCreateOrUpdateShift
                }
                className="px-4 py-2.5 bg-primary text-white rounded-md font-bold hover:bg-primarydull transition-all shadow-md hover:shadow-lg text-sm"
              >
                {isEditing ? "Update Details" : "Create Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
