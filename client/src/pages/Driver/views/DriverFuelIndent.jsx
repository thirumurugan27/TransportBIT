import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Fuel,
  Plus,
  Calendar,
  AlertCircle,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Droplets,
  Gauge,
  Hash,
} from "lucide-react";

export default function DriverFuelIndent() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [fuelTypes] = useState(["DIESEL", "PETROL", "CNG", "EV", "OTHER"]);

  const [form, setForm] = useState({
    vehicle_type: "",
    fuel_type: "",
    vehicle_id: "",
    driver_id: "",
    fuel_indent_number: "",
    filled_date: getToday(),
    filled_time: "",
    odometer_reading: "",
    filled_liters: "",
  });

  useEffect(() => {
    fetchIndents();
    fetchVehicles();
    fetchDrivers();
    fetchVehicleTypes();
  }, []);

  const fetchIndents = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/driver/fuel-indents");
      if (res.ok) {
        const data = await res.json();
        setIndents(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await apiGet("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await apiGet("/api/driver/drivers-dropdown");
      if (res.ok) {
        const data = await res.json();
        setDrivers(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const res = await apiGet("/api/vehicle-types");
      if (res.ok) {
        const data = await res.json();
        setVehicleTypes(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (form.vehicle_type && v.vehicle_type?.toUpperCase() !== form.vehicle_type.toUpperCase()) return false;
    if (form.fuel_type && v.fuel_type?.toUpperCase() !== form.fuel_type.toUpperCase()) return false;
    return true;
  });

  const vehicleOptions = filteredVehicles.map((v) => ({
    value: String(v.id),
    label: v.vehicle_name || v.vehicle_number,
    subtitle: v.vehicle_number,
  }));

  const driverOptions = drivers.map((d) => ({
    value: String(d.id),
    label: d.full_name,
  }));

  const vehicleTypeOptions = vehicleTypes.map((vt) => ({
    value: vt.type || vt,
    label: vt.label || vt.type || vt,
  }));

  const fuelTypeOptions = fuelTypes.map((ft) => ({
    value: ft,
    label: ft,
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) {
      showToast("Please select a vehicle", "warning");
      return;
    }
    if (!form.driver_id) {
      showToast("Please select a driver", "warning");
      return;
    }
    if (!form.fuel_indent_number.trim()) {
      showToast("Fuel indent number is required", "warning");
      return;
    }
    if (!form.filled_date) {
      showToast("Filled date is required", "warning");
      return;
    }
    if (!form.filled_liters || parseFloat(form.filled_liters) <= 0) {
      showToast("Filled liters must be greater than 0", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: parseInt(form.vehicle_id),
        driver_id: parseInt(form.driver_id),
        vehicle_type: form.vehicle_type,
        fuel_type: form.fuel_type,
        fuel_indent_number: form.fuel_indent_number.trim(),
        filled_date: form.filled_date,
        filled_time: form.filled_time,
        odometer_reading: form.odometer_reading ? parseInt(form.odometer_reading) : 0,
        filled_liters: parseFloat(form.filled_liters),
      };

      const res = await apiPost("/api/driver/fuel-indents/create", payload);
      if (res.ok) {
        showToast("Fuel indent raised successfully!", "success");
        closeModal();
        fetchIndents();
      } else {
        const errData = await res.json();
        showToast("Failed: " + (errData.error || "Unknown error"), "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to raise fuel indent", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({
      vehicle_type: "",
      fuel_type: "",
      vehicle_id: "",
      driver_id: "",
      fuel_indent_number: "",
      filled_date: getToday(),
      filled_time: "",
      odometer_reading: "",
      filled_liters: "",
    });
  };

  const calculateStats = () => {
    const total = indents.length;
    const pending = indents.filter((i) => i.status === "pending").length;
    const totalLiters = indents.reduce((sum, i) => sum + (parseFloat(i.fuel_filled) || 0), 0);
    return {total, pending, totalLiters};
  };

  const stats = calculateStats();

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">Fuel Indents</h1>
          <p className="text-sm text-secondarytext mt-0.5">
            Raise and track fuel indent requests
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Raise Indent
        </button>
      </div>

      {loading ? (
        <Loading fullScreen={false} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fuel size={56} className="text-primary" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Fuel size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Indents
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.total}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Clock size={56} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-orange-100 rounded-md">
                  <Clock size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Pending
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.pending}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Droplets size={56} className="text-green-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-green-100 rounded-md">
                  <Droplets size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Liters
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.totalLiters.toFixed(1)}{" "}
                    <span className="text-sm text-secondarytext font-normal">L</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Indents Table */}
          <div className="bg-secondarybg rounded-md border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-primarytext text-sm flex items-center gap-2">
                <Calendar size={16} className="text-secondarytext" />
                Fuel Indent History
              </h3>
              <span className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md">
                {indents.length} entries
              </span>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {indents.length > 0 ? (
                indents.map((indent) => (
                  <div key={indent.id} className={`p-4 space-y-2.5 ${indent.status === "pending" ? "bg-pending/5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash size={13} className="text-secondarytext" />
                        <span className="font-bold text-primarytext text-sm">
                          {indent.fuel_indent_number || `#${indent.id}`}
                        </span>
                        {indent.status === "pending" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-pending/15 text-pending rounded">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                        {indent.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-green/15 text-green rounded">
                            <CheckCircle2 size={10} /> Completed
                          </span>
                        )}
                        {indent.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-red/15 text-red rounded">
                            <XCircle size={10} /> Rejected
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary text-sm">
                        {parseFloat(indent.fuel_filled || 0).toFixed(1)} L
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-primarytext">
                        {indent.vehicle_name || indent.vehicle_number}
                      </span>
                      {indent.vehicle_type && (
                        <span className="text-xs text-secondarytext bg-primarybg px-1.5 py-0.5 rounded">
                          {indent.vehicle_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-secondarytext">
                      <span>Date: <span className="text-primarytext">{indent.filled_date || indent.requested_at?.split("T")[0]}</span></span>
                      {indent.filled_time && <span>Time: <span className="text-primarytext">{indent.filled_time}</span></span>}
                      <span>Odometer: <span className="font-mono text-primarytext">{indent.odometer_reading}</span></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-secondarytext">
                  <AlertCircle size={32} className="opacity-20 mx-auto mb-2" />
                  <p className="text-sm">No fuel indents found. Raise your first indent!</p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg border-b border-gray-100">
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Indent #</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Type / Fuel</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">Odometer</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">Liters</th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {indents.length > 0 ? (
                    indents.map((indent) => (
                      <tr key={indent.id} className="hover:bg-primarybg transition-colors">
                        <td className="px-6 py-3.5 whitespace-nowrap font-bold text-primarytext text-sm">
                          {indent.fuel_indent_number || `#${indent.id}`}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-primarytext">
                          {indent.vehicle_name || indent.vehicle_number}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-primarytext">
                          {indent.driver_name}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-secondarytext">
                          {indent.vehicle_type}{indent.fuel_type ? ` / ${indent.fuel_type}` : ""}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-primarytext">
                          {indent.filled_date || indent.requested_at?.split("T")[0]}
                          {indent.filled_time && <span className="text-secondarytext ml-1">{indent.filled_time}</span>}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono text-secondarytext text-sm">
                          {indent.odometer_reading}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                          <span className="font-bold text-primary text-sm">
                            {parseFloat(indent.fuel_filled || 0).toFixed(1)} L
                          </span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          {indent.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-pending/15 text-pending rounded">
                              <Clock size={10} /> Pending
                            </span>
                          )}
                          {indent.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-green/15 text-green rounded">
                              <CheckCircle2 size={10} /> Completed
                            </span>
                          )}
                          {indent.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-red/15 text-red rounded">
                              <XCircle size={10} /> Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-secondarytext">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p className="text-sm">No fuel indents found. Raise your first indent!</p>
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

      {/* Raise Fuel Indent Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-primarybg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Fuel size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-primarytext">
                  Raise Fuel Indent
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-primarybg rounded-md transition-colors"
              >
                <X size={20} className="text-secondarytext" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {/* Vehicle Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={vehicleTypeOptions}
                  value={form.vehicle_type}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, vehicle_type: val, vehicle_id: ""}))
                  }
                  placeholder="Select vehicle type"
                  emptyMessage="No vehicle types found"
                />
              </div>

              {/* Fuel Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Fuel Type <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={fuelTypeOptions}
                  value={form.fuel_type}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, fuel_type: val, vehicle_id: ""}))
                  }
                  placeholder="Select fuel type"
                  emptyMessage="No fuel types"
                />
              </div>

              {/* Vehicle Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Vehicle Name <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={vehicleOptions}
                  value={form.vehicle_id}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, vehicle_id: val}))
                  }
                  placeholder="Search and select vehicle"
                  emptyMessage={form.vehicle_type || form.fuel_type ? "No vehicles match filters" : "No vehicles available"}
                />
              </div>

              {/* Driver Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Driver Name <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={driverOptions}
                  value={form.driver_id}
                  onChange={(val) =>
                    setForm((prev) => ({...prev, driver_id: val}))
                  }
                  placeholder="Search and select driver"
                  emptyMessage="No drivers found"
                />
              </div>

              {/* Fuel Indent Number */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Fuel Indent Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fuel_indent_number}
                  onChange={(e) =>
                    setForm((prev) => ({...prev, fuel_indent_number: e.target.value}))
                  }
                  className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  placeholder="Enter fuel indent number"
                  required
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Fuel Filled Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.filled_date}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, filled_date: e.target.value}))
                    }
                    max={getToday()}
                    className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Filled Time
                  </label>
                  <input
                    type="time"
                    value={form.filled_time}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, filled_time: e.target.value}))
                    }
                    className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* Odometer & Liters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Odometer Reading <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.odometer_reading}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, odometer_reading: e.target.value}))
                    }
                    className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Enter odometer reading"
                    required
                    min="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Filled Liters <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.filled_liters}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, filled_liters: e.target.value}))
                    }
                    className="w-full h-[42px] px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Enter liters filled"
                    required
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Fuel size={16} />
                      Raise Indent
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
