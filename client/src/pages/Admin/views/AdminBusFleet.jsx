import React, {useState, useEffect} from "react";
import {
  Loader2,
  Bus,
  MapPin,
  Edit2,
  Trash2,
  ArrowLeft,
  Fuel,
  Save,
  X,
  Plus,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminBusFleet() {
  const [busFleet, setBusFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState(null);

  // Stops Management
  const [busStops, setBusStops] = useState([]);
  const [busStopForm, setBusStopForm] = useState({
    stop_name: "",
    fee: 0,
    distance_km: 0,
    arrival_time: "",
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
    setBusStopForm({stop_name: "", fee: 0, distance_km: 0, arrival_time: ""});
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
      setBusStopForm({stop_name: "", fee: 0, distance_km: 0, arrival_time: ""});
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
      <div className="bg-[var(--color-secondarybg)] rounded-md shadow-sm border border-gray-100 overflow-hidden p-6 text-[var(--color-text-main)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={closeBusDetail}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Fleet
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Bus className="w-6 h-6 text-primary" />{" "}
                {selectedBus.vehicle_number}
              </h2>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                <Fuel className="w-3 h-3" /> {selectedBus.fuel_type} •{" "}
                {selectedBus.seating_capacity} seats
                {selectedBus.start_point && selectedBus.end_point && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-xs font-bold border border-blue-100">
                    {selectedBus.start_point} ➝ {selectedBus.end_point}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Route Edit Section */}
        {editingBusRoute ? (
          <div className="bg-blue-50/50 p-6 rounded-md border border-blue-100 mb-8 animate-in fade-in zoom-in duration-200">
            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Update Route Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">
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
                  className="w-full px-4 py-2 rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">
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
                  className="w-full px-4 py-2 rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={updateBusRoute}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-opacity-90 font-bold flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" /> Save Route
              </button>
              <button
                onClick={() => setEditingBusRoute(null)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setEditingBusRoute(selectedBus)}
              className="px-4 py-2 text-primary border border-primary/20 rounded-md hover:bg-primary/5 font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Edit Route Info
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stops List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Bus Stops & Fees
              </h4>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {busStops.length} stops configured
              </span>
            </div>

            <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                      #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Stop Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Distance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Fee
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Arrival
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
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
                            className="w-full px-2 py-1 border rounded-md text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-gray-800">
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
                            className="w-20 px-2 py-1 border rounded-md text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                            className="w-20 px-2 py-1 border rounded-md text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            step="1"
                          />
                        ) : (
                          <span className="font-bold text-green-600 text-sm">
                            ₹{stop.fee}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingStop?.id === stop.id ? (
                          <input
                            type="time"
                            value={editingStop.arrival_time || ""}
                            onChange={(e) =>
                              setEditingStop({
                                ...editingStop,
                                arrival_time: e.target.value,
                              })
                            }
                            className="w-28 px-2 py-1 border rounded-md text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        ) : (
                          <span className="text-gray-600 text-sm">
                            {stop.arrival_time || "--"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingStop?.id === stop.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={updateBusStop}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 font-bold"
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
                              onClick={() =>
                                setEditingStop({
                                  ...stop,
                                  arrival_time: stop.arrival_time || "",
                                })
                              }
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteBusStop(stop.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {busStops.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-8 text-center text-gray-500 italic"
                      >
                        No stops added to this route yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Stop Form */}
          <div>
            <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm sticky top-6">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Add New Stop
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
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
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="e.g. Central Station"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
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
                      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
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
                      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      step="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Arrival Time
                  </label>
                  <input
                    type="time"
                    value={busStopForm.arrival_time}
                    onChange={(e) =>
                      setBusStopForm({
                        ...busStopForm,
                        arrival_time: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <button
                  onClick={addBusStop}
                  className="w-full py-2.5 bg-primary text-white rounded-md font-bold hover:bg-opacity-90 transition-all shadow-sm"
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
    <div className="space-y-8 pb-12 font-sans text-[var(--color-text-main)]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bus Fleet Management
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            Comprehensive overview of all buses, routes, and assignments
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-[var(--color-secondarybg)] rounded-md px-6 py-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Total Buses
              </p>
              <p className="text-2xl font-bold text-primary">
                {busFleet?.length || 0}
              </p>
            </div>
            <div className="p-2 bg-white rounded-md text-primary shadow-sm">
              <Bus className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      ) : busFleet && busFleet.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {busFleet.map((bus) => (
            <div
              key={bus.id}
              className="bg-[var(--color-secondarybg)] rounded-md shadow-sm border border-gray-100 overflow-hidden group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => selectBus(bus)}
            >
              {/* Card Content */}
              <div className="p-8">
                {/* Header with Icon and Status */}
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 bg-white rounded-md text-primary border border-gray-50 shadow-sm">
                    <Bus className="w-7 h-7" />
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${
                      bus.status === "available"
                        ? "bg-green-50 text-green-600 border-green-100"
                        : bus.status === "in_service"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}
                  >
                    {bus.status?.replace("_", " ") || "Active"}
                  </span>
                </div>

                {/* Vehicle Info */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800">
                    {bus.vehicle_number}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1 font-medium flex items-center gap-2">
                    {bus.bus_name || "Bus"}{" "}
                    <span className="text-gray-300">|</span>{" "}
                    {bus.seating_capacity} Seats
                  </p>
                </div>

                {/* Route Info */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-md p-4 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Route
                    </span>
                  </div>
                  {bus.start_point && bus.end_point ? (
                    <p className="text-sm font-bold text-gray-700">
                      {bus.start_point} ➝ {bus.end_point}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No route assigned
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-600">
                      {bus.stops_count || 0}
                    </span>
                    <span className="text-xs text-gray-400 font-medium uppercase">
                      Stops
                    </span>
                  </div>
                  <button className="text-primary font-bold text-sm hover:text-primary/80 flex items-center gap-1">
                    Manage <span className="text-lg">→</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-[var(--color-secondarybg)] rounded-md border border-dashed border-gray-200">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bus className="w-12 h-12 text-gray-300" />
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
