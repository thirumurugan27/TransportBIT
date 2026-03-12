import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";

import {apiGet, apiPost} from "../../../utils/api";

// Format ISO datetime to readable format like "09:16 AM, 27 Feb 2026"
const formatCheckinTime = (isoString) => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const day = d.getDate().toString().padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${h12}:${minutes} ${ampm}, ${day} ${month} ${year}`;
  } catch {
    return isoString;
  }
};

export default function AttendanceRecords() {
  const {showToast} = useToast();
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAttendance, setPendingAttendance] = useState({});
  const [submittingBulk, setSubmittingBulk] = useState(false);

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
      let endpoint = `/api/admin/attendance?start_date=${startDate}&end_date=${endDate}`;
      if (statusFilter !== "all") {
        endpoint += `&status=${statusFilter}`;
      }
      const res = await apiGet(endpoint);
      if (res.ok) {
        const data = await res.json();
        setAttendanceHistory(data || []);
        setPendingAttendance({});
      }
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSingleDay = startDate === endDate;
  const pendingCount = Object.keys(pendingAttendance).length;

  const getEffectiveStatus = (record) => {
    return pendingAttendance[record.user_id] || record.status;
  };

  const handleStatusCheckboxChange = (record, status, checked) => {
    if (record.status === "on_leave") return;

    setPendingAttendance((prev) => {
      const next = {...prev};
      if (!checked || status === record.status) {
        delete next[record.user_id];
        return next;
      }

      next[record.user_id] = status;
      return next;
    });
  };

  const handleSubmitBulkAttendance = async () => {
    if (pendingCount === 0) {
      showToast("No attendance changes selected.", "warning");
      return;
    }

    const updates = Object.entries(pendingAttendance).map(
      ([userId, status]) => {
        const payload = {
          user_id: Number(userId),
          status,
        };

        if (status === "present") {
          payload.checkin_time = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
        }

        return payload;
      },
    );

    setSubmittingBulk(true);
    try {
      const res = await apiPost("/api/admin/attendance/mark-bulk", {
        date: startDate,
        updates,
      });

      if (res.ok) {
        showToast(`Saved ${updates.length} attendance updates.`, "success");
        fetchAttendanceHistory();
      } else {
        const errData = await res.text();
        showToast("Error: " + errData, "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setSubmittingBulk(false);
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

  // Derived stats
  const totalCount = attendanceHistory?.length || 0;
  const presentCount =
    attendanceHistory?.filter((r) => r.status === "present").length || 0;
  const absentCount =
    attendanceHistory?.filter((r) => r.status === "absent").length || 0;
  const onLeaveCount =
    attendanceHistory?.filter((r) => r.status === "on_leave").length || 0;
  const notMarkedCount =
    attendanceHistory?.filter((r) => r.status === "not_marked").length || 0;
  const attendanceRate =
    totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const statusBadge = (status) => {
    const map = {
      present: {
        label: "Present",
        icon: <CheckCircle2 size={12} />,
        cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      },
      absent: {
        label: "Absent",
        icon: <XCircle size={12} />,
        cls: "bg-rose-50 text-rose-700 border border-rose-200",
      },
      on_leave: {
        label: "On Leave",
        icon: <AlertCircle size={12} />,
        cls: "bg-amber-50 text-amber-700 border border-amber-200",
      },
      not_marked: {
        label: "Not Marked",
        icon: <Clock size={12} />,
        cls: "bg-gray-100 text-gray-500 border border-gray-200",
      },
    };
    const cfg = map[status] || map["not_marked"];
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${cfg.cls}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        {/* Row 1 — Title + Export CSV */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
              <CalendarDays size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 leading-tight">
                Attendance Management
              </h2>
              <p className="text-xs text-secondarytext mt-0.5">
                Mark and review driver attendance records
              </p>
            </div>
          </div>
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 h-10.5 px-5 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold shadow-sm transition-colors shrink-0"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* Row 2 — Filters strip */}
        <div className="flex items-center gap-2.5 px-6 py-3 bg-gray-50/50">
          {/* Label */}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-secondarytext uppercase tracking-wider shrink-0 mr-1">
            <Filter size={12} />
            Filters
          </span>

          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* Today */}
          <button
            onClick={setToday}
            className={[
              "inline-flex items-center gap-1.5 h-10.5 px-3.5 rounded-md text-sm font-semibold transition-all shrink-0",
              startDate === today && endDate === today
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-primary/40 hover:text-primary",
            ].join(" ")}
          >
            <CalendarDays size={14} />
            Today
          </button>

          {/* From */}
          <div className="inline-flex items-center h-10.5 bg-white border border-gray-200 rounded-md px-3 gap-2 hover:border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all shrink-0">
            <span className="text-[10px] font-bold text-secondarytext uppercase tracking-widest select-none shrink-0">
              From
            </span>
            <div className="w-px h-4 bg-gray-200 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-gray-700 w-30"
            />
          </div>

          {/* To */}
          <div className="inline-flex items-center h-10.5 bg-white border border-gray-200 rounded-md px-3 gap-2 hover:border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all shrink-0">
            <span className="text-[10px] font-bold text-secondarytext uppercase tracking-widest select-none shrink-0">
              To
            </span>
            <div className="w-px h-4 bg-gray-200 shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-gray-700 w-30"
            />
          </div>

          {/* Status */}
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
            isWhite
          />

          {/* Refresh */}
          <button
            onClick={fetchAttendanceHistory}
            className="inline-flex items-center gap-1.5 h-10.5 px-3.5 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-primary transition-colors shrink-0"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-md shrink-0">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest">
              Total
            </p>
            <p className="text-xl font-bold text-gray-800">{totalCount}</p>
          </div>
        </div>

        {/* Present */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-md shrink-0">
            <UserCheck size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest">
              Present
            </p>
            <p className="text-xl font-bold text-emerald-600">{presentCount}</p>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-md shrink-0">
            <UserX size={18} className="text-rose-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest">
              Absent
            </p>
            <p className="text-xl font-bold text-rose-600">{absentCount}</p>
          </div>
        </div>

        {/* On Leave */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-md shrink-0">
            <AlertCircle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest">
              On Leave
            </p>
            <p className="text-xl font-bold text-amber-600">{onLeaveCount}</p>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
            <Clock size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest">
              Rate
            </p>
            <p className="text-xl font-bold text-primary">{attendanceRate}%</p>
          </div>
        </div>
      </div>
      {/* ── Single-day banner + submit bar ────────────────────────── */}
      {isSingleDay && (
        <div className="bg-primary/5 border border-primary/15 rounded-md px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-gray-700">
              Showing all drivers for{" "}
              <span className="font-bold text-primary">{startDate}</span> —
              select attendance status and submit once.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pendingCount > 0 && (
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                {pendingCount} pending
              </span>
            )}
            <button
              onClick={() => setPendingAttendance({})}
              disabled={pendingCount === 0 || submittingBulk}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleSubmitBulkAttendance}
              disabled={pendingCount === 0 || submittingBulk}
              className="px-4 py-1.5 text-sm font-bold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm transition-colors"
            >
              {submittingBulk ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>Submit Updates ({pendingCount})</>
              )}
            </button>
          </div>
        </div>
      )}
      {/* ── Attendance Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-sm font-semibold text-gray-700">
            {isSingleDay
              ? `Attendance for ${startDate}`
              : `Records: ${startDate} to ${endDate}`}
          </p>
          {!loading && (
            <span className="text-xs text-secondarytext font-medium bg-white border border-gray-200 px-2.5 py-1 rounded-md">
              {totalCount} {totalCount === 1 ? "record" : "records"}
            </span>
          )}
        </div>
        {loading ? (
          <div className="py-16">
            <Loading fullScreen={false} text="Loading attendance records…" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                    Marked By
                  </th>
                  {isSingleDay && (
                    <th className="px-5 py-3.5 text-right text-[11px] font-bold text-secondarytext uppercase tracking-wider">
                      Mark Attendance
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendanceHistory && attendanceHistory.length > 0 ? (
                  attendanceHistory.map((record, idx) => {
                    const effectiveStatus = getEffectiveStatus(record);
                    const hasPendingChange =
                      pendingAttendance[record.user_id] !== undefined;
                    const isOnLeave = record.status === "on_leave";
                    return (
                      <tr
                        key={`${record.id ?? "r"}-${record.date ?? "nd"}-${idx}`}
                        className={`transition-colors hover:bg-primarybg/40 ${hasPendingChange ? "bg-primary/5" : ""}`}
                      >
                        {/* Date */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 text-gray-700 font-medium">
                            <Calendar
                              size={13}
                              className="text-gray-400 shrink-0"
                            />
                            {record.date}
                          </div>
                        </td>
                        {/* Driver */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {record.full_name?.charAt(0)?.toUpperCase() ||
                                "?"}
                            </div>
                            <span className="font-semibold text-gray-800">
                              {record.full_name}
                            </span>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            {statusBadge(effectiveStatus)}
                            {hasPendingChange && (
                              <span className="text-[10px] text-primary font-bold uppercase tracking-wide">
                                • unsaved
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Check-in */}
                        <td className="px-5 py-3.5 text-gray-600">
                          {record.checkin_time ? (
                            <div className="flex items-center gap-1.5">
                              <Clock
                                size={12}
                                className="text-gray-400 shrink-0"
                              />
                              <span>
                                {formatCheckinTime(record.checkin_time)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        {/* Marked by */}
                        <td className="px-5 py-3.5 text-gray-500">
                          {record.marked_by_name || record.marked_by || (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        {/* Mark attendance toggle buttons */}
                        {isSingleDay && (
                          <td className="px-5 py-3.5 text-right">
                            {isOnLeave ? (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                                On Leave
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md p-1">
                                <button
                                  disabled={submittingBulk}
                                  onClick={() =>
                                    handleStatusCheckboxChange(
                                      record,
                                      "present",
                                      effectiveStatus !== "present",
                                    )
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    effectiveStatus === "present"
                                      ? "bg-emerald-600 text-white shadow-sm"
                                      : "text-gray-500 hover:bg-emerald-50 hover:text-emerald-700"
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <CheckCircle2 size={13} />
                                  Present
                                </button>
                                <button
                                  disabled={submittingBulk}
                                  onClick={() =>
                                    handleStatusCheckboxChange(
                                      record,
                                      "absent",
                                      effectiveStatus !== "absent",
                                    )
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    effectiveStatus === "absent"
                                      ? "bg-rose-600 text-white shadow-sm"
                                      : "text-gray-500 hover:bg-rose-50 hover:text-rose-700"
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <XCircle size={13} />
                                  Absent
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={isSingleDay ? 6 : 5}
                      className="px-6 py-20 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Search size={28} className="opacity-40" />
                        </div>
                        <p className="font-semibold text-gray-500">
                          No attendance records found
                        </p>
                        <p className="text-xs text-gray-400">
                          Try adjusting the date range or status filter
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
