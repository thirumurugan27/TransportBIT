import React, {useState, useEffect} from "react";
import {ChevronDown, ChevronRight, MapPin, Clock} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function StudentTrackBus() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBus, setExpandedBus] = useState(null);
  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  useEffect(() => {
    fetchBuses();
  }, []);

  const fetchBuses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/buses`);
      if (res.ok) {
        const data = await res.json();
        setBuses(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStops = async (busId) => {
    setLoadingStops(true);
    setStops([]);
    try {
      const res = await fetch(`${API_BASE}/api/student/bus/${busId}/stops`);
      if (res.ok) {
        const data = await res.json();
        setStops(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStops(false);
    }
  };

  const toggleExpand = (busId) => {
    if (expandedBus === busId) {
      setExpandedBus(null);
      setStops([]);
    } else {
      setExpandedBus(busId);
      fetchStops(busId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bus Routes</h2>
        <p className="text-gray-500">
          View all available bus routes and stops. Real-time tracking coming
          soon.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading buses...</div>
        ) : buses.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-md border border-gray-100">
            No buses found.
          </div>
        ) : (
          buses.map((bus) => (
            <div
              key={bus.id}
              className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden"
            >
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(bus.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center text-blue-600 font-bold">
                    {bus.vehicle_number?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {bus.vehicle_name || bus.vehicle_number}
                    </h3>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{bus.start_point || "Start"}</span>
                      <span>→</span>
                      <span>{bus.end_point || "End"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {bus.total_stops} Stops
                  </span>
                  {expandedBus === bus.id ? (
                    <ChevronDown size={20} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-400" />
                  )}
                </div>
              </div>

              {expandedBus === bus.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 px-2">
                    Route Stops
                  </h4>
                  {loadingStops ? (
                    <div className="text-center py-4 text-gray-500">
                      Loading stops...
                    </div>
                  ) : stops.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 italic">
                      No stops defined for this route.
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line connecting stops */}
                      <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200"></div>

                      <div className="space-y-0">
                        {stops.map((stop, index) => (
                          <div
                            key={stop.id}
                            className="relative flex items-start gap-4 p-2 hover:bg-white rounded-md transition-colors"
                          >
                            <div className="z-10 w-8 h-8 rounded-md bg-white border-2 border-blue-500 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">
                                {stop.stop_name}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin size={12} /> {stop.distance_km} km
                                </span>
                                <span className="flex items-center gap-1">
                                  Fee: ₹{stop.fee}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
