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

  // Helper for status badge rendering
  const getInchargeStatusInfo = (leave) => {
    const status = getStatus(leave);
    if (
      leave.incharge_approved_at ||
      status === "incharge_approved" ||
      status === "admin_approved" ||
      status === "approved"
    )
      return {
        label: "Approved",
        cls: "bg-green/10 text-green border border-green/20",
      };
    if (status === "rejected" && leave.incharge_id && !leave.admin_id)
      return {
        label: "Rejected",
        cls: "bg-red/10 text-red border border-red/20",
      };
    return {
      label: "Pending",
      cls: "bg-pending/10 text-pending border border-pending/20",
    };
  };

  const getAdminStatusInfo = (leave) => {
    const status = getStatus(leave);
    if (
      leave.admin_approved_at ||
      status === "admin_approved" ||
      status === "approved"
    )
      return {
        label: "Approved",
        cls: "bg-green/10 text-green border border-green/20",
      };
    if (status === "rejected" && leave.admin_id)
      return {
        label: "Rejected",
        cls: "bg-red/10 text-red border border-red/20",
      };
    if (leave.incharge_approved_at)
      return {
        label: "Pending",
        cls: "bg-pending/10 text-pending border border-pending/20",
      };
    return {
      label: "Waiting",
      cls: "bg-gray-100 text-gray-400 border border-gray-200",
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg sm:text-2xl font-bold text-primarytext">
          My Leaves
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primarydull text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">Apply</span> Leave
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-md p-3 sm:p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by leave type or remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm text-primarytext placeholder:text-gray-400"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>

        <div className="relative w-full sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm appearance-none cursor-pointer text-primarytext"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        </div>
      </div>

      {/* Leave History */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="bg-gray-50 w-16 h-16 rounded-md flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-primarytext font-semibold mb-1">
              No Leave History
            </h3>
            <p className="text-gray-400 text-sm">
              No leave records found matching your criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table - hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Leave Type</th>
                    <th className="px-5 py-3.5">From</th>
                    <th className="px-5 py-3.5">To</th>
                    <th className="px-5 py-3.5">Duration</th>
                    <th className="px-5 py-3.5">Remarks</th>
                    <th className="px-5 py-3.5">Incharge</th>
                    <th className="px-5 py-3.5">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLeaves.map((leave, idx) => {
                    const ich = getInchargeStatusInfo(leave);
                    const adm = getAdminStatusInfo(leave);
                    return (
                      <tr
                        key={leave.id || idx}
                        onClick={() => openDetails(leave)}
                        className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-800">
                          {leave.leave_type}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {formatDateTime(leave.start_date, leave.start_time)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {formatDateTime(leave.end_date, leave.end_time)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-800 font-medium">
                          {calculateDuration(leave.start_date, leave.end_date)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[180px] truncate">
                          {leave.reason}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${ich.cls}`}
                          >
                            {ich.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${adm.cls}`}
                          >
                            {adm.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards - hidden on desktop */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredLeaves.map((leave, idx) => {
                const ich = getInchargeStatusInfo(leave);
                const adm = getAdminStatusInfo(leave);
                return (
                  <div
                    key={leave.id || idx}
                    onClick={() => openDetails(leave)}
                    className="p-4 active:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Top row: type + status badges */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {leave.leave_type}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${ich.cls}`}
                        >
                          {ich.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${adm.cls}`}
                        >
                          {adm.label}
                        </span>
                      </div>
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {formatDateTime(leave.start_date, leave.start_time)}
                        <span className="mx-1.5 text-gray-300">&rarr;</span>
                        {formatDateTime(leave.end_date, leave.end_time)}
                      </span>
                    </div>

                    {/* Duration + Reason */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        {calculateDuration(leave.start_date, leave.end_date)}
                      </span>
                      {leave.reason && (
                        <span className="text-xs text-gray-400 truncate max-w-[55%] text-right">
                          {leave.reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-500 flex justify-between items-center">
          <span>Total: {filteredLeaves.length}</span>
          <span className="text-gray-400">{filteredLeaves.length} entries</span>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[92vh] sm:max-h-[85vh] overflow-y-auto sm:mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-primarytext">
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-secondarytext hover:text-primarytext hover:bg-primarybg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApply} className="px-5 py-5 space-y-4">
              {error && (
                <div className="bg-red/10 text-red p-3 rounded-md text-sm flex items-center gap-2 border border-red/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Leave Type */}
              <div>
                <label className="block text-sm font-semibold text-primarytext mb-1.5">
                  Leave Type
                </label>
                <select
                  value={formData.leave_type}
                  onChange={(e) =>
                    setFormData({...formData, leave_type: e.target.value})
                  }
                  className="w-full px-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext"
                >
                  <option value="Leave">Leave</option>
                  <option value="GP">GP</option>
                  <option value="OD">OD</option>
                </select>
              </div>

              {/* From Date & To Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-primarytext mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({...formData, start_date: e.target.value})
                    }
                    className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primarytext mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({...formData, end_date: e.target.value})
                    }
                    className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext"
                  />
                </div>
              </div>

              {/* From Time & To Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-primarytext mb-1.5">
                    From Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({...formData, start_time: e.target.value})
                    }
                    className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primarytext mb-1.5">
                    To Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({...formData, end_time: e.target.value})
                    }
                    className="w-full px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-primarytext mb-1.5">
                  Remarks
                </label>
                <textarea
                  className="w-full px-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext resize-none placeholder:text-secondarytext"
                  rows="3"
                  placeholder="Enter reason for leave"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({...formData, reason: e.target.value})
                  }
                ></textarea>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-red hover:bg-red/90 text-white rounded-md text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary hover:bg-primarydull text-white text-sm font-semibold rounded-md transition-all disabled:opacity-70 flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-md shadow-2xl animate-scaleIn overflow-hidden max-h-[92vh] sm:max-h-[85vh] overflow-y-auto sm:mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-gray-800">
                Leave Details - {selectedLeave.leave_type}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Leave Information */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-4">
                  Leave Information
                </h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Leave Type</p>
                    <p className="font-medium text-gray-800">
                      {selectedLeave.leave_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Type</p>
                    <span className="inline-flex px-3 py-0.5 bg-primary text-white rounded-md text-xs font-medium">
                      {selectedLeave.leave_type || "Leave"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">From Date</p>
                    <p className="font-medium text-gray-800 text-[13px]">
                      {formatDateTime(
                        selectedLeave.start_date,
                        selectedLeave.start_time,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">To Date</p>
                    <p className="font-medium text-gray-800 text-[13px]">
                      {formatDateTime(
                        selectedLeave.end_date,
                        selectedLeave.end_time,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                    <p className="font-medium text-gray-800">
                      {calculateDuration(
                        selectedLeave.start_date,
                        selectedLeave.end_date,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Status</p>
                    <span
                      className={`inline-flex items-center px-3 py-0.5 rounded-md text-xs font-semibold text-white ${
                        getStatus(selectedLeave) === "approved" ||
                        getStatus(selectedLeave) === "admin_approved"
                          ? "bg-green"
                          : getStatus(selectedLeave) === "rejected"
                            ? "bg-red"
                            : "bg-pending"
                      }`}
                    >
                      {(selectedLeave.status || "Pending").toString()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Remarks</p>
                    <p className="font-medium text-gray-800 text-sm">
                      {selectedLeave.reason || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval Status */}
              <div className="border-t border-gray-100 pt-5">
                <h4 className="text-sm font-bold text-gray-800 mb-3">
                  Approval Status
                </h4>
                <div className="space-y-3">
                  {/* Incharge */}
                  <div className="border border-gray-200 rounded-md p-3.5 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700">
                          Incharge
                        </p>
                        {selectedLeave.incharge_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {selectedLeave.incharge_name}
                          </p>
                        )}
                        {selectedLeave.incharge_approved_at &&
                          selectedLeave.incharge_name && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Approved by: {selectedLeave.incharge_name}
                            </p>
                          )}
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-3 py-1 rounded-md text-white ${
                          selectedLeave.incharge_approved_at
                            ? "bg-green"
                            : getStatus(selectedLeave) === "rejected" &&
                                selectedLeave.incharge_id &&
                                !selectedLeave.admin_id
                              ? "bg-red"
                              : "bg-pending"
                        }`}
                      >
                        {selectedLeave.incharge_approved_at
                          ? "Approved"
                          : getStatus(selectedLeave) === "rejected" &&
                              selectedLeave.incharge_id &&
                              !selectedLeave.admin_id
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </div>
                    {selectedLeave.incharge_remarks && (
                      <p className="text-xs text-gray-600 mt-2.5 bg-white p-2 rounded-md border border-gray-100">
                        {selectedLeave.incharge_remarks}
                      </p>
                    )}
                  </div>

                  {/* Admin */}
                  <div className="border border-gray-200 rounded-md p-3.5 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700">Admin</p>
                        {selectedLeave.admin_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {selectedLeave.admin_name}
                          </p>
                        )}
                        {selectedLeave.admin_approved_at &&
                          selectedLeave.admin_name && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Approved by: {selectedLeave.admin_name}
                            </p>
                          )}
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-3 py-1 rounded-md text-white ${
                          selectedLeave.admin_approved_at
                            ? "bg-green"
                            : getStatus(selectedLeave) === "rejected" &&
                                selectedLeave.admin_id
                              ? "bg-red"
                              : selectedLeave.incharge_approved_at
                                ? "bg-pending"
                                : "bg-gray-300"
                        }`}
                      >
                        {selectedLeave.admin_approved_at
                          ? "Approved"
                          : getStatus(selectedLeave) === "rejected" &&
                              selectedLeave.admin_id
                            ? "Rejected"
                            : selectedLeave.incharge_approved_at
                              ? "Pending"
                              : "Waiting"}
                      </span>
                    </div>
                    {selectedLeave.admin_remarks && (
                      <p className="text-xs text-gray-600 mt-2.5 bg-white p-2 rounded-md border border-gray-100">
                        {selectedLeave.admin_remarks}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full py-3 bg-primary hover:bg-primarydull text-white rounded-md font-medium shadow-sm transition-all text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
