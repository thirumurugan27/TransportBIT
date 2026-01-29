import React, { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  Plus,
  Trash2,
  Bus,
  ArrowRight,
  ArrowLeft,
  Save,
  Loader2,
  MapPinned,
  Route,
  Users,
} from "lucide-react";
import { showSuccess, showError, showConfirm } from "../../../utils/swal";
import API_BASE from "../../../utils/api";

export default function BusFleet() {
  const [busFleet, setBusFleet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState(null);
  const [busStops, setBusStops] = useState([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRouteForm, setEditRouteForm] = useState({
    bus_name: "",
    start_point: "",
    end_point: "",
  });

  // Form state for adding a stop
  const [busStopForm, setBusStopForm] = useState({
    stop_name: "",
    arrival_time: "",
    distance_km: 0,
    fee: 0,
    latitude: 0,
    longitude: 0,
  });

  const fetchBusFleet = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus-fleet`);
      if (res.ok) {
        const data = await res.json();
        setBusFleet(data);
      } else {
        console.error("Failed to fetch bus fleet");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusFleet();
  }, []);

  const fetchBusStops = async (busId) => {
    setStopsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus/${busId}/stops`);
      if (res.ok) {
        const data = await res.json();
        setBusStops(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStopsLoading(false);
    }
  };

  const selectBus = (bus) => {
    setSelectedBus(bus);
    fetchBusStops(bus.id);
    setEditRouteForm({
      bus_name: bus.bus_name || "",
      start_point: bus.start_point || "",
      end_point: bus.end_point || "",
    });
  };

  const updateBusRoute = async () => {
    try {
      const payload = {
        id: selectedBus.id,
        vehicle_id: selectedBus.id,
        bus_name: editRouteForm.bus_name,
        start_point: editRouteForm.start_point,
        end_point: editRouteForm.end_point,
      };

      const res = await fetch(`${API_BASE}/api/admin/bus-route/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess("Success", "Route updated successfully!");
        setIsEditModalOpen(false);
        // Refresh data
        const updatedBus = { ...selectedBus, ...editRouteForm };
        setSelectedBus(updatedBus);
        fetchBusFleet();
      } else {
        const errText = await res.text();
        showError("Error", "Failed to update: " + errText);
      }
    } catch (err) {
      console.error(err);
      showError("Error", "An unexpected error occurred");
    }
  };

  const addBusStop = async () => {
    if (!busStopForm.stop_name || !busStopForm.arrival_time) {
      showError("Error", "Please fill in Stop Name and Arrival Time");
      return;
    }

    try {
      const maxOrder = busStops.reduce(
        (max, s) => (s.stop_order > max ? s.stop_order : max),
        0,
      );
      const payload = {
        bus_id: selectedBus.id,
        stop_name: busStopForm.stop_name,
        stop_order: maxOrder + 1,
        arrival_time: busStopForm.arrival_time,
        distance_km: parseFloat(busStopForm.distance_km) || 0,
        fee: parseFloat(busStopForm.fee) || 0,
        latitude: parseFloat(busStopForm.latitude) || 0,
        longitude: parseFloat(busStopForm.longitude) || 0,
      };

      const res = await fetch(`${API_BASE}/api/admin/bus-stop/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess("Success", "Stop added successfully!");
        setBusStopForm({
          stop_name: "",
          arrival_time: "",
          distance_km: 0,
          fee: 0,
          latitude: 0,
          longitude: 0,
        });
        fetchBusStops(selectedBus.id);
        fetchBusFleet();
      } else {
        const errText = await res.text();
        showError("Error", "Failed to add stop: " + errText);
      }
    } catch (err) {
      console.error(err);
      showError("Error", "An unexpected error occurred");
    }
  };

  const deleteBusStop = async (stopId) => {
    const isConfirmed = await showConfirm(
      "Delete Stop?",
      "Are you sure you want to remove this stop?",
    );
    if (!isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/bus-stop/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stopId }),
      });
      if (res.ok) {
        showSuccess("Success", "Stop removed");
        fetchBusStops(selectedBus.id);
        fetchBusFleet();
      } else {
        showError("Error", "Failed to delete stop");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formattedTime = (tm) => {
    if (!tm) return "";
    return tm.substring(0, 5);
  };

  const getVehicleLabel = (bus) => {
    return bus.bus_name || bus.vehicle_number;
  };

  // DETAIL VIEW - When a bus is selected
  if (selectedBus) {
    return (
      <div className="min-h-screen bg-primarybg p-6 space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSelectedBus(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-semibold"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Fleet
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Bus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedBus.bus_name || selectedBus.vehicle_number}
                </h2>
                <p className="text-sm text-slate-500 font-mono">
                  {selectedBus.vehicle_number}
                </p>
              </div>
            </div>
            {selectedBus.start_point && selectedBus.end_point && (
              <>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Route className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{selectedBus.start_point}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-semibold">{selectedBus.end_point}</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primarydull rounded-xl transition-all font-bold text-sm shadow-lg shadow-primary/20"
          >
            <Route className="w-4 h-4" />
            Edit Route Info
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Stops List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MapPinned className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-slate-900 text-lg">Route Stops</h3>
                  <span className="bg-primary/10 text-primary text-sm font-bold px-3 py-1 rounded-full">
                    {busStops.length}
                  </span>
                </div>
              </div>

              {stopsLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : busStops.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPinned className="w-8 h-8 text-primary/30" />
                  </div>
                  <p className="text-slate-500 font-semibold mb-2">No stops added yet</p>
                  <p className="text-sm text-slate-400">Use the form on the right to add stops to this route</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stop Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Distance</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fee</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Arrival</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {busStops.map((stop) => (
                        <tr key={stop.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                              {stop.stop_order.toString().padStart(2, "0")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{stop.stop_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-500 font-medium">{stop.distance_km} km</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-green-600 font-bold">₹{stop.fee}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <Clock className="w-4 h-4 text-primary/60" />
                              <span className="font-mono font-semibold">{formattedTime(stop.arrival_time)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => deleteBusStop(stop.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Stop"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Add Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Add New Stop</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    Stop Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="e.g. Central Station"
                      value={busStopForm.stop_name}
                      onChange={(e) => setBusStopForm({ ...busStopForm, stop_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Distance (km)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={busStopForm.distance_km}
                      onChange={(e) => setBusStopForm({ ...busStopForm, distance_km: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Fee (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={busStopForm.fee}
                      onChange={(e) => setBusStopForm({ ...busStopForm, fee: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    Arrival Time <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="time"
                      value={busStopForm.arrival_time}
                      onChange={(e) => setBusStopForm({ ...busStopForm, arrival_time: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <button
                  onClick={addBusStop}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primarydull active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mt-2"
                >
                  <Save size={18} />
                  Add Stop to Route
                </button>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center">Stops are ordered automatically by sequence</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Route Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Edit Route Info</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Bus Name</label>
                  <input
                    type="text"
                    value={editRouteForm.bus_name}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, bus_name: e.target.value })}
                    placeholder="e.g. Campus Express"
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Start Point</label>
                    <input
                      type="text"
                      value={editRouteForm.start_point}
                      onChange={(e) => setEditRouteForm({ ...editRouteForm, start_point: e.target.value })}
                      placeholder="e.g. Campus"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">End Point</label>
                    <input
                      type="text"
                      value={editRouteForm.end_point}
                      onChange={(e) => setEditRouteForm({ ...editRouteForm, end_point: e.target.value })}
                      placeholder="e.g. Erode"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-100 focus:border-primary focus:outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                    />
                  </div>
                </div>
                <button
                  onClick={updateBusRoute}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primarydull transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAIN BUS FLEET LIST VIEW
  return (
    <div className="min-h-screen bg-primarybg p-6">
      {/* Header Section */}
      <div className="bg-secondarybg rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-primarytext mb-2">
               Management
            </h1>
            <p className="text-secondarytext font-medium">
              Comprehensive overview of all buses, routes, and assignments
            </p>
          </div>
          <div className="flex items-center gap-4 bg-primary/5 rounded-xl px-6 py-4">
            <div className="p-3 bg-primary rounded-xl">
              <Bus className="w-6 h-6 text-secondarybg" />
            </div>
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                Total Buses
              </p>
              <p className="text-3xl font-bold text-primary">
                {busFleet?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      ) : busFleet && busFleet.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {busFleet.map((bus) => (
            <div
              key={bus.id}
              onClick={() => selectBus(bus)}
              className="bg-secondarybg rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group border-2 border-transparent hover:border-primary"
            >
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 group-hover:bg-primary rounded-xl flex items-center justify-center transition-all">
                      <Bus className="w-6 h-6 text-primary group-hover:text-secondarybg transition-all" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primarytext">
                        {bus.bus_name || bus.vehicle_number}
                      </h3>
                      <p className="text-xs font-mono font-semibold text-secondarytext bg-gray-100 px-2 py-0.5 rounded w-fit mt-1">
                        {bus.vehicle_number}
                      </p>
                    </div>
                  </div>
                  {/* Status Badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${bus.status === "active" || bus.status === "available"
                      ? "bg-green/10 text-green"
                      : "bg-pending/10 text-pending"
                      }`}
                  >
                    {bus.status || "Active"}
                  </div>
                </div>

                {/* Route Visualization */}
                {bus.start_point && bus.end_point ? (
                  <div className="bg-primarybg rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Route className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                        Route
                      </span>
                    </div>
                    <div className="flex items-center justify-between relative">
                      {/* Connecting Line */}
                      <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-primary/20"></div>

                      {/* Start Point */}
                      <div className="flex flex-col items-center gap-2 z-10 bg-primarybg px-2">
                        <div className="w-3 h-3 rounded-full bg-green border-2 border-secondarybg shadow-sm"></div>
                        <span
                          className="text-xs font-bold text-primarytext max-w-20 truncate text-center"
                          title={bus.start_point}
                        >
                          {bus.start_point}
                        </span>
                      </div>

                      {/* End Point */}
                      <div className="flex flex-col items-center gap-2 z-10 bg-primarybg px-2">
                        <div className="w-3 h-3 rounded-full bg-red border-2 border-secondarybg shadow-sm"></div>
                        <span
                          className="text-xs font-bold text-primarytext max-w-20 truncate text-center"
                          title={bus.end_point}
                        >
                          {bus.end_point}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-primarybg rounded-lg p-4 text-center">
                    <Route className="w-6 h-6 text-secondarytext/30 mx-auto mb-2" />
                    <p className="text-sm text-secondarytext/70 italic">
                      No route configured
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer - Stats */}
              <div className="p-6 bg-gray-50/50 group-hover:bg-primary/5 transition-colors">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-secondarytext">Stops</p>
                      <p className="text-lg font-bold text-primarytext">
                        {bus.total_stops || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-secondarytext">Seats</p>
                      <p className="text-lg font-bold text-primarytext">
                        {bus.seating_capacity}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Strip */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center group-hover:bg-primary/10 transition-colors">
                <span className="text-xs font-bold text-secondarytext group-hover:text-primary uppercase tracking-wider">
                  Manage Stops
                </span>
                <ArrowRight className="w-4 h-4 text-secondarytext group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-secondarybg rounded-xl shadow-sm p-12 text-center">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bus className="w-10 h-10 text-primary/30" />
          </div>
          <h3 className="text-xl font-bold text-primarytext mb-2">
            No Buses in Fleet
          </h3>
          <p className="text-secondarytext font-medium max-w-md mx-auto">
            Your bus fleet is empty. Add buses in the Vehicles module to see
            them here and manage their stops.
          </p>
        </div>
      )}
    </div>
  );
}
