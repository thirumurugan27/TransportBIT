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
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import CustomSearch from "../../../components/ui/CustomSearch";

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
  },
  approved: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: CheckCircle,
    label: "Approved",
  },
  rejected: {
    color: "bg-red/10 text-red border-red/20",
    icon: XCircle,
    label: "Rejected",
  },
  assigned: {
    color: "bg-green/10 text-green border-green/20",
    icon: Truck,
    label: "Assigned",
  },
  completed: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: CheckCircle,
    label: "Completed",
  },
  cancelled: {
    color: "bg-gray-100 text-gray-400 border-gray-200",
    icon: XCircle,
    label: "Cancelled",
  },
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
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
          <FileText size={24} className="text-primary" />
          Vehicle Requests
        </h3>
        <p className="text-sm text-secondarytext mt-1">
          Manage faculty vehicle booking requests
        </p>
      </div>

      {/* Status Tabs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const StatusIcon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={`p-3 rounded-md border text-left transition-all bg-secondarybg ${
                filterStatus === key
                  ? "ring-2 ring-primary border-primary"
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <StatusIcon size={13} className={cfg.color.split(" ")[1]} />
                <span className="text-xs text-secondarytext">{cfg.label}</span>
              </div>
              <p className="text-lg font-bold text-primarytext">
                {statusCounts[key] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm p-4">
        <CustomSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, department, purpose, or ID..."
          className="max-w-md"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-secondarybg rounded-md border border-gray-100 p-12 text-center">
          <FileText size={40} className="mx-auto text-secondarytext mb-3" />
          <p className="text-secondarytext">No vehicle requests found</p>
        </div>
      ) : (
        <div className="bg-secondarybg rounded-md border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primarybg border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    S.No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Faculty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Purpose
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondarytext uppercase">
                    Vehicle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((req, idx) => {
                  const cfg =
                    STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const departureDateTime = req.onward_from_datetime;
                  const departurePlace = req.onward_from_place;
                  const arrivalPlace = req.onward_to_place;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => fetchRequestDetail(req.id)}
                      className="hover:bg-primarybg/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-primarytext">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-primarytext">
                          {req.faculty_name}
                        </p>
                        <p className="text-xs text-secondarytext">
                          {req.faculty_department}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-primarytext truncate max-w-[200px]">
                          {req.purpose}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-secondarytext whitespace-nowrap">
                        {departureDateTime || "-"}
                      </td>
                      <td className="px-4 py-3 text-secondarytext text-xs">
                        {departurePlace
                          ? `${departurePlace}${arrivalPlace ? ` → ${arrivalPlace}` : ""}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.color}`}
                        >
                          <StatusIcon size={11} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {req.vehicle_name ? (
                          <div>
                            <p className="text-primarytext font-medium">
                              {req.vehicle_name}
                            </p>
                            <p className="text-secondarytext">
                              {req.driver_name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-secondarytext">—</span>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-secondarybg z-10">
              <h3 className="text-lg font-bold text-primarytext">
                Request Details
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-md hover:bg-primarybg transition-colors"
              >
                <X size={18} className="text-secondarytext" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-12">
                <Loading fullScreen={false} size="small" />
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Status */}
                {(() => {
                  const cfg =
                    STATUS_CONFIG[selectedRequest.status] ||
                    STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium border ${cfg.color}`}
                    >
                      <StatusIcon size={14} />
                      {cfg.label}
                    </span>
                  );
                })()}

                {/* Faculty Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-secondarytext">Faculty:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.faculty_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Department:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.faculty_department}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Email:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.faculty_email}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Phone:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.faculty_phone}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Trip Type:</span>
                    <p className="font-medium text-primarytext capitalize">
                      {selectedRequest.trip_type?.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Request Under:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.request_under || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">
                      Total Passengers:
                    </span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.count_person ??
                        selectedRequest.total_passengers ??
                        "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Oral Approval:</span>
                    <p className="font-medium text-primarytext">
                      {typeof selectedRequest.oral_approval === "boolean"
                        ? selectedRequest.oral_approval
                          ? "Yes"
                          : "No"
                        : "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-secondarytext">Purpose:</span>
                  <p className="mt-1 text-sm text-primarytext bg-primarybg rounded-md p-3">
                    {selectedRequest.purpose}
                  </p>
                </div>

                {/* Trip Legs */}
                <div>
                  <p className="text-sm font-semibold text-primarytext mb-2">
                    Trip Legs
                  </p>
                  {selectedRequest.trips?.length ? (
                    selectedRequest.trips.map((trip, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-100 rounded-md p-3 mb-2"
                      >
                        <p className="text-xs font-semibold text-secondarytext mb-2">
                          Leg {trip.trip_order}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-primarybg rounded-md p-2">
                            <p className="text-primary font-medium mb-0.5">
                              Departure
                            </p>
                            <p className="text-primarytext">
                              {trip.departure_date} · {trip.departure_time}
                            </p>
                            <p className="text-secondarytext">
                              {trip.departure_location}
                            </p>
                          </div>
                          <div className="bg-primarybg rounded-md p-2">
                            <p className="text-green font-medium mb-0.5">
                              Arrival
                            </p>
                            <p className="text-primarytext">
                              {trip.arrival_date} · {trip.arrival_time}
                            </p>
                            <p className="text-secondarytext">
                              {trip.arrival_location}
                            </p>
                          </div>
                        </div>
                        <div className="mt-1.5 text-xs text-secondarytext">
                          {trip.num_passengers} passenger(s)
                          {trip.passenger_contacts &&
                            ` · ${trip.passenger_contacts}`}
                          {trip.outcome_auditable &&
                            ` · ${trip.outcome_auditable}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-gray-100 rounded-md p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-primarybg rounded-md p-2">
                          <p className="text-primary font-medium mb-0.5">
                            Onward
                          </p>
                          <p className="text-primarytext">
                            {selectedRequest.onward_from_datetime || "-"}
                          </p>
                          <p className="text-secondarytext">
                            {selectedRequest.onward_from_place
                              ? `${selectedRequest.onward_from_place}${selectedRequest.onward_to_place ? ` → ${selectedRequest.onward_to_place}` : ""}`
                              : "-"}
                          </p>
                        </div>
                        <div className="bg-primarybg rounded-md p-2">
                          <p className="text-green font-medium mb-0.5">
                            Return
                          </p>
                          <p className="text-primarytext">
                            {selectedRequest.return_from_datetime || "-"}
                          </p>
                          <p className="text-secondarytext">
                            {selectedRequest.return_from_place
                              ? `${selectedRequest.return_from_place}${selectedRequest.return_to_place ? ` → ${selectedRequest.return_to_place}` : ""}`
                              : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 text-xs text-secondarytext">
                        {selectedRequest.count_person
                          ? `${selectedRequest.count_person} passenger(s)`
                          : ""}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assignment Info */}
                {selectedRequest.status === "assigned" && (
                  <div className="bg-green/5 border border-green/20 rounded-md p-4">
                    <p className="text-sm font-semibold text-green mb-2">
                      Assigned Vehicle & Driver
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-secondarytext">Vehicle:</span>
                        <p className="font-medium text-primarytext">
                          {selectedRequest.vehicle_name ||
                            selectedRequest.vehicle_number}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondarytext">Driver:</span>
                        <p className="font-medium text-primarytext">
                          {selectedRequest.driver_name}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
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
                        className="px-4 py-2 bg-green text-white rounded-md hover:bg-green/90 transition-colors text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setActionModal({
                            type: "reject",
                            request: selectedRequest,
                          });
                          setActionRemarks("");
                        }}
                        className="px-4 py-2 bg-red text-white rounded-md hover:bg-red/90 transition-colors text-sm font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedRequest.status === "approved" && (
                    <button
                      onClick={() => openAssignModal(selectedRequest)}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      Assign Vehicle & Driver
                    </button>
                  )}
                  {selectedRequest.status === "assigned" && (
                    <button
                      onClick={() => handleComplete(selectedRequest.id)}
                      className="px-4 py-2 bg-green text-white rounded-md hover:bg-green/90 transition-colors text-sm font-medium"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== APPROVE/REJECT MODAL ========== */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-secondarybg z-10">
              <h3 className="text-lg font-bold text-primarytext capitalize">
                {actionModal.type} Request
              </h3>
              <button
                onClick={() => {
                  setActionModal(null);
                  setApproveWithAssign(false);
                  setApproveForm({vehicle_id: 0, driver_id: 0});
                }}
                className="p-1.5 rounded-md hover:bg-primarybg"
              >
                <X size={18} className="text-secondarytext" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-secondarytext mb-1">
                  Faculty: {actionModal.request.faculty_name}
                </p>
                <p className="text-sm text-secondarytext">
                  Purpose: {actionModal.request.purpose}
                </p>
                {actionModal.request.trips?.[0] && (
                  <p className="text-xs text-secondarytext mt-1">
                    {actionModal.request.trips[0].departure_date} ·{" "}
                    {actionModal.request.trips[0].departure_location} →{" "}
                    {actionModal.request.trips[0].arrival_location}
                  </p>
                )}
              </div>

              {/* Approve with assignment option */}
              {actionModal.type === "approve" && (
                <div className="border border-gray-200 rounded-md p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approveWithAssign}
                      onChange={(e) => {
                        setApproveWithAssign(e.target.checked);
                        if (e.target.checked && vehicles.length === 0) {
                          fetchVehiclesAndDrivers();
                        }
                      }}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-primarytext">
                      Approve and assign vehicle/driver directly
                    </span>
                  </label>

                  {approveWithAssign && (
                    <div className="mt-4 space-y-3">
                      {/* Vehicle Select */}
                      <div>
                        <label className="block text-sm font-medium text-secondarytext mb-1">
                          Vehicle <span className="text-red">*</span>
                        </label>
                        <select
                          value={approveForm.vehicle_id}
                          onChange={(e) =>
                            setApproveForm((p) => ({
                              ...p,
                              vehicle_id: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                          <option value={0}>Select vehicle...</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.vehicle_name || v.vehicle_number} (
                              {v.vehicle_type} · {v.seating_capacity} seats)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Driver Select */}
                      <div>
                        <label className="block text-sm font-medium text-secondarytext mb-1">
                          Driver <span className="text-red">*</span>
                        </label>
                        <select
                          value={approveForm.driver_id}
                          onChange={(e) =>
                            setApproveForm((p) => ({
                              ...p,
                              driver_id: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                          <option value={0}>Select driver...</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name} ({d.license_type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Remarks (optional)
                </label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add remarks..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setActionModal(null);
                    setApproveWithAssign(false);
                    setApproveForm({vehicle_id: 0, driver_id: 0});
                  }}
                  className="px-4 py-2 border border-gray-200 text-secondarytext rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionSubmitting}
                  className={`px-5 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50 ${
                    actionModal.type === "approve"
                      ? "bg-green hover:bg-green/90"
                      : "bg-red hover:bg-red/90"
                  }`}
                >
                  {actionSubmitting
                    ? "Processing..."
                    : actionModal.type === "approve"
                      ? approveWithAssign
                        ? "Approve & Assign"
                        : "Approve"
                      : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== ASSIGN VEHICLE MODAL ========== */}
      {showAssignModal && assignRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-primarytext">
                Assign Vehicle & Driver
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-md hover:bg-primarybg"
              >
                <X size={18} className="text-secondarytext" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Request summary */}
              <div className="bg-primarybg rounded-md p-3 text-sm">
                <p className="font-medium text-primarytext">
                  Request — {assignRequest.faculty_name}
                </p>
                <p className="text-secondarytext mt-1">
                  {assignRequest.purpose}
                </p>
                {assignRequest.trips?.[0] && (
                  <p className="text-xs text-secondarytext mt-1">
                    {assignRequest.trips[0].departure_date} ·{" "}
                    {assignRequest.trips[0].departure_location} →{" "}
                    {assignRequest.trips[0].arrival_location}
                  </p>
                )}
              </div>

              {/* Vehicle Select */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Vehicle <span className="text-red">*</span>
                </label>
                <select
                  value={assignForm.vehicle_id}
                  onChange={(e) =>
                    setAssignForm((p) => ({
                      ...p,
                      vehicle_id: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value={0}>Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_name || v.vehicle_number} ({v.vehicle_type} ·{" "}
                      {v.seating_capacity} seats)
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Select */}
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Driver <span className="text-red">*</span>
                </label>
                <select
                  value={assignForm.driver_id}
                  onChange={(e) =>
                    setAssignForm((p) => ({
                      ...p,
                      driver_id: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-primarytext focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value={0}>Select driver...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.license_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-200 text-secondarytext rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="px-5 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
