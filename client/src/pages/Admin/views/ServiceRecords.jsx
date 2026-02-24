import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  DollarSign,
  X,
  FileText,
  TrendingUp,
  Calendar,
  Gauge,
  User,
  MapPin,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

// ─── Color tokens ──────────────────────────────────────────────────────────────
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

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const SEVERITY_STYLE = {
  low: {bg: "#E8F5E9", text: "#2E7D32", dot: "#43A047"},
  medium: {bg: "#FFF8E1", text: "#F57F17", dot: "#FBC02D"},
  high: {bg: "#FFF3E0", text: "#E65100", dot: "#FB8C00"},
  critical: {bg: "#FFEBEE", text: "#B71C1C", dot: "#E53935"},
};

const STATUS_STYLE = {
  reported: {bg: "#E3F2FD", text: "#1565C0", dot: "#1E88E5"},
  approved: {bg: "#EDE7F6", text: "#4527A0", dot: "#7E57C2"},
  in_progress: {bg: "#FFF8E1", text: "#F57F17", dot: "#FBC02D"},
  completed: {bg: "#E8F5E9", text: "#2E7D32", dot: "#43A047"},
  rejected: {bg: "#FFEBEE", text: "#B71C1C", dot: "#E53935"},
  cancelled: {bg: "#F5F5F5", text: "#616161", dot: "#9E9E9E"},
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

// ─── Form input helpers ────────────────────────────────────────────────────────
const inputCls =
  "w-full border border-[#D8DCF0] rounded-md p-2.5 bg-[#EEF1F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#7D53F6]/20 focus:border-[#7D53F6] text-black placeholder-[#5F6388]";

const Label = ({children}) => (
  <label className="block text-[11px] font-bold text-[#5F6388] uppercase tracking-widest mb-1.5">
    {children}
  </label>
);

// ─── DataSection helper ────────────────────────────────────────────────────────
const DataSection = ({icon, title, items, children}) => {
  const validItems = (items || []).filter(
    (i) => i.value && i.value !== "-" && i.value !== 0 && i.value !== "0",
  );

  // If no valid items and no extra children, hide section
  if (validItems.length === 0 && !children) return null;

  return (
    <DetailSection icon={icon} title={title}>
      {validItems.length > 0 && <DetailGrid items={validItems} />}
      {children}
    </DetailSection>
  );
};
// ─── Section block used in Detail Modal ───────────────────────────────────────
const DetailSection = ({icon: Icon, title, children}) => {
  return (
    <div
      style={{
        border: "1px solid #E4E8F4",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#EEF1F9",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #E4E8F4",
        }}
      >
        <Icon size={15} color={C.primary} strokeWidth={2.5} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: C.secondarytext,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{background: C.secondarybg, padding: "16px"}}>{children}</div>
    </div>
  );
};

const DetailGrid = ({items}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
        gap: "16px 24px",
      }}
    >
      {items.map(({label, value}) => (
        <div key={label}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.secondarytext,
              marginBottom: 4,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.primarytext,
            }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ─── Action button ─────────────────────────────────────────────────────────────
const ActionBtn = ({onClick, color, children, outline}) => (
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
      transition: "opacity 0.15s, transform 0.1s",
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

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  {value: "all", label: "All Status"},
  {value: "reported", label: "Reported"},
  {value: "approved", label: "Approved"},
  {value: "in_progress", label: "In Progress"},
  {value: "completed", label: "Completed"},
  {value: "rejected", label: "Rejected"},
];

const SEVERITY_OPTIONS = [
  {value: "all", label: "All Severity"},
  {value: "low", label: "Low"},
  {value: "medium", label: "Medium"},
  {value: "high", label: "High"},
  {value: "critical", label: "Critical"},
];

const initialForm = {
  vehicle_id: "",
  service_type_id: "",
  title: "",
  description: "",
  severity: "medium",
  scheduled_date: "",
  odometer_reading: "",
  workshop_name: "",
  mechanic_name: "",
  labor_cost: 0,
};

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal = ({onClose, children, maxWidth = "max-w-lg"}) => (
  <div
    className={`fixed inset-0 flex items-center justify-center z-50 p-4`}
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

// ══════════════════════════════════════════════════════════════════════════════
export default function ServiceRecords() {
  const {showToast} = useToast();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [approveForm, setApproveForm] = useState({
    scheduled_date: "",
    admin_remarks: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [completeForm, setCompleteForm] = useState({
    labor_cost: 0,
    admin_remarks: "",
    next_service_date: "",
    next_service_km: 0,
  });
  const [detailParts, setDetailParts] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);
  useEffect(() => {
    fetchRecords();
  }, [statusFilter, severityFilter]);

  const fetchAll = () => {
    fetchRecords();
    fetchStats();
    fetchVehicles();
    fetchServiceTypes();
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/services";
      const params = [];
      if (statusFilter !== "all") params.push(`status=${statusFilter}`);
      if (severityFilter !== "all") params.push(`severity=${severityFilter}`);
      if (params.length) url += "?" + params.join("&");
      const res = await apiGet(url);
      if (res.ok) setRecords(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiGet("/api/admin/services/stats");
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

  const fetchServiceTypes = async () => {
    try {
      const res = await apiGet("/api/admin/service-types");
      if (res.ok) setServiceTypes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        vehicle_id: parseInt(form.vehicle_id),
        service_type_id: parseInt(form.service_type_id) || 0,
        odometer_reading: parseInt(form.odometer_reading) || 0,
        labor_cost: parseFloat(form.labor_cost) || 0,
      };
      let res;
      if (editingRecord) {
        body.id = editingRecord.id;
        res = await apiPost("/api/admin/services/update", body);
      } else {
        res = await apiPost("/api/admin/services/create", body);
      }
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Success", "success");
        closeCreateModal();
        fetchAll();
      } else showToast(data.error || "Failed", "error");
    } catch {
      showToast("Failed to save", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      "Delete Service Record",
      "This action cannot be undone.",
    );
    if (!confirmed) return;
    try {
      const res = await apiDelete(`/api/admin/services/delete?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handleApprove = async () => {
    try {
      const res = await apiPost(
        `/api/admin/services/${showApproveModal.id}/approve`,
        approveForm,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowApproveModal(null);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  const handleReject = async () => {
    try {
      const res = await apiPost(
        `/api/admin/services/${showRejectModal.id}/reject`,
        {rejection_reason: rejectReason},
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowRejectModal(null);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  const handleStart = async (id) => {
    const confirmed = await showConfirm(
      "Start Service",
      "Vehicle will be marked as under maintenance.",
    );
    if (!confirmed) return;
    try {
      const res = await apiPost(`/api/admin/services/${id}/start`, {});
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  const handleComplete = async () => {
    try {
      const body = {
        ...completeForm,
        labor_cost: parseFloat(completeForm.labor_cost) || 0,
        next_service_km: parseInt(completeForm.next_service_km) || 0,
      };
      const res = await apiPost(
        `/api/admin/services/${showCompleteModal.id}/complete`,
        body,
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setShowCompleteModal(null);
        fetchAll();
      } else showToast(data.error, "error");
    } catch {
      showToast("Failed", "error");
    }
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      vehicle_id: record.vehicle_id,
      service_type_id: record.service_type_id || "",
      title: record.title,
      description: record.description || "",
      severity: record.severity,
      scheduled_date: record.scheduled_date || "",
      odometer_reading: record.odometer_reading || "",
      workshop_name: record.workshop_name || "",
      mechanic_name: record.mechanic_name || "",
      labor_cost: record.labor_cost || 0,
    });
    setShowCreateModal(true);
  };

  const openDetail = async (record) => {
    setShowDetailModal(record);
    try {
      const res = await apiGet(`/api/admin/services/${record.id}/parts`);
      if (res.ok) setDetailParts(await res.json());
      else setDetailParts([]);
    } catch {
      setDetailParts([]);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditingRecord(null);
    setForm(initialForm);
  };

  const filtered = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.vehicle_number?.toLowerCase().includes(q) ||
      r.workshop_name?.toLowerCase().includes(q) ||
      r.service_type_name?.toLowerCase().includes(q)
    );
  });

  const statsCards = stats
    ? [
        {
          label: "Active Services",
          value: stats.active_services || 0,
          icon: Wrench,
          color: C.primary,
          bg: "#F0EBFE",
        },
        {
          label: "Pending Requests",
          value: stats.pending_requests || 0,
          icon: Clock,
          color: C.pending,
          bg: "#FFF8E7",
        },
        {
          label: "Completed (Month)",
          value: stats.completed_this_month || 0,
          icon: CheckCircle,
          color: C.green,
          bg: "#E8F5E9",
        },
        {
          label: "Monthly Cost",
          value: `₹${(stats.total_cost_this_month || 0).toLocaleString()}`,
          icon: DollarSign,
          color: C.skyblue,
          bg: "#E8F4FE",
        },
      ]
    : [];

  if (loading && records.length === 0) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-5 pb-12">
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Stats Cards ── */}
      {statsCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, i) => (
            <div
              key={i}
              className="rounded-md p-5 border"
              style={{
                background: C.secondarybg,
                borderColor: "#E4E8F4",
                boxShadow: "0 1px 4px rgba(125,83,246,0.06)",
                animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.secondarytext,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: C.primarytext,
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className="p-2.5 rounded-md" style={{background: stat.bg}}>
                  <stat.icon size={20} color={stat.color} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-md border"
        style={{background: C.secondarybg, borderColor: "#E4E8F4"}}
      >
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search vehicle, title, workshop…"
          />
          <CustomDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="Status"
            width="w-38"
          />
          <CustomDropdown
            value={severityFilter}
            onChange={setSeverityFilter}
            options={SEVERITY_OPTIONS}
            placeholder="Severity"
            width="w-38"
          />
        </div>
        <button
          onClick={() => {
            setEditingRecord(null);
            setForm(initialForm);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md text-white text-sm font-bold whitespace-nowrap shadow-md hover:opacity-90 transition-opacity"
          style={{background: C.primary}}
        >
          <Plus size={16} strokeWidth={3} /> Add Service Record
        </button>
      </div>

      {/* ── Table ── */}
      <div
        className="rounded-md border overflow-hidden"
        style={{
          background: C.secondarybg,
          borderColor: "#E4E8F4",
          boxShadow: "0 1px 6px rgba(125,83,246,0.05)",
        }}
      >
        <div className="overflow-x-auto">
          {loading ? (
            <Loading fullScreen={false} />
          ) : filtered.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: "#F8F9FD",
                    borderBottom: "2px solid #E4E8F4",
                  }}
                >
                  {[
                    "Vehicle",
                    "Title",
                    "Type",
                    "Status",
                    "Severity",
                    "Cost",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-[11px] font-extrabold uppercase tracking-widest ${h === "Cost" ? "text-right" : "text-left"}`}
                      style={{color: C.secondarytext}}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="cursor-pointer transition-colors"
                    style={{borderBottom: "1px solid #EEF1F9"}}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#F8F9FD")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    <td className="py-3 px-4">
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: C.primarytext,
                        }}
                      >
                        {r.vehicle_name || r.vehicle_number}
                      </p>
                      {r.vehicle_name && (
                        <p style={{fontSize: 11, color: C.secondarytext}}>
                          {r.vehicle_number}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p
                        className="max-w-[220px] truncate"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.primarytext,
                        }}
                      >
                        {r.title}
                      </p>
                    </td>
                    <td
                      className="py-3 px-4"
                      style={{fontSize: 13, color: C.secondarytext}}
                    >
                      {r.service_type_name || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Pill
                        label={r.status?.replace("_", " ")}
                        style={STATUS_STYLE[r.status]}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Pill
                        label={r.severity}
                        style={SEVERITY_STYLE[r.severity]}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: r.total_cost > 0 ? C.primary : C.secondarytext,
                        }}
                      >
                        {r.total_cost > 0
                          ? `₹${r.total_cost.toLocaleString()}`
                          : "—"}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4"
                      style={{fontSize: 13, color: C.secondarytext}}
                    >
                      {r.scheduled_date || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="py-20 flex flex-col items-center"
              style={{color: C.secondarytext}}
            >
              <div
                className="p-4 rounded-md mb-4"
                style={{background: "#EEF1F9"}}
              >
                <FileText size={32} color={C.primary} strokeWidth={1.5} />
              </div>
              <p
                style={{fontWeight: 700, color: C.primarytext, marginBottom: 4}}
              >
                No service records found
              </p>
              <p style={{fontSize: 13}}>
                Try adjusting the filters or add a new service record
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ Detail Modal ════════════════ */}
      {showDetailModal && (
        <Modal onClose={() => setShowDetailModal(null)} maxWidth="max-w-2xl">
          {/* Header */}
          <div className="px-6 py-5 border-b" style={{borderColor: "#E4E8F4"}}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Pill
                    label={showDetailModal.status?.replace("_", " ")}
                    style={STATUS_STYLE[showDetailModal.status]}
                  />
                  <Pill
                    label={showDetailModal.severity}
                    style={SEVERITY_STYLE[showDetailModal.severity]}
                  />
                </div>
                <h3
                  className="mt-2"
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: C.primarytext,
                    lineHeight: 1.2,
                  }}
                >
                  {showDetailModal.title}
                </h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    style={{fontSize: 13, fontWeight: 700, color: C.primary}}
                  >
                    {showDetailModal.vehicle_name ||
                      showDetailModal.vehicle_number}
                  </span>
                  {showDetailModal.vehicle_name && (
                    <>
                      <span style={{color: C.secondarytext, fontSize: 12}}>
                        ·
                      </span>
                      <span style={{fontSize: 12, color: C.secondarytext}}>
                        {showDetailModal.vehicle_number}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="p-2 rounded-md hover:bg-[#EEF1F9] transition-colors flex-shrink-0"
                style={{color: C.secondarytext}}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Description */}
            {showDetailModal.description && (
              <div
                className="px-4 py-3 rounded-md"
                style={{
                  background: "#EEF1F9",
                  borderLeft: `3px solid ${C.primary}`,
                }}
              >
                <p
                  style={{fontSize: 13, color: C.primarytext, lineHeight: 1.6}}
                >
                  {showDetailModal.description}
                </p>
              </div>
            )}

            {/* Service + Odometer */}
            <DataSection
              icon={Wrench}
              title="Service Details"
              items={[
                {
                  label: "Service Type",
                  value: showDetailModal.service_type_name,
                },
                {
                  label: "Odometer Reading",
                  value: showDetailModal.odometer_reading
                    ? `${showDetailModal.odometer_reading} km`
                    : null,
                },
              ]}
            />

            {/* Timeline */}
            <DataSection
              icon={Calendar}
              title="Timeline"
              items={[
                {
                  label: "Scheduled Date",
                  value: showDetailModal.scheduled_date,
                },
                {
                  label: "Started At",
                  value: showDetailModal.started_at,
                },
                {
                  label: "Completed At",
                  value: showDetailModal.completed_at,
                },
              ]}
            />

            {/* Workshop */}
            <DataSection
              icon={MapPin}
              title="Workshop Information"
              items={[
                {
                  label: "Workshop Name",
                  value: showDetailModal.workshop_name,
                },
                {
                  label: "Mechanic Name",
                  value: showDetailModal.mechanic_name,
                },
                {
                  label: "Mechanic Contact",
                  value: showDetailModal.mechanic_contact,
                },
              ]}
            />

            {/* Cost */}
            <DataSection
              icon={DollarSign}
              title="Cost Breakdown"
              items={[
                {
                  label: "Labor Cost",
                  value:
                    showDetailModal.labor_cost > 0
                      ? `₹${showDetailModal.labor_cost.toLocaleString()}`
                      : null,
                },
                {
                  label: "Parts Cost",
                  value:
                    showDetailModal.parts_cost > 0
                      ? `₹${showDetailModal.parts_cost.toLocaleString()}`
                      : null,
                },
                {
                  label: "Total Cost",
                  value:
                    showDetailModal.total_cost > 0
                      ? `₹${showDetailModal.total_cost.toLocaleString()}`
                      : null,
                },
              ]}
            />

            {/* Parts */}
            {detailParts.length > 0 && (
              <DetailSection icon={FileText} title="Products Purchased">
                <div className="space-y-2">
                  {detailParts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-md"
                      style={{background: "#EEF1F9"}}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: C.primarytext,
                          }}
                        >
                          {p.part_name}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: C.secondarytext,
                            marginTop: 2,
                          }}
                        >
                          {p.vendor_name || "No vendor"} · Qty: {p.quantity}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: C.primary,
                        }}
                      >
                        ₹{p.total_price?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Additional Info */}
            <DataSection
              icon={User}
              title="Additional Information"
              items={[
                {
                  label: "Reported By",
                  value: showDetailModal.reported_by_name,
                },
                {label: "Created At", value: showDetailModal.created_at},
              ]}
            >
              {(showDetailModal.admin_remarks ||
                showDetailModal.rejection_reason) && (
                <div
                  className="mt-4 space-y-3 pt-4 border-t"
                  style={{borderColor: "#E4E8F4"}}
                >
                  {showDetailModal.admin_remarks && (
                    <div>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.secondarytext,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Admin Remarks
                      </p>
                      <p
                        className="px-3 py-2.5 rounded-md"
                        style={{
                          fontSize: 13,
                          color: C.primarytext,
                          background: "#EEF1F9",
                          lineHeight: 1.6,
                        }}
                      >
                        {showDetailModal.admin_remarks}
                      </p>
                    </div>
                  )}
                  {showDetailModal.rejection_reason && (
                    <div>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.red,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Rejection Reason
                      </p>
                      <p
                        className="px-3 py-2.5 rounded-md border"
                        style={{
                          fontSize: 13,
                          color: C.red,
                          background: "#FFF5F5",
                          borderColor: "#FFCCCC",
                          lineHeight: 1.6,
                        }}
                      >
                        {showDetailModal.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DataSection>

            {/* ── Action Buttons ── */}
            <div className="flex items-center justify-end gap-2.5 pt-2 flex-wrap">
              {showDetailModal.status === "reported" && (
                <>
                  <ActionBtn
                    color={C.green}
                    onClick={() => {
                      setApproveForm({scheduled_date: "", admin_remarks: ""});
                      setShowApproveModal(showDetailModal);
                      setShowDetailModal(null);
                    }}
                  >
                    <CheckCircle size={15} /> Approve
                  </ActionBtn>
                  <ActionBtn
                    color={C.red}
                    onClick={() => {
                      setRejectReason("");
                      setShowRejectModal(showDetailModal);
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
                    const id = showDetailModal.id;
                    setShowDetailModal(null);
                    handleStart(id);
                  }}
                >
                  <Play size={15} fill="white" /> Start Service
                </ActionBtn>
              )}
              {showDetailModal.status === "in_progress" && (
                <ActionBtn
                  color={C.green}
                  onClick={() => {
                    setCompleteForm({
                      labor_cost: showDetailModal.labor_cost || 0,
                      admin_remarks: "",
                      next_service_date: "",
                      next_service_km: 0,
                    });
                    setShowCompleteModal(showDetailModal);
                    setShowDetailModal(null);
                  }}
                >
                  <CheckCircle size={15} /> Mark Complete
                </ActionBtn>
              )}
              {["reported", "approved"].includes(showDetailModal.status) && (
                <ActionBtn
                  color={C.primary}
                  onClick={() => {
                    openEdit(showDetailModal);
                    setShowDetailModal(null);
                  }}
                >
                  <Edit2 size={15} /> Edit
                </ActionBtn>
              )}
              <ActionBtn
                color={C.red}
                onClick={() => {
                  const id = showDetailModal.id;
                  setShowDetailModal(null);
                  handleDelete(id);
                }}
              >
                <Trash2 size={15} /> Delete
              </ActionBtn>
              <ActionBtn
                color={C.secondarytext}
                outline
                onClick={() => setShowDetailModal(null)}
              >
                Close
              </ActionBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════ Create / Edit Modal ════════════════ */}
      {showCreateModal && (
        <Modal onClose={closeCreateModal}>
          <ModalHeader
            title={editingRecord ? "Edit Service Record" : "New Service Record"}
            onClose={closeCreateModal}
          />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <Label>Vehicle</Label>
              <SearchableSelect
                value={form.vehicle_id}
                onChange={(val) => setForm({...form, vehicle_id: val})}
                placeholder="Select Vehicle"
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: v.vehicle_name || v.vehicle_number,
                  subtitle: v.vehicle_number,
                }))}
                emptyMessage="No vehicles available"
              />
            </div>
            <div>
              <Label>Service Type</Label>
              <SearchableSelect
                value={form.service_type_id}
                onChange={(val) => setForm({...form, service_type_id: val})}
                placeholder="Select Service Type"
                options={serviceTypes
                  .filter((t) => t.is_active)
                  .map((t) => ({
                    value: t.id,
                    label: t.name,
                    subtitle: t.description || "",
                  }))}
                emptyMessage="No service types"
              />
            </div>
            <div>
              <Label>Title</Label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                className={inputCls}
                placeholder="Service title"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({...form, description: e.target.value})
                }
                className={inputCls + " resize-none"}
                rows={3}
                placeholder="Describe the issue or service needed"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <SearchableSelect
                  value={form.severity}
                  onChange={(val) => setForm({...form, severity: val})}
                  placeholder="Select Severity"
                  options={[
                    {value: "low", label: "Low"},
                    {value: "medium", label: "Medium"},
                    {value: "high", label: "High"},
                    {value: "critical", label: "Critical"},
                  ]}
                />
              </div>
              <div>
                <Label>Scheduled Date</Label>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) =>
                    setForm({...form, scheduled_date: e.target.value})
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Odometer (km)</Label>
                <input
                  type="number"
                  value={form.odometer_reading}
                  onChange={(e) =>
                    setForm({...form, odometer_reading: e.target.value})
                  }
                  className={inputCls}
                  min="0"
                  placeholder="Current km"
                />
              </div>
              <div>
                <Label>Labor Cost (₹)</Label>
                <input
                  type="number"
                  value={form.labor_cost}
                  onChange={(e) =>
                    setForm({...form, labor_cost: e.target.value})
                  }
                  className={inputCls}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Workshop</Label>
                <input
                  type="text"
                  value={form.workshop_name}
                  onChange={(e) =>
                    setForm({...form, workshop_name: e.target.value})
                  }
                  className={inputCls}
                  placeholder="Workshop name"
                />
              </div>
              <div>
                <Label>Mechanic</Label>
                <input
                  type="text"
                  value={form.mechanic_name}
                  onChange={(e) =>
                    setForm({...form, mechanic_name: e.target.value})
                  }
                  className={inputCls}
                  placeholder="Mechanic name"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.primary}}
            >
              {editingRecord ? "Update Record" : "Create Service Record"}
            </button>
          </form>
        </Modal>
      )}

      {/* ════════════════ Approve Modal ════════════════ */}
      {showApproveModal && (
        <Modal onClose={() => setShowApproveModal(null)}>
          <ModalHeader
            title="Approve Service Request"
            onClose={() => setShowApproveModal(null)}
          />
          <div className="p-6 space-y-4">
            <div
              className="px-4 py-3 rounded-md border"
              style={{background: "#F0FBF0", borderColor: "#B2DFDB"}}
            >
              <p style={{fontSize: 13, fontWeight: 700, color: C.green}}>
                {showApproveModal.title}
              </p>
              <p style={{fontSize: 12, color: "#388E3C", marginTop: 2}}>
                {showApproveModal.vehicle_name
                  ? `${showApproveModal.vehicle_name} (${showApproveModal.vehicle_number})`
                  : showApproveModal.vehicle_number}
              </p>
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <input
                type="date"
                value={approveForm.scheduled_date}
                onChange={(e) =>
                  setApproveForm({
                    ...approveForm,
                    scheduled_date: e.target.value,
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <textarea
                value={approveForm.admin_remarks}
                onChange={(e) =>
                  setApproveForm({
                    ...approveForm,
                    admin_remarks: e.target.value,
                  })
                }
                className={inputCls + " resize-none"}
                rows={2}
                placeholder="Optional remarks"
              />
            </div>
            <button
              onClick={handleApprove}
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.green}}
            >
              Approve Request
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════ Reject Modal ════════════════ */}
      {showRejectModal && (
        <Modal onClose={() => setShowRejectModal(null)}>
          <ModalHeader
            title="Reject Service Request"
            onClose={() => setShowRejectModal(null)}
          />
          <div className="p-6 space-y-4">
            <div
              className="px-4 py-3 rounded-md border"
              style={{background: "#FFF5F5", borderColor: "#FFCCCC"}}
            >
              <p style={{fontSize: 13, fontWeight: 700, color: C.red}}>
                {showRejectModal.title}
              </p>
              <p style={{fontSize: 12, color: "#E57373", marginTop: 2}}>
                {showRejectModal.vehicle_name
                  ? `${showRejectModal.vehicle_name} (${showRejectModal.vehicle_number})`
                  : showRejectModal.vehicle_number}
              </p>
            </div>
            <div>
              <Label>Reason for Rejection</Label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={inputCls + " resize-none"}
                rows={3}
                placeholder="Provide a reason for rejection"
                required
              />
            </div>
            <button
              onClick={handleReject}
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.red}}
            >
              Reject Request
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════ Complete Modal ════════════════ */}
      {showCompleteModal && (
        <Modal onClose={() => setShowCompleteModal(null)}>
          <ModalHeader
            title="Complete Service"
            onClose={() => setShowCompleteModal(null)}
          />
          <div className="p-6 space-y-4">
            <div
              className="px-4 py-3 rounded-md border"
              style={{background: "#F3EFFE", borderColor: "#C9B8FB"}}
            >
              <p style={{fontSize: 13, fontWeight: 700, color: C.primary}}>
                {showCompleteModal.title}
              </p>
              <p style={{fontSize: 12, color: C.primarydull, marginTop: 2}}>
                {showCompleteModal.vehicle_name
                  ? `${showCompleteModal.vehicle_name} (${showCompleteModal.vehicle_number})`
                  : showCompleteModal.vehicle_number}{" "}
                &mdash; Vehicle will be restored to active
              </p>
            </div>
            <div>
              <Label>Final Labor Cost (₹)</Label>
              <input
                type="number"
                value={completeForm.labor_cost}
                onChange={(e) =>
                  setCompleteForm({...completeForm, labor_cost: e.target.value})
                }
                className={inputCls}
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <Label>Completion Remarks</Label>
              <textarea
                value={completeForm.admin_remarks}
                onChange={(e) =>
                  setCompleteForm({
                    ...completeForm,
                    admin_remarks: e.target.value,
                  })
                }
                className={inputCls + " resize-none"}
                rows={2}
                placeholder="Completion notes"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Next Service Date</Label>
                <input
                  type="date"
                  value={completeForm.next_service_date}
                  onChange={(e) =>
                    setCompleteForm({
                      ...completeForm,
                      next_service_date: e.target.value,
                    })
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Next Service KM</Label>
                <input
                  type="number"
                  value={completeForm.next_service_km}
                  onChange={(e) =>
                    setCompleteForm({
                      ...completeForm,
                      next_service_km: e.target.value,
                    })
                  }
                  className={inputCls}
                  min="0"
                />
              </div>
            </div>
            <button
              onClick={handleComplete}
              className="w-full py-2.5 rounded-md text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{background: C.green}}
            >
              Mark Completed
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
