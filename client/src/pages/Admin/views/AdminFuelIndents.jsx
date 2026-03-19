import React, { useState, useEffect } from "react";
import {
  API_BASE,
  apiGet,
  apiDelete,
  apiPost,
  apiPut,
  apiUpload,
  getToday,
} from "../../../utils/api";
import { useToast } from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import { showConfirm } from "../../../utils/swal";
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
  Check,
  Truck,
  User,
  Upload,
  ExternalLink,
  Pencil,
  Trash2,
  FileText,
  IndianRupee,
  Gauge,
  Filter,
  RefreshCw,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toInputDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const datePart = raw.split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
    const [dd, mm, yyyy] = datePart.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const toInputTimeValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const hhmm24 = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (hhmm24) return `${hhmm24[1]}:${hhmm24[2]}`;
  const hhmm12 = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!hhmm12) return "";
  let hour = parseInt(hhmm12[1], 10);
  const minute = hhmm12[2];
  const period = hhmm12[3].toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-pending/15 text-pending rounded-md">
        <Clock size={10} /> Pending
      </span>
    );
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-green/15 text-green rounded-md">
        <CheckCircle2 size={10} /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 bg-red/15 text-red rounded-md">
        <XCircle size={10} /> Rejected
      </span>
    );
  return null;
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="rounded-md border border-gray-100 bg-primarybg/60 px-3 py-2.5">
      <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-sm font-semibold text-primarytext ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function EmptyState({ message = "No fuel indents found" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="p-4 bg-primarybg rounded-full">
        <Fuel size={28} className="text-secondarytext opacity-30" />
      </div>
      <p className="text-sm text-secondarytext">{message}</p>
    </div>
  );
}

function FieldGroup({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-primarytext">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminFuelIndents() {
  const { showToast } = useToast();
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [detailsEditMode, setDetailsEditMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [billUploadLoadingId, setBillUploadLoadingId] = useState(null);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [filter, setFilter] = useState("all");

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [fuelTypes] = useState(["DIESEL", "PETROL", "CNG", "EV", "OTHER"]);

  const [form, setForm] = useState({
    vehicle_type: "",
    fuel_type: "",
    vehicle_id: "",
    driver_id: "",
    filled_date: getToday(),
    filled_time: "",
    odometer_reading: "",
    filled_liters: "",
    fuel_amount: "",
    bill_file: null,
  });

  const [editForm, setEditForm] = useState({
    filled_date: "",
    filled_time: "",
    odometer_reading: "",
    filled_liters: "",
    fuel_amount: "",
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
      const res = await apiGet("/api/admin/fuel-indents");
      if (res.ok) setIndents((await res.json()) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await apiGet("/api/vehicles");
      if (res.ok) setVehicles((await res.json()) || []);
    } catch (err) { console.error(err); }
  };

  const fetchDrivers = async () => {
    try {
      const res = await apiGet("/api/drivers");
      if (res.ok) setDrivers((await res.json()) || []);
    } catch (err) { console.error(err); }
  };

  const fetchVehicleTypes = async () => {
    try {
      const res = await apiGet("/api/vehicle-types");
      if (res.ok) setVehicleTypes((await res.json()) || []);
    } catch (err) { console.error(err); }
  };

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      const res = await apiPost(`/api/admin/fuel-indents/approve?id=${id}`, {});
      if (res.ok) {
        showToast("Fuel indent approved successfully", "success");
        setSelectedIndent((prev) =>
          prev && prev.id === id ? { ...prev, status: "completed" } : prev
        );
        fetchIndents();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to approve", "error");
      }
    } catch {
      showToast("Failed to approve", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(id);
    try {
      const res = await apiPost(`/api/admin/fuel-indents/reject?id=${id}`, {});
      if (res.ok) {
        showToast("Fuel indent rejected", "success");
        setSelectedIndent((prev) =>
          prev && prev.id === id ? { ...prev, status: "rejected" } : prev
        );
        fetchIndents();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to reject", "error");
      }
    } catch {
      showToast("Failed to reject", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) return showToast("Please select a vehicle", "warning");
    if (!form.driver_id) return showToast("Please select a driver", "warning");
    if (!form.filled_date) return showToast("Filled date is required", "warning");
    if (!form.filled_liters || parseFloat(form.filled_liters) <= 0)
      return showToast("Filled liters must be greater than 0", "warning");
    if (!form.fuel_amount || parseFloat(form.fuel_amount) <= 0)
      return showToast("Fuel amount must be greater than 0", "warning");

    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: parseInt(form.vehicle_id),
        driver_id: parseInt(form.driver_id),
        vehicle_type: form.vehicle_type,
        fuel_type: form.fuel_type,
        filled_date: form.filled_date,
        filled_time: form.filled_time,
        odometer_reading: form.odometer_reading ? parseInt(form.odometer_reading) : 0,
        filled_liters: parseFloat(form.filled_liters),
        fuel_amount: parseFloat(form.fuel_amount),
      };
      const res = await apiPost("/api/admin/fuel-indents/create", payload);
      const responseData = await res.json();
      if (res.ok) {
        if (form.bill_file && responseData?.id) {
          const formData = new FormData();
          formData.append("file", form.bill_file);
          const billRes = await apiUpload(`/api/admin/fuel-indents/${responseData.id}/bill`, formData);
          if (!billRes.ok) {
            const billErr = await billRes.json();
            showToast(billErr.error || "Indent created, but bill upload failed", "warning");
          }
        }
        showToast("Fuel indent created successfully!", "success");
        closeModal();
        fetchIndents();
      } else {
        showToast("Failed: " + (responseData.error || "Unknown error"), "error");
      }
    } catch {
      showToast("Failed to create fuel indent", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const saveInlineEdit = async (indentId) => {
    if (!editForm.filled_date) { showToast("Filled date is required", "warning"); return; }
    if (!editForm.filled_liters || parseFloat(editForm.filled_liters) <= 0) {
      showToast("Filled liters must be greater than 0", "warning"); return;
    }
    if (!editForm.fuel_amount || parseFloat(editForm.fuel_amount) <= 0) {
      showToast("Fuel amount must be greater than 0", "warning"); return;
    }
    setRowActionLoadingId(indentId);
    try {
      const res = await apiPut(`/api/admin/fuel-indents/${indentId}`, {
        filled_date: editForm.filled_date,
        filled_time: editForm.filled_time,
        odometer_reading: parseInt(editForm.odometer_reading || "0", 10),
        filled_liters: parseFloat(editForm.filled_liters),
        fuel_amount: parseFloat(editForm.fuel_amount),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Fuel indent updated", "success");
        setDetailsEditMode(false);
        fetchIndents();
        setSelectedIndent((prev) =>
          prev && prev.id === indentId
            ? {
                ...prev,
                filled_date: editForm.filled_date,
                filled_time: editForm.filled_time,
                odometer_reading: parseInt(editForm.odometer_reading || "0", 10),
                fuel_filled: parseFloat(editForm.filled_liters),
                fuel_amount: parseFloat(editForm.fuel_amount),
              }
            : prev
        );
      } else {
        showToast(data.error || "Failed to update fuel indent", "error");
      }
    } catch {
      showToast("Failed to update fuel indent", "error");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const deleteIndent = async (indentId) => {
    const isConfirmed = await showConfirm(
      "Delete Fuel Indent",
      "This will permanently delete this fuel indent record. Are you sure?"
    );
    if (!isConfirmed) return;
    setRowActionLoadingId(indentId);
    try {
      const res = await apiDelete(`/api/admin/fuel-indents/${indentId}`);
      const data = await res.json();
      if (res.ok) {
        showToast("Fuel indent deleted", "success");
        if (selectedIndent?.id === indentId) closeDetailsModal();
        fetchIndents();
      } else {
        showToast(data.error || "Failed to delete fuel indent", "error");
      }
    } catch {
      showToast("Failed to delete fuel indent", "error");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleUploadBill = async (indentId, file) => {
    if (!file) return;
    setBillUploadLoadingId(indentId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(`/api/admin/fuel-indents/${indentId}/bill`, formData);
      const data = await res.json();
      if (res.ok) {
        showToast("Bill uploaded successfully", "success");
        setSelectedIndent((prev) =>
          prev && prev.id === indentId
            ? {
                ...prev,
                bill_file_url: data?.bill?.file_url || prev.bill_file_url,
                bill_original_name: data?.bill?.original_name || prev.bill_original_name,
              }
            : prev
        );
        fetchIndents();
      } else {
        showToast(data.error || "Failed to upload bill", "error");
      }
    } catch {
      showToast("Failed to upload bill", "error");
    } finally {
      setBillUploadLoadingId(null);
    }
  };

  // ─── Modal helpers ──────────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setForm({
      vehicle_type: "", fuel_type: "", vehicle_id: "", driver_id: "",
      filled_date: getToday(), filled_time: "", odometer_reading: "",
      filled_liters: "", fuel_amount: "", bill_file: null,
    });
  };

  const openDetailsModal = (indent) => {
    setSelectedIndent(indent);
    setDetailsEditMode(false);
    setEditForm({
      filled_date: toInputDateValue(indent.filled_date) || getToday(),
      filled_time: toInputTimeValue(indent.filled_time),
      odometer_reading: String(indent.odometer_reading || ""),
      filled_liters: String(indent.fuel_filled || 0),
      fuel_amount: String(indent.fuel_amount || 0),
    });
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedIndent(null);
    setDetailsEditMode(false);
  };

  const startInlineEdit = (indent) => {
    setDetailsEditMode(true);
    setEditForm({
      filled_date: toInputDateValue(indent.filled_date) || getToday(),
      filled_time: toInputTimeValue(indent.filled_time),
      odometer_reading: String(indent.odometer_reading || ""),
      filled_liters: String(indent.fuel_filled || 0),
      fuel_amount: String(indent.fuel_amount || 0),
    });
  };

  const cancelInlineEdit = () => {
    setDetailsEditMode(false);
    setEditForm({ filled_date: "", filled_time: "", odometer_reading: "", filled_liters: "", fuel_amount: "" });
  };

  const getBillURL = (indent) => {
    if (!indent?.bill_file_url) return "";
    return `${API_BASE || ""}${indent.bill_file_url}`;
  };

  // ─── Derived data ────────────────────────────────────────────────────────────
  const filteredVehicles = vehicles.filter((v) => {
    if (form.vehicle_type && v.vehicle_type?.toUpperCase() !== form.vehicle_type.toUpperCase()) return false;
    if (form.fuel_type && v.fuel_type?.toUpperCase() !== form.fuel_type.toUpperCase()) return false;
    return true;
  });

  const vehicleOptions = filteredVehicles.map((v) => ({
    value: String(v.id),
    label: v.vehicle_name || v.vehicle_number,
    subtitle: `${v.vehicle_number}${v.seating_capacity ? ` • ${v.seating_capacity} Seats` : ""}`,
  }));

  const driverOptions = drivers.map((d) => ({ value: String(d.id), label: d.full_name }));
  const vehicleTypeOptions = vehicleTypes.map((vt) => ({ value: vt.type || vt, label: vt.label || vt.type || vt }));
  const fuelTypeOptions = fuelTypes.map((ft) => ({ value: ft, label: ft }));

  const filteredIndents = indents.filter((i) => {
    if (filter === "pending") return i.status === "pending";
    if (filter === "completed") return i.status === "completed";
    if (filter === "rejected") return i.status === "rejected";
    return true;
  });

  const stats = {
    total: indents.length,
    pending: indents.filter((i) => i.status === "pending").length,
    completed: indents.filter((i) => i.status === "completed").length,
    rejected: indents.filter((i) => i.status === "rejected").length,
    totalLiters: indents.reduce((sum, i) => sum + (parseFloat(i.fuel_filled) || 0), 0),
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <Fuel size={22} className="text-primary" /> Fuel Indents
          </h1>
          <p className="text-sm text-secondarytext mt-0.5">
            Manage and approve fuel indent requests
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
        >
          <Plus size={17} strokeWidth={2.5} />
          Create Indent
        </button>
      </div>

      {loading ? (
        <Loading fullScreen={false} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, icon: Fuel, color: "text-primary", bg: "bg-primary/10" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
              { label: "Approved", value: stats.completed, icon: CheckCircle2, color: "text-green", bg: "bg-green/10" },
              { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red", bg: "bg-red/10" },
              { label: "Total Liters", value: `${stats.totalLiters.toFixed(1)} L`, icon: Droplets, color: "text-blue-600", bg: "bg-blue-100" },
            ].map((s, i) => (
              <div key={i} className="bg-secondarybg rounded-md border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondarytext mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-primarytext leading-tight">{s.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-md ${s.bg} shrink-0`}>
                    <s.icon size={18} className={s.color} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-primarybg p-1 rounded-md w-fit">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: `Pending (${stats.pending})` },
              { key: "completed", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  filter === tab.key
                    ? "bg-secondarybg text-primarytext shadow-sm"
                    : "text-secondarytext hover:text-primarytext"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table Card */}
          <div className="bg-secondarybg rounded-md border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-primarytext text-sm flex items-center gap-2">
                <FileText size={15} className="text-secondarytext" />
                Fuel Indent Records
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondarytext bg-primarybg px-2 py-1 rounded-md">
                  {filteredIndents.length} records
                </span>
                <button
                  onClick={fetchIndents}
                  className="p-1.5 rounded-md hover:bg-primarybg transition-colors text-secondarytext hover:text-primarytext"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredIndents.length > 0 ? (
                filteredIndents.map((indent, index) => (
                  <div
                    key={indent.id}
                    onClick={() => openDetailsModal(indent)}
                    className={`p-4 space-y-2.5 cursor-pointer hover:bg-primarybg/50 transition-colors ${
                      indent.status === "pending" ? "bg-orange-50/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-primarybg px-2 py-0.5 text-[10px] font-bold text-secondarytext">
                          #{index + 1}
                        </span>
                        <StatusBadge status={indent.status} />
                      </div>
                      <span className="font-bold text-primary text-sm">
                        {parseFloat(indent.fuel_filled || 0).toFixed(1)} L
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Truck size={13} className="text-secondarytext" />
                      <span className="font-semibold text-primarytext">{indent.vehicle_name || indent.vehicle_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User size={13} className="text-secondarytext" />
                      <span className="text-primarytext">{indent.driver_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-secondarytext">
                      <span>Date: <span className="text-primarytext font-medium">{indent.filled_date || indent.requested_at?.split("T")[0]}</span></span>
                      <span>₹<span className="text-primarytext font-mono">{parseFloat(indent.fuel_amount || 0).toFixed(2)}</span></span>
                    </div>
                    {indent.status === "pending" && (
                      <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(indent.id)}
                          disabled={actionLoading === indent.id}
                          className="flex items-center gap-1 bg-green text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-green/90 disabled:opacity-50 transition-colors"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(indent.id)}
                          disabled={actionLoading === indent.id}
                          className="flex items-center gap-1 bg-red text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red/90 disabled:opacity-50 transition-colors"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState />
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg border-b border-gray-100">
                    {["#", "Vehicle", "Driver", "Type / Fuel", "Date / Time", "Odometer", "Liters", "Amount (₹)", "Bill", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[10px] font-bold text-secondarytext uppercase tracking-wider ${
                          ["Odometer", "Liters", "Amount (₹)"].includes(h) ? "text-right" : ["Bill", "Status", "Actions"].includes(h) ? "text-center" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredIndents.length > 0 ? (
                    filteredIndents.map((indent, index) => (
                      <tr
                        key={indent.id}
                        onClick={() => openDetailsModal(indent)}
                        className={`cursor-pointer hover:bg-primarybg/60 transition-colors ${
                          indent.status === "pending" ? "bg-orange-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-xs font-bold text-secondarytext">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-primarytext whitespace-nowrap">{indent.vehicle_name || indent.vehicle_number}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-primarytext whitespace-nowrap">{indent.driver_name}</td>
                        <td className="px-4 py-3 text-sm text-secondarytext whitespace-nowrap">
                          {indent.vehicle_type}{indent.fuel_type ? ` / ${indent.fuel_type}` : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-primarytext whitespace-nowrap">
                          {indent.filled_date || indent.requested_at?.split("T")[0]}
                          {indent.filled_time && (
                            <span className="text-secondarytext ml-1 text-xs">{indent.filled_time}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-secondarytext text-sm whitespace-nowrap">
                          {indent.odometer_reading || "—"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-bold text-primary text-sm">{parseFloat(indent.fuel_filled || 0).toFixed(1)} L</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-secondarytext text-sm whitespace-nowrap">
                          ₹{parseFloat(indent.fuel_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {indent.bill_file_url ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                              <FileText size={9} /> Available
                            </span>
                          ) : (
                            <span className="text-xs text-secondarytext">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <StatusBadge status={indent.status} />
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {indent.status === "pending" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleApprove(indent.id)}
                                disabled={actionLoading === indent.id}
                                title="Approve"
                                className="flex items-center gap-1 bg-green text-white px-2.5 py-1 rounded-md text-[11px] font-bold hover:bg-green/90 disabled:opacity-50 transition-colors"
                              >
                                <Check size={11} /> Approve
                              </button>
                              <button
                                onClick={() => handleReject(indent.id)}
                                disabled={actionLoading === indent.id}
                                title="Reject"
                                className="flex items-center gap-1 bg-red text-white px-2.5 py-1 rounded-md text-[11px] font-bold hover:bg-red/90 disabled:opacity-50 transition-colors"
                              >
                                <XCircle size={11} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-secondarytext">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="py-2">
                        <EmptyState />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Details Modal ──────────────────────────────────────────────────────── */}
      {showDetailsModal && selectedIndent && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={closeDetailsModal}
        >
          <div
            className="bg-secondarybg rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-md bg-primary">
                  <Fuel className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">
                    {selectedIndent.vehicle_name || selectedIndent.vehicle_number}
                  </h2>
                  <p className="text-xs text-secondarytext mt-0.5">
                    Fuel Indent #{selectedIndent.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedIndent.status} />
                <button
                  onClick={closeDetailsModal}
                  className="p-2 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-3">
                <DetailItem label="Driver" value={selectedIndent.driver_name || "Not assigned"} />
                <DetailItem label="Vehicle Type" value={selectedIndent.vehicle_type || "—"} />
                <DetailItem label="Fuel Type" value={selectedIndent.fuel_type || "—"} />
              </div>

              {/* Edit / View Section */}
              {detailsEditMode ? (
                <div className="bg-primarybg rounded-lg border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Pencil size={14} className="text-primary" />
                    <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">Edit Fuel Entry</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide block mb-1.5">Filled Date</label>
                      <input type="date" value={editForm.filled_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, filled_date: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide block mb-1.5">Filled Time</label>
                      <input type="time" value={editForm.filled_time}
                        onChange={(e) => setEditForm((p) => ({ ...p, filled_time: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide block mb-1.5">Odometer Reading</label>
                      <input type="number" min="0" value={editForm.odometer_reading}
                        onChange={(e) => setEditForm((p) => ({ ...p, odometer_reading: e.target.value }))}
                        className={inputCls} placeholder="KM reading" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide block mb-1.5">Filled Liters</label>
                      <input type="number" min="0.1" step="0.1" value={editForm.filled_liters}
                        onChange={(e) => setEditForm((p) => ({ ...p, filled_liters: e.target.value }))}
                        className={inputCls} placeholder="Liters" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-secondarytext uppercase tracking-wide block mb-1.5">Total Amount (₹)</label>
                      <input type="number" min="0.1" step="0.01" value={editForm.fuel_amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, fuel_amount: e.target.value }))}
                        className={inputCls} placeholder="Amount" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-primarybg rounded-lg border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Droplets size={14} className="text-primary" />
                    <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">Fuel Details</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <DetailItem
                      label="Requested At"
                      value={selectedIndent.requested_at
                        ? new Date(selectedIndent.requested_at).toLocaleDateString("en-IN")
                        : "—"}
                    />
                    <DetailItem
                      label="Filled Date"
                      value={selectedIndent.filled_date || selectedIndent.requested_at?.split("T")[0] || "—"}
                    />
                    <DetailItem label="Filled Time" value={selectedIndent.filled_time || "—"} />
                    <DetailItem
                      label="Odometer"
                      value={selectedIndent.odometer_reading ? `${selectedIndent.odometer_reading} km` : "—"}
                      mono
                    />
                    <DetailItem
                      label="Fuel Filled"
                      value={`${parseFloat(selectedIndent.fuel_filled || 0).toFixed(1)} L`}
                    />
                    <DetailItem
                      label="Amount"
                      value={`₹${parseFloat(selectedIndent.fuel_amount || 0).toFixed(2)}`}
                    />
                  </div>
                </div>
              )}

              {/* Bill Section */}
              <div className="bg-primarybg rounded-lg border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wide mb-1">Bill Document</p>
                  <p className="text-sm text-primarytext">
                    {selectedIndent.bill_original_name || "No bill uploaded"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIndent.bill_file_url && (
                    <a
                      href={getBillURL(selectedIndent)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink size={12} /> View Bill
                    </a>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-primary bg-white hover:bg-primarybg cursor-pointer transition-colors">
                    <Upload size={12} />
                    {billUploadLoadingId === selectedIndent.id ? "Uploading..." : "Upload Bill"}
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) => handleUploadBill(selectedIndent.id, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-primarybg/40 flex items-center justify-between gap-3 flex-wrap">
              {/* Left: Approve / Reject for pending */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedIndent.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedIndent.id)}
                      disabled={actionLoading === selectedIndent.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-green text-white hover:bg-green/90 disabled:opacity-60 transition-colors shadow-sm"
                    >
                      {actionLoading === selectedIndent.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <Check size={13} />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedIndent.id)}
                      disabled={actionLoading === selectedIndent.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-red text-white hover:bg-red/90 disabled:opacity-60 transition-colors shadow-sm"
                    >
                      {actionLoading === selectedIndent.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <XCircle size={13} />}
                      Reject
                    </button>
                  </>
                )}
              </div>

              {/* Right: Edit / Delete / Close */}
              <div className="flex items-center gap-2 flex-wrap">
                {!detailsEditMode ? (
                  <button
                    onClick={() => startInlineEdit(selectedIndent)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={cancelInlineEdit}
                      className="px-3 py-2 text-xs font-bold rounded-md border border-gray-200 text-secondarytext hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveInlineEdit(selectedIndent.id)}
                      disabled={rowActionLoadingId === selectedIndent.id}
                      className="px-3 py-2 text-xs font-bold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {rowActionLoadingId === selectedIndent.id ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteIndent(selectedIndent.id)}
                  disabled={rowActionLoadingId === selectedIndent.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border border-red/30 text-red bg-red/5 hover:bg-red/10 disabled:opacity-60 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
                <button
                  onClick={closeDetailsModal}
                  className="px-3 py-2 text-xs font-bold rounded-md border border-gray-200 text-secondarytext hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Fuel Indent Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-secondarybg rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-md">
                  <Fuel size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primarytext">Create Fuel Indent</h2>
                  <p className="text-xs text-secondarytext mt-0.5">Fill in the fuel details below</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-primarybg rounded-md transition-colors text-secondarytext hover:text-primarytext"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Vehicle Type">
                  <SearchableSelect
                    options={vehicleTypeOptions}
                    value={form.vehicle_type}
                    onChange={(val) => setForm((p) => ({ ...p, vehicle_type: val, vehicle_id: "" }))}
                    placeholder="Select type"
                    emptyMessage="No vehicle types found"
                  />
                </FieldGroup>
                <FieldGroup label="Fuel Type">
                  <SearchableSelect
                    options={fuelTypeOptions}
                    value={form.fuel_type}
                    onChange={(val) => setForm((p) => ({ ...p, fuel_type: val, vehicle_id: "" }))}
                    placeholder="Select fuel"
                    emptyMessage="No fuel types"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Vehicle" required>
                <SearchableSelect
                  options={vehicleOptions}
                  value={form.vehicle_id}
                  onChange={(val) => setForm((p) => ({ ...p, vehicle_id: val }))}
                  placeholder="Search and select vehicle"
                  emptyMessage={form.vehicle_type || form.fuel_type ? "No vehicles match filters" : "No vehicles available"}
                />
              </FieldGroup>

              <FieldGroup label="Driver" required>
                <SearchableSelect
                  options={driverOptions}
                  value={form.driver_id}
                  onChange={(val) => setForm((p) => ({ ...p, driver_id: val }))}
                  placeholder="Search and select driver"
                  emptyMessage="No drivers found"
                />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Filled Date" required>
                  <input
                    type="date"
                    value={form.filled_date}
                    onChange={(e) => setForm((p) => ({ ...p, filled_date: e.target.value }))}
                    max={getToday()}
                    className={inputCls}
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Filled Time">
                  <input
                    type="time"
                    value={form.filled_time}
                    onChange={(e) => setForm((p) => ({ ...p, filled_time: e.target.value }))}
                    className={inputCls}
                  />
                </FieldGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Odometer Reading" required>
                  <input
                    type="number"
                    value={form.odometer_reading}
                    onChange={(e) => setForm((p) => ({ ...p, odometer_reading: e.target.value }))}
                    className={inputCls}
                    placeholder="KM reading"
                    min="0"
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Filled Liters" required>
                  <input
                    type="number"
                    value={form.filled_liters}
                    onChange={(e) => setForm((p) => ({ ...p, filled_liters: e.target.value }))}
                    className={inputCls}
                    placeholder="Liters"
                    min="0.1"
                    step="0.1"
                    required
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Total Amount (₹)" required>
                <input
                  type="number"
                  value={form.fuel_amount}
                  onChange={(e) => setForm((p) => ({ ...p, fuel_amount: e.target.value }))}
                  className={inputCls}
                  placeholder="Enter total amount"
                  min="0.1"
                  step="0.01"
                  required
                />
              </FieldGroup>

              <FieldGroup label="Bill Upload (PDF / Image)">
                <div className="border-2 border-dashed border-gray-200 rounded-md p-4 bg-primarybg hover:border-primary/40 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setForm((p) => ({ ...p, bill_file: e.target.files?.[0] || null }))}
                    className="w-full text-sm text-secondarytext file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {form.bill_file && (
                    <p className="text-xs text-primary mt-2 flex items-center gap-1">
                      <FileText size={11} /> {form.bill_file.name}
                    </p>
                  )}
                </div>
              </FieldGroup>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-semibold text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold shadow-sm"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Fuel size={15} />
                      Create Indent
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
