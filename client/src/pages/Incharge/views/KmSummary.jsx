import React, { useState, useEffect } from "react";
import { apiGet } from "../../../utils/api";
import {
  Route,
  Calendar,
  User,
  Car,
  Clock,
  TrendingUp,
  Filter,
  MapPin,
  RefreshCw,
} from "lucide-react";

export default function KmSummary() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ logs: [], summary: {} });
  const [period, setPeriod] = useState("today");

  useEffect(() => {
    fetchKmSummary();
  }, [period]);

  const fetchKmSummary = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/incharge/km-summary?period=${period}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("Error fetching KM summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getVehicleTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case "BUS":
        return "bg-blue-100 text-blue-700";
      case "CAR":
        return "bg-green-100 text-green-700";
      case "EV":
        return "bg-purple-100 text-purple-700";
      case "VAN":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getShiftBadge = (shift) => {
    switch (shift?.toUpperCase()) {
      case "MORNING":
        return "bg-amber-100 text-amber-700";
      case "AFTERNOON":
        return "bg-orange-100 text-orange-700";
      case "EVENING":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <Route className="text-primary" /> KM Summary
          </h3>
          <p className="text-secondarytext text-sm">
            View detailed KM logs for all drivers with vehicle and shift information
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center gap-2 bg-secondarybg rounded-lg p-1">
            {["today", "week", "month"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  period === p
                    ? "bg-primary text-white shadow-sm"
                    : "text-secondarytext hover:bg-gray-200"
                }`}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>

          <button
            onClick={fetchKmSummary}
            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Route className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {data.summary?.today_km?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-secondarytext">Today's KM</p>
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-green" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green">
                {data.summary?.today_trips || 0}
              </p>
              <p className="text-xs text-secondarytext">Today's Trips</p>
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pending/10 rounded-xl flex items-center justify-center">
              <Calendar className="text-pending" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-pending">
                {data.summary?.week_km?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-secondarytext">This Week</p>
            </div>
          </div>
        </div>

        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red/10 rounded-xl flex items-center justify-center">
              <MapPin className="text-red" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-red">
                {data.summary?.month_km?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-secondarytext">This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* KM Logs Table */}
      <div className="bg-secondarybg rounded-xl shadow-sm border border-primarybg overflow-hidden">
        <div className="p-4 border-b border-primarybg">
          <h4 className="font-semibold text-primarytext flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            Detailed KM Logs
            <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
              {data.logs?.length || 0} entries
            </span>
          </h4>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.logs?.length === 0 ? (
          <div className="p-12 text-center text-secondarytext">
            <Route size={48} className="mx-auto mb-3 opacity-20" />
            <p>No KM logs found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <User size={14} /> Driver
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} /> Date
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Car size={14} /> Vehicle
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Clock size={14} /> Shift
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Start KM
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    End KM
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    <div className="flex items-center gap-1 justify-end">
                      <Route size={14} /> Total
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-secondarytext uppercase tracking-wider">
                    Route
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.logs?.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {log.driver_name?.charAt(0) || "?"}
                        </div>
                        <span className="font-medium text-primarytext">
                          {log.driver_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-secondarytext">
                      {formatDate(log.date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getVehicleTypeColor(
                            log.vehicle_type
                          )}`}
                        >
                          {log.vehicle_type}
                        </span>
                        <span className="text-primarytext font-medium">
                          {log.vehicle_number}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getShiftBadge(
                          log.shift
                        )}`}
                      >
                        {log.shift || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-secondarytext">
                      {log.start_km?.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right text-secondarytext">
                      {log.end_km?.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-primary">
                        {log.total_km?.toFixed(1)} km
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-secondarytext">
                        {log.route_name || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td
                    colSpan="6"
                    className="py-3 px-4 text-right font-semibold text-primarytext"
                  >
                    Total Distance:
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-primary text-lg">
                      {data.summary?.total_km?.toFixed(1) || 0} km
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Remarks Section - if any logs have remarks */}
      {data.logs?.some((l) => l.remarks) && (
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <h4 className="font-semibold text-primarytext mb-3">Recent Remarks</h4>
          <div className="space-y-2">
            {data.logs
              ?.filter((l) => l.remarks)
              .slice(0, 5)
              .map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-50 rounded-lg p-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-primarytext">
                      {log.driver_name}
                    </span>
                    <span className="text-secondarytext">•</span>
                    <span className="text-secondarytext text-xs">
                      {formatDate(log.date)}
                    </span>
                  </div>
                  <p className="text-secondarytext">{log.remarks}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
