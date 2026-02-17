import React, {useState, useEffect} from "react";
import Loading from "../../../components/ui/Loading";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Wrench,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  DollarSign,
  X,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import {apiGet, apiPost, apiDelete} from "../../../utils/api";
import {showConfirm} from "../../../utils/swal";

const SEVERITY_COLORS = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  reported: "bg-blue-100 text-blue-700",
  approved: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

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

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, severityFilter]);

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
      } else {
        showToast(data.error || "Failed", "error");
      }
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
        {admin_remarks: rejectReason},
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
          color: "bg-primary/10 text-primary",
        },
        {
          label: "Pending Requests",
          value: stats.pending_requests || 0,
          icon: Clock,
          color: "bg-amber-50 text-amber-600",
        },
        {
          label: "Completed (Month)",
          value: stats.completed_this_month || 0,
          icon: CheckCircle,
          color: "bg-green-50 text-green-600",
        },
        {
          label: "Monthly Cost",
          value: `₹${(stats.monthly_cost || 0).toLocaleString()}`,
          icon: DollarSign,
          color: "bg-purple-50 text-purple-600",
        },
      ]
    : [];

  if (loading && records.length === 0) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Stats Cards */}
      {statsCards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, i) => (
            <div
              key={i}
              className="bg-secondarybg rounded-md p-5 border border-primarybg shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                    {stat.label}
                  </p>
                  <h3 className="text-2xl font-extrabold text-primarytext">
                    {stat.value}
                  </h3>
                </div>
                <div className={"p-3 rounded-md shadow-sm " + stat.color}>
                  <stat.icon size={24} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by vehicle, title, workshop..."
          />
          <CustomDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="Status"
            width="w-40"
          />
          <CustomDropdown
            value={severityFilter}
            onChange={setSeverityFilter}
            options={SEVERITY_OPTIONS}
            placeholder="Severity"
            width="w-40"
          />
        </div>
        <button
          onClick={() => {
            setEditingRecord(null);
            setForm(initialForm);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-md hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Service Record
        </button>
      </div>

      {/* Service Records Table */}
      <div className="bg-secondarybg rounded-md border border-primarybg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <Loading fullScreen={false} />
          ) : filtered.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-primarybg">
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primarybg">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="hover:bg-primarybg transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm text-primarytext">
                        {r.vehicle_name || r.vehicle_number}
                      </div>
                      {r.vehicle_name && (
                        <div className="text-xs text-secondarytext">
                          {r.vehicle_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-primarytext font-medium max-w-[250px] truncate">
                        {r.title}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-secondarytext">
                      {r.service_type_name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-md font-semibold ${STATUS_COLORS[r.status] || ""}`}
                      >
                        {r.status?.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-md font-semibold ${SEVERITY_COLORS[r.severity] || ""}`}
                      >
                        {r.severity?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-primary">
                        {r.total_cost > 0
                          ? `₹${r.total_cost.toLocaleString()}`
                          : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-secondarytext">
                      {r.scheduled_date || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-16 flex flex-col items-center text-secondarytext">
              <FileText size={48} className="mb-3 opacity-20" />
              <p className="font-medium">No service records found</p>
              <p className="text-sm mt-1">
                Try adjusting the filters or add a new service record
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={closeCreateModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                {editingRecord
                  ? "Edit Service Record"
                  : "Create Service Record"}
              </h3>
              <button
                onClick={closeCreateModal}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Vehicle
                </label>
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
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Service Type
                </label>
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
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Service title"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({...form, description: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  placeholder="Describe the issue or service needed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Severity
                  </label>
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
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) =>
                      setForm({...form, scheduled_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={form.odometer_reading}
                    onChange={(e) =>
                      setForm({...form, odometer_reading: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="0"
                    placeholder="Current km"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Labor Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={form.labor_cost}
                    onChange={(e) =>
                      setForm({...form, labor_cost: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Workshop
                  </label>
                  <input
                    type="text"
                    value={form.workshop_name}
                    onChange={(e) =>
                      setForm({...form, workshop_name: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Workshop name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Mechanic
                  </label>
                  <input
                    type="text"
                    value={form.mechanic_name}
                    onChange={(e) =>
                      setForm({...form, mechanic_name: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Mechanic name"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white rounded-md py-2.5 font-medium hover:bg-primary/90 transition-colors"
              >
                {editingRecord ? "Update Record" : "Create Service Record"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowDetailModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Vehicle Info */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                    <Wrench size={24} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-primarytext">
                      {showDetailModal.vehicle_name ||
                        showDetailModal.vehicle_number}
                    </h3>
                    <p className="text-sm text-secondarytext mt-0.5">
                      {showDetailModal.vehicle_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="text-secondarytext hover:text-primarytext transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Service Details Section */}
              <div className="bg-primarybg/50 rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench size={16} className="text-secondarytext" />
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Service Details
                  </h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-primarytext">
                      {showDetailModal.title}
                    </p>
                    {showDetailModal.description && (
                      <p className="text-sm text-secondarytext mt-1">
                        {showDetailModal.description}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-secondarytext">Service Type</p>
                      <p className="text-sm font-medium text-primarytext mt-0.5">
                        {showDetailModal.service_type_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-secondarytext">Status</p>
                      <div className="mt-1">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${STATUS_COLORS[showDetailModal.status]}`}
                        >
                          {showDetailModal.status
                            ?.replace("_", " ")
                            .toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-secondarytext">Severity</p>
                      <div className="mt-1">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${SEVERITY_COLORS[showDetailModal.severity]}`}
                        >
                          {showDetailModal.severity?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-secondarytext">
                        Odometer Reading
                      </p>
                      <p className="text-sm font-medium text-primarytext mt-0.5">
                        {showDetailModal.odometer_reading
                          ? `${showDetailModal.odometer_reading} km`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="bg-primarybg/50 rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-secondarytext" />
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Timeline
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-secondarytext">Scheduled Date</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.scheduled_date || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Started At</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.started_at || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Completed At</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.completed_at || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Workshop & Mechanic Info */}
              <div className="bg-primarybg/50 rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench size={16} className="text-secondarytext" />
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Workshop Information
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-secondarytext">Workshop Name</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.workshop_name || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Mechanic Name</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.mechanic_name || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">
                      Mechanic Contact
                    </p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.mechanic_contact || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-primarybg/50 rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={16} className="text-secondarytext" />
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Cost Breakdown
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-secondarytext">Labor Cost</p>
                    <p className="text-sm font-bold text-primarytext mt-0.5">
                      {showDetailModal.labor_cost > 0
                        ? `₹${showDetailModal.labor_cost.toLocaleString()}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Parts Cost</p>
                    <p className="text-sm font-bold text-primarytext mt-0.5">
                      {showDetailModal.parts_cost > 0
                        ? `₹${showDetailModal.parts_cost.toLocaleString()}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Total Cost</p>
                    <p className="text-lg font-bold text-primary mt-0.5">
                      {showDetailModal.total_cost > 0
                        ? `₹${showDetailModal.total_cost.toLocaleString()}`
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parts Purchased */}
              {detailParts.length > 0 && (
                <div className="bg-primarybg/50 rounded-md p-4">
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-3">
                    Parts Purchased
                  </h4>
                  <div className="space-y-2">
                    {detailParts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-secondarybg p-3 rounded-md border border-gray-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-primarytext">
                            {p.part_name}
                          </p>
                          <p className="text-xs text-secondarytext">
                            {p.vendor_name || "No vendor"} · Qty: {p.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-primary">
                          ₹{p.total_price?.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reported By & Admin Info */}
              <div className="bg-primarybg/50 rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-secondarytext" />
                  <h4 className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                    Additional Information
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-secondarytext">Reported By</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.reported_by_name || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondarytext">Created At</p>
                    <p className="text-sm font-medium text-primarytext mt-0.5">
                      {showDetailModal.created_at}
                    </p>
                  </div>
                </div>
                {showDetailModal.admin_remarks && (
                  <div className="mt-3">
                    <p className="text-xs text-secondarytext mb-1">
                      Admin Remarks
                    </p>
                    <p className="text-sm text-primarytext bg-secondarybg p-3 rounded-md">
                      {showDetailModal.admin_remarks}
                    </p>
                  </div>
                )}
                {showDetailModal.rejection_reason && (
                  <div className="mt-3">
                    <p className="text-xs text-secondarytext mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      {showDetailModal.rejection_reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {showDetailModal.status === "reported" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setApproveForm({
                          scheduled_date: "",
                          admin_remarks: "",
                        });
                        setShowApproveModal(showDetailModal);
                        setShowDetailModal(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectReason("");
                        setShowRejectModal(showDetailModal);
                        setShowDetailModal(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </>
                )}
                {showDetailModal.status === "approved" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStart(showDetailModal.id);
                      setShowDetailModal(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Play size={16} />
                    Start Service
                  </button>
                )}
                {showDetailModal.status === "in_progress" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompleteForm({
                        labor_cost: showDetailModal.labor_cost || 0,
                        admin_remarks: "",
                        next_service_date: "",
                        next_service_km: 0,
                      });
                      setShowCompleteModal(showDetailModal);
                      setShowDetailModal(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <CheckCircle size={16} />
                    Mark Complete
                  </button>
                )}
                {["reported", "approved"].includes(showDetailModal.status) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(showDetailModal);
                      setShowDetailModal(null);
                    }}
                    className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(showDetailModal.id);
                    setShowDetailModal(null);
                  }}
                  className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="px-4 py-2.5 bg-secondarybg border border-gray-200 text-secondarytext rounded-md hover:bg-primarybg transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowApproveModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Approve Service Request
              </h3>
              <button
                onClick={() => setShowApproveModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-700 font-medium">
                  Approving: {showApproveModal.title}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  {showApproveModal.vehicle_name
                    ? `${showApproveModal.vehicle_name} (${showApproveModal.vehicle_number})`
                    : showApproveModal.vehicle_number}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={approveForm.scheduled_date}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      scheduled_date: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Remarks
                </label>
                <textarea
                  value={approveForm.admin_remarks}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      admin_remarks: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={2}
                  placeholder="Optional remarks"
                />
              </div>
              <button
                onClick={handleApprove}
                className="w-full bg-green-600 text-white rounded-md py-2.5 font-medium hover:bg-green-700 transition-colors"
              >
                Approve Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowRejectModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Reject Service Request
              </h3>
              <button
                onClick={() => setShowRejectModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700 font-medium">
                  Rejecting: {showRejectModal.title}
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {showRejectModal.vehicle_name
                    ? `${showRejectModal.vehicle_name} (${showRejectModal.vehicle_number})`
                    : showRejectModal.vehicle_number}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  placeholder="Provide reason for rejection"
                  required
                />
              </div>
              <button
                onClick={handleReject}
                className="w-full bg-red-600 text-white rounded-md py-2.5 font-medium hover:bg-red-700 transition-colors"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowCompleteModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-primarytext">
                Complete Service
              </h3>
              <button
                onClick={() => setShowCompleteModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                <p className="text-sm text-primary font-medium">
                  Completing: {showCompleteModal.title}
                </p>
                <p className="text-xs text-secondarytext mt-0.5">
                  {showCompleteModal.vehicle_name
                    ? `${showCompleteModal.vehicle_name} (${showCompleteModal.vehicle_number})`
                    : showCompleteModal.vehicle_number}{" "}
                  — Vehicle will be restored to active
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Final Labor Cost (₹)
                </label>
                <input
                  type="number"
                  value={completeForm.labor_cost}
                  onChange={(e) =>
                    setCompleteForm({
                      ...completeForm,
                      labor_cost: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Remarks
                </label>
                <textarea
                  value={completeForm.admin_remarks}
                  onChange={(e) =>
                    setCompleteForm({
                      ...completeForm,
                      admin_remarks: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={2}
                  placeholder="Completion remarks"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Next Service Date
                  </label>
                  <input
                    type="date"
                    value={completeForm.next_service_date}
                    onChange={(e) =>
                      setCompleteForm({
                        ...completeForm,
                        next_service_date: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Next Service KM
                  </label>
                  <input
                    type="number"
                    value={completeForm.next_service_km}
                    onChange={(e) =>
                      setCompleteForm({
                        ...completeForm,
                        next_service_km: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    min="0"
                  />
                </div>
              </div>
              <button
                onClick={handleComplete}
                className="w-full bg-green-600 text-white rounded-md py-2.5 font-medium hover:bg-green-700 transition-colors"
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
