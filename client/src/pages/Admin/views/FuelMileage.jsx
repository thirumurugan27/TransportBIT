import React, {useState, useEffect} from "react";
import {
  Fuel,
  Gauge,
  TrendingUp,
  History,
  ChevronRight,
  AlertCircle,
  Plus,
  X,
  Search,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function FuelMileage() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [fuelIndents, setFuelIndents] = useState([]);
  const [odometerReadings, setOdometerReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showIndentModal, setShowIndentModal] = useState(false);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form states
  const [indentForm, setIndentForm] = useState({
    vehicle_id: "",
    driver_id: "",
    fuel_requested: "",
    odometer_reading: "",
  });

  const [odometerForm, setOdometerForm] = useState({
    vehicle_id: "",
    driver_id: "",
    from_reading: "",
    to_reading: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, driversRes, indentsRes, odometerRes] =
        await Promise.all([
          fetch(`${API_BASE}/api/admin/vehicles`),
          fetch(`${API_BASE}/api/admin/drivers`),
          fetch(`${API_BASE}/api/admin/fuel-indents`).catch(() => ({
            json: () => [],
          })),
          fetch(`${API_BASE}/api/admin/odometer-readings`).catch(() => ({
            json: () => [],
          })),
        ]);

      setVehicles((await vehiclesRes.json()) || []);
      setDrivers((await driversRes.json()) || []);
      setFuelIndents((await indentsRes.json()) || []);
      setOdometerReadings((await odometerRes.json()) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIndentSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/fuel-indents/create`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          ...indentForm,
          fuel_requested: parseFloat(indentForm.fuel_requested),
          odometer_reading: parseInt(indentForm.odometer_reading),
          vehicle_id: parseInt(indentForm.vehicle_id),
          driver_id: parseInt(indentForm.driver_id),
        }),
      });
      if (res.ok) {
        setShowIndentModal(false);
        setIndentForm({
          vehicle_id: "",
          driver_id: "",
          fuel_requested: "",
          odometer_reading: "",
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOdometerSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/odometer-readings/create`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            ...odometerForm,
            from_reading: parseInt(odometerForm.from_reading),
            to_reading: parseInt(odometerForm.to_reading),
            vehicle_id: parseInt(odometerForm.vehicle_id),
            driver_id: parseInt(odometerForm.driver_id),
          }),
        },
      );
      if (res.ok) {
        setShowOdometerModal(false);
        setOdometerForm({
          vehicle_id: "",
          driver_id: "",
          from_reading: "",
          to_reading: "",
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate stats
  const pendingIndents = fuelIndents.filter((i) => i.status === "pending");
  const totalFuelUsed = fuelIndents
    .filter((i) => i.status === "completed")
    .reduce((sum, i) => sum + (i.fuel_filled || 0), 0);
  const avgEfficiency =
    odometerReadings.length > 0
      ? (
          odometerReadings.reduce(
            (sum, r) =>
              sum + (r.to_reading - r.from_reading) / (r.fuel_used || 1),
            0,
          ) / odometerReadings.length
        ).toFixed(1)
      : "N/A";

  const inputClasses =
    "w-full bg-primarybg border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:bg-secondarybg focus:ring-2 focus:ring-primary focus:outline-none transition-all";
  const labelClasses =
    "text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-1.5 block";

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-primarytext tracking-tight">
            Fuel & Mileage
          </h1>
          <p className="text-secondarytext mt-2 font-medium">
            Track consumption, verify odometers and optimize efficiency
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-secondarybg text-primary font-bold rounded-md shadow-sm border border-gray-100 hover:bg-primarybg transition-colors"
          >
            <History className="w-4 h-4" /> History
          </button>
          <button
            onClick={() => setShowIndentModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-md shadow-md shadow-primary/30 hover:bg-primarydull transition-colors"
          >
            <Fuel className="w-4 h-4" /> Raise Indent
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-secondarybg p-6 rounded-md shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 bg-primary/10 rounded-md flex items-center justify-center text-primary shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
              Avg Efficiency
            </p>
            <h3 className="text-2xl font-black text-primarytext">
              {avgEfficiency}{" "}
              <span className="text-sm font-bold text-secondarytext">km/l</span>
            </h3>
          </div>
        </div>

        <div className="bg-secondarybg p-6 rounded-md shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 bg-green/10 rounded-md flex items-center justify-center text-green shadow-sm">
            <Fuel className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
              Total Fuel Used
            </p>
            <h3 className="text-2xl font-black text-primarytext">
              {totalFuelUsed}{" "}
              <span className="text-sm font-bold text-secondarytext">
                Liters
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={() => setShowOdometerModal(true)}
          className="bg-secondarybg p-6 rounded-md shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer group hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-pending/10 rounded-md flex items-center justify-center text-pending shadow-sm">
              <Gauge className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                Log Odometer
              </p>
              <h3 className="text-lg font-bold text-primarytext">
                Daily Readings
              </h3>
            </div>
          </div>
          <ChevronRight className="text-gray-300 group-hover:text-primary transition-colors" />
        </button>
      </div>

      {/* Pending Verifications */}
      <div className="bg-secondarybg p-8 rounded-md shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-primarytext flex items-center gap-3">
            <AlertCircle className="text-pending" /> Pending Verifications
            {pendingIndents.length > 0 && (
              <span className="bg-pending text-white text-[10px] px-2 py-0.5 rounded-md">
                {pendingIndents.length}
              </span>
            )}
          </h3>
          <button className="text-sm font-bold text-primary hover:underline">
            Verify All
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primarybg border-t-primary rounded-md animate-spin"></div>
          </div>
        ) : pendingIndents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondarytext font-medium">
              All fuel indents are up to date! ✨
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingIndents.map((item, idx) => (
              <div
                key={idx}
                className="p-5 bg-primarybg/50 rounded-md border border-gray-100 flex items-center justify-between hover:bg-primarybg transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className="p-3 bg-secondarybg rounded-md font-mono font-bold text-xs shadow-sm border border-gray-200">
                    {item.vehicle_number || `VH-${item.vehicle_id}`}
                  </div>
                  <div>
                    <h4 className="font-bold text-primarytext text-sm">
                      {item.driver_name || `Driver #${item.driver_id}`}
                    </h4>
                    <p className="text-[10px] text-secondarytext font-bold uppercase tracking-widest mt-0.5">
                      Requested: {item.fuel_requested} L
                    </p>
                  </div>
                </div>
                <button className="px-5 py-2 bg-secondarybg text-primary font-bold text-xs rounded-md border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm">
                  Complete Log
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raise Indent Modal */}
      {showIndentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowIndentModal(false)}
          />
          <div className="relative bg-secondarybg w-full max-w-lg p-8 rounded-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primarytext flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white">
                  <Fuel className="w-5 h-5" />
                </div>
                Raise Fuel Indent
              </h2>
              <button
                onClick={() => setShowIndentModal(false)}
                className="text-secondarytext hover:text-red transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIndentSubmit} className="space-y-5">
              <div>
                <label className={labelClasses}>Select Vehicle</label>
                <select
                  className={inputClasses}
                  value={indentForm.vehicle_id}
                  onChange={(e) =>
                    setIndentForm({...indentForm, vehicle_id: e.target.value})
                  }
                  required
                >
                  <option value="">Choose a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} - {v.vehicle_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Select Driver</label>
                <select
                  className={inputClasses}
                  value={indentForm.driver_id}
                  onChange={(e) =>
                    setIndentForm({...indentForm, driver_id: e.target.value})
                  }
                  required
                >
                  <option value="">Choose a driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Fuel Required (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputClasses}
                    value={indentForm.fuel_requested}
                    onChange={(e) =>
                      setIndentForm({
                        ...indentForm,
                        fuel_requested: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={labelClasses}>Current Odometer</label>
                  <input
                    type="number"
                    className={inputClasses}
                    value={indentForm.odometer_reading}
                    onChange={(e) =>
                      setIndentForm({
                        ...indentForm,
                        odometer_reading: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowIndentModal(false)}
                  className="flex-1 py-3 bg-primarybg text-secondarytext font-bold rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-md shadow-md shadow-primary/30 hover:bg-primarydull transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Odometer Modal */}
      {showOdometerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOdometerModal(false)}
          />
          <div className="relative bg-secondarybg w-full max-w-lg p-8 rounded-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primarytext flex items-center gap-3">
                <div className="w-10 h-10 bg-green rounded-md flex items-center justify-center text-white">
                  <Gauge className="w-5 h-5" />
                </div>
                Log Odometer Reading
              </h2>
              <button
                onClick={() => setShowOdometerModal(false)}
                className="text-secondarytext hover:text-red transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOdometerSubmit} className="space-y-5">
              <div>
                <label className={labelClasses}>Select Vehicle</label>
                <select
                  className={inputClasses}
                  value={odometerForm.vehicle_id}
                  onChange={(e) =>
                    setOdometerForm({
                      ...odometerForm,
                      vehicle_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Choose a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} - {v.vehicle_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Select Driver</label>
                <select
                  className={inputClasses}
                  value={odometerForm.driver_id}
                  onChange={(e) =>
                    setOdometerForm({
                      ...odometerForm,
                      driver_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Choose a driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>From Odometer</label>
                  <input
                    type="number"
                    className={inputClasses}
                    value={odometerForm.from_reading}
                    onChange={(e) =>
                      setOdometerForm({
                        ...odometerForm,
                        from_reading: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={labelClasses}>To Odometer</label>
                  <input
                    type="number"
                    className={inputClasses}
                    value={odometerForm.to_reading}
                    onChange={(e) =>
                      setOdometerForm({
                        ...odometerForm,
                        to_reading: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowOdometerModal(false)}
                  className="flex-1 py-3 bg-primarybg text-secondarytext font-bold rounded-md hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-green text-white font-bold rounded-md shadow-md shadow-green/30 hover:opacity-90 transition-colors"
                >
                  Update Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHistoryModal(false)}
          />
          <div className="relative bg-secondarybg w-full max-w-3xl p-8 rounded-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primarytext">
                Fuel History
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-secondarytext hover:text-red transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {fuelIndents.length === 0 ? (
                <div className="text-center py-12 text-secondarytext">
                  No fuel records found
                </div>
              ) : (
                <div className="space-y-3">
                  {fuelIndents.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-primarybg/50 rounded-md border border-gray-100 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-secondarybg rounded-md border border-gray-200">
                          <Fuel className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-primarytext text-sm">
                            {item.vehicle_number ||
                              `Vehicle #${item.vehicle_id}`}
                          </p>
                          <p className="text-xs text-secondarytext">
                            {item.driver_name || `Driver #${item.driver_id}`} •{" "}
                            {item.fuel_filled || item.fuel_requested}L
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold ${
                          item.status === "completed"
                            ? "bg-green/10 text-green"
                            : "bg-pending/10 text-pending"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
