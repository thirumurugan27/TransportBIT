import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Wrench,
  Send,
  X,
  History,
  FileText,
  CalendarDays,
} from "lucide-react";

const severityOptions = [
  {value: "low", label: "Low", color: "bg-blue-100 text-blue-700"},
  {value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700"},
  {value: "high", label: "High", color: "bg-orange-100 text-orange-700"},
  {value: "critical", label: "Critical", color: "bg-red-100 text-red-700"},
];

const statusConfig = {
  reported: {label: "Reported", color: "bg-blue-100 text-blue-700", icon: Send},
  approved: {
    label: "Approved",
    color: "bg-indigo-100 text-indigo-700",
    icon: CheckCircle,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-yellow-100 text-yellow-700",
    icon: Wrench,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-600",
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
  const [activeTab, setActiveTab] = useState("report");
  const [requests, setRequests] = useState([]);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    fetchVehicles();
    fetchMyRequests();
    fetchServiceTypes();
  }, []);

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

  const fetchVehicleHistory = async (vehicleId) => {
    if (!vehicleId) {
      setVehicleHistory([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/driver/services/vehicle-history?vehicle_id=${vehicleId}`,
      );
      if (res.ok) setVehicleHistory(await res.json());
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
        setActiveTab("requests");
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

  const tabs = [
    {key: "report", label: "Report Issue", icon: Plus},
    {key: "requests", label: "My Requests", icon: FileText},
    {key: "history", label: "Vehicle History", icon: History},
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primarytext">
          Service & Repair
        </h1>
        <p className="text-secondarytext text-sm mt-0.5">
          Report vehicle issues and track service requests
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === "requests") fetchMyRequests();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-md text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "bg-secondarybg text-secondarytext hover:bg-primarybg border border-gray-100"
              }`}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Issue Tab */}
      {activeTab === "report" && (
        <div className="bg-secondarybg rounded-md border border-gray-100 p-6 animate-fadeIn">
          <h2 className="text-lg font-bold text-primarytext mb-5">
            Report a Vehicle Issue
          </h2>
          <form onSubmit={handleReport} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                Vehicle *
              </label>
              <SearchableSelect
                options={vehicleOptions}
                value={String(form.vehicle_id)}
                onChange={(val) => setForm({...form, vehicle_id: val})}
                placeholder="Search your vehicle..."
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
                placeholder="Select service type..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                Issue Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={4}
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
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                        form.severity === s.value
                          ? `${s.color} border-current`
                          : "border-gray-200 text-secondarytext hover:bg-primarybg"
                      }`}
                    >
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
                  className="w-full border border-gray-200 rounded-md p-2.5 bg-primarybg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Current km reading"
                  min="0"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === "requests" && (
        <div className="space-y-2.5 animate-fadeIn">
          {loading ? (
            <Loading fullScreen={false} />
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-secondarytext bg-secondarybg rounded-md border border-gray-100">
              <AlertTriangle size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No service requests yet</p>
              <button
                onClick={() => setActiveTab("report")}
                className="mt-3 text-primary text-sm font-medium hover:underline"
              >
                Report an issue
              </button>
            </div>
          ) : (
            requests.map((req) => {
              const sc = statusConfig[req.status] || statusConfig.reported;
              const StatusIcon = sc.icon;

              return (
                <div
                  key={req.id}
                  className="bg-secondarybg rounded-md border border-gray-100 p-4 cursor-pointer hover:shadow-sm transition-all"
                  onClick={() => setDetailModal(req)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                          sc.color.includes("green")
                            ? "bg-green-100"
                            : sc.color.includes("red")
                              ? "bg-red-100"
                              : sc.color.includes("yellow")
                                ? "bg-yellow-100"
                                : sc.color.includes("indigo")
                                  ? "bg-indigo-100"
                                  : "bg-blue-100"
                        }`}
                      >
                        <StatusIcon
                          size={16}
                          className={
                            sc.color.includes("green")
                              ? "text-green-600"
                              : sc.color.includes("red")
                                ? "text-red-600"
                                : sc.color.includes("yellow")
                                  ? "text-yellow-600"
                                  : sc.color.includes("indigo")
                                    ? "text-indigo-600"
                                    : "text-blue-600"
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-primarytext text-sm">
                            {req.title}
                          </h3>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${sc.color}`}
                          >
                            {sc.label}
                          </span>
                          {req.severity && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                severityOptions.find(
                                  (s) => s.value === req.severity,
                                )?.color || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {req.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondarytext mt-0.5">
                          {req.vehicle_number}
                        </p>
                        <p className="text-xs text-secondarytext mt-1 line-clamp-2">
                          {req.description}
                        </p>
                        <p className="text-[11px] text-secondarytext mt-2">
                          Reported: {req.created_at || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Vehicle History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md border border-gray-100 p-4">
            <label className="block text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
              Select Vehicle
            </label>
            <SearchableSelect
              options={vehicleOptions}
              value={String(selectedVehicleId)}
              onChange={(val) => {
                setSelectedVehicleId(val);
                fetchVehicleHistory(val);
              }}
              placeholder="Search vehicle to view history..."
            />
          </div>

          {loading ? (
            <Loading fullScreen={false} />
          ) : selectedVehicleId && vehicleHistory.length === 0 ? (
            <div className="text-center py-12 text-secondarytext bg-secondarybg rounded-md border border-gray-100">
              <History size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No service history for this vehicle</p>
            </div>
          ) : (
            vehicleHistory.map((record) => {
              const sc = statusConfig[record.status] || statusConfig.reported;
              return (
                <div
                  key={record.id}
                  className="bg-secondarybg rounded-md border border-gray-100 p-4 transition-all hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-primarytext text-sm">
                          {record.title}
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${sc.color}`}
                        >
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-xs text-secondarytext mt-0.5">
                        {record.service_type_name || "General"} |{" "}
                        {record.vehicle_number}
                      </p>
                      {record.description && (
                        <p className="text-xs text-secondarytext mt-1 line-clamp-2">
                          {record.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-secondarytext">
                        {record.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} />
                            {record.scheduled_date || "-"}
                          </span>
                        )}
                        {record.total_cost > 0 && (
                          <span className="text-primary font-bold">
                            ₹{record.total_cost.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-secondarybg p-6 border-b border-gray-100 flex items-center justify-between rounded-t-md">
              <h3 className="text-lg font-bold text-primarytext">
                Request Details
              </h3>
              <button
                onClick={() => setDetailModal(null)}
                className="text-secondarytext hover:text-primarytext transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-bold text-primarytext">
                  {detailModal.title}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  {(() => {
                    const sc =
                      statusConfig[detailModal.status] || statusConfig.reported;
                    return (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${sc.color}`}
                      >
                        {sc.label}
                      </span>
                    );
                  })()}
                  {detailModal.severity && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                        severityOptions.find(
                          (s) => s.value === detailModal.severity,
                        )?.color || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {detailModal.severity}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  {label: "Vehicle", value: detailModal.vehicle_number},
                  detailModal.service_type_name && {
                    label: "Service Type",
                    value: detailModal.service_type_name,
                  },
                  detailModal.odometer_reading > 0 && {
                    label: "Odometer",
                    value: `${detailModal.odometer_reading} km`,
                  },
                  detailModal.scheduled_date && {
                    label: "Scheduled",
                    value: detailModal.scheduled_date || "-",
                  },
                  detailModal.workshop_name && {
                    label: "Workshop",
                    value: detailModal.workshop_name,
                  },
                  detailModal.total_cost > 0 && {
                    label: "Total Cost",
                    value: `₹${detailModal.total_cost.toLocaleString()}`,
                    highlight: true,
                  },
                ]
                  .filter(Boolean)
                  .map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-secondarytext">{item.label}</span>
                      <span
                        className={
                          item.highlight
                            ? "text-primary font-bold"
                            : "text-primarytext font-medium"
                        }
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
              </div>

              {detailModal.description && (
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Description
                  </p>
                  <p className="text-sm text-primarytext bg-primarybg p-3 rounded-md">
                    {detailModal.description}
                  </p>
                </div>
              )}

              {detailModal.admin_remarks && (
                <div>
                  <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-1.5">
                    Admin Remarks
                  </p>
                  <p className="text-sm text-primarytext bg-primarybg p-3 rounded-md">
                    {detailModal.admin_remarks}
                  </p>
                </div>
              )}

              <div className="text-xs text-secondarytext pt-2 border-t border-gray-100">
                Reported: {new Date(detailModal.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
