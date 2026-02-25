import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  RefreshCw,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  FileText,
  ChevronRight,
  X,
  Play,
  Trash2,
  Edit2,
  Car,
  Wrench,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

// ─── Color tokens ───
const C = {
  primarybg: "#EEF1F9",
  secondarybg: "#FFFFFF",
  primary: "#7D53F6",
  primarydull: "#9F74F7",
  green: "#008000",
  pending: "#F0B041",
  red: "#FF5555",
  primarytext: "#000000",
  secondarytext: "#5F6388",
  skyblue: "#0388FC",
};

const STATUS_STYLE = {
  pending: {bg: "#FFF8E1", text: "#F57F17", dot: "#FBC02D"},
  approved: {bg: "#E8F5E9", text: "#2E7D32", dot: "#43A047"},
  completed: {bg: "#E3F2FD", text: "#1565C0", dot: "#1E88E5"},
  rejected: {bg: "#FFEBEE", text: "#B71C1C", dot: "#E53935"},
};

const REASON_LABELS = {
  service_repair: "Service & Repair",
  fc_renewal: "FC Renewal",
  insurance_renewal: "Insurance Renewal",
  permit_renewal: "Permit Renewal",
  maintenance: "General Maintenance",
  other: "Other",
};

const Pill = ({label, style}) => (
  <span
    style={{
      background: style?.bg || "#EEF1F9",
      color: style?.text || C.primarytext,
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 10px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: style?.dot || C.primary,
        flexShrink: 0,
      }}
    />
    {label}
  </span>
);

const inputCls =
  "w-full border border-[#D8DCF0] rounded-md p-2.5 bg-[#EEF1F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D53F6]/20 focus:border-[#7D53F6] text-black placeholder-[#5F6388]";

const Label = ({children}) => (
  <label className="block text-[11px] font-bold text-[#5F6388] uppercase tracking-widest mb-1.5">
    {children}
  </label>
);

const Modal = ({onClose, children, maxWidth = "max-w-lg"}) => (
  <div
    className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)"}}
    onClick={onClose}
  >
    <div
      className={`bg-white rounded-md shadow-2xl ${maxWidth} w-full max-h-[92vh] overflow-y-auto`}
      style={{animation: "scaleIn 0.18s ease"}}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const ModalHeader = ({title, onClose}) => (
  <div
    className="flex items-center justify-between px-6 py-4 border-b"
    style={{borderColor: "#E4E8F4"}}
  >
    <h3 style={{fontSize: 17, fontWeight: 800, color: C.primarytext}}>
      {title}
    </h3>
    <button
      onClick={onClose}
      className="p-1.5 rounded-md hover:bg-[#EEF1F9] transition-colors"
      style={{color: C.secondarytext}}
    >
      <X size={18} />
    </button>
  </div>
);

const ActionBtn = ({children, color, onClick, outline}) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "9px 20px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      transition: "opacity 0.15s",
      border: outline ? `2px solid ${color}` : "none",
      background: outline ? "transparent" : color,
      color: outline ? color : "#fff",
      boxShadow: outline ? "none" : "0 2px 8px rgba(0,0,0,0.12)",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
  >
    {children}
  </button>
);

const STATUS_FILTER_OPTIONS = [
  {value: "all", label: "All Status"},
  {value: "pending", label: "Pending"},
  {value: "approved", label: "Active"},
  {value: "completed", label: "Completed"},
  {value: "rejected", label: "Rejected"},
];

const REASON_OPTIONS = [
  {value: "service_repair", label: "Service & Repair"},
  {value: "fc_renewal", label: "FC Renewal"},
  {value: "insurance_renewal", label: "Insurance Renewal"},
  {value: "permit_renewal", label: "Permit Renewal"},
  {value: "maintenance", label: "General Maintenance"},
  {value: "other", label: "Other"},
];

const initialForm = {
  vehicle_id: "",
  driver_id: "",
  replacement_vehicle_id: "",
  start_date: "",
  end_date: "",
  reason: "fc_renewal",
  notes: "",
};

export default function VehicleReplacements() {
  const {showToast} = useToast();
  const [replacements, setReplacements] = useState([]);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [form, setForm] = useState(initialForm);

  // Vehicle-driver lookup
  const [vehicleDrivers, setVehicleDrivers] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [approveReplacementId, setApproveReplacementId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);
  useEffect(() => {
    fetchReplacements();
  }, [statusFilter]);

  const fetchAll = () => {
    fetchReplacements();
    fetchStats();
    fetchVehicles();
  };

  const fetchReplacements = async () => {
    setLoading(true);
    try {
      const url =
        statusFilter !== "all"
          ? `/api/admin/vehicle-replacements?status=${statusFilter}`
          : "/api/admin/vehicle-replacements";
      const res = await apiGet(url);
      if (res.ok) setReplacements(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiGet("/api/admin/vehicle-replacements/stats");
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await apiGet("/api/admin/vehicles");
      if (res.ok) setVehicles(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVehicleDrivers = async (vehicleId) => {
    try {
      const res = await apiGet(
        `/api/admin/vehicle-replacements/vehicle-drivers?vehicle_id=${vehicleId}`,
      );
      if (res.ok) setVehicleDrivers(await res.json());
      else setVehicleDrivers([]);
    } catch {
      setVehicleDrivers([]);
    }
  };

  const fetchAvailableVehicles = async (startDate, endDate, excludeId) => {
    if (!startDate || !endDate) return;
    try {
      const res = await apiGet(
        `/api/admin/vehicle-replacements/available-vehicles?start_date=${startDate}&end_date=${endDate}&exclude_vehicle_id=${excludeId || ""}`,
      );
      if (res.ok) setAvailableVehicles(await res.json());
    } catch {
      setAvailableVehicles([]);
    }
  };

  // Create
  const handleCreate = async () => {
    if (!form.vehicle_id || !form.start_date || !form.end_date) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        vehicle_id: parseInt(form.vehicle_id),
        driver_id: form.driver_id ? parseInt(form.driver_id) : 0,
        replacement_vehicle_id: form.replacement_vehicle_id
          ? parseInt(form.replacement_vehicle_id)
          : null,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        notes: form.notes,
        requested_by_role: "admin",
        requested_by_id: 0,
        replacement_type: "vehicle",
      };
      const res = await apiPost("/api/admin/vehicle-replacements/create", body);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowCreateModal(false);
        setForm(initialForm);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed to create replacement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Approve
  const handleApprove = async () => {
    if (!showApproveModal) return;
    if (!approveReplacementId) {
      showToast("Select a replacement vehicle", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        request_id: showApproveModal.id,
        replacement_vehicle_id: parseInt(approveReplacementId),
        approved_by_id: 0,
      };
      const res = await apiPost("/api/admin/vehicle-replacements/approve", body);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowApproveModal(null);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed to approve", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Complete
  const handleComplete = async (id) => {
    const ok = await showConfirm(
      "Complete Replacement",
      "This will restore the original vehicle and end the temporary assignment.",
    );
    if (!ok) return;
    try {
      const res = await apiPost("/api/admin/vehicle-replacements/complete", {
        request_id: id,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  // Reject
  const handleReject = async (id) => {
    const ok = await showConfirm(
      "Reject Replacement",
      "Are you sure you want to reject this request?",
    );
    if (!ok) return;
    try {
      const res = await apiPost("/api/admin/vehicle-replacements/reject", {
        request_id: id,
        rejected_by: 0,
        reason: "Rejected by admin",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  // Delete
  const handleDelete = async (id) => {
    const ok = await showConfirm(
      "Delete Replacement",
      "This action cannot be undone. If active, the vehicle will be restored.",
    );
    if (!ok) return;
    try {
      const res = await apiPost("/api/admin/vehicle-replacements/delete", {
        request_id: id,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  // Update
  const handleUpdate = async () => {
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      const res = await apiPost("/api/admin/vehicle-replacements/update", {
        request_id: showEditModal.id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        notes: form.notes,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowEditModal(null);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter
  const filtered = replacements.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        r.vehicle_number?.toLowerCase().includes(q) ||
        r.driver_name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        r.replacement_vehicle_number?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (loading && replacements.length === 0) return <Loading />;

  return (
    <div
      className="p-4 md:p-6 space-y-5"
      style={{background: C.primarybg, minHeight: "100vh"}}
    >
      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: "Total",
              value: stats.total,
              color: C.primary,
              icon: <FileText size={18} />,
            },
            {
              label: "Active",
              value: stats.active,
              color: C.green,
              icon: <RefreshCw size={18} />,
            },
            {
              label: "Pending",
              value: stats.pending,
              color: C.pending,
              icon: <Clock size={18} />,
            },
            {
              label: "Completed",
              value: stats.completed,
              color: C.skyblue,
              icon: <CheckCircle size={18} />,
            },
            {
              label: "This Month",
              value: stats.this_month,
              color: "#9C27B0",
              icon: <Calendar size={18} />,
            },
          ].map((s, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{
                background: C.secondarybg,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{color: C.secondarytext}}
                >
                  {s.label}
                </span>
                <span style={{color: s.color}}>{s.icon}</span>
              </div>
              <span
                className="text-2xl font-extrabold"
                style={{color: s.color}}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Toolbar ─── */}
      <div
        className="flex flex-wrap items-center gap-3 p-4 rounded-xl"
        style={{
          background: C.secondarybg,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by vehicle, driver, reason..."
          />
        </div>
        <div className="w-44">
          <CustomDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
        <ActionBtn
          color={C.primary}
          onClick={() => {
            setForm(initialForm);
            setVehicleDrivers([]);
            setAvailableVehicles([]);
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} /> New Replacement
        </ActionBtn>
      </div>

      {/* ─── Replacement Cards ─── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{color: C.secondarytext}}>
          <RefreshCw size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">No vehicle replacements found</p>
          <p className="text-sm mt-1">
            Create a new replacement request to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              style={{
                background: C.secondarybg,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
              onClick={() => setShowDetailModal(r)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Car size={16} style={{color: C.primary}} />
                    <span
                      className="text-sm font-bold"
                      style={{color: C.primarytext}}
                    >
                      {r.vehicle_number}
                    </span>
                    {r.replacement_vehicle_number && (
                      <>
                        <RefreshCw size={13} style={{color: C.secondarytext}} />
                        <span
                          className="text-sm font-bold"
                          style={{color: C.green}}
                        >
                          {r.replacement_vehicle_number}
                        </span>
                      </>
                    )}
                    <Pill label={r.status} style={STATUS_STYLE[r.status]} />
                  </div>
                  <div
                    className="flex items-center gap-4 text-xs flex-wrap"
                    style={{color: C.secondarytext}}
                  >
                    <span className="flex items-center gap-1">
                      <User size={12} /> {r.driver_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {r.start_date} → {r.end_date}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{background: C.primarybg}}
                    >
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    {r.service_title && (
                      <span className="flex items-center gap-1">
                        <Wrench size={12} /> {r.service_title}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.days_remaining > 0 && r.status === "approved" && (
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{background: "#E8F5E9", color: "#2E7D32"}}
                    >
                      {r.days_remaining}d left
                    </span>
                  )}
                  {r.days_remaining <= 0 && r.status === "approved" && (
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{background: "#FFEBEE", color: "#B71C1C"}}
                    >
                      Overdue
                    </span>
                  )}
                  <ChevronRight size={16} style={{color: C.secondarytext}} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {showDetailModal && (
        <Modal onClose={() => setShowDetailModal(null)} maxWidth="max-w-md">
          <ModalHeader
            title="Replacement Details"
            onClose={() => setShowDetailModal(null)}
          />
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold"
                  style={{color: C.secondarytext}}
                >
                  #{showDetailModal.id}
                </span>
              </div>
              <Pill
                label={showDetailModal.status}
                style={STATUS_STYLE[showDetailModal.status]}
              />
            </div>

            <div className="space-y-3">
              <DetailRow
                icon={<Car size={14} />}
                label="Vehicle"
                value={showDetailModal.vehicle_number}
              />
              {showDetailModal.replacement_vehicle_number && (
                <DetailRow
                  icon={<RefreshCw size={14} />}
                  label="Replacement Vehicle"
                  value={showDetailModal.replacement_vehicle_number}
                  valueColor={C.green}
                />
              )}
              <DetailRow
                icon={<User size={14} />}
                label="Driver"
                value={showDetailModal.driver_name}
              />
              <DetailRow
                icon={<Calendar size={14} />}
                label="Period"
                value={`${showDetailModal.start_date} → ${showDetailModal.end_date}`}
              />
              <DetailRow
                icon={<FileText size={14} />}
                label="Reason"
                value={
                  REASON_LABELS[showDetailModal.reason] ||
                  showDetailModal.reason
                }
              />
              {showDetailModal.service_title && (
                <DetailRow
                  icon={<Wrench size={14} />}
                  label="Linked Service"
                  value={showDetailModal.service_title}
                />
              )}
              {showDetailModal.notes && (
                <DetailRow
                  icon={<FileText size={14} />}
                  label="Notes"
                  value={showDetailModal.notes}
                />
              )}
              <DetailRow
                icon={<Clock size={14} />}
                label="Created"
                value={showDetailModal.created_at}
              />
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              {showDetailModal.status === "pending" && (
                <>
                  <ActionBtn
                    color={C.green}
                    onClick={() => {
                      setApproveReplacementId(null);
                      setShowApproveModal(showDetailModal);
                      setShowDetailModal(null);
                      // Convert dd-mm-yyyy to yyyy-mm-dd for API
                      const sd = showDetailModal.start_date?.split("-").reverse().join("-");
                      const ed = showDetailModal.end_date?.split("-").reverse().join("-");
                      fetchAvailableVehicles(sd, ed, showDetailModal.vehicle_id);
                    }}
                  >
                    <CheckCircle size={15} /> Approve
                  </ActionBtn>
                  <ActionBtn
                    color={C.red}
                    onClick={() => {
                      handleReject(showDetailModal.id);
                      setShowDetailModal(null);
                    }}
                  >
                    <XCircle size={15} /> Reject
                  </ActionBtn>
                </>
              )}
              {showDetailModal.status === "approved" && (
                <ActionBtn
                  color={C.skyblue}
                  onClick={() => {
                    handleComplete(showDetailModal.id);
                    setShowDetailModal(null);
                  }}
                >
                  <CheckCircle size={15} /> Complete
                </ActionBtn>
              )}
              {(showDetailModal.status === "pending" ||
                showDetailModal.status === "approved") && (
                <ActionBtn
                  color={C.primarydull}
                  outline
                  onClick={() => {
                    setForm({
                      start_date:
                        showDetailModal.start_date
                          ?.split("-")
                          .reverse()
                          .join("-") || "",
                      end_date:
                        showDetailModal.end_date
                          ?.split("-")
                          .reverse()
                          .join("-") || "",
                      reason: showDetailModal.reason || "fc_renewal",
                      notes: showDetailModal.notes || "",
                    });
                    setShowEditModal(showDetailModal);
                    setShowDetailModal(null);
                  }}
                >
                  <Edit2 size={15} /> Edit
                </ActionBtn>
              )}
              <ActionBtn
                color={C.red}
                outline
                onClick={() => {
                  handleDelete(showDetailModal.id);
                  setShowDetailModal(null);
                }}
              >
                <Trash2 size={15} /> Delete
              </ActionBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Create Modal ─── */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} maxWidth="max-w-lg">
          <ModalHeader
            title="New Replacement"
            onClose={() => setShowCreateModal(false)}
          />
          <div className="p-6 space-y-4">
            {/* Vehicle Replacement Flow: Vehicle → Driver → Reason → Dates → Replacement Vehicle → Notes */}
            <div>
              <Label>Vehicle *</Label>
              <SearchableSelect
                value={form.vehicle_id}
                onChange={(val) => {
                  setForm({...form, vehicle_id: val, driver_id: ""});
                  if (val) fetchVehicleDrivers(val);
                  else setVehicleDrivers([]);
                }}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.vehicle_number} – ${v.vehicle_name || v.vehicle_type}`,
                }))}
                placeholder="Select vehicle..."
              />
            </div>

            {vehicleDrivers.length > 0 && (
              <div>
                <Label>Driver *</Label>
                <SearchableSelect
                  value={form.driver_id}
                  onChange={(val) => setForm({...form, driver_id: val})}
                  options={vehicleDrivers.map((d) => ({
                    value: d.id,
                    label: `${d.full_name}${d.is_ev ? " (EV)" : ""}`,
                  }))}
                  placeholder="Select driver..."
                />
              </div>
            )}

            <div>
              <Label>Reason *</Label>
              <CustomDropdown
                value={form.reason}
                onChange={(val) => setForm({...form, reason: val})}
                options={REASON_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => {
                    setForm({...form, start_date: e.target.value});
                    if (form.end_date && form.vehicle_id)
                      fetchAvailableVehicles(e.target.value, form.end_date, form.vehicle_id);
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => {
                    setForm({...form, end_date: e.target.value});
                    if (form.start_date && form.vehicle_id)
                      fetchAvailableVehicles(form.start_date, e.target.value, form.vehicle_id);
                  }}
                  className={inputCls}
                />
              </div>
            </div>

            {form.start_date && form.end_date && (
              <div>
                <Label>Replacement Vehicle *</Label>
                <SearchableSelect
                  value={form.replacement_vehicle_id}
                  onChange={(val) => setForm({...form, replacement_vehicle_id: val})}
                  options={availableVehicles.map((v) => ({
                    value: v.id,
                    label: `${v.vehicle_number} – ${v.vehicle_name || v.vehicle_type}`,
                  }))}
                  placeholder="Select replacement vehicle..."
                />
                {form.replacement_vehicle_id && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{color: C.green}}>
                    <RefreshCw size={12} /> Driver will be temporarily assigned to this vehicle
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className={inputCls + " resize-none"}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={submitting}
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.primary, opacity: submitting ? 0.7 : 1}}
            >
              {submitting ? "Creating..." : "Create Replacement"}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Approve Modal ─── */}
      {showApproveModal && (
        <Modal onClose={() => setShowApproveModal(null)}>
          <ModalHeader
            title="Approve & Assign Vehicle"
            onClose={() => setShowApproveModal(null)}
          />
          <div className="p-6 space-y-4">
            <div className="p-3 rounded-lg" style={{background: C.primarybg}}>
              <div className="text-sm font-bold" style={{color: C.primarytext}}>
                {showApproveModal.vehicle_number} • Driver:{" "}
                {showApproveModal.driver_name}
              </div>
              <div className="text-xs mt-1" style={{color: C.secondarytext}}>
                {REASON_LABELS[showApproveModal.reason]} •{" "}
                {showApproveModal.start_date} → {showApproveModal.end_date}
              </div>
            </div>

            <div>
              <Label>Replacement Vehicle *</Label>
              <SearchableSelect
                value={approveReplacementId}
                onChange={setApproveReplacementId}
                options={availableVehicles.map((v) => ({
                  value: v.id,
                  label: `${v.vehicle_number} – ${v.vehicle_name || v.vehicle_type}`,
                }))}
                placeholder="Select replacement vehicle..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowApproveModal(null)}
                className="flex-1 py-2.5 rounded-md font-bold text-sm border-2 hover:opacity-90 transition-opacity"
                style={{borderColor: "#D8DCF0", color: C.secondarytext}}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
                style={{background: C.green, opacity: submitting ? 0.7 : 1}}
              >
                {submitting ? "Approving..." : "Approve & Activate"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Edit Modal ─── */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(null)}>
          <ModalHeader
            title="Edit Replacement"
            onClose={() => setShowEditModal(null)}
          />
          <div className="p-6 space-y-4">
            <div>
              <Label>Reason</Label>
              <CustomDropdown
                value={form.reason}
                onChange={(val) => setForm({...form, reason: val})}
                options={REASON_OPTIONS}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({...form, start_date: e.target.value})
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({...form, end_date: e.target.value})}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className={inputCls + " resize-none"}
                rows={2}
              />
            </div>
            <button
              onClick={handleUpdate}
              disabled={submitting}
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.primary, opacity: submitting ? 0.7 : 1}}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Helper components ───
function DetailRow({icon, label, value, valueColor}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5" style={{color: "#9F74F7"}}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className="text-[10px] font-bold uppercase tracking-widest block"
          style={{color: "#5F6388"}}
        >
          {label}
        </span>
        <span
          className="text-sm font-semibold"
          style={{color: valueColor || "#000"}}
        >
          {value || "—"}
        </span>
      </div>
    </div>
  );
}
