import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import {showError, showSuccess} from "../../../utils/swal";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableDropdown from "../../../components/ui/SearchableDropdown";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  X,
  FileText,
  User,
  ShieldCheck,
  Truck,
  Users,
  ArrowRight,
  Calendar,
  Plus,
} from "lucide-react";
import {
  calculateDuration,
  getStatusLabel,
  getStatusColor,
} from "../../../utils/dateFormat";

import {apiGet, apiPost} from "../../../utils/api";

// Helper to convert 24h time to 12h AM/PM format
const formatTimeAMPM = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export default function LeaveApprovals() {
  const [loading, setLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionProcessing, setActionProcessing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [remarks, setRemarks] = useState("");

  // New states for temporary assignment workflow
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [affectedAssignments, setAffectedAssignments] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [tempAssignments, setTempAssignments] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Apply leave modal states
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [driversList, setDriversList] = useState([]);
  const [applyLeaveLoading, setApplyLeaveLoading] = useState(false);
  const [applyLeaveForm, setApplyLeaveForm] = useState({
    driver_id: "",
    leave_type: "Casual Leave",
    start_date: "",
    start_time: "09:00",
    end_date: "",
    end_time: "17:00",
    reason: "",
  });

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/leave/all");
      if (res.ok) {
        const data = await res.json();
        setLeaveRequests(Array.isArray(data) ? data : []);
      } else {
        setLeaveRequests([]);
      }
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  // Fetch drivers list for apply leave modal
  const fetchDriversList = async () => {
    try {
      const res = await apiGet("/api/admin/drivers");
      if (res.ok) {
        const data = await res.json();
        setDriversList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching drivers:", err);
    }
  };

  const openApplyLeaveModal = () => {
    fetchDriversList();
    setApplyLeaveForm({
      driver_id: "",
      leave_type: "Casual Leave",
      start_date: "",
      start_time: "09:00",
      end_date: "",
      end_time: "17:00",
      reason: "",
    });
    setShowApplyLeaveModal(true);
  };

  const handleApplyLeave = async () => {
    if (
      !applyLeaveForm.driver_id ||
      !applyLeaveForm.start_date ||
      !applyLeaveForm.end_date
    ) {
      showError(
        "Missing Fields",
        "Please select a driver, start date, and end date.",
      );
      return;
    }
    setApplyLeaveLoading(true);
    try {
      const res = await apiPost("/api/admin/leave/apply", {
        driver_id: parseInt(applyLeaveForm.driver_id),
        leave_type: applyLeaveForm.leave_type,
        start_date: applyLeaveForm.start_date,
        start_time: applyLeaveForm.start_time + ":00",
        end_date: applyLeaveForm.end_date,
        end_time: applyLeaveForm.end_time + ":00",
        reason: applyLeaveForm.reason,
      });
      if (res.ok) {
        showSuccess(
          "Leave Applied",
          "Leave has been applied successfully on behalf of the driver.",
        );
        setShowApplyLeaveModal(false);
        fetchLeaveRequests();
      } else {
        const errData = await res.json();
        showError("Error", errData.error || "Failed to apply leave");
      }
    } catch (err) {
      showError("Error", err.message);
    } finally {
      setApplyLeaveLoading(false);
    }
  };

  // Fetch affected assignments for a leave request
  const fetchAffectedAssignments = async (leaveId) => {
    setLoadingAssignments(true);
    try {
      const res = await apiGet(
        `/api/admin/leave/${leaveId}/affected-assignments`,
      );
      if (res.ok) {
        const data = await res.json();
        setAffectedAssignments(data.assignments || []);
        setAvailableDrivers(data.available_drivers || []);
        // Initialize temp assignments state
        const initial = {};
        (data.assignments || []).forEach((a) => {
          initial[a.id] = {
            assignment_id: a.id,
            shift_id: a.shift_id,
            vehicle_id: a.vehicle_id,
            replacement_driver_id: "",
            start_date: data.start_date,
            end_date: data.end_date,
          };
        });
        setTempAssignments(initial);
      }
    } catch (err) {
      console.error("Error fetching affected assignments:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Handle clicking "Approve" button - check for assignments first
  const handleApproveClick = async (leave) => {
    setSelectedLeave(leave);
    await fetchAffectedAssignments(leave.id);
    setShowAssignmentModal(true);
  };

  // Approve leave with temporary assignments
  const approveWithAssignments = async () => {
    setActionProcessing(selectedLeave.id);
    try {
      // Prepare temporary assignments array
      const tempAssignmentsArray = Object.values(tempAssignments)
        .filter((ta) => ta.replacement_driver_id)
        .map((ta) => ({
          assignment_id: ta.assignment_id,
          shift_id: ta.shift_id,
          vehicle_id: ta.vehicle_id,
          replacement_driver_id: parseInt(ta.replacement_driver_id),
          start_date: ta.start_date,
          end_date: ta.end_date,
        }));

      const res = await apiPost("/api/admin/leave/approve-with-assignments", {
        leave_id: selectedLeave.id,
        approver_id: 1,
        remarks: remarks || "",
        temporary_assignments: tempAssignmentsArray,
      });

      if (res.ok) {
        setShowAssignmentModal(false);
        setShowLeaveModal(false);
        setRemarks("");
        setTempAssignments({});
        fetchLeaveRequests();
        showSuccess(
          "Leave Approved",
          `Leave request approved successfully.${tempAssignmentsArray.length > 0 ? ` ${tempAssignmentsArray.length} temporary assignment(s) created.` : ""} Attendance will be automatically marked as absent.`,
        );
      } else {
        const errorData = await res.json();
        showError("Error", errorData.error || "Failed to approve leave");
      }
    } catch (err) {
      showError("Error", err.message);
    } finally {
      setActionProcessing(null);
    }
  };

  const approveLeave = async (leaveId, status) => {
    setActionProcessing(leaveId);
    try {
      const res = await apiPost("/api/admin/leave/approve", {
        leave_id: leaveId,
        approver_id: 1, // Admin ID
        status: status,
        remarks: remarks || "",
      });
      if (res.ok) {
        const data = await res.json();
        setShowLeaveModal(false);
        setRemarks("");
        fetchLeaveRequests();
        if (status === "approved") {
          showSuccess(
            "Leave Approved",
            "Leave request approved successfully. Attendance will be automatically marked as absent for the leave period.",
          );
        } else {
          showSuccess("Leave Rejected", "Leave request has been rejected.");
        }
      } else {
        const errorText = await res.text();
        showError("Error", "Failed: " + errorText);
      }
    } catch (err) {
      showError("Error", err.message);
    } finally {
      setActionProcessing(null);
    }
  };

  const getStatus = (leave) => (leave?.status || "").toLowerCase().trim();

  const filteredLeaves = leaveRequests.filter((leave) => {
    const matchesSearch =
      leave.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.leave_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.reason?.toLowerCase().includes(searchQuery.toLowerCase());

    const status = getStatus(leave);
    const matchesStatus =
      statusFilter === "ALL" ||
      status.toUpperCase() === statusFilter ||
      (statusFilter === "PENDING" && status === "incharge_approved") ||
      (statusFilter === "APPROVED" &&
        (status === "admin_approved" || status === "approved")) ||
      (statusFilter === "REJECTED" && status === "rejected");

    return matchesSearch && matchesStatus;
  });

  const modalStatus = selectedLeave ? getStatus(selectedLeave) : "";
  const modalInchargeApproved =
    modalStatus === "incharge_approved" || modalStatus === "approved";
  const modalAdminApproved =
    modalStatus === "admin_approved" || modalStatus === "approved";
  const modalInchargeRejected =
    modalStatus === "rejected" && selectedLeave?.incharge_id;
  const modalAdminRejected =
    modalStatus === "rejected" && selectedLeave?.admin_id;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#8b5cf6]" />
            Leave Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Apply leave on behalf of drivers and manage approvals
          </p>
        </div>
        <button
          onClick={openApplyLeaveModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-semibold text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Apply Leave
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by driver name, leave type, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                {value: "ALL", label: "All Status"},
                {value: "PENDING", label: "Pending"},
                {value: "APPROVED", label: "Approved"},
                {value: "REJECTED", label: "Rejected"},
              ]}
              width="w-40"
            />
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <Loading fullScreen={false} />
        ) : filteredLeaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              No Leave Requests
            </h3>
            <p className="text-sm text-gray-500">
              There are no leave requests to display.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Driver Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    From Date
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    To Date
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Incharge Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Admin Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeaves.map((leave, idx) => {
                  const status = getStatus(leave);
                  const inchargeApproved = !!(
                    leave.incharge_approved_at ||
                    status === "incharge_approved" ||
                    status === "approved"
                  );
                  const adminApproved =
                    status !== "rejected" &&
                    !!(
                      leave.admin_approved_at ||
                      status === "admin_approved" ||
                      status === "approved"
                    );
                  const inchargeRejected =
                    status === "rejected" && leave.incharge_id;
                  const adminRejected = status === "rejected" && leave.admin_id;

                  return (
                    <tr
                      key={leave.id || idx}
                      onClick={() => {
                        setSelectedLeave(leave);
                        setShowLeaveModal(true);
                        setRemarks("");
                      }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-semibold text-sm">
                            {leave.driver_name?.charAt(0) || "D"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {leave.driver_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {leave.driver_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#8b5cf6]/10 text-[#8b5cf6]">
                          {leave.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {leave.start_date || "-"}
                          </span>
                          {leave.start_time && (
                            <span className="text-xs text-gray-500">
                              {leave.start_time}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {leave.end_date || "-"}
                          </span>
                          {leave.end_time && (
                            <span className="text-xs text-gray-500">
                              {leave.end_time}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {calculateDuration(leave.start_date, leave.end_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                            inchargeApproved
                              ? "bg-green-100 text-green-700"
                              : inchargeRejected
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {inchargeApproved
                            ? "Approved"
                            : inchargeRejected
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                            adminApproved
                              ? "bg-green-100 text-green-700"
                              : adminRejected
                                ? "bg-red-100 text-red-700"
                                : inchargeApproved
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {adminApproved
                            ? "Approved"
                            : adminRejected
                              ? "Rejected"
                              : inchargeApproved
                                ? "Pending"
                                : "Waiting"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 flex justify-between items-center">
          <span>Total: {filteredLeaves.length} leave request(s)</span>
        </div>
      </div>

      {/* Leave Details Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#8b5cf6]/5 to-transparent">
              <h3 className="text-xl font-bold text-gray-800">
                Leave Details - {selectedLeave.leave_type}
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Leave Information Section */}
              <div>
                <h4 className="text-base font-bold text-gray-800 mb-4">
                  Leave Information
                </h4>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Leave Type
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.leave_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Type
                    </p>
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-[#8b5cf6] text-white">
                      {selectedLeave.leave_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      From Date
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {selectedLeave.start_date || "-"}
                      {selectedLeave.start_time && (
                        <span className="text-gray-600">
                          , {selectedLeave.start_time}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      To Date
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {selectedLeave.end_date || "-"}
                      {selectedLeave.end_time && (
                        <span className="text-gray-600">
                          , {selectedLeave.end_time}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Gate Out
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.start_time || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Gate In
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.end_time || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Duration
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {calculateDuration(
                        selectedLeave.start_date,
                        selectedLeave.end_date,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Status
                    </p>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${getStatusColor(selectedLeave).bg} ${getStatusColor(selectedLeave).text}`}
                    >
                      {getStatusLabel(selectedLeave)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Remarks
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.reason || "No remarks provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval Status Section */}
              <div className="border-t border-gray-200 pt-5">
                <h4 className="text-base font-bold text-gray-800 mb-4">
                  Approval Status
                </h4>
                <div className="space-y-3">
                  {/* Incharge Approval */}
                  <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          Incharge Approval
                        </p>
                        {selectedLeave.incharge_name ? (
                          <div>
                            <p className="text-sm text-gray-700">
                              {selectedLeave.incharge_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getStatus(selectedLeave) === "rejected" &&
                              selectedLeave.incharge_id
                                ? `Rejected by ${selectedLeave.incharge_name}`
                                : selectedLeave.incharge_approved_at
                                  ? `Approved by ${selectedLeave.incharge_name}`
                                  : "Not yet reviewed"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Not yet reviewed
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-semibold ${
                          modalInchargeApproved
                            ? "bg-green-100 text-green-700"
                            : modalInchargeRejected
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {modalInchargeApproved
                          ? "Approved"
                          : modalInchargeRejected
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Admin Approval */}
                  <div className="bg-blue-50 rounded-md p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          Admin Approval
                        </p>
                        {selectedLeave.admin_name ? (
                          <div>
                            <p className="text-sm text-gray-700">
                              {selectedLeave.admin_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getStatus(selectedLeave) === "rejected" &&
                              selectedLeave.admin_id
                                ? `Rejected by ${selectedLeave.admin_name}`
                                : selectedLeave.admin_approved_at
                                  ? `Approved by ${selectedLeave.admin_name}`
                                  : "Not yet reviewed"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Not yet reviewed
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-semibold ${
                          modalAdminApproved
                            ? "bg-green-100 text-green-700"
                            : modalAdminRejected
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {modalAdminApproved
                          ? "Approved"
                          : modalAdminRejected
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Pending Requests */}
              {!selectedLeave.admin_approved_at &&
                getStatus(selectedLeave) !== "rejected" && (
                  <div className="border-t border-gray-200 pt-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add your remarks here..."
                      rows="3"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm resize-none"
                    />
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              {!selectedLeave.admin_approved_at &&
              getStatus(selectedLeave) !== "rejected" ? (
                <>
                  <button
                    onClick={() => approveLeave(selectedLeave.id, "rejected")}
                    disabled={actionProcessing === selectedLeave.id}
                    className="px-5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionProcessing === selectedLeave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveClick(selectedLeave)}
                    disabled={actionProcessing === selectedLeave.id}
                    className="px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionProcessing === selectedLeave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve Leave
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Temporary Assignment Modal */}
      {showAssignmentModal && selectedLeave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/50 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#8b5cf6]/5 to-transparent">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Assign Temporary Replacements
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Driver:{" "}
                  <span className="font-semibold">
                    {selectedLeave.driver_name}
                  </span>{" "}
                  | Leave:{" "}
                  <span className="font-semibold">
                    {selectedLeave.start_date || "-"} -{" "}
                    {selectedLeave.end_date || "-"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignmentModal(false);
                  setTempAssignments({});
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAssignments ? (
                <Loading fullScreen={false} />
              ) : affectedAssignments.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-6 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h4 className="text-lg font-semibold text-green-800 mb-2">
                    No Active Assignments
                  </h4>
                  <p className="text-sm text-green-700">
                    This driver has no active assignments during the leave
                    period. You can proceed to approve the leave directly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        {affectedAssignments.length} Assignment
                        {affectedAssignments.length > 1 ? "s" : ""} Affected
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Please assign temporary replacement drivers for the
                        following assignments. You can skip assignments if no
                        replacement is needed.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {affectedAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="bg-white border border-gray-200 rounded-md p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Assignment Info */}
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-md bg-[#8b5cf6]/10 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-6 h-6 text-[#8b5cf6]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-gray-800 text-lg">
                                {assignment.vehicle_name ||
                                  assignment.vehicle_number}
                              </p>
                              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600">
                                {assignment.vehicle_type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {assignment.vehicle_number}
                            </p>
                            <div className="flex flex-wrap gap-4 mt-3 text-sm">
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Clock className="w-4 h-4 text-[#8b5cf6]" />
                                <span className="font-medium">
                                  {assignment.shift_name}
                                </span>
                                <span className="text-gray-400">
                                  ({formatTimeAMPM(assignment.shift_start_time)}{" "}
                                  - {formatTimeAMPM(assignment.shift_end_time)})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Calendar className="w-4 h-4 text-[#8b5cf6]" />
                                <span>
                                  {assignment.start_date} to{" "}
                                  {assignment.end_date}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Replacement Driver Selection - List Style */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-[#8b5cf6]" />
                            <label className="text-sm font-semibold text-gray-700">
                              Choose a Replacement Driver
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            Select an available driver who doesn't have
                            conflicting assignments:
                          </p>
                          <div className="border border-gray-200 rounded-md overflow-hidden divide-y divide-gray-100">
                            {availableDrivers.map((driver) => {
                              const isSelected =
                                tempAssignments[assignment.id]
                                  ?.replacement_driver_id === String(driver.id);
                              return (
                                <div
                                  key={driver.id}
                                  onClick={() => {
                                    setTempAssignments((prev) => ({
                                      ...prev,
                                      [assignment.id]: {
                                        ...prev[assignment.id],
                                        replacement_driver_id: isSelected
                                          ? ""
                                          : String(driver.id),
                                      },
                                    }));
                                  }}
                                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-[#8b5cf6]/5 border-l-4 border-l-[#8b5cf6]"
                                      : "bg-white hover:bg-gray-50 border-l-4 border-l-transparent"
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span
                                      className={`text-sm font-semibold ${isSelected ? "text-[#8b5cf6]" : "text-gray-800"}`}
                                    >
                                      {driver.full_name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      License: {driver.license_type || "N/A"}
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="w-5 h-5 text-[#8b5cf6] flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                            {availableDrivers.length === 0 && (
                              <div className="px-4 py-6 text-center text-sm text-gray-500">
                                No available drivers found for this period
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Remarks Section */}
              <div className="border-t border-gray-200 pt-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Approval Remarks (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any remarks for this leave approval..."
                  rows="2"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {Object.values(tempAssignments).filter(
                  (ta) => ta.replacement_driver_id,
                ).length > 0 && (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {
                      Object.values(tempAssignments).filter(
                        (ta) => ta.replacement_driver_id,
                      ).length
                    }{" "}
                    replacement(s) assigned
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setTempAssignments({});
                  }}
                  className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={approveWithAssignments}
                  disabled={actionProcessing === selectedLeave.id}
                  className="px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {actionProcessing === selectedLeave.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {affectedAssignments.length > 0
                    ? "Approve & Create Assignments"
                    : "Approve Leave"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#8b5cf6]/5 to-transparent">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#8b5cf6]" />
                Apply Leave (Admin)
              </h3>
              <button
                onClick={() => setShowApplyLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Driver Select */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Select Driver <span className="text-red-500">*</span>
                </label>
                <SearchableDropdown
                  value={applyLeaveForm.driver_id}
                  onChange={(val) =>
                    setApplyLeaveForm((prev) => ({
                      ...prev,
                      driver_id: val,
                    }))
                  }
                  options={driversList.map((d) => ({
                    value: String(d.id || d.driver_id),
                    label: `${d.full_name || d.name}${d.phone ? ` (${d.phone})` : ""}`,
                  }))}
                  placeholder="-- Select a driver --"
                  searchPlaceholder="Search driver name or phone..."
                  width="w-full"
                />
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Leave Type
                </label>
                <CustomDropdown
                  value={applyLeaveForm.leave_type}
                  onChange={(val) =>
                    setApplyLeaveForm((prev) => ({
                      ...prev,
                      leave_type: val,
                    }))
                  }
                  options={[
                    {value: "Casual Leave", label: "Casual Leave"},
                    {value: "Sick Leave", label: "Sick Leave"},
                    {value: "Permission", label: "Permission"},
                    {value: "Emergency Leave", label: "Emergency Leave"},
                    {value: "Compensatory Off", label: "Compensatory Off"},
                    {value: "Other", label: "Other"},
                  ]}
                  placeholder="Select leave type"
                  width="w-full"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={applyLeaveForm.start_date}
                    onChange={(e) =>
                      setApplyLeaveForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    className="w-full h-[42px] px-3 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={applyLeaveForm.end_date}
                    onChange={(e) =>
                      setApplyLeaveForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    className="w-full h-[42px] px-3 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={applyLeaveForm.start_time}
                    onChange={(e) =>
                      setApplyLeaveForm((prev) => ({
                        ...prev,
                        start_time: e.target.value,
                      }))
                    }
                    className="w-full h-[42px] px-3 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={applyLeaveForm.end_time}
                    onChange={(e) =>
                      setApplyLeaveForm((prev) => ({
                        ...prev,
                        end_time: e.target.value,
                      }))
                    }
                    className="w-full h-[42px] px-3 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Reason
                </label>
                <textarea
                  value={applyLeaveForm.reason}
                  onChange={(e) =>
                    setApplyLeaveForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Reason for leave..."
                  rows="3"
                  className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext placeholder:text-secondarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> Leave applied by admin will be
                  auto-approved (admin_approved). Attendance will be
                  automatically marked as absent for the leave period.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowApplyLeaveModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLeave}
                disabled={applyLeaveLoading}
                className="px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {applyLeaveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Apply Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
