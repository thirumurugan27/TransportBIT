import React, {useState, useEffect, useMemo} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import CustomSearch from "../../../components/ui/CustomSearch";
import {
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Wrench,
  Send,
  X,
  FileText,
  CalendarDays,
  ChevronRight,
  Bus,
  Gauge,
  Shield,
} from "lucide-react";

const severityOptions = [
  {
    value: "low",
    label: "Low",
    color: "bg-skyblue/10 text-skyblue",
    dot: "bg-skyblue",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-pending/10 text-pending",
    dot: "bg-pending",
  },
  {
    value: "high",
    label: "High",
    color: "bg-red/10 text-red",
    dot: "bg-red",
  },
  {
    value: "critical",
    label: "Critical",
    color: "bg-red/15 text-red",
    dot: "bg-red",
  },
];

const statusConfig = {
  reported: {
    label: "Reported",
    color: "bg-skyblue/10 text-skyblue border-skyblue/20",
    bgIcon: "bg-skyblue/10",
    iconColor: "text-skyblue",
    icon: Send,
  },
  approved: {
    label: "Approved",
    color: "bg-primary/10 text-primary border-primary/20",
    bgIcon: "bg-primary/10",
    iconColor: "text-primary",
    icon: CheckCircle,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-pending/10 text-pending border-pending/20",
    bgIcon: "bg-pending/10",
    iconColor: "text-pending",
    icon: Wrench,
  },
  completed: {
    label: "Completed",
    color: "bg-green/10 text-green border-green/20",
    bgIcon: "bg-green/10",
    iconColor: "text-green",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red/10 text-red border-red/20",
    bgIcon: "bg-red/10",
    iconColor: "text-red",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-secondarytext/10 text-secondarytext border-secondarytext/20",
    bgIcon: "bg-secondarytext/10",
    iconColor: "text-secondarytext",
    icon: XCircle,
  },
};

const initialForm = {
  vehicle_id: "",
  service_type_id: "",
  title: "",
  description: "",
  severity: "medium",
  odometer_reading: "",
};

export default function DriverServiceRepair() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    fetchVehicles();
    fetchMyRequests();
    fetchServiceTypes();
  }, []);

  // Also extract vehicles from driver's own service requests
  useEffect(() => {
    if (requests.length > 0) {
      setVehicles((prev) => {
        const map = new Map(prev.map((v) => [v.id, v]));
        requests.forEach((r) => {
          if (r.vehicle_id && !map.has(r.vehicle_id)) {
            map.set(r.vehicle_id, {
              id: r.vehicle_id,
              vehicle_name: r.vehicle_name || r.vehicle_number,
              vehicle_number: r.vehicle_number || `Vehicle #${r.vehicle_id}`,
            });
          }
        });
        return Array.from(map.values());
      });
    }
  }, [requests]);

  const fetchVehicles = async () => {
    try {
      const driverId = user?.driver_id;
      if (!driverId) return;
      const res = await apiGet(`/api/driver/assignments?driver_id=${driverId}`);
      if (res.ok) {
        const assignments = await res.json();
        const vehicleMap = new Map();
        assignments.forEach((a) => {
          if (a.vehicle_id && !vehicleMap.has(a.vehicle_id)) {
            vehicleMap.set(a.vehicle_id, {
              id: a.vehicle_id,
              vehicle_name: a.vehicle_name || a.vehicle_number,
              vehicle_number: a.vehicle_number || `Vehicle #${a.vehicle_id}`,
            });
          }
          // Also include group vehicles from EV assignments
          if (a.group_vehicles) {
            a.group_vehicles.forEach((gv) => {
              if (gv.vehicle_id && !vehicleMap.has(gv.vehicle_id)) {
                vehicleMap.set(gv.vehicle_id, {
                  id: gv.vehicle_id,
                  vehicle_name: gv.vehicle_name || gv.vehicle_number,
                  vehicle_number:
                    gv.vehicle_number || `Vehicle #${gv.vehicle_id}`,
                });
              }
            });
          }
        });
        setVehicles(Array.from(vehicleMap.values()));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServiceTypes = async () => {
    try {
      const res = await apiGet("/api/driver/service-types");
      if (res.ok) setServiceTypes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/driver/services/my-requests");
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) {
      showToast("Please select a vehicle", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: parseInt(form.vehicle_id),
        service_type_id: form.service_type_id
          ? parseInt(form.service_type_id)
          : null,
        title: form.title,
        description: form.description,
        severity: form.severity,
        odometer_at_service: parseInt(form.odometer_reading) || null,
      };
      const res = await apiPost("/api/driver/services/report", payload);
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Issue reported successfully", "success");
        setForm(initialForm);
        setShowReportModal(false);
        fetchMyRequests();
      } else {
        showToast(data.error || "Failed to report", "error");
      }
    } catch {
      showToast("Failed to report issue", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const serviceTypeOptions = serviceTypes
    .filter((t) => t.is_active)
    .map((t) => ({
      value: String(t.id),
      label: t.name,
    }));

  const vehicleOptions = vehicles.map((v) => ({
    value: String(v.id),
    label: v.vehicle_name || v.vehicle_number,
    subtitle: v.vehicle_number,
  }));

  // Stats from requests
  const stats = useMemo(() => {
    const total = requests.length;
    const active = requests.filter((r) =>
      ["reported", "approved", "in_progress"].includes(r.status),
    ).length;
    const completed = requests.filter((r) => r.status === "completed").length;
    const rejected = requests.filter(
      (r) => r.status === "rejected" || r.status === "cancelled",
    ).length;
    return {total, active, completed, rejected};
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    let filtered = requests;
    if (statusFilter === "active")
      filtered = filtered.filter((r) =>
        ["reported", "approved", "in_progress"].includes(r.status),
      );
    else if (statusFilter === "rejected")
      filtered = filtered.filter(
        (r) => r.status === "rejected" || r.status === "cancelled",
      );
    else if (statusFilter !== "all")
      filtered = filtered.filter((r) => r.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.title || "").toLowerCase().includes(q) ||
          (r.service_type_name || "").toLowerCase().includes(q) ||
          (r.vehicle_number || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [requests, statusFilter, searchQuery]);

  const statusFilterOptions = [
    {value: "all", label: "All"},
    {value: "active", label: "Active"},
    {value: "completed", label: "Completed"},
    {value: "rejected", label: "Rejected"},
  ];

  // Status timeline steps
  const getTimeline = (req) => {
    const steps = [
      {
        key: "reported",
        label: "Reported",
        date: req.created_at,
        done: true,
      },
      {
        key: "approved",
        label: "Approved",
        date: null,
        done: ["approved", "in_progress", "completed"].includes(req.status),
      },
      {
        key: "in_progress",
        label: "In Progress",
        date: null,
        done: ["in_progress", "completed"].includes(req.status),
      },
      {
        key: "completed",
        label: "Completed",
        date: req.completed_at || null,
        done: req.status === "completed",
      },
    ];
    if (req.status === "rejected")
      return [
        steps[0],
        {
          key: "rejected",
          label: "Rejected",
          date: null,
          done: true,
          isNegative: true,
        },
      ];
    if (req.status === "cancelled")
      return [
        steps[0],
        {
          key: "cancelled",
          label: "Cancelled",
          date: null,
          done: true,
          isNegative: true,
        },
      ];
    return steps;
  };

  return (
    <div className="space-y-5 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-primarytext">
            Service & Repair
          </h1>
          <p className="text-secondarytext text-xs sm:text-sm mt-0.5">
            Report vehicle issues and track service requests
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primarydull text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-md font-medium transition-all shadow-sm hover:shadow-md text-sm"
        >
          <Plus size={16} />
          <span className="hidden xs:inline">Report</span> Issue
        </button>
      </div>

      {/* Stats Cards */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Requests",
              value: stats.total,
              icon: FileText,
              color: "bg-primary/10 text-primary",
            },
            {
              label: "Active",
              value: stats.active,
              icon: Clock,
              color: "bg-pending/10 text-pending",
            },
            {
              label: "Completed",
              value: stats.completed,
              icon: CheckCircle,
              color: "bg-green/10 text-green",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              icon: XCircle,
              color: "bg-red/10 text-red",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-secondarybg rounded-md p-4 border border-primarybg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-1">
                    {stat.label}
                  </p>
                  <h3 className="text-2xl font-extrabold text-primarytext">
                    {stat.value}
                  </h3>
                </div>
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center ${stat.color}`}
                >
                  <stat.icon size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Requests */}
      <div className="space-y-3 animate-fadeIn">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <CustomSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search requests..."
            isWhite
          />
          <CustomDropdown
            isWhite
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
            placeholder="Filter by status"
            width="w-40"
          />
        </div>

        {loading ? (
          <Loading fullScreen={false} />
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-secondarytext bg-secondarybg rounded-md border border-primarybg">
            <div className="w-14 h-14 rounded-full bg-primarybg flex items-center justify-center mx-auto mb-4">
              <Wrench size={24} className="text-secondarytext/50" />
            </div>
            <p className="text-sm font-medium text-primarytext">
              {statusFilter === "all"
                ? "No service requests yet"
                : `No ${statusFilter} requests`}
            </p>
            <p className="text-xs text-secondarytext mt-1">
              Report a vehicle issue to get started
            </p>
            <button
              onClick={() => setShowReportModal(true)}
              className="mt-4 text-primary text-xs font-semibold hover:underline flex items-center gap-1 mx-auto"
            >
              <Plus size={14} />
              Report an issue
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRequests.map((req) => {
              const sc = statusConfig[req.status] || statusConfig.reported;
              const StatusIcon = sc.icon;
              const sevOption = severityOptions.find(
                (s) => s.value === req.severity,
              );

              return (
                <div
                  key={req.id}
                  className="bg-secondarybg rounded-md border border-primarybg p-4 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all group"
                  onClick={() => setDetailModal(req)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${sc.bgIcon}`}
                    >
                      <StatusIcon size={16} className={sc.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <h3 className="font-bold text-primarytext text-sm truncate">
                            {req.title}
                          </h3>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-secondarytext/40 group-hover:text-primary shrink-0 transition-colors"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${sc.color}`}
                        >
                          {sc.label}
                        </span>
                        {sevOption && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sevOption.color}`}
                          >
                            {sevOption.label}
                          </span>
                        )}
                        <span className="text-[10px] text-secondarytext flex items-center gap-1">
                          <Bus size={10} />
                          {req.vehicle_name || req.vehicle_number}
                        </span>
                      </div>
                      {req.description && (
                        <p className="text-xs text-secondarytext mt-1.5 line-clamp-1">
                          {req.description}
                        </p>
                      )}
                      <p className="text-[10px] text-secondarytext/70 mt-2 flex items-center gap-1">
                        <Clock size={10} />
                        {req.created_at}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Issue Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-secondarybg p-5 border-b border-primarybg flex items-center justify-between rounded-t-md z-10">
              <div>
                <h3 className="text-base font-bold text-primarytext">
                  Report a Vehicle Issue
                </h3>
                <p className="text-xs text-secondarytext mt-0.5">
                  Your request will be reviewed by an admin
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-secondarytext hover:text-primarytext transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReport} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Vehicle *
                  </label>
                  <SearchableSelect
                    options={vehicleOptions}
                    value={String(form.vehicle_id)}
                    onChange={(val) => setForm({...form, vehicle_id: val})}
                    placeholder="Search vehicle..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Service Type{" "}
                    <span className="text-secondarytext font-normal text-[10px]">
                      (Optional)
                    </span>
                  </label>
                  <SearchableSelect
                    options={serviceTypeOptions}
                    value={String(form.service_type_id)}
                    onChange={(val) => setForm({...form, service_type_id: val})}
                    placeholder="Select type..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Issue Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  className="w-full border border-primarybg rounded-md p-2.5 bg-primarybg text-sm text-primarytext focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., Brake noise, Engine overheating"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                  Description *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({...form, description: e.target.value})
                  }
                  className="w-full border border-primarybg rounded-md p-2.5 bg-primarybg text-sm text-primarytext focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Severity
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {severityOptions.map((s) => (
                      <button
                        type="button"
                        key={s.value}
                        onClick={() => setForm({...form, severity: s.value})}
                        className={`px-3 py-2 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          form.severity === s.value
                            ? `${s.color} border-current shadow-sm`
                            : "border-primarybg text-secondarytext hover:bg-primarybg"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            form.severity === s.value
                              ? s.dot
                              : "bg-secondarytext/30"
                          }`}
                        />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
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
                    className="w-full border border-primarybg rounded-md p-2.5 bg-primarybg text-sm text-primarytext focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Current km reading"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 border border-primarybg text-secondarytext rounded-md text-sm font-semibold hover:bg-primarybg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primarydull transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Send size={14} />
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-secondarybg p-5 border-b border-primarybg flex items-center justify-between rounded-t-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const sc =
                    statusConfig[detailModal.status] || statusConfig.reported;
                  return (
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${sc.bgIcon}`}
                    >
                      <sc.icon size={16} className={sc.iconColor} />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-primarytext truncate">
                    {detailModal.title}
                  </h3>
                  <p className="text-xs text-secondarytext">
                    {detailModal.vehicle_name || detailModal.vehicle_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status & Severity Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc =
                    statusConfig[detailModal.status] || statusConfig.reported;
                  return (
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold border ${sc.color}`}
                    >
                      {sc.label}
                    </span>
                  );
                })()}
                {detailModal.severity && (
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      severityOptions.find(
                        (s) => s.value === detailModal.severity,
                      )?.color || "bg-secondarytext/10 text-secondarytext"
                    }`}
                  >
                    {detailModal.severity.charAt(0).toUpperCase() +
                      detailModal.severity.slice(1)}{" "}
                    Severity
                  </span>
                )}
              </div>

              {/* Status Timeline */}
              <div className="bg-primarybg rounded-md p-4">
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-3">
                  Status Timeline
                </p>
                <div className="flex items-center gap-0">
                  {getTimeline(detailModal).map((step, i, arr) => (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center gap-1.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                            step.isNegative
                              ? "bg-red"
                              : step.done
                                ? "bg-primary"
                                : "bg-secondarytext/20"
                          }`}
                        >
                          {step.isNegative ? (
                            <XCircle size={14} />
                          ) : step.done ? (
                            <CheckCircle size={14} />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold text-center leading-tight ${
                            step.isNegative
                              ? "text-red"
                              : step.done
                                ? "text-primarytext"
                                : "text-secondarytext/50"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 -mt-4 rounded-full ${
                            arr[i + 1]?.done || arr[i + 1]?.isNegative
                              ? arr[i + 1]?.isNegative
                                ? "bg-red/40"
                                : "bg-primary"
                              : "bg-secondarytext/15"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Detail Fields */}
              <div className="space-y-2">
                {[
                  {
                    label: "Vehicle",
                    value:
                      detailModal.vehicle_name || detailModal.vehicle_number,
                    icon: Bus,
                  },
                  detailModal.service_type_name && {
                    label: "Service Type",
                    value: detailModal.service_type_name,
                    icon: Wrench,
                  },
                  detailModal.odometer_at_service > 0 && {
                    label: "Odometer",
                    value: `${detailModal.odometer_at_service?.toLocaleString()} km`,
                    icon: Gauge,
                  },
                  detailModal.scheduled_date && {
                    label: "Scheduled",
                    value: detailModal.scheduled_date,
                    icon: CalendarDays,
                  },
                  detailModal.completed_at && {
                    label: "Completed",
                    value: detailModal.completed_at,
                    icon: CheckCircle,
                  },
                  detailModal.workshop_name && {
                    label: "Workshop",
                    value: detailModal.workshop_name,
                    icon: Shield,
                  },
                  detailModal.mechanic_name && {
                    label: "Mechanic",
                    value: detailModal.mechanic_name,
                    icon: Wrench,
                  },
                ]
                  .filter(Boolean)
                  .map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-primarybg last:border-0"
                    >
                      <span className="text-xs text-secondarytext flex items-center gap-2">
                        {item.icon && (
                          <item.icon
                            size={13}
                            className="text-secondarytext/50"
                          />
                        )}
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {item.value}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Description */}
              {detailModal.description && (
                <div>
                  <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Description
                  </p>
                  <p className="text-sm text-primarytext bg-primarybg p-3 rounded-md leading-relaxed">
                    {detailModal.description}
                  </p>
                </div>
              )}

              {/* Admin Remarks */}
              {detailModal.admin_remarks && (
                <div>
                  <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Admin Remarks
                  </p>
                  <div className="bg-primary/5 border border-primary/10 p-3 rounded-md">
                    <p className="text-sm text-primarytext leading-relaxed">
                      {detailModal.admin_remarks}
                    </p>
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {detailModal.rejection_reason && (
                <div>
                  <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Rejection Reason
                  </p>
                  <div className="bg-red/5 border border-red/10 p-3 rounded-md">
                    <p className="text-sm text-primarytext leading-relaxed">
                      {detailModal.rejection_reason}
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-[10px] text-secondarytext/60 pt-2 border-t border-primarybg flex items-center gap-1">
                <Clock size={10} />
                Reported: {detailModal.created_at}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
