import React, {useState, useEffect} from "react";
import {
  Loader2,
  Map,
  Route,
  TrendingUp,
  Truck,
  AlertCircle,
  Bus,
  Car,
  Zap,
  Award,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function KmSummary() {
  const [kmSummary, setKmSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKmSummary();
  }, []);

  const fetchKmSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/km-summary`);
      if (res.ok) {
        const data = await res.json();
        setKmSummary(data || {});
      }
    } catch (error) {
      console.error("Error fetching KM summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (type) => {
    switch (type) {
      case "BUS":
        return <Bus size={24} className="text-primary" />;
      case "CAR":
        return <Car size={24} className="text-primary" />;
      case "EV":
        return <Zap size={24} className="text-primary" />;
      case "VAN":
        return <Truck size={24} className="text-primary" />;
      default:
        return <Truck size={24} className="text-primary" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Analytics & Reports
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Detailed breakdown of fleet mileage and driver performance
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Map size={64} className="text-primary" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                  <Map size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Total Distance
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {kmSummary.grand_total_km?.toFixed(1) || 0}{" "}
                    <span className="text-sm text-gray-500 font-normal">
                      km
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Route size={64} className="text-green-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-green-50 rounded-lg text-green-600">
                  <Route size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Total Trips
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {kmSummary.grand_total_trips || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-amber-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Avg / Trip
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {kmSummary.grand_total_trips > 0
                      ? (
                          kmSummary.grand_total_km / kmSummary.grand_total_trips
                        ).toFixed(1)
                      : 0}{" "}
                    <span className="text-sm text-gray-500 font-normal">
                      km
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Truck size={64} className="text-indigo-500" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                  <Truck size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Fleet Types
                  </p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {kmSummary.by_vehicle_type?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vehicle Category Breakdown */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Truck size={20} className="text-primary" />
                  Distance by Vehicle Type
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {kmSummary.by_vehicle_type?.map((item) => {
                    const percentage =
                      kmSummary.grand_total_km > 0
                        ? (
                            (item.total_km / kmSummary.grand_total_km) *
                            100
                          ).toFixed(1)
                        : 0;
                    return (
                      <div
                        key={item.vehicle_type}
                        className="bg-gray-50 rounded-lg p-5 border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 bg-white rounded-lg shadow-sm text-gray-700">
                            {getVehicleIcon(item.vehicle_type)}
                          </div>
                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                            {percentage}%
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                          {item.vehicle_type}
                        </h4>
                        <p className="text-xl font-bold text-gray-800 mb-1">
                          {item.total_km?.toFixed(1)}{" "}
                          <span className="text-sm text-gray-500 font-normal">
                            km
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.total_trips} trips •{" "}
                          {item.avg_km_per_trip?.toFixed(1)} km/trip
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{width: `${percentage}%`}}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {(!kmSummary.by_vehicle_type ||
                    kmSummary.by_vehicle_type.length === 0) && (
                    <div className="col-span-full py-12 flex flex-col items-center text-center text-gray-400">
                      <AlertCircle size={48} className="mb-2 opacity-20" />
                      <p>No vehicle data recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Drivers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Award size={20} className="text-amber-500" />
                  Top Drivers
                </h3>
              </div>
              <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
                <div className="space-y-3">
                  {kmSummary.top_drivers?.map((d, i) => (
                    <div
                      key={d.driver_id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary/30 transition-all hover:bg-white hover:shadow-sm"
                    >
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                          i === 0
                            ? "bg-amber-100 text-amber-700 ring-4 ring-amber-50"
                            : i === 1
                            ? "bg-gray-200 text-gray-700 ring-4 ring-gray-100"
                            : i === 2
                            ? "bg-orange-100 text-orange-700 ring-4 ring-orange-100"
                            : "bg-white border border-gray-200 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {d.driver_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {d.trips} trips completed
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">
                          {d.total_km?.toFixed(0)} km
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {(d.total_km / d.trips).toFixed(1)} avg
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!kmSummary.top_drivers ||
                    kmSummary.top_drivers.length === 0) && (
                    <div className="py-12 flex flex-col items-center text-center text-gray-400">
                      <Award size={48} className="mb-2 opacity-20" />
                      <p>No driver data available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
