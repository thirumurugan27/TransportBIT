import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  AlertTriangle,
  CheckCircle2,
  Truck,
  X,
  FileText,
  Save,
  Pencil,
  AlertOctagon,
  Bus,
  Car,
  Gauge,
  Calendar,
  Clock,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost} from "../../../utils/api";

const STATUS_CONFIG = {
  overdue: {
    label: "Overdue",
    badgeColor: "bg-red-500 text-white",
    rowBorder: "border-l-4 border-l-red-500",
    headerBg: "bg-red-500",
    progressColor: "bg-red-500",
  },
  danger: {
    label: "Danger",
    badgeColor: "bg-red-100 text-red-700",
    rowBorder: "border-l-4 border-l-red-400",
    headerBg: "bg-red-500",
    progressColor: "bg-red-400",
  },
  warning: {
    label: "Warning",
    badgeColor: "bg-amber-100 text-amber-700",
    rowBorder: "border-l-4 border-l-amber-400",
    headerBg: "bg-amber-500",
    progressColor: "bg-amber-500",
  },
  on_track: {
    label: "On Track",
    badgeColor: "bg-green-100 text-green-700",
    rowBorder: "border-l-4 border-l-green-400",
    headerBg: "bg-primary",
    progressColor: "bg-green-500",
  },
};

const getKmStatusColor = (remaining) => {
  if (remaining === null || remaining === undefined)
    return "bg-gray-100 text-gray-500";
  if (remaining <= 0) return "bg-red-500 text-white";
  if (remaining <= 100) return "bg-red-100 text-red-700";
  if (remaining <= 300) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
};

const getVehicleIcon = (type) => {
  if (type === "BUS") return <Bus size={20} className="text-white" />;
  if (type === "CAR") return <Car size={20} className="text-white" />;
  return <Truck size={20} className="text-white" />;
};

const getVehicleIconSmall = (type) => {
  if (type === "BUS")
    return <Bus size={16} className="text-blue-500 shrink-0" />;
  if (type === "CAR")
    return <Car size={16} className="text-green-500 shrink-0" />;
  return <Truck size={16} className="text-primary shrink-0" />;
};

export default function ServiceReminders() {
  const {showToast} = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/service-tracking");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch service tracking:", e);
    } finally {
      setLoading(false);
    }
  };

  const stats = vehicles.reduce(
    (acc, v) => {
      if (v.status === "overdue") acc.overdue++;
      else if (v.status === "danger") acc.danger++;
      else if (v.status === "warning") acc.warning++;
      else acc.onTrack++;
      return acc;
    },
    {overdue: 0, danger: 0, warning: 0, onTrack: 0},
  );

  const filtered = vehicles.filter((v) => {
    const matchesType = filterType === "ALL" || v.vehicle_type === filterType;
    const matchesSearch =
      !searchQuery ||
      v.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicle_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicle_type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => a.remaining_km - b.remaining_km);

  const convertDate = (d) => {
    if (!d) return "";
    const match = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return d;
  };

  const openDetail = (v) => {
    setSelectedVehicle(v);
    setIsEditing(false);
    setShowDetailModal(true);
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedVehicle(null);
    setIsEditing(false);
  };

  const startEditing = () => {
    setEditForm({
      last_serviced_km: selectedVehicle.last_serviced_km || 0,
      next_service_km: selectedVehicle.next_service_km || 0,
      last_service_date: convertDate(selectedVehicle.last_service_date),
      next_service_date: convertDate(selectedVehicle.next_service_date),
      notes: selectedVehicle.notes || "",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (parseInt(editForm.next_service_km) <= 0) {
      showToast("Next service KM must be greater than 0", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost("/api/admin/service-tracking/update", {
        vehicle_id: selectedVehicle.vehicle_id,
        last_serviced_km: parseInt(editForm.last_serviced_km) || 0,
        next_service_km: parseInt(editForm.next_service_km) || 10000,
        last_service_date: editForm.last_service_date || "",
        next_service_date: editForm.next_service_date || "",
        notes: editForm.notes,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setIsEditing(false);
        closeDetail();
        fetchData();
      } else {
        showToast(data.error || "Failed to update", "error");
      }
    } catch {
      showToast("Failed to update service tracking", "error");
    } finally {
      setSaving(false);
    }
  };

  const getProgressPercent = (v) => {
    if (v.next_service_km <= 0) return 100;
    const traveled = v.current_km - v.last_serviced_km;
    const total = v.next_service_km - v.last_serviced_km;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, (traveled / total) * 100));
  };

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Search + Filter */}
      <div className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="w-full sm:w-72">
            <CustomSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by vehicle number or name..."
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              {key: "ALL", label: "All"},
              {key: "BUS", label: "Bus"},
              {key: "CAR", label: "Car"},
              {key: "BATTERY_VEHICLE", label: "Battery Vehicle"},
              {key: "OTHER", label: "Other"},
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filterType === tab.key
                    ? "bg-primary text-white shadow-md"
                    : "bg-primarybg text-secondarytext hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-md">
              <AlertOctagon size={20} />
            </div>
            <h4 className="font-bold text-primarytext text-sm">Overdue</h4>
          </div>
          <div className="text-center bg-red-50 p-3 rounded-md">
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-xs text-red-600 font-medium">Past due KM</p>
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 text-red-500 rounded-md">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-bold text-primarytext text-sm">Danger</h4>
          </div>
          <div className="text-center bg-red-50/50 p-3 rounded-md">
            <p className="text-2xl font-bold text-red-500">{stats.danger}</p>
            <p className="text-xs text-red-500 font-medium">
              {"< 100 km left"}
            </p>
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-md">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-bold text-primarytext text-sm">Warning</h4>
          </div>
          <div className="text-center bg-amber-50 p-3 rounded-md">
            <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
            <p className="text-xs text-amber-600 font-medium">
              {"< 300 km left"}
            </p>
          </div>
        </div>
        <div className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-md">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="font-bold text-primarytext text-sm">On Track</h4>
          </div>
          <div className="text-center bg-green-50 p-3 rounded-md">
            <p className="text-2xl font-bold text-green-600">{stats.onTrack}</p>
            <p className="text-xs text-green-600 font-medium">Good condition</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-secondarybg rounded-md border border-primarybg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primarybg border-b border-primarybg">
                {[
                  "S.No",
                  "Vehicle",
                  "Type",
                  "Serviced At",
                  "Current KM",
                  "To Be Serviced",
                  "Remaining",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-3 text-xs font-bold text-secondarytext uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-primarybg">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-primarybg p-4 rounded-full">
                        <FileText
                          size={32}
                          className="text-secondarytext"
                          strokeWidth={1.5}
                        />
                      </div>
                      <p className="text-secondarytext font-medium">
                        No vehicles found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((v, idx) => {
                  const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.on_track;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => openDetail(v)}
                      className={`group cursor-pointer transition-all duration-200 hover:bg-primary/5 ${sc.rowBorder}`}
                    >
                      <td className="px-4 py-3 text-secondarytext font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getVehicleIconSmall(v.vehicle_type)}
                          <div>
                            <p className="font-semibold text-primarytext">
                              {v.vehicle_name || v.vehicle_number}
                            </p>
                            {v.vehicle_name && (
                              <p className="text-xs text-secondarytext">
                                {v.vehicle_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-primarybg text-secondarytext">
                          {v.vehicle_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-primarytext font-medium">
                        {v.last_serviced_km.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-primarytext">
                          {v.current_km.toLocaleString()} km
                        </span>
                      </td>
                      <td className="px-4 py-3 text-primarytext font-medium">
                        {v.next_service_km.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-bold ${getKmStatusColor(v.remaining_km)}`}
                        >
                          {v.remaining_km <= 0
                            ? `${Math.abs(v.remaining_km).toLocaleString()} over`
                            : `${v.remaining_km.toLocaleString()} km`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md ${sc.badgeColor}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight
                          size={16}
                          className="text-secondarytext group-hover:text-primary transition-colors"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedVehicle && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeDetail}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-md ${STATUS_CONFIG[selectedVehicle.status]?.headerBg || "bg-primary"} flex items-center justify-center shadow-md`}
                  >
                    {getVehicleIcon(selectedVehicle.vehicle_type)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      {selectedVehicle.vehicle_name ||
                        selectedVehicle.vehicle_number}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedVehicle.vehicle_name && (
                        <span className="text-sm text-secondarytext">
                          {selectedVehicle.vehicle_number}
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primarybg text-secondarytext">
                        {selectedVehicle.vehicle_type}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${STATUS_CONFIG[selectedVehicle.status]?.badgeColor}`}
                      >
                        {STATUS_CONFIG[selectedVehicle.status]?.label}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeDetail}
                  className="text-secondarytext hover:text-primarytext p-2 hover:bg-primarybg rounded-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isEditing ? (
              <>
                <div className="p-6 space-y-4">
                  {/* KM Overview Section */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        KM Overview
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center bg-secondarybg rounded-md p-3">
                        <p className="text-xs text-secondarytext font-medium mb-1">
                          Serviced At
                        </p>
                        <p className="text-lg font-bold text-primarytext">
                          {selectedVehicle.last_serviced_km.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-secondarytext">km</p>
                      </div>
                      <div className="text-center bg-secondarybg rounded-md p-3">
                        <p className="text-xs text-secondarytext font-medium mb-1">
                          Current KM
                        </p>
                        <p className="text-lg font-bold text-primarytext">
                          {selectedVehicle.current_km.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-secondarytext">km</p>
                      </div>
                      <div className="text-center bg-secondarybg rounded-md p-3">
                        <p className="text-xs text-secondarytext font-medium mb-1">
                          To Be Serviced
                        </p>
                        <p className="text-lg font-bold text-primarytext">
                          {selectedVehicle.next_service_km.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-secondarytext">km</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress & Remaining */}
                  <div className="bg-primarybg rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={16} className="text-primary" />
                      <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                        Service Progress
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-secondarytext">
                          Remaining KM
                        </span>
                        <span
                          className={`text-sm font-bold px-2.5 py-1 rounded-md ${getKmStatusColor(selectedVehicle.remaining_km)}`}
                        >
                          {selectedVehicle.remaining_km <= 0
                            ? `${Math.abs(selectedVehicle.remaining_km).toLocaleString()} km overdue`
                            : `${selectedVehicle.remaining_km.toLocaleString()} km`}
                        </span>
                      </div>
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${STATUS_CONFIG[selectedVehicle.status]?.progressColor}`}
                            style={{
                              width: `${Math.min(100, getProgressPercent(selectedVehicle))}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[11px] text-secondarytext">
                            {selectedVehicle.last_serviced_km.toLocaleString()}{" "}
                            km
                          </span>
                          <span className="text-[11px] text-secondarytext font-medium">
                            {Math.round(getProgressPercent(selectedVehicle))}%
                            used
                          </span>
                          <span className="text-[11px] text-secondarytext">
                            {selectedVehicle.next_service_km.toLocaleString()}{" "}
                            km
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dates Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-primarybg rounded-md p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={16} className="text-primary" />
                        <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                          Service Dates
                        </h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Last Service
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.last_service_date || "Not set"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Next Service
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.next_service_date || "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primarybg rounded-md p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock size={16} className="text-primary" />
                        <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                          Record Info
                        </h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Created
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.created_at || "-"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-secondarytext">
                            Updated
                          </span>
                          <span className="text-sm font-semibold text-primarytext">
                            {selectedVehicle.updated_at || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedVehicle.notes && (
                    <div className="bg-primarybg rounded-md p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <StickyNote size={16} className="text-primary" />
                        <h4 className="text-sm font-bold text-secondarytext uppercase tracking-wide">
                          Notes
                        </h4>
                      </div>
                      <p className="text-sm text-primarytext whitespace-pre-wrap">
                        {selectedVehicle.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end items-center gap-3">
                  <button
                    onClick={closeDetail}
                    className="px-5 py-2.5 text-secondarytext hover:bg-primarybg rounded-md font-semibold text-sm transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={startEditing}
                    className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
                  >
                    <Pencil size={16} />
                    Edit Service Data
                  </button>
                </div>
              </>
            ) : (
              /* Edit Form */
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Serviced At (KM)
                    </label>
                    <input
                      type="number"
                      value={editForm.last_serviced_km}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          last_serviced_km: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      min="0"
                      required
                    />
                    <p className="text-[11px] text-secondarytext mt-1">
                      KM when last serviced
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      To Be Serviced (KM)
                    </label>
                    <input
                      type="number"
                      value={editForm.next_service_km}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          next_service_km: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      min="1"
                      required
                    />
                    <p className="text-[11px] text-secondarytext mt-1">
                      KM at which next service is due
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Last Service Date
                    </label>
                    <input
                      type="date"
                      value={editForm.last_service_date}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          last_service_date: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                      Next Service Date
                    </label>
                    <input
                      type="date"
                      value={editForm.next_service_date}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          next_service_date: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm({...editForm, notes: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    rows={3}
                    placeholder="Service notes or remarks..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-5 py-2.5 text-secondarytext hover:bg-primarybg rounded-md font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-primary text-white rounded-md font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
