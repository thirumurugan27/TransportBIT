import React, {useState, useEffect} from "react";
import {showError, showSuccess} from "../../../utils/swal";
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
} from "lucide-react";
import {
  formatDate,
  formatTime,
  calculateDuration,
  getStatusLabel,
} from "../../../utils/dateFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function LeaveApprovals() {
  const [loading, setLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionProcessing, setActionProcessing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [remarks, setRemarks] = useState("");

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/leave/all`);
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

  const approveLeave = async (leaveId, status) => {
    setActionProcessing(leaveId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/leave/approve`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          leave_id: leaveId,
          approver_id: 1, // Admin ID
          status: status,
          remarks: remarks || "",
        }),
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
            Leave Approvals - Admin
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Final approval for driver leave requests
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by driver name, leave type, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
          </div>
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
                          <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-semibold text-sm">
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
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#8b5cf6]/10 text-[#8b5cf6]">
                          {leave.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatDate(leave.start_date)}
                          </span>
                          {leave.start_time && (
                            <span className="text-xs text-gray-500">
                              {formatTime(leave.start_time)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatDate(leave.end_date)}
                          </span>
                          {leave.end_time && (
                            <span className="text-xs text-gray-500">
                              {formatTime(leave.end_time)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {calculateDuration(leave.start_date, leave.end_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
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
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
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
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#8b5cf6] text-white">
                      {selectedLeave.leave_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      From Date
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(selectedLeave.start_date)}
                      {selectedLeave.start_time && (
                        <span className="text-gray-600">
                          , {formatTime(selectedLeave.start_time)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      To Date
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(selectedLeave.end_date)}
                      {selectedLeave.end_time && (
                        <span className="text-gray-600">
                          , {formatTime(selectedLeave.end_time)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Gate Out
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.start_time
                        ? formatTime(selectedLeave.start_time)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Gate In
                    </p>
                    <p className="text-sm text-gray-800">
                      {selectedLeave.end_time
                        ? formatTime(selectedLeave.end_time)
                        : "-"}
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
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedLeave).bg} ${getStatusColor(selectedLeave).text}`}
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
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
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
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:border-[#8b5cf6] text-sm resize-none"
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
                    className="px-5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionProcessing === selectedLeave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                  <button
                    onClick={() => approveLeave(selectedLeave.id, "approved")}
                    disabled={actionProcessing === selectedLeave.id}
                    className="px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
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
                  className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
