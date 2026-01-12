import React, {useState, useEffect} from "react";
import {
  Car,
  Bus,
  Truck,
  Zap,
  Fuel,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Trash2,
  Edit2,
  Search,
  Filter,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter State
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const initialFormState = {
    vehicle_type: "BUS",
    vehicle_number: "",
    seating_capacity: 0,
    fuel_type: "DIESEL",
    bus_name: "",
    start_point: "",
    end_point: "",
  };
  const [vehicleForm, setVehicleForm] = useState(initialFormState);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vehicles`);
      const data = await res.json();
      setVehicles(data || []);
    } catch (err) {
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const filteredVehicles = vehicles.filter((v) => {
    const matchesType = filterType === "ALL" || v.vehicle_type === filterType;
    const matchesSearch =
      v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.bus_name &&
        v.bus_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const getVehicleLabel = (v) => {
    if (v.vehicle_type === "BUS") return `${v.vehicle_number} (${v.bus_name})`;
    return v.vehicle_number;
  };

  const handleEdit = (vehicle) => {
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type,
      vehicle_number: vehicle.vehicle_number,
      seating_capacity: vehicle.seating_capacity,
      fuel_type: vehicle.fuel_type,
      bus_name: vehicle.bus_name || "",
      start_point: vehicle.start_point || "",
      end_point: vehicle.end_point || "",
    });
    setEditingId(vehicle.id);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?"))
      return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/vehicles/delete?id=${id}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        alert("Vehicle deleted successfully!");
        fetchVehicles();
      } else {
        alert("Failed to delete vehicle: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting vehicle");
    }
  };

  const handleSubmit = async () => {
    if (
      !vehicleForm.vehicle_type ||
      !vehicleForm.vehicle_number ||
      !vehicleForm.seating_capacity ||
      !vehicleForm.fuel_type
    ) {
      alert("Please fill all required fields");
      return;
    }
    if (
      vehicleForm.vehicle_type === "BUS" &&
      (!vehicleForm.bus_name ||
        !vehicleForm.start_point ||
        !vehicleForm.end_point)
    ) {
      alert("Please fill all bus details (Name, Start/End Points)");
      return;
    }

    try {
      const url = isEditing
        ? `${API_BASE}/api/admin/vehicles/update`
        : `${API_BASE}/api/admin/vehicles/create`;

      const body = isEditing ? {...vehicleForm, id: editingId} : vehicleForm;

      const res = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });

      if (res.ok) {
        alert(
          isEditing
            ? "Vehicle updated successfully!"
            : "Vehicle created successfully!"
        );
        fetchVehicles();
        setShowCreateModal(false);
        setVehicleForm(initialFormState);
        setIsEditing(false);
        setEditingId(null);
      } else {
        alert(
          `Failed to ${isEditing ? "update" : "create"} vehicle: ` +
            (await res.text())
        );
      }
    } catch (err) {
      console.error(err);
      alert(`Error ${isEditing ? "updating" : "creating"} vehicle`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Buses
            </h4>
            <p className="text-3xl font-bold text-gray-800">
              {vehicles?.filter((v) => v.vehicle_type === "BUS").length || 0}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Bus size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Electric
            </h4>
            <p className="text-3xl font-bold text-purple-600">
              {vehicles?.filter((v) => v.fuel_type === "EV").length || 0}
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Zap size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Cars
            </h4>
            <p className="text-3xl font-bold text-emerald-600">
              {vehicles?.filter((v) => v.vehicle_type === "CAR").length || 0}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Car size={24} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Others
            </h4>
            <p className="text-3xl font-bold text-gray-600">
              {vehicles?.filter(
                (v) => v.vehicle_type === "OTHER" || v.vehicle_type === "VAN"
              ).length || 0}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-gray-600">
            <Truck size={24} />
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Vehicle Management
          </h2>
          <p className="text-sm text-gray-500">
            Manage your entire fleet and assets
          </p>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setVehicleForm(initialFormState);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-md shadow-[var(--color-primary)]/25"
        >
          <Plus size={18} />
          Add New Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by vehicle number or bus name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
          {["ALL", "BUS", "CAR", "VAN", "OTHER"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                filterType === type
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {type === "ALL"
                ? "All"
                : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mb-4"></div>
            <p>Loading fleet data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Vehicle Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Specs
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Route / Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles && filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-12 w-12 rounded-lg flex items-center justify-center text-xl transition-colors ${
                              v.vehicle_type === "BUS"
                                ? "bg-blue-50 text-blue-600"
                                : v.fuel_type === "EV"
                                ? "bg-purple-50 text-purple-600"
                                : v.vehicle_type === "CAR"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-gray-50 text-gray-600"
                            }`}
                          >
                            {v.vehicle_type === "BUS" ? (
                              <Bus size={20} />
                            ) : v.vehicle_type === "CAR" ? (
                              <Car size={20} />
                            ) : (
                              <Truck size={20} />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {getVehicleLabel(v)}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              #{v.id} • {v.vehicle_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {v.vehicle_type === "BUS" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            College Bus
                          </span>
                        )}
                        {v.vehicle_type === "CAR" &&
                          v.seating_capacity <= 5 && (
                            <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Car (5-Seater)
                            </span>
                          )}
                        {v.vehicle_type === "CAR" && v.seating_capacity > 5 && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Car (7-Seater)
                          </span>
                        )}
                        {v.vehicle_type === "VAN" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Van
                          </span>
                        )}
                        {v.vehicle_type === "OTHER" && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                            Special Purpose
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            {v.fuel_type === "EV" ? (
                              <Zap size={14} className="text-purple-500" />
                            ) : (
                              <Fuel size={14} className="text-gray-400" />
                            )}
                            {v.fuel_type}
                          </div>
                          <div className="text-xs text-gray-500">
                            {v.seating_capacity} Seats
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {v.vehicle_type === "BUS" ? (
                          <div className="flex flex-col text-xs gap-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                              <span className="font-medium text-gray-700">
                                {v.start_point || "?"}
                              </span>
                            </div>
                            <div className="h-3 border-l border-gray-200 ml-[3px]"></div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                              <span className="font-medium text-gray-700">
                                {v.end_point || "?"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${
                            v.status === "available"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {v.status === "available" ? (
                            <CheckCircle size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {v.status === "available"
                            ? "Available"
                            : "In Service"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            onClick={() => handleEdit(v)}
                            title="Edit Vehicle"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            onClick={() => handleDelete(v.id)}
                            title="Delete Vehicle"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Bus size={24} className="text-gray-400" />
                        </div>
                        <p>No vehicles found. Add one to get started.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Vehicle Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {isEditing ? "Edit" : "Create"}{" "}
                {vehicleForm.vehicle_type === "BUS" ? "Bus" : "Vehicle"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Vehicle Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Vehicle Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["BUS", "CAR", "VAN", "OTHER"].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setVehicleForm({...vehicleForm, vehicle_type: type})
                      }
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                        vehicleForm.vehicle_type === type
                          ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      {type === "BUS" && (
                        <>
                          <Bus size={16} /> Bus
                        </>
                      )}
                      {type === "CAR" && (
                        <>
                          <Car size={16} /> Car
                        </>
                      )}
                      {type === "VAN" && (
                        <>
                          <Truck size={16} /> Van
                        </>
                      )}
                      {type === "OTHER" && (
                        <>
                          <AlertCircle size={16} /> Other
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                {vehicleForm.vehicle_type === "BUS" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bus Name / Route Name
                    </label>
                    <input
                      placeholder="e.g., Route A Express"
                      value={vehicleForm.bus_name}
                      onChange={(e) =>
                        setVehicleForm({
                          ...vehicleForm,
                          bus_name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    placeholder="e.g., TN34 AB 1234"
                    value={vehicleForm.vehicle_number}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        vehicle_number: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none font-mono uppercase transition-all"
                  />
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuel Type
                  </label>
                  <select
                    value={vehicleForm.fuel_type}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        fuel_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                  >
                    <option value="DIESEL">🛢️ Diesel</option>
                    <option value="PETROL">⛽ Petrol</option>
                    <option value="CNG">🌿 CNG</option>
                    <option value="EV">⚡ Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    value={vehicleForm.seating_capacity}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        seating_capacity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    min="1"
                  />
                </div>
              </div>

              {/* Route Details (Bus Only) */}
              {vehicleForm.vehicle_type === "BUS" && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Route Details
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Point
                      </label>
                      <input
                        placeholder="e.g., Main Campus"
                        value={vehicleForm.start_point}
                        onChange={(e) =>
                          setVehicleForm({
                            ...vehicleForm,
                            start_point: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Point
                      </label>
                      <input
                        placeholder="e.g., Central Station"
                        value={vehicleForm.end_point}
                        onChange={(e) =>
                          setVehicleForm({
                            ...vehicleForm,
                            end_point: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                className="w-full px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all font-bold shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isEditing ? "Update" : "Create"} Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
