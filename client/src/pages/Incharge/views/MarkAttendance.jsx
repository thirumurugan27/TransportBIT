import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";

export default function MarkAttendance() {
  const {user} = useAuth();
  const [clusterDrivers, setClusterDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(getToday());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const inchargeId = user?.driver_id;

  useEffect(() => {
    if (inchargeId) {
      fetchClusterDrivers();
    }
  }, [inchargeId, attendanceDate]);

  useEffect(() => {
    filterDrivers();
  }, [clusterDrivers, searchTerm, statusFilter]);

  const fetchClusterDrivers = async () => {
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/incharge/cluster-drivers?incharge_id=${inchargeId}&date=${attendanceDate}`
      );
      if (res.ok) {
        setClusterDrivers((await res.json()) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    let result = [...clusterDrivers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (driver) =>
          driver.full_name?.toLowerCase().includes(term) ||
          driver.driver_id?.toString().includes(term)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((driver) => {
        if (statusFilter === "present")
          return driver.attendance_status === "present";
        if (statusFilter === "absent")
          return driver.attendance_status === "absent";
        if (statusFilter === "pending")
          return (
            driver.attendance_status !== "present" &&
            driver.attendance_status !== "absent"
          );
        if (statusFilter === "leave") return driver.has_approved_leave;
        return true;
      });
    }

    setFilteredDrivers(result);
  };

  const handleMarkAttendance = async (targetUserID, status) => {
    try {
      const now = new Date();
      const checkinTime =
        status === "present"
          ? now.toISOString().slice(0, 19).replace("T", " ")
          : null;

      const res = await apiPost("/api/incharge/attendance/mark", {
        incharge_id: parseInt(inchargeId),
        user_id: targetUserID,
        date: attendanceDate,
        status: status,
        checkin_time: checkinTime,
      });

      if (res.ok) {
        fetchClusterDrivers();
      } else {
        alert("Error: " + (await res.text()));
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const stats = {
    total: clusterDrivers.length,
    present: clusterDrivers.filter((d) => d.attendance_status === "present")
      .length,
    absent: clusterDrivers.filter((d) => d.attendance_status === "absent")
      .length,
    pending: clusterDrivers.filter(
      (d) =>
        d.attendance_status !== "present" && d.attendance_status !== "absent"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-primarytext">
            Mark Attendance
          </h3>
          <p className="text-secondarytext text-sm">
            Manage daily attendance for your cluster drivers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col justify-center items-center">
          <span className="text-secondarytext text-xs uppercase tracking-wider font-semibold">
            Total
          </span>
          <span className="text-2xl font-bold text-primarytext">
            {stats.total}
          </span>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col justify-center items-center">
          <span className="text-green text-xs uppercase tracking-wider font-semibold">
            Present
          </span>
          <span className="text-2xl font-bold text-green">{stats.present}</span>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col justify-center items-center">
          <span className="text-red text-xs uppercase tracking-wider font-semibold">
            Absent
          </span>
          <span className="text-2xl font-bold text-red">{stats.absent}</span>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col justify-center items-center">
          <span className="text-pending text-xs uppercase tracking-wider font-semibold">
            Pending
          </span>
          <span className="text-2xl font-bold text-pending">
            {stats.pending}
          </span>
        </div>
      </div>

      <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-secondarytext text-sm whitespace-nowrap">
              Filter Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-40 px-3 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="pending">Not Marked</option>
              <option value="leave">On Leave</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-secondarytext text-sm whitespace-nowrap">
              Date:
            </span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-secondarytext animate-pulse">
          Fetching driver list...
        </div>
      ) : (
        <div className="bg-secondarybg rounded-xl shadow-sm border border-primarybg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primarybg text-left">
                  <th className="px-6 py-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Driver Details
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondarytext uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDrivers.length > 0 ? (
                  filteredDrivers.map((d) => (
                    <tr
                      key={d.driver_id}
                      className="hover:bg-primarybg/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primarytext">
                            {d.full_name}
                          </span>
                          <span className="text-xs text-secondarytext">
                            ID: {d.driver_id}
                          </span>
                          {d.has_approved_leave && (
                            <span className="inline-block mt-1 text-xs text-pending font-medium">
                              • On Leave
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
                            d.attendance_status === "present"
                              ? "bg-green/10 text-green border-green/20"
                              : d.attendance_status === "absent"
                              ? "bg-red/10 text-red border-red/20"
                              : "bg-gray-100 text-secondarytext border-gray-200"
                          }`}
                        >
                          {d.attendance_status === "present"
                            ? "Present"
                            : d.attendance_status === "absent"
                            ? "Absent"
                            : "Not Marked"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-secondarytext text-sm">
                        {d.checkin_time ? d.checkin_time.split(" ")[1] : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              handleMarkAttendance(d.user_id, "present")
                            }
                            disabled={
                              d.attendance_status === "present" ||
                              d.has_approved_leave
                            }
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              d.attendance_status === "present" ||
                              d.has_approved_leave
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green text-white hover:bg-green/90 shadow-sm hover:shadow"
                            }`}
                          >
                            Mark Present
                          </button>
                          <button
                            onClick={() =>
                              handleMarkAttendance(d.user_id, "absent")
                            }
                            disabled={d.attendance_status === "absent"}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              d.attendance_status === "absent"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red text-white hover:bg-red/90 shadow-sm hover:shadow"
                            }`}
                          >
                            Mark Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-secondarytext"
                    >
                      No drivers match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
