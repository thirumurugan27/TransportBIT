import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  Map as MapIcon,
  Route,
  TrendingUp,
  Plus,
  Calendar,
  AlertCircle,
  X,
  Fuel,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function DriverKmLog() {
  const {showToast} = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const {user} = useAuth();
  const driverId = user?.driver_id;

  const [form, setForm] = useState({
    date: getToday(),
    start_km: 0,
    end_km: 0,
    vehicle_id: "",
    assignment_id: "",
    remarks: "",
    fuel_consumed: "",
  });

  useEffect(() => {
    if (driverId) {
      fetchLogs();
      fetchAssignedVehicles(getToday());
    }
  }, [driverId]);

  useEffect(() => {
    if (form.vehicle_id && showModal) {
      fetchLastLogDetails(form.vehicle_id);
    }
  }, [form.vehicle_id, showModal]);

  const fetchLastLogDetails = async (vehId) => {
    try {
      const res = await apiGet(
        `/api/driver/vehicle-last-log?vehicle_id=${vehId}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.end_km !== undefined) {
          setForm((prev) => ({...prev, start_km: data.end_km}));
        }
      }
    } catch (err) {
      console.error("Failed to fetch last log details", err);
    }
  };

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

  const fetchAssignedVehicles = async (dateValue = form.date) => {
    setVehiclesLoading(true);
    try {
      const res = await apiGet(
        `/api/driver/km-log/assigned-vehicles?driver_id=${driverId}&date=${dateValue}`,
      );
      if (!res.ok) {
        throw new Error("Failed to load assigned vehicles");
      }

      const assignedVehicles = await res.json();
      const vehicleMap = new globalThis.Map();

      const upsertVehicle = (vehicle) => {
        if (!vehicle?.id) return;

        const existing = vehicleMap.get(vehicle.id);
        vehicleMap.set(vehicle.id, {
          ...existing,
          ...vehicle,
          assignment_id:
            existing?.assignment_id || vehicle.assignment_id || null,
          vehicle_name: vehicle.vehicle_name || existing?.vehicle_name || "",
          vehicle_number:
            vehicle.vehicle_number || existing?.vehicle_number || "",
          vehicle_type:
            vehicle.vehicle_type || existing?.vehicle_type || "Vehicle",
          source: vehicle.source || existing?.source || "assignment",
          source_label:
            vehicle.source_label || existing?.source_label || "Assigned",
        });
      };

      (assignedVehicles || []).forEach(upsertVehicle);

      const uniqueVehicles = Array.from(vehicleMap.values()).sort(
        (left, right) => {
          const leftLabel = (
            left.vehicle_name ||
            left.vehicle_number ||
            ""
          ).toLowerCase();
          const rightLabel = (
            right.vehicle_name ||
            right.vehicle_number ||
            ""
          ).toLowerCase();
          return leftLabel.localeCompare(rightLabel);
        },
      );

      setVehicles(uniqueVehicles);
      setForm((prev) => {
        const currentMatch = uniqueVehicles.find(
          (vehicle) => String(vehicle.id) === String(prev.vehicle_id),
        );
        const fallback = uniqueVehicles[0];
        if (!currentMatch && !fallback) {
          return {...prev, vehicle_id: "", assignment_id: ""};
        }

        const selected = currentMatch || fallback;
        return {
          ...prev,
          vehicle_id: String(selected.id),
          assignment_id: selected.assignment_id?.toString() || "",
        };
      });
    } catch (err) {
      console.error(err);
      showToast("Failed to load assigned vehicles", "error");
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    if (parseFloat(form.end_km) <= parseFloat(form.start_km)) {
      showToast("End KM must be greater than Start KM", "warning");
      return;
    }
    if (!form.vehicle_id) {
      showToast("Please select a vehicle", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const selectedVehicle = vehicles.find(
        (v) => v.id === parseInt(form.vehicle_id),
      );
      const payload = {
        driver_id: parseInt(driverId),
        date: form.date,
        start_km: parseFloat(form.start_km),
        end_km: parseFloat(form.end_km),
        vehicle_type: selectedVehicle?.vehicle_type || "BUS",
        vehicle_id: parseInt(form.vehicle_id),
        assignment_id: form.assignment_id ? parseInt(form.assignment_id) : null,
        remarks: form.remarks,
        total_km: parseFloat(form.end_km) - parseFloat(form.start_km),
        fuel_consumed: form.fuel_consumed
          ? parseFloat(form.fuel_consumed)
          : null,
        force,
      };

      const res = await apiPost("/api/driver/km-log/add", payload);
      const data = await res.json();

      if (res.ok) {
        showToast("KM log submitted for approval!", "success");
        closeModal();
        fetchLogs();
      } else if (data.code === "duplicate") {
        const confirmed = await showConfirm(
          "Log Already Exists",
          data.error || "You have already submitted a KM log for this date and vehicle. Do you want to add another log?",
        );
        if (confirmed) {
          await handleSubmit(null, true);
        }
      } else {
        showToast("Failed: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to add log", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setForm((prev) => ({
      ...prev,
      start_km: 0,
      end_km: 0,
      remarks: "",
      fuel_consumed: "",
    }));
  };

  const normalizeText = (value) =>
    typeof value === "string" ? value.trim() : "";

  const getVehicleDisplay = (vehicle) => {
    const vehicleName = normalizeText(vehicle?.vehicle_name);
    const vehicleNumber = normalizeText(vehicle?.vehicle_number);

    if (vehicleName && vehicleNumber && vehicleName !== vehicleNumber) {
      return {
        title: vehicleName,
        subtitle: `${vehicleNumber} • ${vehicle?.vehicle_type || "Vehicle"} • ${vehicle?.source_label || "Assigned"}${vehicle?.seating_capacity ? ` • ${vehicle?.seating_capacity} Seats` : ""}`,
      };
    }

    return {
      title: vehicleNumber || vehicleName || "Unknown vehicle",
      subtitle: `${vehicle?.vehicle_type || "Vehicle"} • ${vehicle?.source_label || "Assigned"}${vehicle?.seating_capacity ? ` • ${vehicle?.seating_capacity} Seats` : ""}`,
    };
  };

  const totalKm = parseFloat(form.end_km || 0) - parseFloat(form.start_km || 0);

  const calculateStats = () => {
    const totalTrips = logs.length;
    const totalKm = logs.reduce((sum, log) => {
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

  const vehicleOptions = vehicles.map((vehicle) => {
    const display = getVehicleDisplay(vehicle);
    return {
      value: String(vehicle.id),
      label: display.title,
      subtitle: display.subtitle,
    };
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">My KM Logs</h1>
          <p className="text-sm text-secondarytext mt-0.5">
            Track your vehicle usage and trip history
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            fetchAssignedVehicles(form.date);
          }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Add Entry
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
                <MapIcon size={56} className="text-primary" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <MapIcon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Distance
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.totalKm.toFixed(1)}{" "}
                    <span className="text-sm text-secondarytext font-normal">
                      km
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <Route size={56} className="text-green-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-green-100 rounded-md">
                  <Route size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Total Trips
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.totalTrips}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-secondarybg rounded-md border border-gray-100 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={56} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-orange-100 rounded-md">
                  <TrendingUp size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Avg / Trip
                  </p>
                  <p className="text-xl font-bold text-primarytext mt-0.5">
                    {stats.avgKm.toFixed(1)}{" "}
                    <span className="text-sm text-secondarytext font-normal">
                      km
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-secondarybg rounded-md border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-primarytext text-sm flex items-center gap-2">
                <Calendar size={16} className="text-secondarytext" />
                Recent Logs
              </h3>
              <span className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md">
                {logs.length} entries
              </span>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const dist =
                    log.total_km !== undefined
                      ? parseFloat(log.total_km)
                      : parseFloat(log.end_km) - parseFloat(log.start_km);
                  return (
                    <div
                      key={log.id}
                      className={`p-4 space-y-2.5 ${log.status === "pending" ? "bg-pending/5" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-secondarytext" />
                          <span className="font-bold text-primarytext text-sm">
                            {log.date}
                          </span>
                          {log.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-pending/15 text-pending rounded">
                              <Clock size={10} /> Pending
                            </span>
                          )}
                          {log.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-red/15 text-red rounded">
                              <XCircle size={10} /> Rejected
                            </span>
                          )}
                          {log.status === "approved" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-green/15 text-green rounded">
                              <CheckCircle2 size={10} /> Approved
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-primary text-sm">
                          {dist.toFixed(1)} km
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.vehicle_number && (
                          <span className="text-sm font-medium text-primarytext">
                            {log.vehicle_number}
                          </span>
                        )}
                        {log.fuel_consumed && (
                          <span className="inline-flex items-center gap-1 text-xs text-pending font-medium">
                            <Fuel size={12} />
                            {parseFloat(log.fuel_consumed).toFixed(1)} L
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-secondarytext">
                        <span>
                          Start:{" "}
                          <span className="font-mono text-primarytext">
                            {log.start_km}
                          </span>
                        </span>
                        <span>
                          End:{" "}
                          <span className="font-mono text-primarytext">
                            {log.end_km}
                          </span>
                        </span>
                      </div>
                      {log.remarks && (
                        <p className="text-xs text-secondarytext">
                          {log.remarks}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-secondarytext">
                  <AlertCircle size={32} className="opacity-20 mx-auto mb-2" />
                  <p className="text-sm">
                    No logs found. Add your first entry!
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg border-b border-gray-100">
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Start KM
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      End KM
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Fuel (L)
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
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
                          className="hover:bg-primarybg transition-colors"
                        >
                          <td className="px-6 py-3.5 whitespace-nowrap font-bold text-primarytext text-sm">
                            {log.date}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-primarytext">
                              {log.vehicle_number || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono text-secondarytext text-sm">
                            {log.start_km}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono text-secondarytext text-sm">
                            {log.end_km}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right">
                            <span className="font-bold text-primary text-sm">
                              {dist.toFixed(1)} km
                            </span>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm">
                            {log.fuel_consumed ? (
                              <span className="font-medium text-pending">
                                {parseFloat(log.fuel_consumed).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-secondarytext">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-center">
                            {log.status === "pending" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-pending/15 text-pending rounded">
                                <Clock size={10} /> Pending
                              </span>
                            )}
                            {log.status === "approved" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-green/15 text-green rounded">
                                <CheckCircle2 size={10} /> Approved
                              </span>
                            )}
                            {log.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-red/15 text-red rounded">
                                <XCircle size={10} /> Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <p className="text-sm text-secondarytext truncate max-w-50">
                              {log.remarks || "—"}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-12 text-center text-secondarytext"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p className="text-sm">
                            No logs found. Add your first entry!
                          </p>
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

      {/* Add KM Log Entry Modal — matches admin style */}
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
                  <Plus size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-primarytext">
                  Add KM Log Entry
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
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setForm((prev) => ({...prev, date: nextDate}));
                    if (driverId) {
                      fetchAssignedVehicles(nextDate);
                    }
                  }}
                  max={getToday()}
                  className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  required
                />
              </div>

              {/* Vehicle */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Vehicle <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={vehicleOptions}
                  value={String(form.vehicle_id)}
                  disabled={vehiclesLoading}
                  onChange={(val) => {
                    const selectedVehicle = vehicles.find(
                      (v) => String(v.id) === val,
                    );
                    setForm((prev) => ({
                      ...prev,
                      vehicle_id: val,
                      assignment_id:
                        selectedVehicle?.assignment_id?.toString() || "",
                    }));
                  }}
                  placeholder={
                    vehiclesLoading
                      ? "Loading assigned vehicles..."
                      : "Search and select vehicle"
                  }
                  emptyMessage="No vehicles assigned"
                />
                {vehiclesLoading && (
                  <p className="text-xs text-secondarytext mt-1">
                    Loading assigned vehicles for selected date...
                  </p>
                )}
                {vehicles.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    No assigned vehicles found for this date (including EV group
                    and vehicle requests). Contact admin if this looks wrong.
                  </p>
                )}
              </div>

              {/* KM Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    Start KM <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.start_km}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, start_km: e.target.value}))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="0.0"
                    required
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primarytext">
                    End KM <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.end_km}
                    onChange={(e) =>
                      setForm((prev) => ({...prev, end_km: e.target.value}))
                    }
                    className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="0.0"
                    required
                    min={form.start_km || "0"}
                    step="0.1"
                  />
                </div>
              </div>

              {/* Total KM Display */}
              {totalKm > 0 && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-md border border-green-100">
                  <span className="text-sm font-medium text-green-700">
                    Total Distance
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {totalKm.toFixed(1)} km
                  </span>
                </div>
              )}

              {/* Fuel Consumed */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Fuel Consumed{" "}
                  <span className="text-secondarytext font-normal">
                    (Optional, in Liters)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.fuel_consumed}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      fuel_consumed: e.target.value,
                    }))
                  }
                  className="w-full h-10.5 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  placeholder="0.0"
                  min="0"
                  step="0.1"
                />
                {form.fuel_consumed && totalKm > 0 && (
                  <p className="text-xs text-secondarytext mt-0.5">
                    Mileage:{" "}
                    <span className="font-bold text-primary">
                      {(totalKm / parseFloat(form.fuel_consumed)).toFixed(1)}{" "}
                      km/L
                    </span>
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-primarytext">
                  Remarks{" "}
                  <span className="text-secondarytext font-normal">
                    (Optional)
                  </span>
                </label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((prev) => ({...prev, remarks: e.target.value}))
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                  rows="2"
                  placeholder="Add any notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-primarybg">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-gray-200 text-secondarytext rounded-md hover:bg-primarybg font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || vehiclesLoading || !form.vehicle_id}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium text-sm transition-colors"
                >
                  {submitting ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Plus size={16} /> Add Log
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
