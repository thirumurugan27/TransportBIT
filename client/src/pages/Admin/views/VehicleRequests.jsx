import React, {useState, useEffect} from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Eye,
  X,
  MapPin,
  Calendar,
  User,
  FileText,
  Search,
  Info,
  Navigation,
  AlertTriangle,
  Play,
  Phone,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import Swal from "sweetalert2";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import CustomSearch from "../../../components/ui/CustomSearch";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableSelect from "../../../components/ui/SearchableSelect";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const STATUS_CONFIG = {
  pending: {
    color: "bg-pending/10 text-pending border-pending/20",
    icon: Clock,
    label: "Pending",
    themeColor: "amber",
  },
  approved: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: CheckCircle,
    label: "Approved",
    themeColor: "purple",
  },
  rejected: {
    color: "bg-red/10 text-red border-red/20",
    icon: XCircle,
    label: "Rejected",
    themeColor: "red",
  },
  assigned: {
    color: "bg-green/10 text-green border-green/20",
    icon: Truck,
    label: "Assigned",
    themeColor: "green",
  },
  trip_started: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Truck,
    label: "Trip Started",
    themeColor: "blue",
  },
  completed: {
    color: "bg-green/10 text-green border-green/20",
    icon: CheckCircle,
    label: "Completed",
    themeColor: "green",
  },
  cancelled: {
    color: "bg-primarybg text-secondarytext border-primarybg",
    icon: XCircle,
    label: "Cancelled",
    themeColor: "gray",
  },
};

const REQUEST_UNDER_OPTIONS = [
  {value: "academic_department", label: "Academic Department"},
  {value: "students_training", label: "Students Training"},
  {value: "supporting_department", label: "Supporting Department"},
];

const getRequestUnderLabel = (value) => {
  const found = REQUEST_UNDER_OPTIONS.find((r) => r.value === value);
  return found ? found.label : value || "-";
};

export default function VehicleRequests() {
  const {showToast} = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Detail modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRequest, setAssignRequest] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assignForm, setAssignForm] = useState({vehicle_id: 0, driver_id: 0});
  const [assigning, setAssigning] = useState(false);

  // Approve/Reject modal
  const [actionModal, setActionModal] = useState(null); // {type: 'approve'|'reject', request}
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [approveWithAssign, setApproveWithAssign] = useState(false);
  const [approveForm, setApproveForm] = useState({vehicle_id: 0, driver_id: 0});

  // Conflict modal state
  const [conflictModal, setConflictModal] = useState(null);
  const [conflictPendingAction, setConflictPendingAction] = useState(null); // { type: 'approve'|'assign', payload }

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicle-requests`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setRequests((await res.json()) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicle-request/${id}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSelectedRequest(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchVehiclesAndDrivers = async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/vehicles`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/admin/drivers`, {
          credentials: "include",
          headers: getAuthHeaders(),
        }),
      ]);
      if (vRes.ok) setVehicles((await vRes.json()) || []);
      if (dRes.ok) setDrivers((await dRes.json()) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;

    // If approving with assignment, validate vehicle and driver selection
    if (actionModal.type === "approve" && approveWithAssign) {
      if (!approveForm.vehicle_id || !approveForm.driver_id) {
        showToast("Please select both vehicle and driver", "warning");
        return;
      }
    }

    setActionSubmitting(true);
    const endpoint =
      actionModal.type === "approve"
        ? "/api/admin/vehicle-request/approve"
        : "/api/admin/vehicle-request/reject";
    try {
      const body = {
        request_id: actionModal.request.id,
        admin_remarks: actionRemarks,
      };

      // Include vehicle and driver if approving with assignment
      if (actionModal.type === "approve" && approveWithAssign) {
        body.vehicle_id = approveForm.vehicle_id;
        body.driver_id = approveForm.driver_id;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(
          actionModal.type === "approve"
            ? approveWithAssign
              ? "Request approved and vehicle assigned"
              : "Request approved"
            : "Request rejected",
          "success",
        );
        setActionModal(null);
        setActionRemarks("");
        setApproveWithAssign(false);
        setApproveForm({vehicle_id: 0, driver_id: 0});
        setSelectedRequest(null);
        fetchRequests();
      } else if (res.status === 409) {
        const data = await res.json();
        if (
          data.error === "driver_conflict" ||
          data.error === "vehicle_conflict"
        ) {
          setConflictPendingAction({
            type: "approve",
            payload: body,
          });
          setConflictModal({
            message:
              data.message ||
              "Driver is already assigned during this time range",
            conflicts: data.conflicts || [],
            available_drivers: data.available_drivers || [],
            conflict_type: data.error,
          });
        } else {
          showToast(data.message || "Conflict detected", "error");
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Action failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  const openAssignModal = (req) => {
    setAssignRequest(req);
    setAssignForm({vehicle_id: 0, driver_id: 0});
    setShowAssignModal(true);
    fetchVehiclesAndDrivers();
  };

  const handleAssign = async () => {
    if (!assignForm.vehicle_id || !assignForm.driver_id) {
      showToast("Select both vehicle and driver", "warning");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicle-request/assign`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify({
          request_id: assignRequest.id,
          vehicle_id: assignForm.vehicle_id,
          driver_id: assignForm.driver_id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Vehicle and driver assigned!", "success");
        setShowAssignModal(false);
        setSelectedRequest(null);
        fetchRequests();
      } else if (res.status === 409) {
        if (
          data.error === "driver_conflict" ||
          data.error === "vehicle_conflict"
        ) {
          setConflictPendingAction({
            type: "assign",
            payload: {
              request_id: assignRequest.id,
              vehicle_id: assignForm.vehicle_id,
              driver_id: assignForm.driver_id,
            },
          });
          setConflictModal({
            message:
              data.message ||
              "Driver is already assigned during this time range",
            conflicts: data.conflicts || [],
            available_drivers: data.available_drivers || [],
            conflict_type: data.error,
          });
        } else {
          showToast(data.message || "Conflict detected", "error");
        }
      } else {
        showToast(data.error || "Assignment failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleComplete = async (requestId) => {
    const confirmed = await showConfirm(
      "Mark Completed?",
      "This will mark the trip as completed.",
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vehicle-request/complete`,
        {
          method: "POST",
          credentials: "include",
          headers: {"Content-Type": "application/json", ...getAuthHeaders()},
          body: JSON.stringify({request_id: requestId}),
        },
      );
      if (res.ok) {
        showToast("Marked as completed", "success");
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  const handleCancel = async (requestId) => {
    const {isConfirmed, value: reason} = await Swal.fire({
      title: "Cancel Request?",
      text: "This will cancel the vehicle request and notify the driver & faculty. This action cannot be undone.",
      icon: "warning",
      input: "textarea",
      inputLabel: "Reason for cancellation",
      inputPlaceholder: "Enter reason...",
      inputAttributes: {"aria-label": "Reason for cancellation"},
      showCancelButton: true,
      confirmButtonColor: "#7D53F6",
      cancelButtonColor: "#FF5555",
      confirmButtonText: "Yes, Cancel",
      cancelButtonText: "No",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicle-request/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify({
          request_id: requestId,
          admin_remarks: reason || "Cancelled by admin",
        }),
      });
      if (res.ok) {
        showToast("Request cancelled and notifications sent", "success");
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  // Format time to AM/PM
  const formatTimeAMPM = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  // Force assign after conflict warning
  const handleForceAssign = async () => {
    if (!conflictPendingAction) return;
    const {type, payload} = conflictPendingAction;
    const endpoint =
      type === "approve"
        ? "/api/admin/vehicle-request/approve"
        : "/api/admin/vehicle-request/assign";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify({...payload, force_assign: true}),
      });

      if (res.ok) {
        showToast(
          type === "approve"
            ? "Request approved and vehicle assigned (forced)"
            : "Vehicle and driver assigned (forced)",
          "success",
        );
        setConflictModal(null);
        setConflictPendingAction(null);
        setShowAssignModal(false);
        setActionModal(null);
        setActionRemarks("");
        setApproveWithAssign(false);
        setApproveForm({vehicle_id: 0, driver_id: 0});
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to force assign", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  // Select alternate driver from conflict modal
  const handleSelectAlternateDriver = async (newDriverId) => {
    if (!conflictPendingAction) return;
    const {type, payload} = conflictPendingAction;
    const endpoint =
      type === "approve"
        ? "/api/admin/vehicle-request/approve"
        : "/api/admin/vehicle-request/assign";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json", ...getAuthHeaders()},
        body: JSON.stringify({...payload, driver_id: newDriverId}),
      });

      if (res.ok) {
        showToast(
          type === "approve"
            ? "Request approved and vehicle assigned with alternate driver"
            : "Vehicle assigned with alternate driver",
          "success",
        );
        setConflictModal(null);
        setConflictPendingAction(null);
        setShowAssignModal(false);
        setActionModal(null);
        setActionRemarks("");
        setApproveWithAssign(false);
        setApproveForm({vehicle_id: 0, driver_id: 0});
        setSelectedRequest(null);
        fetchRequests();
      } else if (res.status === 409) {
        const data = await res.json();
        if (
          data.error === "driver_conflict" ||
          data.error === "vehicle_conflict"
        ) {
          setConflictPendingAction({
            type,
            payload: {...payload, driver_id: newDriverId},
          });
          setConflictModal({
            message: data.message || "This driver also has conflicts",
            conflicts: data.conflicts || [],
            available_drivers: data.available_drivers || [],
            conflict_type: data.error,
          });
        } else {
          showToast(data.message || "Conflict detected", "error");
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to assign", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    }
  };

  // Filtering
  const filtered = requests.filter((r) => {
    const matchesStatus = !filterStatus || r.status === filterStatus;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      r.faculty_name?.toLowerCase().includes(query) ||
      r.faculty_department?.toLowerCase().includes(query) ||
      r.purpose?.toLowerCase().includes(query) ||
      String(r.id).includes(query);
    return matchesStatus && matchesSearch;
  });

  // Stat counts
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const ongoingCount = requests.filter((r) =>
    ["assigned", "trip_started"].includes(r.status),
  ).length;
  const completedCount = requests.filter(
    (r) => r.status === "completed",
  ).length;

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-secondarytext text-xl font-normal">
        Vehicle Requests
      </h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending */}
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 rounded-md bg-amber-50 text-amber-500 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-secondarytext font-medium mb-0.5">
              Pending
            </p>
            <p className="text-2xl font-bold text-primarytext leading-none">
              {pendingCount}
            </p>
          </div>
        </div>
        {/* Approved */}
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 rounded-md bg-purple-50 text-purple-500 shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-secondarytext font-medium mb-0.5">
              Approved
            </p>
            <p className="text-2xl font-bold text-primarytext leading-none">
              {approvedCount}
            </p>
          </div>
        </div>
        {/* Ongoing */}
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 rounded-md bg-blue-50 text-blue-500 shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-xs text-secondarytext font-medium mb-0.5">
              Ongoing
            </p>
            <p className="text-2xl font-bold text-primarytext leading-none">
              {ongoingCount}
            </p>
          </div>
        </div>
        {/* Completed */}
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 rounded-md bg-green-50 text-green-500 shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-secondarytext font-medium mb-0.5">
              Completed
            </p>
            <p className="text-2xl font-bold text-primarytext leading-none">
              {completedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <CustomSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, department, purpose, or ID..."
          className="flex-1"
        />
        <CustomDropdown
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            {value: "", label: "All Statuses"},
            ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
              value: key,
              label: cfg.label,
            })),
          ]}
          placeholder="All Statuses"
          width="w-full sm:w-48"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-secondarybg rounded-md border border-primarybg p-12 text-center">
          <FileText size={40} className="mx-auto text-secondarytext/30 mb-3" />
          <p className="text-secondarytext font-medium">
            No vehicle requests found
          </p>
        </div>
      ) : (
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primarybg/50 border-b border-primarybg">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    Faculty Details
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    Purpose
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    Journey Details
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    Assignment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primarybg">
                {filtered.map((req, idx) => {
                  const cfg =
                    STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const departureDateTime = req.onward_from_datetime;
                  const routeDisplay = req.trips?.length > 1
                    ? [req.trips[0].departure_location, ...req.trips.map(t => t.arrival_location)].join(' → ')
                    : req.trips?.length === 1
                      ? `${req.trips[0].departure_location}${req.trips[0].arrival_location ? ` → ${req.trips[0].arrival_location}` : ''}`
                      : req.onward_from_place
                        ? `${req.onward_from_place}${req.onward_to_place ? ` → ${req.onward_to_place}` : ''}`
                        : null;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => fetchRequestDetail(req.id)}
                      className="hover:bg-primarybg/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-primarytext leading-tight">
                          {req.faculty_name}
                        </p>
                        <p className="text-[11px] text-secondarytext mt-0.5">
                          {req.faculty_department}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-secondarytext text-xs line-clamp-1 max-w-[200px]">
                          {req.purpose}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-bold text-primarytext">
                            {routeDisplay || "-"}
                          </p>
                          <p className="text-[10px] text-secondarytext font-mono">
                            {departureDateTime || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${cfg.color}`}
                        >
                          <StatusIcon size={12} strokeWidth={2.5} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {req.vehicle_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                              <Truck size={14} />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-primarytext">
                                {req.vehicle_number}
                              </p>
                              <p className="text-[10px] text-secondarytext">
                                {req.driver_name}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-secondarytext uppercase tracking-widest opacity-40 italic">
                            Not Assigned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== DETAIL MODAL ========== */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60  flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="p-6 border-b border-primarybg/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-md flex items-center justify-center text-secondarybg shadow-lg ${STATUS_CONFIG[selectedRequest.status]?.themeColor === "green" ? "bg-green" : STATUS_CONFIG[selectedRequest.status]?.themeColor === "red" ? "bg-red" : STATUS_CONFIG[selectedRequest.status]?.themeColor === "amber" ? "bg-pending" : "bg-primary"}`}
                  >
                    {React.createElement(
                      STATUS_CONFIG[selectedRequest.status]?.icon || Truck,
                      {size: 28, strokeWidth: 2.5},
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      Request Details
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_CONFIG[selectedRequest.status]?.color}`}
                      >
                        {STATUS_CONFIG[selectedRequest.status]?.label}
                      </span>
                      <p className="text-sm text-secondarytext font-medium">
                        {selectedRequest.faculty_name} ·{" "}
                        {selectedRequest.faculty_department}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="p-12">
                <Loading fullScreen={false} size="small" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Trip Timeline & Location Section */}
                <div className="bg-primarybg rounded-md p-4">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Navigation size={14} /> Journey Details
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedRequest.trips?.length ? (
                      selectedRequest.trips.map((trip, idx) => (
                        <div
                          key={idx}
                          className="bg-secondarybg p-4 rounded-md border border-primarybg/50 relative"
                        >
                          <div className="absolute top-3 right-3 px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold rounded uppercase">
                            Leg {trip.trip_order}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                                Departure
                              </p>
                              <p className="text-sm font-bold text-primarytext">
                                {trip.departure_location}
                              </p>
                              <p className="text-[11px] text-secondarytext font-mono">
                                {trip.departure_date}{" "}
                                {trip.departure_time &&
                                  `· ${trip.departure_time}`}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                                Arrival
                              </p>
                              <p className="text-sm font-bold text-primarytext">
                                {trip.arrival_location}
                              </p>
                              <p className="text-[11px] text-secondarytext font-mono">
                                {trip.arrival_date}{" "}
                                {trip.arrival_time && `· ${trip.arrival_time}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-secondarybg p-4 rounded-md border border-primarybg/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                              From
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {selectedRequest.onward_from_place}
                            </p>
                            <p className="text-[11px] text-secondarytext font-mono">
                              {selectedRequest.onward_from_datetime}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                              To
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {selectedRequest.onward_to_place}
                            </p>
                            <p className="text-[11px] text-secondarytext font-mono">
                              {selectedRequest.onward_to_datetime}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Faculty & Booking Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-3 flex items-center gap-2">
                      <User size={14} /> Requester Details
                    </h4>
                    <div className="bg-secondarybg border border-primarybg/50 rounded-md p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                          Name & Dept
                        </p>
                        <p className="text-sm font-bold text-primarytext">
                          {selectedRequest.faculty_name}
                        </p>
                        <p className="text-xs font-medium text-secondarytext">
                          {selectedRequest.faculty_department}
                        </p>
                      </div>
                      <div className="flex gap-4 pt-2 border-t border-primarybg">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                            Email
                          </p>
                          <p className="text-xs font-bold text-primarytext">
                            {selectedRequest.faculty_email}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">
                            Phone
                          </p>
                          <p className="text-xs font-bold text-primary">
                            {selectedRequest.faculty_phone}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Info size={14} /> Booking Metadata
                    </h4>
                    <div className="bg-secondarybg border border-primarybg/50 rounded-md p-4 space-y-2">
                      <div className="flex justify-between items-center py-1 group/md">
                        <span className="text-xs font-medium text-secondarytext">
                          Trip Type
                        </span>
                        <span className="text-xs font-bold text-primarytext uppercase tracking-tighter">
                          {selectedRequest.trip_type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">
                          Trip Mode
                        </span>
                        <span className="text-xs font-bold text-primarytext uppercase tracking-tighter">
                          {selectedRequest.trip_mode || "Official"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">
                          Passengers
                        </span>
                        <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-full">
                          {selectedRequest.count_person || 1} Persons
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">
                          Vertical
                        </span>
                        <span className="text-xs font-bold text-primarytext">
                          {selectedRequest.vertical || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Travelling Persons Contact Details */}
                {(selectedRequest.traveller_name ||
                  selectedRequest.traveller_mobile ||
                  selectedRequest.traveller_address) && (
                  <div className="bg-teal-50 rounded-md p-4 border border-teal-200">
                    <h4 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <User size={14} /> Travelling Persons Contact Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedRequest.traveller_name && (
                        <div className="bg-white rounded-md p-3 border border-teal-100">
                          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1">
                            Name
                          </p>
                          <p className="text-sm font-bold text-primarytext">
                            {selectedRequest.traveller_name}
                          </p>
                        </div>
                      )}
                      {selectedRequest.traveller_mobile && (
                        <div className="bg-white rounded-md p-3 border border-teal-100">
                          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1">
                            Mobile Number
                          </p>
                          <p className="text-sm font-bold text-primary">
                            {selectedRequest.traveller_mobile}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedRequest.traveller_address && (
                      <div className="bg-white rounded-md p-3 border border-teal-100 mt-4">
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1">
                          Address
                        </p>
                        <p className="text-sm font-medium text-primarytext">
                          {selectedRequest.traveller_address}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Purpose & Admin Remarks Section */}
                <div className="bg-primarybg rounded-md p-4">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={14} /> Purpose & Remarks
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-secondarybg border border-primarybg/50 rounded-md p-4">
                      <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-2">
                        Detailed Purpose
                      </p>
                      <p className="text-sm font-medium text-primarytext leading-relaxed bg-primarybg/20 p-3 rounded italic">
                        "{selectedRequest.purpose}"
                      </p>
                    </div>
                    {selectedRequest.admin_remarks && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                          Admin Remarks
                        </p>
                        <p className="text-sm text-amber-800 font-medium italic">
                          {selectedRequest.admin_remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment & OTP Info Section */}
                {(selectedRequest.vehicle_name ||
                  selectedRequest.status === "assigned" ||
                  selectedRequest.status === "trip_started") && (
                  <div className="bg-primarybg rounded-md p-4 border border-dashed border-primary">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Truck size={14} /> Assignment & Status Tracking
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedRequest.vehicle_name && (
                        <div className="bg-secondarybg p-3 rounded-md border border-primarybg flex items-center gap-4">
                          <div className="w-10 h-10 rounded-md bg-primary text-secondarybg flex items-center justify-center shadow-md">
                            <Truck size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primarytext leading-none">
                              {selectedRequest.vehicle_name}
                            </p>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                              {selectedRequest.driver_name}
                            </p>
                            {selectedRequest.driver_phone && (
                              <a
                                href={`tel:${selectedRequest.driver_phone}`}
                                className="text-xs text-secondarytext flex items-center gap-1 mt-1 hover:text-primary transition-colors"
                              >
                                <Phone size={10} />
                                {selectedRequest.driver_phone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="bg-secondarybg p-3 rounded-md border border-primarybg space-y-2">
                        {selectedRequest.start_otp && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-secondarytext uppercase tracking-tighter">
                              Start OTP
                            </span>
                            <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded tracking-widest">
                              {selectedRequest.start_otp}
                            </span>
                          </div>
                        )}
                        {selectedRequest.end_otp && (
                          <div className="flex justify-between items-center text-xs border-t border-primarybg pt-2">
                            <span className="font-bold text-secondarytext uppercase tracking-tighter">
                              End OTP
                            </span>
                            <span className="font-mono font-bold text-green bg-green/5 px-2 py-0.5 rounded tracking-widest">
                              {selectedRequest.end_otp}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* OTP Status Info Bars */}
                    <div className="mt-4 space-y-2">
                      {selectedRequest.status === "assigned" && (
                        <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded text-[11px] text-primary font-bold flex items-center gap-2">
                          <Clock size={14} /> WAITING FOR DRIVER TO START
                          JOURNEY
                        </div>
                      )}
                      {selectedRequest.status === "trip_started" && (
                        <div className="px-3 py-2 bg-green/10 border border-green/20 rounded text-[11px] text-green font-bold flex items-center gap-2">
                          <Play size={14} /> TRIP IS CURRENTLY IN PROGRESS
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer Modal Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-primarybg">
                  {selectedRequest.status === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          setActionModal({
                            type: "approve",
                            request: selectedRequest,
                          });
                          setActionRemarks("");
                        }}
                        className="px-6 py-2.5 bg-green text-secondarybg rounded-md font-bold text-sm shadow-lg shadow-green/20 hover:opacity-90 transition-all active:scale-[0.98]"
                      >
                        Approve Request
                      </button>
                      <button
                        onClick={() => {
                          setActionModal({
                            type: "reject",
                            request: selectedRequest,
                          });
                          setActionRemarks("");
                        }}
                        className="px-6 py-2.5 bg-red text-secondarybg rounded-md font-bold text-sm shadow-lg shadow-red/20 hover:opacity-90 transition-all active:scale-[0.98]"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedRequest.status === "approved" && (
                    <button
                      onClick={() => openAssignModal(selectedRequest)}
                      className="px-8 py-2.5 bg-primary text-secondarybg rounded-md font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      Assign Vehicle & Driver
                    </button>
                  )}
                  {(selectedRequest.status === "assigned" ||
                    selectedRequest.status === "trip_started") && (
                    <button
                      onClick={() => handleComplete(selectedRequest.id)}
                      className="px-6 py-2.5 bg-primary text-white rounded-md font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      Mark Completed (Admin Override)
                    </button>
                  )}
                  {(selectedRequest.status === "pending" ||
                    selectedRequest.status === "approved" ||
                    selectedRequest.status === "assigned") && (
                    <button
                      onClick={() => handleCancel(selectedRequest.id)}
                      className="px-6 py-2.5 bg-red/10 border border-red/20 text-red font-bold text-sm rounded-md hover:bg-red/20 transition-all"
                    >
                      Cancel the request
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-6 py-2.5 bg-primarybg text-secondarytext font-bold text-sm rounded-md hover:bg-primarybg transition-all shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== APPROVE/REJECT MODAL ========== */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/60  flex items-center justify-center z-60 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-primarybg bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center ${
                    actionModal.type === "approve"
                      ? "bg-green/10 text-green"
                      : "bg-red/10 text-red"
                  }`}
                >
                  {actionModal.type === "approve" ? (
                    <CheckCircle size={20} />
                  ) : (
                    <XCircle size={20} />
                  )}
                </div>
                <h3 className="text-lg font-bold text-primarytext capitalize">
                  {actionModal.type} Request
                </h3>
              </div>
              <button
                onClick={() => {
                  setActionModal(null);
                  setApproveWithAssign(false);
                  setApproveForm({vehicle_id: 0, driver_id: 0});
                }}
                className="p-2 rounded-md hover:bg-primarybg text-secondarytext hover:text-primarytext transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Request Summary */}
              <div className="bg-primarybg/50 rounded-md p-4 border border-primarybg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primarytext">
                      {actionModal.request.faculty_name}
                    </p>
                    <p className="text-xs text-secondarytext">
                      {actionModal.request.faculty_department}
                    </p>
                    <p className="text-xs text-secondarytext mt-2 italic line-clamp-2">
                      "{actionModal.request.purpose}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Approve with Assign Option */}
              {actionModal.type === "approve" && (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-md border border-primarybg hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <input
                      type="checkbox"
                      checked={approveWithAssign}
                      onChange={(e) => {
                        setApproveWithAssign(e.target.checked);
                        if (e.target.checked && vehicles.length === 0) {
                          fetchVehiclesAndDrivers();
                        }
                      }}
                      className="w-5 h-5 text-primary rounded-md border-gray-300 focus:ring-primary/20 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-semibold text-primarytext group-hover:text-primary transition-colors">
                        Approve and assign vehicle/driver
                      </span>
                      <p className="text-xs text-secondarytext mt-0.5">
                        Select vehicle and driver to assign immediately
                      </p>
                    </div>
                  </label>

                  {approveWithAssign && (
                    <div className="space-y-4 pl-1 animate-fadeIn">
                      {/* Vehicle Select */}
                      <div>
                        <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                          Vehicle <span className="text-red">*</span>
                        </label>
                        <SearchableSelect
                          options={vehicles.map((v) => ({
                            value: v.id,
                            label: v.vehicle_name || v.vehicle_number,
                            subtitle: `${v.vehicle_number} • ${v.vehicle_type}`,
                          }))}
                          value={approveForm.vehicle_id}
                          onChange={(val) =>
                            setApproveForm((p) => ({...p, vehicle_id: val}))
                          }
                          placeholder="Search vehicle..."
                          emptyMessage="No vehicles available"
                        />
                      </div>

                      {/* Driver Select */}
                      <div>
                        <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                          Driver <span className="text-red">*</span>
                        </label>
                        <SearchableSelect
                          options={drivers.map((d) => ({
                            value: d.id,
                            label: d.full_name,
                            subtitle: d.phone || "No phone",
                          }))}
                          value={approveForm.driver_id}
                          onChange={(val) =>
                            setApproveForm((p) => ({...p, driver_id: val}))
                          }
                          placeholder="Search driver..."
                          emptyMessage="No drivers available"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Remarks */}
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                  Admin Remarks{" "}
                  <span className="text-secondarytext/60">(Optional)</span>
                </label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add your comments here..."
                  className="w-full px-4 py-3 bg-primarybg/30 border border-primarybg rounded-md text-sm text-primarytext placeholder:text-secondarytext/60 focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none resize-none transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-primarybg bg-primarybg/30">
              <button
                onClick={() => {
                  setActionModal(null);
                  setApproveWithAssign(false);
                  setApproveForm({vehicle_id: 0, driver_id: 0});
                }}
                className="px-5 py-2.5 bg-secondarybg border border-primarybg text-secondarytext rounded-md hover:bg-primarybg font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionSubmitting}
                className={`px-6 py-2.5 text-white rounded-md text-sm font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 ${
                  actionModal.type === "approve"
                    ? "bg-green hover:bg-green/90 shadow-green/20"
                    : "bg-red hover:bg-red/90 shadow-red/20"
                }`}
              >
                {actionSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : actionModal.type === "approve" ? (
                  approveWithAssign ? (
                    "Confirm & Assign"
                  ) : (
                    "Approve Request"
                  )
                ) : (
                  "Reject Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ASSIGN VEHICLE MODAL ========== */}
      {showAssignModal && assignRequest && (
        <div className="fixed inset-0 bg-slate-900/60  flex items-center justify-center z-60 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-primarybg bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <h3 className="text-lg font-bold text-primarytext">
                  Assign Vehicle & Driver
                </h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 rounded-md hover:bg-primarybg text-secondarytext hover:text-primarytext transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Request Summary */}
              <div className="bg-primarybg/50 rounded-md p-4 border border-primarybg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primarytext">
                      {assignRequest.faculty_name}
                    </p>
                    <p className="text-xs text-secondarytext">
                      {assignRequest.faculty_department}
                    </p>
                    <p className="text-xs text-secondarytext mt-2 italic line-clamp-2">
                      "{assignRequest.purpose}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Vehicle & Driver Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    Vehicle <span className="text-red">*</span>
                  </label>
                  <SearchableSelect
                    options={vehicles.map((v) => ({
                      value: v.id,
                      label: v.vehicle_name || v.vehicle_number,
                      subtitle: `${v.vehicle_number} • ${v.vehicle_type}`,
                    }))}
                    value={assignForm.vehicle_id}
                    onChange={(val) =>
                      setAssignForm((p) => ({...p, vehicle_id: val}))
                    }
                    placeholder="Search vehicle..."
                    emptyMessage="No vehicles available"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    Driver <span className="text-red">*</span>
                  </label>
                  <SearchableSelect
                    options={drivers.map((d) => ({
                      value: d.id,
                      label: d.full_name,
                      subtitle: d.phone || "No phone",
                    }))}
                    value={assignForm.driver_id}
                    onChange={(val) =>
                      setAssignForm((p) => ({...p, driver_id: val}))
                    }
                    placeholder="Search driver..."
                    emptyMessage="No drivers available"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-primarybg bg-primarybg/30">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-5 py-2.5 bg-secondarybg border border-primarybg text-secondarytext rounded-md hover:bg-primarybg font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="px-6 py-2.5 bg-primary text-white rounded-md hover:bg-primarydull font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
              >
                {assigning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Assigning...
                  </>
                ) : (
                  "Assign Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CONFLICT MODAL ========== */}
      {conflictModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-fadeIn"
          onClick={() => {
            setConflictModal(null);
            setConflictPendingAction(null);
          }}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-md flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primarytext">
                  {conflictModal.conflict_type === "vehicle_conflict"
                    ? "Vehicle Conflict Detected"
                    : "Driver Conflict Detected"}
                </h3>
                <p className="text-sm text-secondarytext mt-1">
                  {conflictModal.message}
                </p>
              </div>
              <button
                onClick={() => {
                  setConflictModal(null);
                  setConflictPendingAction(null);
                }}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conflict Details */}
            {conflictModal.conflicts && conflictModal.conflicts.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-primarytext mb-3">
                  Conflicting Assignments:
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
                          {conflict.shift_name || "Assignment"}
                        </span>
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-md">
                          {conflict.assignment_type === "REGULAR"
                            ? "Bus/Car Assignment"
                            : conflict.assignment_type === "EV_CLUSTER"
                              ? "EV Assignment"
                              : conflict.assignment_type === "TEMP_REPLACEMENT"
                                ? "Temp Replacement"
                                : conflict.assignment_type === "VEHICLE_REQUEST"
                                  ? "Vehicle Request"
                                  : conflict.assignment_type || "Assignment"}
                        </span>
                      </div>
                      <div className="text-sm text-amber-700 space-y-1 ml-5">
                        <p>
                          <strong>Time:</strong>{" "}
                          {conflict.assignment_type === "VEHICLE_REQUEST"
                            ? `${conflict.start_time} → ${conflict.end_time}`
                            : `${formatTimeAMPM(conflict.start_time)} - ${formatTimeAMPM(conflict.end_time)}`}
                        </p>
                        {conflict.vehicle_number && (
                          <p>
                            <strong>Vehicle:</strong> {conflict.vehicle_number}
                            {conflict.vehicle_type
                              ? ` (${conflict.vehicle_type})`
                              : ""}
                          </p>
                        )}
                        {conflict.assignment_type !== "VEHICLE_REQUEST" && (
                          <p>
                            <strong>Dates:</strong> {conflict.start_date} to{" "}
                            {conflict.end_date}
                          </p>
                        )}
                        {conflict.faculty_name && (
                          <p>
                            <strong>Requested by:</strong>{" "}
                            {conflict.faculty_name}
                          </p>
                        )}
                        {conflict.driver_name && (
                          <p>
                            <strong>Driver:</strong> {conflict.driver_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      This will assign even though there are conflicting
                      schedules. Use this only if necessary.
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

              {/* Option 2: Choose Different Driver */}
              {conflictModal.conflict_type === "driver_conflict" &&
                conflictModal.available_drivers &&
                conflictModal.available_drivers.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex-1">
                      <h5 className="font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle size={16} /> Choose a Different Driver
                      </h5>
                      <p className="text-xs text-green-600 mt-1 mb-3">
                        Select an available driver who doesn't have conflicting
                        assignments:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {conflictModal.available_drivers.map((d) => {
                          const isAvailable = d.available;
                          return (
                            <button
                              key={d.id}
                              onClick={() => handleSelectAlternateDriver(d.id)}
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
                                {d.full_name}
                              </span>
                              {isAvailable ? (
                                <CheckCircle
                                  size={14}
                                  className="text-green-600 flex-shrink-0"
                                />
                              ) : (
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
                )}
            </div>

            {/* Cancel Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setConflictModal(null);
                  setConflictPendingAction(null);
                }}
                className="px-4 py-2 text-secondarytext hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
