import React, {useState, useEffect} from "react";
import {
  Calendar,
  Clock,
  FileText,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Info,
} from "lucide-react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";

export default function DriverApplyLeave() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PENDING, APPROVED, REJECTED

  // Get driver info from auth context
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [formData, setFormData] = useState({
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    leave_type: "Leave", // Default as per screenshot
    reason: "",
  });

  useEffect(() => {
    if (driverId) {
      fetchLeaves();
    }
  }, [driverId]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await apiGet(`/api/driver/leave?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaves(
          Array.isArray(data) ? data : data && data.leaves ? data.leaves : [],
        );
      } else {
        console.error("Failed to fetch leaves");
      }
    } catch (err) {
      console.error("Error fetching leaves:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        driver_id: parseInt(driverId),
        start_date: formData.start_date,
        start_time: formData.start_time,
        end_date: formData.end_date,
        end_time: formData.end_time,
        leave_type: formData.leave_type,
        reason: formData.reason,
      };

      const res = await apiPost("/api/driver/leave/apply", payload);

      if (res.ok) {
        setShowModal(false);
        setFormData({
          start_date: "",
          start_time: "",
          end_date: "",
          end_time: "",
          leave_type: "Leave",
          reason: "",
        });
        fetchLeaves(); // Refresh list
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to apply for leave");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateDuration = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} days`;
  };

  const formatDateTime = (date, time) => {
    if (!date) return "-";
    if (!time) return date;
    return `${date} ${time}`;
  };

  const getStatus = (leave) => (leave?.status || "").toLowerCase();

  const filteredLeaves = leaves.filter((leave) => {
    const matchesSearch =
      leave.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leave.leave_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const status = getStatus(leave);
    const matchesStatus =
      statusFilter === "ALL" || status.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openDetails = (leave) => {
    setSelectedLeave(leave);
    setShowDetailsModal(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primarytext">My Leaves</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primarydull text-white px-6 py-2.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md"
        >
          Apply Leave
        </button>
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
              placeholder="Search by leave type or remarks..."
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

      {/* Leave History List */}
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
              No Leave History
            </h3>
            <p className="text-secondarytext text-sm">
              No leave records found matching your criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">From Date</th>
                  <th className="px-6 py-4">To Date</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Remarks</th>
                  <th className="px-6 py-4">Incharge Status</th>
                  <th className="px-6 py-4">Admin Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeaves.map((leave, idx) => (
                  <tr
                    key={leave.id || idx}
                    onClick={() => openDetails(leave)}
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {leave.leave_type}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 bg-[#0ea5e9] text-white rounded-full text-xs font-medium shadow-sm">
                        Leave
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(leave.start_date, leave.start_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(leave.end_date, leave.end_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {calculateDuration(leave.start_date, leave.end_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-50 truncate">
                      {leave.reason}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          leave.incharge_approved_at ||
                          getStatus(leave) === "incharge_approved" ||
                          getStatus(leave) === "admin_approved" ||
                          getStatus(leave) === "approved"
                            ? "bg-green/10 text-green border-green/20"
                            : getStatus(leave) === "rejected" &&
                                leave.incharge_id &&
                                !leave.admin_id
                              ? "bg-red/10 text-red border-red/20"
                              : "bg-pending/10 text-pending border-pending/20"
                        }`}
                      >
                        {leave.incharge_approved_at ||
                        getStatus(leave) === "incharge_approved" ||
                        getStatus(leave) === "admin_approved" ||
                        getStatus(leave) === "approved"
                          ? "Approved"
                          : getStatus(leave) === "rejected" &&
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
                          getStatus(leave) === "admin_approved" ||
                          getStatus(leave) === "approved"
                            ? "bg-green/10 text-green border-green/20"
                            : getStatus(leave) === "rejected" && leave.admin_id
                              ? "bg-red/10 text-red border-red/20"
                              : leave.incharge_approved_at
                                ? "bg-pending/10 text-pending border-pending/20"
                                : "bg-gray-100 text-gray-400 border-gray-200"
                        }`}
                      >
                        {leave.admin_approved_at ||
                        getStatus(leave) === "admin_approved" ||
                        getStatus(leave) === "approved"
                          ? "Approved"
                          : getStatus(leave) === "rejected" && leave.admin_id
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

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl animate-scaleIn overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApply} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm flex items-center gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Leave Type
                  </label>
                  <select
                    value={formData.leave_type}
                    onChange={(e) =>
                      setFormData({...formData, leave_type: e.target.value})
                    }
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm"
                  >
                    <option value="Leave">Leave</option>
                    <option value="GP">GP</option>
                    <option value="OD">OD</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      From Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({...formData, start_date: e.target.value})
                        }
                        className="w-full pl-4 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      To Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({...formData, end_date: e.target.value})
                        }
                        className="w-full pl-4 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      From Time
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        required
                        value={formData.start_time}
                        onChange={(e) =>
                          setFormData({...formData, start_time: e.target.value})
                        }
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm"
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      To Time
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        required
                        value={formData.end_time}
                        onChange={(e) =>
                          setFormData({...formData, end_time: e.target.value})
                        }
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm"
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Remarks
                  </label>
                  <textarea
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 focus:border-[#8b5cf6] transition-all text-sm resize-none"
                    rows="3"
                    placeholder="Enter reason for leave"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({...formData, reason: e.target.value})
                    }
                  ></textarea>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#f43f5e] hover:bg-[#e11d48] text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm font-medium rounded-md shadow-sm transition-all disabled:opacity-70 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Leave Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl animate-scaleIn overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Leave Details - {selectedLeave.leave_type}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <h4 className="text-base font-semibold text-gray-800 mb-4">
                Leave Information
              </h4>
              <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Leave Type</p>
                  <p className="font-medium text-gray-800">
                    {selectedLeave.leave_type}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Type</p>
                  <span className="inline-flex px-3 py-0.5 bg-[#8b5cf6] text-white rounded-full text-xs font-medium">
                    Leave
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">From Date</p>
                  <p className="font-medium text-gray-800">
                    {formatDateTime(
                      selectedLeave.start_date,
                      selectedLeave.start_time,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">To Date</p>
                  <p className="font-medium text-gray-800">
                    {formatDateTime(
                      selectedLeave.end_date,
                      selectedLeave.end_time,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Duration</p>
                  <p className="font-medium text-gray-800">
                    {calculateDuration(
                      selectedLeave.start_date,
                      selectedLeave.end_date,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${
                      getStatus(selectedLeave) === "approved"
                        ? "bg-[#22c55e]"
                        : getStatus(selectedLeave) === "rejected"
                          ? "bg-[#ef4444]"
                          : "bg-[#eab308]"
                    }`}
                  >
                    {(selectedLeave.status || "Pending").toString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">Remarks</p>
                  <p className="font-medium text-gray-800">
                    {selectedLeave.reason}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="text-base font-semibold text-gray-800 mb-4">
                  Approval Timeline
                </h4>
                <div className="flex flex-col gap-3">
                  {/* Incharge */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-gray-700">
                          Incharge Review
                        </p>
                        {selectedLeave.incharge_name ? (
                          <p className="text-xs text-gray-500">
                            by {selectedLeave.incharge_name}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Pending Review
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          selectedLeave.incharge_approved_at
                            ? "bg-green/10 text-green"
                            : "bg-pending/10 text-pending"
                        }`}
                      >
                        {selectedLeave.incharge_approved_at
                          ? "APPROVED"
                          : "PENDING"}
                      </span>
                    </div>
                    {selectedLeave.incharge_remarks && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                        Note: {selectedLeave.incharge_remarks}
                      </p>
                    )}
                  </div>

                  {/* Admin */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-gray-700">
                          Admin Approval
                        </p>
                        {selectedLeave.admin_name ? (
                          <p className="text-xs text-gray-500">
                            by {selectedLeave.admin_name}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Waiting for Incharge
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          selectedLeave.admin_approved_at
                            ? "bg-green/10 text-green"
                            : "bg-pending/10 text-pending"
                        }`}
                      >
                        {selectedLeave.admin_approved_at
                          ? "APPROVED"
                          : "PENDING"}
                      </span>
                    </div>
                    {selectedLeave.admin_remarks && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                        Note: {selectedLeave.admin_remarks}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-md font-medium shadow-sm transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
