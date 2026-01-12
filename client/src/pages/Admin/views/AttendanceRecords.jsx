import React, {useState, useEffect} from "react";
import {
  Loader2,
  Calendar,
  Download,
  UserCheck,
  UserX,
  FileText,
  Filter,
  Search,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AttendanceRecords() {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAttendanceHistory();
  }, [startDate, endDate, statusFilter]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/admin/attendance?start_date=${startDate}&end_date=${endDate}`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAttendanceHistory(data || []);
      }
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!attendanceHistory || attendanceHistory.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ["Date", "Driver Name", "Status", "Check In", "Check Out"];
    const csvContent = [
      headers.join(","),
      ...attendanceHistory.map((record) =>
        [
          record.date,
          `"${record.full_name || ""}"`,
          record.status,
          record.checkin_time || "-",
          record.checkout_time || "-",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance_report_${startDate}_to_${endDate}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              Attendance Records
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              View and export driver attendance history
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-md border border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1 w-full lg:w-auto lg:mb-0 lg:mr-2">
              <Filter size={16} /> Filters:
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white text-sm min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <button
              onClick={downloadCSV}
              className="ml-auto xl:ml-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-md transition-colors flex items-center gap-2 text-sm font-medium shadow-sm h-[38px]"
              title="Download filtered attendance report"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total Records
            </p>
            <p className="text-3xl font-bold text-gray-800">
              {attendanceHistory?.length || 0}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Present
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {attendanceHistory?.filter((r) => r.status === "present")
                .length || 0}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-md group-hover:bg-emerald-100 transition-colors">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Absent
            </p>
            <p className="text-3xl font-bold text-rose-600">
              {attendanceHistory?.filter((r) => r.status === "absent").length ||
                0}
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-md group-hover:bg-rose-100 transition-colors">
            <UserX size={24} />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
            <p>Loading attendance records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Check-out
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendanceHistory && attendanceHistory.length > 0 ? (
                  attendanceHistory.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {record.date}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {record.full_name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">
                            {record.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                            record.status === "present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-red-50 text-red-700 border-red-100"
                          }`}
                        >
                          {record.status === "present" ? (
                            <UserCheck size={12} />
                          ) : (
                            <UserX size={12} />
                          )}
                          {record.status === "present" ? "Present" : "Absent"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.checkin_time || (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.checkout_time || (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-16 text-center text-gray-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Search size={48} className="opacity-20" />
                        <p className="font-medium">
                          No attendance records found
                        </p>
                        <p className="text-xs">
                          Try adjusting your date range or status filter
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
