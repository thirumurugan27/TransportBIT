import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Loader2,
  X,
  FileText,
  User,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import {
  calculateDuration,
  getStatusLabel,
  getStatusColor,
} from "../../../utils/dateFormat";

export default function LeaveApprovals() {
  const {showToast} = useToast();
  const [loading, setLoading] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionProcessing, setActionProcessing] = useState(null);
  const [remarks, setRemarks] = useState("");

  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  const fetchPendingLeaves = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/incharge/leave/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingLeaves(Array.isArray(data) ? data : []);
      } else {
        setPendingLeaves([]);
      }
    } catch (err) {
      console.error(err);
      setPendingLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLeaves();
  }, []);

  const handleLeaveAction = async (leaveId, action) => {
    setActionProcessing(leaveId);
    try {
      const res = await apiPost("/api/incharge/leave/approve", {
        leave_id: leaveId,
        incharge_id: parseInt(inchargeId),
        status: action,
        remarks: remarks || "",
      });
      if (res.ok) {
        const data = await res.json();
        showToast(
          data.message || "Leave request processed successfully",
          "success",
        );
        fetchPendingLeaves();
        setShowLeaveModal(false);
        setRemarks("");
      } else {
        const errorText = await res.text();
        showToast("Error: " + errorText, "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setActionProcessing(null);
    }
  };

  const getStatus = (leave) => (leave?.status || "").toLowerCase().trim();

  const filteredLeaves = pendingLeaves.filter((leave) => {
    const matchesSearch =
      leave.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.leave_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.reason?.toLowerCase().includes(searchQuery.toLowerCase());

    const status = getStatus(leave);
    let matchesStatus = false;
    if (statusFilter === "ALL") {
      matchesStatus = true;
    } else if (statusFilter === "PENDING") {
      matchesStatus = status === "pending";
    } else if (statusFilter === "INCHARGE_APPROVED") {
      matchesStatus = status === "incharge_approved";
    } else if (statusFilter === "ADMIN_APPROVED") {
      matchesStatus = status === "admin_approved";
    } else if (statusFilter === "APPROVED") {
      matchesStatus = status === "approved";
    } else if (statusFilter === "REJECTED") {
      matchesStatus = status === "rejected";
    }

    return matchesSearch && matchesStatus;
  });

  const modalStatus = selectedLeave ? getStatus(selectedLeave) : "";
  const inchargeApproved =
    modalStatus === "incharge_approved" || modalStatus === "approved";
  const adminApproved =
    modalStatus === "admin_approved" || modalStatus === "approved";
  const inchargeRejected =
    modalStatus === "rejected" && selectedLeave?.incharge_id;
  const adminRejected = modalStatus === "rejected" && selectedLeave?.admin_id;

  // Count stats
  const pendingCount = pendingLeaves.filter(
    (l) => getStatus(l) === "pending",
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primarytext flex items-center gap-2">
          <CheckCircle2 className="w-7 h-7 text-primary" />
          Leave Approvals
        </h1>
        <p className="text-sm text-secondarytext mt-1">
          Review and manage driver leave requests
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-secondarybg rounded-md p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext w-5 h-5" />
            <input
              type="text"
              placeholder="Search by driver name, leave type, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[42px] pl-10 pr-4 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext placeholder:text-secondarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-secondarytext" />
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                {value: "ALL", label: "All Status"},
                {
                  value: "PENDING",
                  label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
                },
                {value: "INCHARGE_APPROVED", label: "Incharge Approved"},
                {value: "ADMIN_APPROVED", label: "Admin Approved"},
                {value: "APPROVED", label: "Fully Approved"},
                {value: "REJECTED", label: "Rejected"},
              ]}
              width="w-52"
            />
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <Loading fullScreen={false} />
        ) : filteredLeaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-primarytext mb-1">
              No Leave Requests
            </h3>
            <p className="text-sm text-secondarytext">
              {statusFilter !== "ALL"
                ? "No leave requests found for the selected filter."
                : "There are no leave requests at this time."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    To
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Applied On
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeaves.map((leave, idx) => {
                  const statusColors = getStatusColor(leave);
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
                          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                            {leave.driver_name?.charAt(0) || "D"}
                          </div>
                          <p className="text-sm font-semibold text-primarytext">
                            {leave.driver_name || "Unknown"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                          {leave.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-primarytext">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {leave.start_date || "-"}
                          </span>
                          {leave.start_time && (
                            <span className="text-xs text-secondarytext">
                              {leave.start_time}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-primarytext">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {leave.end_date || "-"}
                          </span>
                          {leave.end_time && (
                            <span className="text-xs text-secondarytext">
                              {leave.end_time}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-primarytext">
                        {calculateDuration(leave.start_date, leave.end_date)}
                      </td>
                      <td className="px-6 py-4 text-xs text-secondarytext">
                        {leave.created_at || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${statusColors.bg} ${statusColors.text}`}
                        >
                          {getStatusLabel(leave)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-secondarytext flex justify-between items-center">
          <span>Total: {filteredLeaves.length} leave request(s)</span>
        </div>
      </div>

      {/* Leave Details Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-primary/5">
              <h3 className="text-xl font-bold text-primarytext flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Leave Details
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Driver Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {selectedLeave.driver_name?.charAt(0) || "D"}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-primarytext">
                    {selectedLeave.driver_name || "Unknown Driver"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                      {selectedLeave.leave_type}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${getStatusColor(selectedLeave).bg} ${getStatusColor(selectedLeave).text}`}
                    >
                      {getStatusLabel(selectedLeave)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leave Details Grid */}
              <div>
                <h4 className="text-sm font-bold text-primarytext mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Leave Period
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primarybg rounded-md p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-secondarytext mb-1">
                      From
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedLeave.start_date || "-"}
                    </p>
                    {selectedLeave.start_time && (
                      <p className="text-xs text-secondarytext mt-0.5">
                        {selectedLeave.start_time}
                      </p>
                    )}
                  </div>
                  <div className="bg-primarybg rounded-md p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-secondarytext mb-1">
                      To
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedLeave.end_date || "-"}
                    </p>
                    {selectedLeave.end_time && (
                      <p className="text-xs text-secondarytext mt-0.5">
                        {selectedLeave.end_time}
                      </p>
                    )}
                  </div>
                  <div className="bg-primarybg rounded-md p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-secondarytext mb-1">
                      Duration
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {calculateDuration(
                        selectedLeave.start_date,
                        selectedLeave.end_date,
                      )}
                    </p>
                  </div>
                  <div className="bg-primarybg rounded-md p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-secondarytext mb-1">
                      Applied On
                    </p>
                    <p className="text-sm font-semibold text-primarytext">
                      {selectedLeave.created_at || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {selectedLeave.reason && (
                <div>
                  <h4 className="text-sm font-bold text-primarytext mb-2">
                    Reason
                  </h4>
                  <p className="text-sm text-secondarytext bg-primarybg rounded-md p-3 border border-gray-100">
                    {selectedLeave.reason}
                  </p>
                </div>
              )}

              {/* Approval Status */}
              <div>
                <h4 className="text-sm font-bold text-primarytext mb-3">
                  Approval Status
                </h4>
                <div className="space-y-3">
                  {/* Incharge Approval */}
                  <div
                    className={`rounded-md p-4 border ${inchargeApproved ? "bg-green-50 border-green-200" : inchargeRejected ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-secondarytext" />
                        <div>
                          <p className="text-sm font-semibold text-primarytext">
                            Incharge
                          </p>
                          {selectedLeave.incharge_name ? (
                            <p className="text-xs text-secondarytext mt-0.5">
                              {inchargeRejected ? "Rejected" : "Approved"} by{" "}
                              {selectedLeave.incharge_name}
                              {selectedLeave.incharge_approved_at && (
                                <span>
                                  {" "}
                                  • {selectedLeave.incharge_approved_at}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-secondarytext mt-0.5">
                              Not yet reviewed
                            </p>
                          )}
                          {selectedLeave.incharge_remarks && (
                            <p className="text-xs text-secondarytext mt-1 italic">
                              &quot;{selectedLeave.incharge_remarks}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
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
                    </div>
                  </div>

                  {/* Admin Approval */}
                  <div
                    className={`rounded-md p-4 border ${adminApproved ? "bg-green-50 border-green-200" : adminRejected ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-secondarytext" />
                        <div>
                          <p className="text-sm font-semibold text-primarytext">
                            Admin
                          </p>
                          {selectedLeave.admin_name ? (
                            <p className="text-xs text-secondarytext mt-0.5">
                              {adminRejected ? "Rejected" : "Approved"} by{" "}
                              {selectedLeave.admin_name}
                              {selectedLeave.admin_approved_at && (
                                <span>
                                  {" "}
                                  • {selectedLeave.admin_approved_at}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-secondarytext mt-0.5">
                              Not yet reviewed
                            </p>
                          )}
                          {selectedLeave.admin_remarks && (
                            <p className="text-xs text-secondarytext mt-1 italic">
                              &quot;{selectedLeave.admin_remarks}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          adminApproved
                            ? "bg-green-100 text-green-700"
                            : adminRejected
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {adminApproved
                          ? "Approved"
                          : adminRejected
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks input for pending leaves */}
              {!selectedLeave.incharge_approved_at &&
                getStatus(selectedLeave) !== "rejected" && (
                  <div>
                    <label className="block text-sm font-semibold text-primarytext mb-2">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add your remarks here..."
                      rows="3"
                      className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext placeholder:text-secondarytext hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    />
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              {!selectedLeave.incharge_approved_at &&
              getStatus(selectedLeave) !== "rejected" ? (
                <>
                  <button
                    onClick={() => setShowLeaveModal(false)}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-secondarytext border border-gray-200 rounded-md font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleLeaveAction(selectedLeave.id, "rejected")
                    }
                    disabled={actionProcessing === selectedLeave.id}
                    className="px-5 py-2.5 bg-white hover:bg-red-50 text-red border border-red/20 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionProcessing === selectedLeave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      handleLeaveAction(selectedLeave.id, "approved")
                    }
                    disabled={actionProcessing === selectedLeave.id}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionProcessing === selectedLeave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-sm transition-colors"
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
