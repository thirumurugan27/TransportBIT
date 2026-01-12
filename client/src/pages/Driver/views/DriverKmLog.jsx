import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {
  Map,
  Route,
  TrendingUp,
  Plus,
  Truck,
  Calendar,
  AlertCircle,
} from "lucide-react";

export default function DriverKmLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [form, setForm] = useState({
    date: getToday(),
    start_km: 0,
    end_km: 0,
    vehicle_type: "BUS",
    remarks: "",
  });

  useEffect(() => {
    if (driverId) {
      fetchLogs();
    }
  }, [driverId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/driver/km-logs?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Basic validation
      if (parseFloat(form.end_km) <= parseFloat(form.start_km)) {
        alert("End KM must be greater than Start KM");
        return;
      }

      const payload = {
        driver_id: parseInt(driverId),
        date: form.date,
        start_km: parseFloat(form.start_km),
        end_km: parseFloat(form.end_km),
        vehicle_type: form.vehicle_type,
        remarks: form.remarks,
        total_km: parseFloat(form.end_km) - parseFloat(form.start_km),
      };

      const res = await apiPost("/api/driver/km-log/add", payload);

      if (res.ok) {
        alert("Log added!");
        setShowModal(false);
        fetchLogs();
        setForm({
          ...form,
          start_km: 0,
          end_km: 0,
          remarks: "",
        });
      } else {
        const errData = await res.json();
        alert("Failed to add log: " + (errData.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate Summary Stats from fetched logs
  const calculateStats = () => {
    const totalTrips = logs.length;
    const totalKm = logs.reduce((sum, log) => {
      // Assuming log.total_km is available, else calculate
      const dist =
        log.total_km !== undefined
          ? parseFloat(log.total_km)
          : parseFloat(log.end_km) - parseFloat(log.start_km);
      return sum + (isNaN(dist) ? 0 : dist);
    }, 0);
    const avgKm = totalTrips > 0 ? totalKm / totalTrips : 0;

    return {totalTrips, totalKm, avgKm};
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="hidden md:block text-primary" size={28} />
            My KM Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track your vehicle usage and trip history
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary text-white px-5 py-2.5 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-primary/30 font-medium"
        >
          <Plus size={20} />
          Add Entry
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards (Replicating Admin KmSummary Style) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Distance Card */}
            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Map size={64} className="text-primary" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-primary/10 rounded-md text-primary">
                  <Map size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Total Distance
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {stats.totalKm.toFixed(1)}{" "}
                    <span className="text-sm text-gray-500 font-normal">
                      km
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Based on recent logs
                  </p>
                </div>
              </div>
            </div>

            {/* Total Trips Card */}
            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Route size={64} className="text-green-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-green-50 rounded-md text-green-600">
                  <Route size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Total Trips
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {stats.totalTrips}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Logged entries</p>
                </div>
              </div>
            </div>

            {/* Avg/Trip Card */}
            <div className="bg-white rounded-md p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-amber-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-amber-50 rounded-md text-amber-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Avg / Trip
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {stats.avgKm.toFixed(1)}{" "}
                    <span className="text-sm text-gray-500 font-normal">
                      km
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Per logged entry</p>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                Recent Logs
              </h3>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                Last {logs.length} entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vehicle Type
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Start KM
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      End KM
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length > 0 ? (
                    logs.map((log) => {
                      const dist =
                        log.total_km !== undefined
                          ? parseFloat(log.total_km)
                          : parseFloat(log.end_km) - parseFloat(log.start_km);
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-blue-50/30 transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-700">
                              {log.date}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {log.vehicle_type || "BUS"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600">
                            {log.start_km}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600">
                            {log.end_km}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="font-bold text-primary">
                              {dist.toFixed(1)} km
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">
                              {log.remarks || "-"}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p>No logs found. Add your first entry!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-md w-full max-w-md shadow-2xl overflow-hidden transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                Add Daily KM Log
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  value={form.date}
                  onChange={(e) => setForm({...form, date: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Start KM
                  </label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    value={form.start_km}
                    onChange={(e) =>
                      setForm({...form, start_km: e.target.value})
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    End KM
                  </label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    value={form.end_km}
                    onChange={(e) => setForm({...form, end_km: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Vehicle Type
                </label>
                <select
                  className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white"
                  value={form.vehicle_type}
                  onChange={(e) =>
                    setForm({...form, vehicle_type: e.target.value})
                  }
                >
                  <option value="BUS">Bus</option>
                  <option value="CAR">Car</option>
                  <option value="EV">EV / Van</option>
                  <option value="VAN">Van</option>
                  <option value="TRUCK">Truck</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Remarks{" "}
                  <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  className="w-full border border-gray-300 px-3 py-2.5 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows="3"
                  value={form.remarks}
                  onChange={(e) => setForm({...form, remarks: e.target.value})}
                  placeholder="Route details, fuel info, or issues..."
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-md font-medium transition-colors shadow-lg shadow-primary/25"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
