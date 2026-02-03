import React, {useState, useEffect, useMemo} from "react";
import {
  Loader2,
  Bus,
  MapPin,
  Edit2,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Plus,
  Search,
  Filter,
  Route,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const STATUS_STYLES = {
  active: "bg-green/10 text-green border-green/20",
  available: "bg-green/10 text-green border-green/20",
  maintenance: "bg-pending/10 text-pending border-pending/20",
  inactive: "bg-red/10 text-red border-red/20",
};

export default function AdminBusFleet() {
  const {showToast} = useToast();
  const [busFleet, setBusFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    setEditingBusRoute(null);
  };

  const closeBusDetail = () => {
    setSelectedBus(null);
    setBusStops([]);
    setEditingStop(null);
    setEditingBusRoute(null);
    setBusStopForm({stop_name: "", fee: 0, distance_km: 0, arrival_time: ""});
  };

  const toInputString = (value) =>
    value === null || value === undefined ? "" : `${value}`;

  const beginEditStop = (stop) => {
    setEditingStop({
      ...stop,
      arrival_time: stop.arrival_time || "",
      distance_km: toInputString(stop.distance_km),
      fee: toInputString(stop.fee),
    });
  };

  const addBusStop = async () => {
    const stopName = busStopForm.stop_name.trim();
    if (!stopName) {
      showToast("Stop name is required", "warning");
      return;
    }
    const payload = {
      bus_id: selectedBus.id,
      stop_name: stopName,
      arrival_time: busStopForm.arrival_time || "",
      distance_km: Number(busStopForm.distance_km) || 0,
      fee: Number(busStopForm.fee) || 0,
      stop_order: Number(busStopForm.stop_order) || 0,
    };
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/add`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast("Stop added successfully!", "success");
      setBusStopForm({stop_name: "", fee: 0, distance_km: 0, arrival_time: ""});
      fetchBusStops(selectedBus.id);
      fetchBusFleet();
    } else {
      showToast("Failed: " + (await res.text()), "error");
    }
  };

  const updateBusStop = async () => {
    if (!editingStop?.stop_name?.trim()) {
      showToast("Stop name is required", "warning");
      return;
    }
    const payload = {
      ...editingStop,
      stop_name: editingStop.stop_name.trim(),
      arrival_time: editingStop.arrival_time || "",
      distance_km: Number(editingStop.distance_km) || 0,
      fee: Number(editingStop.fee) || 0,
      stop_order: Number(editingStop.stop_order) || 0,
    };
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/update`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast("Stop updated!", "success");
      setEditingStop(null);
      fetchBusStops(selectedBus.id);
    } else {
      showToast("Failed: " + (await res.text()), "error");
    }
  };

  const deleteBusStop = async (stopId) => {
    const isConfirmed = await showConfirm(
      "Delete Stop?",
      "Are you sure you want to delete this stop?",
    );
    if (!isConfirmed) return;
    const res = await fetch(`${API_BASE}/api/admin/bus-stop/delete`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({id: stopId}),
    });
    if (res.ok) {
      showToast("Stop deleted!", "success");
      fetchBusStops(selectedBus.id);
      fetchBusFleet();
    } else {
      showToast("Failed: " + (await res.text()), "error");
    }
  };

  const updateBusRoute = async () => {
    const res = await fetch(`${API_BASE}/api/admin/bus-route/update`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        id: selectedBus.id,
        vehicle_id: selectedBus.id,
        bus_name: editingBusRoute.bus_name,
        start_point: editingBusRoute.start_point,
        end_point: editingBusRoute.end_point,
      }),
    });
    if (res.ok) {
      showToast("Route updated successfully!", "success");
      setEditingBusRoute(null);
      setSelectedBus({...selectedBus, ...editingBusRoute});
      fetchBusFleet();
    } else {
      showToast("Failed: " + (await res.text()), "error");
    }
  };

  // Filtered and sorted buses
  const filteredBuses = useMemo(() => {
    let filtered = [...busFleet];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bus) =>
          (bus.bus_name || "").toLowerCase().includes(term) ||
          (bus.vehicle_number || "").toLowerCase().includes(term) ||
          (bus.start_point || "").toLowerCase().includes(term) ||
          (bus.end_point || "").toLowerCase().includes(term),
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (bus) => (bus.status || "").toLowerCase() === statusFilter,
      );
    }

    // Sort by bus_name
    filtered.sort((a, b) => {
      const nameA = (a.bus_name || a.vehicle_number || "").toLowerCase();
      const nameB = (b.bus_name || b.vehicle_number || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [busFleet, searchTerm, statusFilter]);

  // Fleet Statistics
  const fleetStats = useMemo(() => {
    return {
      total: busFleet.length,
      active: busFleet.filter((b) =>
        ["active", "available"].includes((b.status || "").toLowerCase()),
      ).length,
      totalSeats: busFleet.reduce(
        (sum, b) => sum + (b.seating_capacity || 0),
        0,
      ),
      totalStops: busFleet.reduce((sum, b) => sum + (b.total_stops || 0), 0),
    };
  }, [busFleet]);

  const formattedTime = (time) => {
    if (!time) return "--:--";
    return time.substring(0, 5);
  };

  if (selectedBus) {
    return (
      <div className="min-h-screen bg-primarybg p-6 space-y-6">
        {/* Header */}
        <div className="bg-secondarybg rounded-2xl border border-primary/10 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={closeBusDetail}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primarybg border border-primary/10 text-secondarytext hover:text-primary hover:border-primary/30 font-semibold transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Fleet
              </button>
              <div className="w-px h-8 bg-primary/10" />
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase">
                    {selectedBus.vehicle_number}
                  </p>
                  <h2 className="text-2xl font-bold text-primarytext">
                    {selectedBus.bus_name || selectedBus.vehicle_number}
                  </h2>
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditingBusRoute(selectedBus)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-secondarybg font-bold shadow-lg shadow-primary/20 hover:bg-primarydull transition-all"
            >
              <Edit2 className="w-4 h-4" />
              Edit Route Info
            </button>
          </div>

          {/* Route Edit Form */}
          {editingBusRoute && (
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/10 mb-6">
              <h4 className="font-bold text-primarytext mb-4 flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                Update Route Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
                    Bus Name
                  </label>
                  <input
                    type="text"
                    value={editingBusRoute.bus_name || ""}
                    onChange={(e) =>
                      setEditingBusRoute({
                        ...editingBusRoute,
                        bus_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-secondarybg text-primarytext font-semibold outline-none transition-all"
                    placeholder="Enter bus name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
                    Start Point
                  </label>
                  <input
                    type="text"
                    value={editingBusRoute.start_point || ""}
                    onChange={(e) =>
                      setEditingBusRoute({
                        ...editingBusRoute,
                        start_point: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-secondarybg text-primarytext font-semibold outline-none transition-all"
                    placeholder="Starting location"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
                    End Point
                  </label>
                  <input
                    type="text"
                    value={editingBusRoute.end_point || ""}
                    onChange={(e) =>
                      setEditingBusRoute({
                        ...editingBusRoute,
                        end_point: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-secondarybg text-primarytext font-semibold outline-none transition-all"
                    placeholder="Destination"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={updateBusRoute}
                  className="px-5 py-2 bg-primary text-secondarybg rounded-xl font-bold hover:bg-primarydull flex items-center gap-2 shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingBusRoute(null)}
                  className="px-5 py-2 bg-secondarybg text-secondarytext border border-primary/10 rounded-xl font-semibold hover:bg-primarybg flex items-center gap-2 transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Bus Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-secondarytext/70 uppercase mb-1">
                    Route
                  </p>
                  {selectedBus.start_point && selectedBus.end_point ? (
                    <p className="text-sm font-bold text-primarytext flex items-center gap-2">
                      {selectedBus.start_point}
                      <ArrowRight className="w-3 h-3" />
                      {selectedBus.end_point}
                    </p>
                  ) : (
                    <p className="text-sm text-secondarytext">Not configured</p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase mb-1">
                    Capacity
                  </p>
                  <p className="text-lg font-bold text-primarytext">
                    {selectedBus.seating_capacity} Seats
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase mb-1">
                    Total Stops
                  </p>
                  <p className="text-lg font-bold text-primarytext">
                    {busStops.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stops Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stops List */}
          <div className="lg:col-span-2">
            <div className="bg-secondarybg rounded-2xl border border-primary/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-primarytext flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Route Stops
                  </h3>
                  <p className="text-sm text-secondarytext mt-1">
                    {busStops.length} stops configured
                  </p>
                </div>
              </div>

              {busStops.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-primarytext font-semibold mb-2">
                    No stops configured
                  </p>
                  <p className="text-secondarytext text-sm">
                    Add stops using the form on the right
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {busStops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="bg-primarybg rounded-xl border border-primary/10 p-4 hover:border-primary/20 transition-all"
                    >
                      {editingStop?.id === stop.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={editingStop.stop_name}
                              onChange={(e) =>
                                setEditingStop({
                                  ...editingStop,
                                  stop_name: e.target.value,
                                })
                              }
                              className="px-3 py-2 rounded-lg border border-primary/20 focus:border-primary outline-none bg-secondarybg text-primarytext font-semibold"
                              placeholder="Stop name"
                            />
                            <input
                              type="time"
                              value={editingStop.arrival_time || ""}
                              onChange={(e) =>
                                setEditingStop({
                                  ...editingStop,
                                  arrival_time: e.target.value,
                                })
                              }
                              className="px-3 py-2 rounded-lg border border-primary/20 focus:border-primary outline-none bg-secondarybg text-primarytext font-semibold"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              value={editingStop.distance_km ?? ""}
                              onChange={(e) =>
                                setEditingStop({
                                  ...editingStop,
                                  distance_km: e.target.value,
                                })
                              }
                              className="px-3 py-2 rounded-lg border border-primary/20 focus:border-primary outline-none bg-secondarybg text-primarytext font-semibold"
                              placeholder="Distance (km)"
                              step="0.1"
                            />
                            <input
                              type="number"
                              value={editingStop.fee ?? ""}
                              onChange={(e) =>
                                setEditingStop({
                                  ...editingStop,
                                  fee: e.target.value,
                                })
                              }
                              className="px-3 py-2 rounded-lg border border-primary/20 focus:border-primary outline-none bg-secondarybg text-primarytext font-semibold"
                              placeholder="Fee (?)"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={updateBusStop}
                              className="px-4 py-2 bg-green text-secondarybg rounded-lg font-bold text-sm hover:opacity-90"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStop(null)}
                              className="px-4 py-2 bg-secondarybg text-secondarytext border border-primary/10 rounded-lg font-semibold text-sm hover:bg-primarybg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-primarytext mb-1">
                                {stop.stop_name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondarytext">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formattedTime(stop.arrival_time)}
                                </span>
                                <span>{stop.distance_km} km</span>
                                <span className="font-bold text-green">
                                  ₹{stop.fee}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => beginEditStop(stop)}
                              className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteBusStop(stop.id)}
                              className="p-2 rounded-lg text-red hover:bg-red/10 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Stop Form */}
          <div className="lg:col-span-1">
            <div className="bg-secondarybg rounded-2xl border border-primary/10 p-6 shadow-sm sticky top-6">
              <h4 className="font-bold text-primarytext mb-5 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Add New Stop
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
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
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all"
                    placeholder="e.g., Central Station"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
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
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      value={busStopForm.distance_km}
                      onChange={(e) =>
                        setBusStopForm({
                          ...busStopForm,
                          distance_km: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase mb-2">
                      Fee (?)
                    </label>
                    <input
                      type="number"
                      value={busStopForm.fee}
                      onChange={(e) =>
                        setBusStopForm({
                          ...busStopForm,
                          fee: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  onClick={addBusStop}
                  className="w-full py-3 bg-primary text-secondarybg rounded-xl font-bold hover:bg-primarydull shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
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
    <div className="min-h-screen bg-primarybg p-6 space-y-6">
      {/* Header Section */}
      <div className="bg-secondarybg rounded-2xl border border-primary/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-secondarytext/70 uppercase tracking-widest mb-2">
              Admin Dashboard
            </p>
            <h1 className="text-3xl font-extrabold text-primarytext mb-2">
              Bus Fleet Management
            </h1>
            <p className="text-secondarytext font-medium">
              Comprehensive overview of buses, routes, and stops
            </p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase">
                    Total Buses
                  </p>
                  <p className="text-2xl font-bold text-primarytext">
                    {fleetStats.total}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green/10 text-green">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase">
                    Active
                  </p>
                  <p className="text-2xl font-bold text-primarytext">
                    {fleetStats.active}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase">
                    Total Seats
                  </p>
                  <p className="text-2xl font-bold text-primarytext">
                    {fleetStats.totalSeats}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext/70 uppercase">
                    Total Stops
                  </p>
                  <p className="text-2xl font-bold text-primarytext">
                    {fleetStats.totalStops}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondarytext/50" />
              <input
                type="text"
                placeholder="Search by bus name, number, or route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all placeholder:text-secondarytext/50"
              />
            </div>
            <div className="relative sm:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondarytext/50" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-primary/10 focus:border-primary focus:ring-2 focus:ring-primary/10 bg-primarybg text-primarytext font-semibold outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bus Fleet Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      ) : filteredBuses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBuses.map((bus) => {
            const statusClass =
              STATUS_STYLES[(bus.status || "active").toLowerCase()] ||
              STATUS_STYLES.active;
            return (
              <div
                key={bus.id}
                onClick={() => selectBus(bus)}
                className="bg-secondarybg rounded-2xl border border-primary/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden group"
              >
                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-secondarybg transition-all">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondarytext/70 uppercase">
                          {bus.vehicle_number}
                        </p>
                        <h3 className="text-xl font-bold text-primarytext">
                          {bus.bus_name || bus.vehicle_number}
                        </h3>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${statusClass}`}
                    >
                      {bus.status || "Active"}
                    </span>
                  </div>

                  {/* Route Info */}
                  <div className="bg-primarybg rounded-xl p-4 border border-primary/10">
                    <div className="flex items-center gap-2 text-xs font-bold text-secondarytext uppercase mb-2">
                      <Route className="w-3 h-3 text-primary" />
                      Route
                    </div>
                    {bus.start_point && bus.end_point ? (
                      <div className="flex items-center gap-2 text-sm font-semibold text-primarytext">
                        <span className="truncate flex-1">
                          {bus.start_point}
                        </span>
                        <ArrowRight className="w-4 h-4 text-secondarytext shrink-0" />
                        <span className="truncate flex-1 text-right">
                          {bus.end_point}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-secondarytext">
                        Route not configured
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primarybg rounded-xl p-3 border border-primary/10 text-center">
                      <p className="text-xs font-bold text-secondarytext uppercase mb-1">
                        Stops
                      </p>
                      <p className="text-2xl font-bold text-primarytext">
                        {bus.total_stops || 0}
                      </p>
                    </div>
                    <div className="bg-primarybg rounded-xl p-3 border border-primary/10 text-center">
                      <p className="text-xs font-bold text-secondarytext uppercase mb-1">
                        Seats
                      </p>
                      <p className="text-2xl font-bold text-primarytext">
                        {bus.seating_capacity}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-primarybg border-t border-primary/10 flex items-center justify-between text-sm">
                  <span className="font-semibold text-secondarytext">
                    View Details
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-secondarybg rounded-2xl border border-primary/10 p-12 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bus className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-primarytext mb-2">
            {searchTerm || statusFilter !== "all"
              ? "No buses found"
              : "Fleet is empty"}
          </h3>
          <p className="text-secondarytext max-w-md mx-auto">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filter criteria"
              : "Add buses in the Vehicles module to see them here"}
          </p>
        </div>
      )}
    </div>
  );
}
