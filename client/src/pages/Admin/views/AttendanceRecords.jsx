import React, {useState, useEffect} from "react";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  Loader2,
  Calendar,
  Download,
  UserCheck,
  UserX,
  FileText,
  Filter,
  Search,
  Clock,
  CalendarDays,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AttendanceRecords() {
  const {showToast} = useToast();
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default to today
  const today = new Date().toISOString().split("T")[0];

  // Filters
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all");

  // Helper to set today's date
  const setToday = () => {
    const todayDate = new Date().toISOString().split("T")[0];
    setStartDate(todayDate);
    setEndDate(todayDate);
  };

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
      showToast("No data available to export.", "warning");
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
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance_report_${startDate}_to_${endDate}.csv`,
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

            <button
              onClick={setToday}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 h-[38px] ${
                startDate === today && endDate === today
                  ? "bg-primary text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <CalendarDays size={14} />
              Today
            </button>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
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
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Status
              </label>
              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  {value: "all", label: "All Status"},
                  {value: "present", label: "Present"},
                  {value: "absent", label: "Absent"},
                  {value: "on_leave", label: "On Leave"},
                  {value: "not_marked", label: "Not Marked"},
                ]}
                width="w-36"
              />
            </div>

            <button
              onClick={downloadCSV}
              className="ml-auto xl:ml-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors flex items-center gap-2 text-sm font-medium shadow-sm h-[38px]"
              title="Download filtered attendance report"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Info banner when viewing single day */}
      {startDate === endDate && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <p className="text-sm text-blue-700">
            Showing attendance for <strong>{startDate}</strong> - All drivers
            are listed with their status
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total
            </p>
            <p className="text-2xl font-bold text-gray-800">
              {attendanceHistory?.length || 0}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Present
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {attendanceHistory?.filter((r) => r.status === "present")
                .length || 0}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-md group-hover:bg-emerald-100 transition-colors">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Absent
            </p>
            <p className="text-2xl font-bold text-rose-600">
              {attendanceHistory?.filter((r) => r.status === "absent").length ||
                0}
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-md group-hover:bg-rose-100 transition-colors">
            <UserX size={20} />
          </div>
        </div>

        <div className="bg-white rounded-md p-5 shadow-sm border border-gray-100 flex items-center justify-between group">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Not Marked
            </p>
            <p className="text-2xl font-bold text-gray-500">
              {attendanceHistory?.filter(
                (r) => r.status === "not_marked" || r.status === "on_leave",
              ).length || 0}
            </p>
          </div>
          <div className="p-3 bg-gray-100 text-gray-500 rounded-md group-hover:bg-gray-200 transition-colors">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-md mb-4"></div>
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
                    Marked By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendanceHistory && attendanceHistory.length > 0 ? (
                  attendanceHistory.map((record, idx) => (
                    <tr
                      key={`${record.id ?? "record"}-${record.date ?? "nodate"}-${idx}`}
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
                          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {record.full_name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">
                            {record.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                            record.status === "present"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : record.status === "absent"
                                ? "bg-red-50 text-red-700 border-red-100"
                                : record.status === "on_leave"
                                  ? "bg-orange-50 text-orange-700 border-orange-100"
                                  : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {record.status === "present" ? (
                            <UserCheck size={12} />
                          ) : (
                            <UserX size={12} />
                          )}
                          {record.status === "present"
                            ? "Present"
                            : record.status === "absent"
                              ? "Absent"
                              : record.status === "on_leave"
                                ? "On Leave"
                                : "Not Marked"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.checkin_time || (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {record.marked_by_incharge_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            <UserCheck size={12} />
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
