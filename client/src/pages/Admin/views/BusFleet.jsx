import React, {useState, useEffect} from "react";
import {
  Loader2,
  Bus,
  MapPin,
  IndianRupee,
  Trash2,
  Edit2,
  Plus,
  ArrowLeft,
  Fuel,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Map,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function BusFleet() {
  const [busFleet, setBusFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState(null);

  // Stops Management
  const [busStops, setBusStops] = useState([]);
  const [busStopForm, setBusStopForm] = useState({
    stop_name: "",
    fee: 0,
    distance_km: 0,
  });
  const [editingStop, setEditingStop] = useState(null);

  // Route Management
  const [editingBusRoute, setEditingBusRoute] = useState(null);

  useEffect(() => {
    fetchBusFleet();
  }, []);

  const fetchBusFleet = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus-fleet`);
      if (res.ok) {
        const data = await res.json();
        setBusFleet(data || []);
      }
    } catch (error) {
      console.error("Error fetching bus fleet:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusStops = async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus/${busId}/stops`);
      if (res.ok) {
        const data = await res.json();
        setBusStops(data || []);
      }
    } catch (error) {
      console.error("Error fetching stops:", error);
      setBusStops([]);
    }
  };

  const selectBus = (bus) => {
    setSelectedBus(bus);
    fetchBusStops(bus.id);
  };

  const closeBusDetail = () => {
    setSelectedBus(null);
    setBusStops([]);
    setEditingStop(null);
    setBusStopForm({stop_name: "", fee: 0, distance_km: 0});
  };

  const addBusStop = async () => {
    if (!busStopForm.stop_name) {
      alert("Stop name is required");
      return;
    }
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/add`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({...busStopForm, vehicle_id: selectedBus.id}),
    });
    if (res.ok) {
      alert("Stop added!");
      setBusStopForm({stop_name: "", fee: 0, distance_km: 0});
      fetchBusStops(selectedBus.id);
      fetchBusFleet(); // Update count if needed
    } else {
      alert("Failed: " + (await res.text()));
    }
  };

  const updateBusStop = async () => {
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/update`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(editingStop),
    });
    if (res.ok) {
      alert("Stop updated!");
      setEditingStop(null);
      fetchBusStops(selectedBus.id);
    } else {
      alert("Failed: " + (await res.text()));
    }
  };

  const deleteBusStop = async (stopId) => {
    if (!window.confirm("Are you sure you want to delete this stop?")) return;
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/delete`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({id: stopId}),
    });
    if (res.ok) {
      alert("Stop deleted!");
      fetchBusStops(selectedBus.id);
      fetchBusFleet();
    } else {
      alert("Failed: " + (await res.text()));
    }
  };

  const updateBusRoute = async () => {
    const res = await fetch(`${API_BASE}/api/admin/bus-route/update`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(editingBusRoute),
    });
    if (res.ok) {
      alert("Route updated!");
      setEditingBusRoute(null);
      fetchBusFleet();
    } else {
      alert("Failed: " + (await res.text()));
    }
  };

  if (selectedBus) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={closeBusDetail}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Back to Fleet
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Bus size={24} className="text-[var(--color-primary)]" />{" "}
                {selectedBus.vehicle_number}
              </h2>
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Fuel size={12} /> {selectedBus.fuel_type}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users size={12} /> {selectedBus.seating_capacity} Seats
                </span>
                {selectedBus.start_point && selectedBus.end_point && (
                  <span className="ml-2 px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md text-xs font-bold border border-[var(--color-primary)]/20">
                    {selectedBus.start_point} ➝ {selectedBus.end_point}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Route Edit Section */}
        {editingBusRoute ? (
          <div className="bg-[var(--color-primary)]/5 p-6 rounded-xl border border-[var(--color-primary)]/20 mb-8">
            <h4 className="font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2">
              <Map size={18} /> Update Route Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Start Point
                </label>
                <input
                  type="text"
                  value={editingBusRoute.start_point}
                  onChange={(e) =>
                    setEditingBusRoute({
                      ...editingBusRoute,
                      start_point: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  End Point
                </label>
                <input
                  type="text"
                  value={editingBusRoute.end_point}
                  onChange={(e) =>
                    setEditingBusRoute({
                      ...editingBusRoute,
                      end_point: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all bg-white"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={updateBusRoute}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 font-bold shadow-md shadow-[var(--color-primary)]/20"
              >
                Save Route
              </button>
              <button
                onClick={() => setEditingBusRoute(null)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setEditingBusRoute(selectedBus)}
              className="px-4 py-2 text-[var(--color-primary)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 rounded-lg hover:bg-[var(--color-primary)]/10 font-bold text-sm flex items-center gap-2 transition-all"
            >
              <Edit2 size={14} /> Edit Route Info
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stops List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <MapPin size={18} className="text-[var(--color-primary)]" /> Bus
                Stops & Fees
              </h4>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-lg text-gray-600">
                {busStops.length} stops configured
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Stop Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Fee
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {busStops.map((stop, idx) => (
                    <tr key={stop.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-6 py-4">
                        {editingStop?.id === stop.id ? (
                          <input
                            type="text"
                            value={editingStop.stop_name}
                            onChange={(e) =>
                              setEditingStop({
                                ...editingStop,
                                stop_name: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                          />
                        ) : (
                          <span className="font-medium text-gray-800 text-sm">
                            {stop.stop_name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingStop?.id === stop.id ? (
                          <input
                            type="number"
                            value={editingStop.distance_km}
                            onChange={(e) =>
                              setEditingStop({
                                ...editingStop,
                                distance_km: parseFloat(e.target.value),
                              })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            step="0.1"
                          />
                        ) : (
                          <span className="text-gray-600 text-sm">
                            {stop.distance_km} km
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingStop?.id === stop.id ? (
                          <input
                            type="number"
                            value={editingStop.fee}
                            onChange={(e) =>
                              setEditingStop({
                                ...editingStop,
                                fee: parseFloat(e.target.value),
                              })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            step="1"
                          />
                        ) : (
                          <span className="font-bold text-emerald-600 text-sm flex items-center gap-0.5">
                            <IndianRupee size={12} />
                            {stop.fee}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingStop?.id === stop.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={updateBusStop}
                              className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStop(null)}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingStop(stop)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit Stop"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteBusStop(stop.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Stop"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {busStops.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-12 text-center text-gray-400 italic"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <MapPin size={24} className="text-gray-300" />
                          <p>No stops added to this route yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Stop Form */}
          <div>
            <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-200 sticky top-6 shadow-sm">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-[var(--color-primary)]" /> Add
                New Stop
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Stop Name
                  </label>
                  <input
                    type="text"
                    value={busStopForm.stop_name}
                    onChange={(e) =>
                      setBusStopForm({
                        ...busStopForm,
                        stop_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all bg-white"
                    placeholder="e.g. Central Station"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      value={busStopForm.distance_km}
                      onChange={(e) =>
                        setBusStopForm({
                          ...busStopForm,
                          distance_km: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all bg-white"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                      Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={busStopForm.fee}
                      onChange={(e) =>
                        setBusStopForm({
                          ...busStopForm,
                          fee: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all bg-white"
                      step="1"
                    />
                  </div>
                </div>
                <button
                  onClick={addBusStop}
                  className="w-full py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Add Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Bus Fleet Management
          </h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">
            Comprehensive overview of all buses, routes, and assignments
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg px-6 py-3 shadow-sm border border-[var(--color-primary)]/20 flex flex-col items-end">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Total Buses
            </p>
            <p className="text-2xl font-bold text-[var(--color-primary)]">
              {busFleet?.length || 0}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-12 h-12 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : busFleet && busFleet.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {busFleet.map((bus) => (
            <div
              key={bus.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group cursor-pointer hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all duration-300"
              onClick={() => selectBus(bus)}
            >
              {/* Card Content */}
              <div className="p-6">
                {/* Header with Icon and Status */}
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3.5 bg-[var(--color-primary)]/5 rounded-xl text-[var(--color-primary)] group-hover:scale-110 transition-transform">
                    <Bus size={28} />
                  </div>
                  <span
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      bus.status === "available"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : bus.status === "in_service"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}
                  >
                    {bus.status === "available" ? (
                      <CheckCircle size={10} />
                    ) : (
                      <AlertCircle size={10} />
                    )}
                    {bus.status?.replace("_", " ") || "Active"}
                  </span>
                </div>

                {/* Vehicle Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    {bus.vehicle_number}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 font-medium">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {bus.bus_name || "Bus"}
                    </span>
                    <span>•</span>
                    <span>{bus.seating_capacity} Seats</span>
                  </div>
                </div>

                {/* Route Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Map size={12} /> Route
                  </div>
                  {bus.start_point && bus.end_point ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 z-10"></div>
                        <span className="text-sm font-semibold text-gray-700">
                          {bus.start_point}
                        </span>
                      </div>
                      <div className="ml-0.5 h-4 border-l-2 border-dashed border-gray-300"></div>
                      <div className="flex items-center gap-2 relative">
                        <div className="w-2 h-2 rounded-full bg-rose-400 z-10"></div>
                        <span className="text-sm font-semibold text-gray-700">
                          {bus.end_point}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No route assigned
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <MapPin size={14} />
                    <span className="text-sm font-bold text-gray-700">
                      {bus.stops_count || 0}
                    </span>
                    <span className="text-xs text-gray-400 font-medium uppercase">
                      Stops
                    </span>
                  </div>
                  <span className="text-[var(--color-primary)] font-bold text-sm group-hover:underline flex items-center gap-1">
                    Manage <ArrowLeft size={14} className="rotate-180" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bus className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            No Buses in Fleet
          </h3>
          <p className="text-gray-500 font-medium">
            Add buses from the Vehicles page to get started
          </p>
        </div>
      )}
    </div>
  );
}
