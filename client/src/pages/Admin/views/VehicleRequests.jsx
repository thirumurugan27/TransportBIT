import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { showConfirm } from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import CustomSearch from "../../../components/ui/CustomSearch";
import CustomDropdown from "../../../components/ui/CustomDropdown";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  { value: "academic_department", label: "Academic Department" },
  { value: "students_training", label: "Students Training" },
  { value: "supporting_department", label: "Supporting Department" },
];

const getRequestUnderLabel = (value) => {
  const found = REQUEST_UNDER_OPTIONS.find((r) => r.value === value);
  return found ? found.label : value || "-";
};

export default function VehicleRequests() {
  const { showToast } = useToast();
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
  const [assignForm, setAssignForm] = useState({ vehicle_id: 0, driver_id: 0 });
  const [assigning, setAssigning] = useState(false);

  // Approve/Reject modal
  const [actionModal, setActionModal] = useState(null); // {type: 'approve'|'reject', request}
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [approveWithAssign, setApproveWithAssign] = useState(false);
  const [approveForm, setApproveForm] = useState({ vehicle_id: 0, driver_id: 0 });

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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        setApproveForm({ vehicle_id: 0, driver_id: 0 });
        setSelectedRequest(null);
        fetchRequests();
      } else if (res.status === 409) {
        const data = await res.json();
        showToast(data.message || "Conflict detected", "error");
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
    setAssignForm({ vehicle_id: 0, driver_id: 0 });
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        showToast(data.message || "Conflict detected", "error");
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
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ request_id: requestId }),
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
    const confirmed = await showConfirm(
      "Cancel Request?",
      "This will cancel the vehicle request. This action cannot be undone.",
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicle-request/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          request_id: requestId,
          admin_remarks: "Cancelled by admin",
        }),
      });
      if (res.ok) {
        showToast("Request cancelled", "success");
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

  // Stats
  const statusCounts = {};
  requests.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-primarybg p-6">
        <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
          <FileText size={24} className="text-primary" />
          Vehicle Requests
        </h3>
        <p className="text-sm text-secondarytext mt-1">
          Manage faculty vehicle booking requests
        </p>
      </div>

      {/* Status Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const StatusIcon = cfg.icon;
          const isActive = filterStatus === key;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(isActive ? "" : key)}
              className={`p-4 rounded-md border text-left transition-all ${isActive
                ? "bg-secondarybg ring-2 ring-primary border-primary shadow-md"
                : "bg-secondarybg border-primarybg hover:border-primary/30"
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${cfg.color}`}>
                  <StatusIcon size={14} />
                </div>
                <span className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">{cfg.label}</span>
              </div>
              <p className="text-2xl font-black text-primarytext">
                {statusCounts[key] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm p-4">
        <CustomSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, department, purpose, or ID..."
          className="max-w-md"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-secondarybg rounded-md border border-primarybg p-12 text-center">
          <FileText size={40} className="mx-auto text-secondarytext/30 mb-3" />
          <p className="text-secondarytext font-medium">No vehicle requests found</p>
        </div>
      ) : (
        <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primarybg/50 border-b border-primarybg">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-secondarytext uppercase tracking-widest whitespace-nowrap">
                    REQ ID
                  </th>
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
                  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const departureDateTime = req.onward_from_datetime;
                  const departurePlace = req.onward_from_place;
                  const arrivalPlace = req.onward_to_place;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => fetchRequestDetail(req.id)}
                      className="hover:bg-primarybg/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-primary">#{req.id}</span>
                      </td>
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
                            {departurePlace} {arrivalPlace && `→ ${arrivalPlace}`}
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
                          <span className="text-[10px] font-bold text-secondarytext uppercase tracking-widest opacity-40 italic">Not Assigned</span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Header */}
            <div className="p-6 border-b border-primarybg/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-md flex items-center justify-center text-secondarybg shadow-lg ${STATUS_CONFIG[selectedRequest.status]?.themeColor === 'green' ? 'bg-green' : STATUS_CONFIG[selectedRequest.status]?.themeColor === 'red' ? 'bg-red' : STATUS_CONFIG[selectedRequest.status]?.themeColor === 'amber' ? 'bg-pending' : 'bg-primary'}`}>
                    {React.createElement(STATUS_CONFIG[selectedRequest.status]?.icon || Truck, { size: 28, strokeWidth: 2.5 })}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      Request Details
                      <span className="ml-2 text-sm text-secondarytext font-mono">#{selectedRequest.id}</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_CONFIG[selectedRequest.status]?.color}`}>
                        {STATUS_CONFIG[selectedRequest.status]?.label}
                      </span>
                      <p className="text-sm text-secondarytext font-medium">
                        {selectedRequest.faculty_name} · {selectedRequest.faculty_department}
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
                        <div key={idx} className="bg-secondarybg p-4 rounded-md border border-primarybg/50 relative">
                          <div className="absolute top-3 right-3 px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold rounded uppercase">Leg {trip.trip_order}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">Departure</p>
                              <p className="text-sm font-bold text-primarytext">{trip.departure_location}</p>
                              <p className="text-[11px] text-secondarytext font-mono">{trip.departure_date} {trip.departure_time && `· ${trip.departure_time}`}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">Arrival</p>
                              <p className="text-sm font-bold text-primarytext">{trip.arrival_location}</p>
                              <p className="text-[11px] text-secondarytext font-mono">{trip.arrival_date} {trip.arrival_time && `· ${trip.arrival_time}`}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-secondarybg p-4 rounded-md border border-primarybg/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">From</p>
                            <p className="text-sm font-bold text-primarytext">{selectedRequest.onward_from_place}</p>
                            <p className="text-[11px] text-secondarytext font-mono">{selectedRequest.onward_from_datetime}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">To</p>
                            <p className="text-sm font-bold text-primarytext">{selectedRequest.onward_to_place}</p>
                            <p className="text-[11px] text-secondarytext font-mono">{selectedRequest.onward_to_datetime}</p>
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
                      <User size={14} /> Faculty Information
                    </h4>
                    <div className="bg-secondarybg border border-primarybg/50 rounded-md p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">Name & Dept</p>
                        <p className="text-sm font-bold text-primarytext">{selectedRequest.faculty_name}</p>
                        <p className="text-xs font-medium text-secondarytext">{selectedRequest.faculty_department}</p>
                      </div>
                      <div className="flex gap-4 pt-2 border-t border-primarybg">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">Email</p>
                          <p className="text-xs font-bold text-primarytext">{selectedRequest.faculty_email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider">Phone</p>
                          <p className="text-xs font-bold text-primary">{selectedRequest.faculty_phone}</p>
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
                        <span className="text-xs font-medium text-secondarytext">Trip Type</span>
                        <span className="text-xs font-bold text-primarytext uppercase tracking-tighter">{selectedRequest.trip_type?.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">Trip Mode</span>
                        <span className="text-xs font-bold text-primarytext uppercase tracking-tighter">{selectedRequest.trip_mode || "Official"}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">Passengers</span>
                        <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-full">{selectedRequest.count_person || 1} Persons</span>
                      </div>
                      <div className="flex justify-between items-center py-1 group/md border-t border-primarybg/50">
                        <span className="text-xs font-medium text-secondarytext">Vertical</span>
                        <span className="text-xs font-bold text-primarytext">{selectedRequest.vertical || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purpose & Admin Remarks Section */}
                <div className="bg-primarybg rounded-md p-4">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={14} /> Purpose & Remarks
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-secondarybg border border-primarybg/50 rounded-md p-4">
                      <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-2">Detailed Purpose</p>
                      <p className="text-sm font-medium text-primarytext leading-relaxed bg-primarybg/20 p-3 rounded italic">"{selectedRequest.purpose}"</p>
                    </div>
                    {selectedRequest.admin_remarks && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Admin Remarks</p>
                        <p className="text-sm text-amber-800 font-medium italic">{selectedRequest.admin_remarks}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment & OTP Info Section */}
                {(selectedRequest.vehicle_name || selectedRequest.status === "assigned" || selectedRequest.status === "trip_started") && (
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
                            <p className="text-sm font-bold text-primarytext leading-none">{selectedRequest.vehicle_name}</p>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedRequest.driver_name}</p>
                          </div>
                        </div>
                      )}
                      <div className="bg-secondarybg p-3 rounded-md border border-primarybg space-y-2">
                        {selectedRequest.start_otp && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-secondarytext uppercase tracking-tighter">Start OTP</span>
                            <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded tracking-widest">{selectedRequest.start_otp}</span>
                          </div>
                        )}
                        {selectedRequest.end_otp && (
                          <div className="flex justify-between items-center text-xs border-t border-primarybg pt-2">
                            <span className="font-bold text-secondarytext uppercase tracking-tighter">End OTP</span>
                            <span className="font-mono font-bold text-green bg-green/5 px-2 py-0.5 rounded tracking-widest">{selectedRequest.end_otp}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* OTP Status Info Bars */}
                    <div className="mt-4 space-y-2">
                      {selectedRequest.status === "assigned" && (
                        <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded text-[11px] text-primary font-bold flex items-center gap-2">
                          <Clock size={14} /> WAITING FOR DRIVER TO START JOURNEY
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
                          setActionModal({ type: "approve", request: selectedRequest });
                          setActionRemarks("");
                        }}
                        className="px-6 py-2.5 bg-green text-secondarybg rounded-md font-bold text-sm shadow-lg shadow-green/20 hover:opacity-90 transition-all active:scale-[0.98]"
                      >
                        Approve Request
                      </button>
                      <button
                        onClick={() => {
                          setActionModal({ type: "reject", request: selectedRequest });
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
                  {(selectedRequest.status === "assigned" || selectedRequest.status === "trip_started") && (
                    <button
                      onClick={() => handleComplete(selectedRequest.id)}
                      className="px-6 py-2.5 bg-green text-secondarybg rounded-md font-bold text-sm shadow-lg shadow-green/20 hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      Mark Completed (Admin Override)
                    </button>
                  )}
                  {(selectedRequest.status === "pending" || selectedRequest.status === "approved" || selectedRequest.status === "assigned") && (
                    <button
                      onClick={() => handleCancel(selectedRequest.id)}
                      className="px-6 py-2.5 bg-secondarybg border border-primarytext/10 text-primarytext font-bold text-sm rounded-md hover:bg-primarybg transition-all"
                    >
                      Cancel Request
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-60 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg/50">
              <h3 className="text-xl font-bold text-primarytext capitalize">
                {actionModal.type} Request
              </h3>
              <button
                onClick={() => {
                  setActionModal(null);
                  setApproveWithAssign(false);
                  setApproveForm({ vehicle_id: 0, driver_id: 0 });
                }}
                className="p-2 rounded-md hover:bg-primarybg text-secondarytext hover:text-primarytext transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-primarybg rounded-md p-4">
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1">Request Summary</p>
                <p className="text-sm font-bold text-primarytext">
                  {actionModal.request.faculty_name} · {actionModal.request.faculty_department}
                </p>
                <p className="text-xs text-secondarytext mt-1 italic">"{actionModal.request.purpose}"</p>
              </div>

              {actionModal.type === "approve" && (
                <div className="border border-primarybg rounded-md p-4 bg-primary/5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={approveWithAssign}
                      onChange={(e) => {
                        setApproveWithAssign(e.target.checked);
                        if (e.target.checked && vehicles.length === 0) {
                          fetchVehiclesAndDrivers();
                        }
                      }}
                      className="w-5 h-5 text-primary rounded border-primarybg focus:ring-primary/20 accent-primary"
                    />
                    <span className="text-sm font-bold text-primarytext group-hover:text-primary transition-colors">
                      Approve and assign vehicle/driver directly
                    </span>
                  </label>

                  {approveWithAssign && (
                    <div className="mt-5 space-y-4 animate-fadeIn">
                      <CustomDropdown
                        label="Select Vehicle"
                        options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_number} (${v.vehicle_name || v.vehicle_type})` }))}
                        value={approveForm.vehicle_id}
                        onChange={(val) => setApproveForm(p => ({ ...p, vehicle_id: val }))}
                        required
                      />
                      <CustomDropdown
                        label="Select Driver"
                        options={drivers.map(d => ({ value: d.id, label: d.full_name }))}
                        value={approveForm.driver_id}
                        onChange={(val) => setApproveForm(p => ({ ...p, driver_id: val }))}
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-secondarytext uppercase tracking-widest mb-2">
                  Admin Remarks (optional)
                </label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add your comments here..."
                  className="w-full px-4 py-3 border border-primarybg rounded-md text-sm text-primarytext focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none resize-none bg-primarybg/20 transition-all font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-primarybg">
                <button
                  onClick={() => {
                    setActionModal(null);
                    setApproveWithAssign(false);
                    setApproveForm({ vehicle_id: 0, driver_id: 0 });
                  }}
                  className="px-6 py-2.5 bg-secondarybg border border-primarybg text-secondarytext rounded-md hover:bg-primarybg font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionSubmitting}
                  className={`px-8 py-2.5 text-secondarybg rounded-md text-sm font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${actionModal.type === "approve"
                    ? "bg-green shadow-green/20"
                    : "bg-red shadow-red/20"
                    }`}
                >
                  {actionSubmitting
                    ? "Processing..."
                    : actionModal.type === "approve"
                      ? approveWithAssign
                        ? "Confirm & Assign"
                        : "Approve Request"
                      : "Reject Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== ASSIGN VEHICLE MODAL ========== */}
      {showAssignModal && assignRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-60 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg/50">
              <h3 className="text-xl font-bold text-primarytext">
                Assign Vehicle & Driver
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 rounded-md hover:bg-primarybg text-secondarytext hover:text-primarytext transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-primarybg rounded-md p-4">
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1">Request Detail</p>
                <p className="text-sm font-bold text-primarytext">
                  {assignRequest.faculty_name} · {assignRequest.faculty_department}
                </p>
                <p className="text-xs text-secondarytext mt-1 italic">"{assignRequest.purpose}"</p>
              </div>

              <div className="space-y-4">
                <CustomDropdown
                  label="Select Vehicle"
                  options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_number} (${v.vehicle_name || v.vehicle_type})` }))}
                  value={assignForm.vehicle_id}
                  onChange={(val) => setAssignForm(p => ({ ...p, vehicle_id: val }))}
                  required
                />
                <CustomDropdown
                  label="Select Driver"
                  options={drivers.map(d => ({ value: d.id, label: d.full_name }))}
                  value={assignForm.driver_id}
                  onChange={(val) => setAssignForm(p => ({ ...p, driver_id: val }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-primarybg">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-6 py-2.5 bg-secondarybg border border-primarybg text-secondarytext rounded-md hover:bg-primarybg font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="px-10 py-2.5 bg-primary text-secondarybg rounded-md hover:bg-primarydull font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
