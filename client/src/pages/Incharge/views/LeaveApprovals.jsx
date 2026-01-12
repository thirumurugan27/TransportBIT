import React, {useState, useEffect} from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Loader2,
  AlertCircle,
  X,
  FileText,
  ChevronDown,
} from "lucide-react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";

export default function LeaveApprovals() {
  const [loading, setLoading] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PENDING, APPROVED, REJECTED
  const [actionProcessing, setActionProcessing] = useState(null);

  // Use auth context to get incharge ID
  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  const fetchPendingLeaves = async () => {
    setLoading(true);
    try {
      // Fetch ALL leaves so we can filter client-side
      const res = await apiGet("/api/admin/leave/all");
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

  const handleLeaveAction = async (leaveId, action, remarks = "") => {
    setActionProcessing(leaveId);
    try {
      const res = await apiPost("/api/admin/leave/approve", {
        leave_id: leaveId,
        approver_id: parseInt(inchargeId),
        status: action, // 'approved' or 'rejected'
        remarks: remarks,
      });
      if (res.ok) {
        fetchPendingLeaves();
        setShowLeaveModal(false);
      } else {
        alert("Error: " + (await res.text()));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionProcessing(null);
    }
  };

  const calculateDuration = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} days`;
  };

  const filteredLeaves = pendingLeaves.filter((leave) => {
    const matchesSearch =
      leave.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.leave_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (leave.status && leave.status.toUpperCase() === statusFilter) ||
      (statusFilter === "PENDING" && !leave.status); // Handle legacy null status as pending if needed

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Leave Approvals
          </h1>
          <p className="text-sm text-secondarytext mt-1">
            Review driver leave requests
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-md p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-secondarytext mb-1 block">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by leave type, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm text-primarytext"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext w-4 h-4" />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <label className="text-sm font-medium text-secondarytext mb-1 block">
            Filter Status
          </label>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm appearance-none cursor-pointer text-primarytext"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondarytext w-4 h-4 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-primarybg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-secondarytext" />
            </div>
            <h3 className="text-primarytext font-medium mb-1">
              No Pending Requests
            </h3>
            <p className="text-secondarytext text-sm">
              There are no leave requests requiring your approval.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-primarybg text-secondarytext text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Driver Name</th>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">From Date</th>
                  <th className="px-6 py-4">To Date</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Incharge Status</th>
                  <th className="px-6 py-4">Admin Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeaves.map((leave, idx) => (
                  <tr
                    key={leave.id || idx}
                    onClick={() => {
                      setSelectedLeave(leave);
                      setShowLeaveModal(true);
                    }}
                    className="hover:bg-primarybg/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-primarytext">
                      {leave.driver_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-secondarytext">
                      {leave.leave_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-secondarytext">
                      {leave.start_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-secondarytext">
                      {leave.end_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-primarytext font-medium">
                      {calculateDuration(leave.start_date, leave.end_date)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          leave.incharge_approved_at ||
                          leave.status === "incharge_approved" ||
                          leave.status === "admin_approved"
                            ? "bg-green/10 text-green border-green/20"
                            : leave.status === "rejected" &&
                              leave.incharge_id &&
                              !leave.admin_id
                            ? "bg-red/10 text-red border-red/20"
                            : "bg-pending/10 text-pending border-pending/20"
                        }`}
                      >
                        {leave.incharge_approved_at ||
                        leave.status === "incharge_approved" ||
                        leave.status === "admin_approved"
                          ? "Approved"
                          : leave.status === "rejected" &&
                            leave.incharge_id &&
                            !leave.admin_id
                          ? "Rejected"
                          : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          leave.admin_approved_at ||
                          leave.status === "admin_approved"
                            ? "bg-green/10 text-green border-green/20"
                            : leave.status === "rejected" && leave.admin_id
                            ? "bg-red/10 text-red border-red/20"
                            : leave.incharge_approved_at
                            ? "bg-pending/10 text-pending border-pending/20"
                            : "bg-gray-100 text-gray-400 border-gray-200"
                        }`}
                      >
                        {leave.admin_approved_at ||
                        leave.status === "admin_approved"
                          ? "Approved"
                          : leave.status === "rejected" && leave.admin_id
                          ? "Rejected"
                          : leave.incharge_approved_at
                          ? "Pending"
                          : "Waiting"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-500 flex justify-between items-center">
          <span>
            Show{" "}
            <select className="border border-gray-300 rounded px-1 py-0.5">
              <option>10</option>
              <option>50</option>
            </select>{" "}
            entries
          </span>
          <span>Showing {filteredLeaves.length} entries</span>
        </div>
      </div>

      {/* Details/Action Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl animate-scaleIn overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Review Leave Request
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-[#8b5cf6]/10 text-[#8b5cf6] rounded-full flex items-center justify-center text-lg font-bold">
                  {selectedLeave.driver_name?.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-800">
                    {selectedLeave.driver_name}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Driver ID: {selectedLeave.driver_id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm mb-8">
                <div>
                  <p className="text-gray-500 mb-1">Leave Type</p>
                  <p className="font-medium text-gray-800">
                    {selectedLeave.leave_type}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Duration</p>
                  <p className="font-medium text-gray-800">
                    {calculateDuration(
                      selectedLeave.start_date,
                      selectedLeave.end_date
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">From Date</p>
                  <p className="font-medium text-gray-800">
                    {selectedLeave.start_date}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">To Date</p>
                  <p className="font-medium text-gray-800">
                    {selectedLeave.end_date}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">Reason</p>
                  <div className="bg-gray-50 p-3 rounded text-gray-700 border border-gray-100 italic">
                    {selectedLeave.reason || "No reason provided."}
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="border-t border-gray-100 pt-6 mb-6">
                <h5 className="text-sm font-semibold text-gray-800 mb-4">
                  Approval Timeline
                </h5>
                <div className="flex gap-4">
                  {/* Incharge Status */}
                  <div
                    className={`flex-1 p-3 rounded border border-l-4 ${
                      selectedLeave.incharge_approved_at
                        ? "bg-green/10 border-green/20 border-l-green"
                        : "bg-gray-50 border-gray-200 border-l-gray-300"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-500">
                      Incharge Review
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedLeave.incharge_approved_at ? (
                        <CheckCircle2 className="text-green w-4 h-4" />
                      ) : (
                        <Clock className="text-gray-400 w-4 h-4" />
                      )}
                      <span
                        className={`text-sm font-bold ${
                          selectedLeave.incharge_approved_at
                            ? "text-green"
                            : "text-gray-500"
                        }`}
                      >
                        {selectedLeave.incharge_approved_at
                          ? "Approved"
                          : "Pending"}
                      </span>
                    </div>
                    {selectedLeave.incharge_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        by{" "}
                        <span className="font-medium">
                          {selectedLeave.incharge_name}
                        </span>
                      </p>
                    )}
                    {selectedLeave.incharge_remarks && (
                      <p className="text-xs text-gray-500 mt-2">
                        "{selectedLeave.incharge_remarks}"
                      </p>
                    )}
                  </div>

                  {/* Admin Status */}
                  <div
                    className={`flex-1 p-3 rounded border border-l-4 ${
                      selectedLeave.admin_approved_at
                        ? "bg-green/10 border-green/20 border-l-green"
                        : "bg-indigo-50 border-indigo-200 border-l-[#8b5cf6]"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-500">
                      Admin Approval
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedLeave.admin_approved_at ? (
                        <CheckCircle2 className="text-green w-4 h-4" />
                      ) : (
                        <Clock className="text-[#8b5cf6] w-4 h-4" />
                      )}
                      <span
                        className={`text-sm font-bold ${
                          selectedLeave.admin_approved_at
                            ? "text-green"
                            : "text-[#8b5cf6]"
                        }`}
                      >
                        {selectedLeave.admin_approved_at
                          ? "Approved"
                          : "Reviewing"}
                      </span>
                    </div>
                    {selectedLeave.admin_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        by{" "}
                        <span className="font-medium">
                          {selectedLeave.admin_name}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    const r = prompt("Reason for rejection:");
                    if (r) handleLeaveAction(selectedLeave.id, "rejected", r);
                  }}
                  disabled={actionProcessing === selectedLeave.id}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md font-medium text-sm transition-colors"
                >
                  Reject Request
                </button>
                <button
                  onClick={() =>
                    handleLeaveAction(selectedLeave.id, "approved")
                  }
                  disabled={actionProcessing === selectedLeave.id}
                  className="px-6 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  {actionProcessing === selectedLeave.id && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Approve & Forward
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
