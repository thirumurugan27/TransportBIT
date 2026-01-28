import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, getToday} from "../../../utils/api";

export default function DriverHistory() {
  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [leaveStats, setLeaveStats] = useState({});
  const [loading, setLoading] = useState(false);

  const [historyStartDate, setHistoryStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [historyEndDate, setHistoryEndDate] = useState(getToday());
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");
  const [driverSearchTerm, setDriverSearchTerm] = useState("");

  useEffect(() => {
    if (inchargeId) {
      fetchAttendanceHistory();
      fetchLeaveHistory();
    }
  }, [inchargeId, historyStartDate, historyEndDate, attendanceStatusFilter]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      let url = `/api/incharge/attendance/history?incharge_id=${inchargeId}&start_date=${historyStartDate}&end_date=${historyEndDate}`;
      if (attendanceStatusFilter !== "all") {
        url += `&status=${attendanceStatusFilter}`;
      }
      const res = await apiGet(url);
      if (res.ok) {
        setAttendanceHistory((await res.json()) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveHistory = async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        apiGet("/api/admin/leave/history"),
        apiGet("/api/admin/leave/stats"),
      ]);
      const history = await historyRes.json();
      const stats = await statsRes.json();
      setLeaveHistory(history || []);
      setLeaveStats(stats || {});
    } catch (err) {
      console.error(err);
    }
  };

  // Filter the lists based on search term
  const filteredAttendance = attendanceHistory.filter((record) =>
    driverSearchTerm
      ? record.driver_name
          ?.toLowerCase()
          .includes(driverSearchTerm.toLowerCase())
      : true
  );

  const filteredLeaves = leaveHistory.filter((leave) =>
    driverSearchTerm
      ? leave.driver_name
          ?.toLowerCase()
          .includes(driverSearchTerm.toLowerCase())
      : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-primarytext">
            Driver History
          </h3>
          <p className="text-secondarytext text-sm">
            View attendance records and leave history for your drivers
          </p>
        </div>
      </div>

      <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col gap-4">
        {/* Filters Top Row */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search by driver name..."
              value={driverSearchTerm}
              onChange={(e) => setDriverSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none"
            />
            <svg
              className="w-5 h-5 text-secondarytext absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondarytext">
                From:
              </label>
              <input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="px-3 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondarytext">
                To:
              </label>
              <input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="px-3 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondarytext">
                Status:
              </label>
              <select
                value={attendanceStatusFilter}
                onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                className="px-3 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-xl p-5 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green/10 rounded-xl flex items-center justify-center text-xl">
              ✅
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green">
                {attendanceHistory?.filter((r) => r.status === "present")
                  .length || 0}
              </h3>
              <p className="text-xs text-secondarytext">Present Days</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-5 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red/10 rounded-xl flex items-center justify-center text-xl">
              ❌
            </div>
            <div>
              <h3 className="text-2xl font-bold text-red">
                {attendanceHistory?.filter((r) => r.status === "absent")
                  .length || 0}
              </h3>
              <p className="text-xs text-secondarytext">Absent Days</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-5 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl">
              🏖️
            </div>
            <div>
              <h3 className="text-2xl font-bold text-primary">
                {leaveStats.total || 0}
              </h3>
              <p className="text-xs text-secondarytext">Leave Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-5 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pending/10 rounded-xl flex items-center justify-center text-xl">
              ⏳
            </div>
            <div>
              <h3 className="text-2xl font-bold text-pending">
                {leaveStats.pending || 0}
              </h3>
              <p className="text-xs text-secondarytext">Leaves Pending</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-secondarytext animate-pulse">
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Records */}
          <div className="bg-secondarybg rounded-xl shadow-sm border border-primarybg overflow-hidden h-full">
            <div className="bg-primary/10 px-6 py-4 border-b border-primarybg">
              <h4 className="text-primary font-bold flex items-center gap-2">
                Attendance Records
              </h4>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-primarybg sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Marked By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAttendance && filteredAttendance.length > 0 ? (
                    filteredAttendance.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-primarybg/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-primarytext">
                          {record.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-secondarytext">
                          {record.driver_name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                              record.status === "present"
                                ? "bg-green/10 text-green border-green/20"
                                : "bg-red/10 text-red border-red/20"
                            }`}
                          >
                            {record.status === "present" ? "Present" : "Absent"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.marked_by_incharge_name ? (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                              {record.marked_by_incharge_name}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-secondarytext"
                      >
                        No attendance records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave Records */}
          <div className="bg-secondarybg rounded-xl shadow-sm border border-primarybg overflow-hidden h-full">
            <div className="bg-pending/10 px-6 py-4 border-b border-primarybg">
              <h4 className="text-pending font-bold flex items-center gap-2">
                Leave Records
              </h4>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-primarybg sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Dates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLeaves && filteredLeaves.length > 0 ? (
                    filteredLeaves.map((leave) => (
                      <tr
                        key={leave.id}
                        className="hover:bg-primarybg/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-primarytext">
                          {leave.driver_name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              leave.leave_type === "SICK"
                                ? "bg-red/10 text-red border-red/20"
                                : leave.leave_type === "EMERGENCY"
                                ? "bg-pending/10 text-pending border-pending/20"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}
                          >
                            {leave.leave_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-secondarytext">
                          {leave.start_date} → {leave.end_date}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              leave.status === "admin_approved"
                                ? "bg-green/10 text-green border-green/20"
                                : leave.status === "rejected"
                                ? "bg-red/10 text-red border-red/20"
                                : leave.status === "incharge_approved"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-pending/10 text-pending border-pending/20"
                            }`}
                          >
                            {leave.status === "admin_approved"
                              ? "Approved"
                              : leave.status === "rejected"
                              ? "Rejected"
                              : leave.status === "incharge_approved"
                              ? "Awaiting Admin"
                              : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-secondarytext"
                      >
                        No leave records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
