import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {formatDate} from "../../../utils/dateFormat";
import {
  Shield,
  AlertTriangle,
  Wrench,
  X,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";

export default function InchargeHome() {
  const {showToast} = useToast();
  const [stats, setStats] = useState({
    total_drivers: 0,
    on_duty: 0,
    pending_leaves: 0,
  });
  const [vehicleAlerts, setVehicleAlerts] = useState({
    alerts: [],
    expired: 0,
    critical: 0,
    total: 0,
  });
  const [fcReplacements, setFcReplacements] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [requestForm, setRequestForm] = useState({
    replacement_type: "fc",
    start_date: "",
    expected_end_date: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch pending leaves count
        const res = await apiGet("/api/admin/leave/pending?status=pending");
        const leaves = await res.json();

        // Fetch all assignments for today
        const today = getToday();
        const assignRes = await apiGet(
          `/api/incharge/assignments?date=${today}`,
        );
        const assignments = await assignRes.json();

        // Fetch vehicle alerts for incharge's cluster
        const alertsRes = await apiGet(
          `/api/incharge/vehicles/alerts?driver_id=${inchargeId}`,
        );
        const alertsData = await alertsRes.json();

        setStats({
          total_drivers: assignments?.length || 0,
          on_duty:
            assignments?.filter((a) =>
              ["assigned", "scheduled", "ongoing"].includes(
                a.status?.toLowerCase(),
              ),
            )?.length || 0,
          pending_leaves: leaves?.length || 0,
        });
        setVehicleAlerts(
          alertsData || {alerts: [], expired: 0, critical: 0, total: 0},
        );

        // Fetch FC replacement requests for this incharge's cluster
        const fcRes = await apiGet(
          `/api/incharge/fc-replacements?incharge_id=${inchargeId}`,
        );
        if (fcRes.ok) {
          const fcData = await fcRes.json();
          setFcReplacements(fcData || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (inchargeId) {
      fetchStats();
    }
  }, [inchargeId]);

  const openRequestModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    // Pre-fill dates
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Determine replacement type based on which document is expiring
    let repType = "fc";
    if (vehicle.fc_days !== null && vehicle.fc_days <= 10) repType = "fc";
    else if (vehicle.insurance_days !== null && vehicle.insurance_days <= 10)
      repType = "insurance";
    else if (vehicle.permit_days !== null && vehicle.permit_days <= 10)
      repType = "permit";

    setRequestForm({
      replacement_type: repType,
      start_date: today,
      expected_end_date: nextWeek,
      reason: `${repType.toUpperCase()} renewal/maintenance`,
    });
    setShowRequestModal(true);
  };

  const hasExistingRequest = (vehicleId) => {
    return fcReplacements.some(
      (r) =>
        r.original_vehicle_id === vehicleId &&
        ["pending", "approved", "active"].includes(r.status),
    );
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.start_date || !requestForm.expected_end_date) {
      showToast("Please fill in all required fields", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost("/api/incharge/fc-replacement/request", {
        original_vehicle_id: selectedVehicle.id,
        replacement_type: requestForm.replacement_type,
        start_date: requestForm.start_date,
        expected_end_date: requestForm.expected_end_date,
        reason: requestForm.reason,
      });

      if (res.ok) {
        const newRequest = await res.json();
        setFcReplacements([newRequest, ...fcReplacements]);
        setShowRequestModal(false);
        showToast(
          "Replacement request submitted successfully. Admin will review and assign a replacement vehicle.",
          "success",
        );
      } else {
        const errData = await res.json();
        showToast(errData.error || "Failed to submit request", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to submit request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        bg: "bg-pending/10",
        text: "text-pending",
        icon: Clock,
        label: "Pending Approval",
      },
      approved: {
        bg: "bg-primary/10",
        text: "text-primary",
        icon: CheckCircle,
        label: "Approved",
      },
      active: {
        bg: "bg-green/10",
        text: "text-green",
        icon: CheckCircle,
        label: "Active",
      },
      completed: {
        bg: "bg-gray-100",
        text: "text-gray-600",
        icon: CheckCircle,
        label: "Completed",
      },
      rejected: {
        bg: "bg-red/10",
        text: "text-red",
        icon: XCircle,
        label: "Rejected",
      },
      cancelled: {
        bg: "bg-gray-100",
        text: "text-gray-500",
        icon: XCircle,
        label: "Cancelled",
      },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                Total Assignments
              </p>
              <h3 className="text-3xl font-bold text-primarytext mt-2">
                {stats.total_drivers}
              </h3>
            </div>
            <div className="bg-primarybg p-3 rounded-md text-primary">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                On Duty
              </p>
              <h3 className="text-3xl font-bold text-green mt-2">
                {stats.on_duty}
              </h3>
            </div>
            <div className="bg-green/10 p-3 rounded-md text-green">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                Pending Leaves
              </p>
              <h3 className="text-3xl font-bold text-pending mt-2">
                {stats.pending_leaves}
              </h3>
            </div>
            <div className="bg-pending/10 p-3 rounded-md text-pending">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Document Alert Section */}
      {vehicleAlerts.total > 0 && (
        <div
          className={`${vehicleAlerts.expired > 0 ? "bg-red/10 border-red/20" : "bg-pending/10 border-pending/20"} border rounded-md p-6`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 ${vehicleAlerts.expired > 0 ? "bg-red/20" : "bg-pending/20"} rounded-md flex items-center justify-center`}
            >
              <Shield
                className={`w-6 h-6 ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}
              />
            </div>
            <div>
              <h3
                className={`font-bold ${vehicleAlerts.expired > 0 ? "text-red" : "text-pending"}`}
              >
                ⚠️ Vehicle Document Alerts
              </h3>
              <p
                className={`text-sm ${vehicleAlerts.expired > 0 ? "text-red/80" : "text-pending/80"}`}
              >
                {vehicleAlerts.expired > 0 && (
                  <span className="font-semibold">
                    {vehicleAlerts.expired} vehicle(s) with expired documents
                  </span>
                )}
                {vehicleAlerts.expired > 0 &&
                  vehicleAlerts.critical > 0 &&
                  " • "}
                {vehicleAlerts.critical > 0 && (
                  <span>
                    {vehicleAlerts.critical} vehicle(s) expiring within 10 days
                  </span>
                )}
                {" — Insurance, FC, or Permit for cluster vehicles"}
              </p>
            </div>
          </div>
          {/* Vehicle list */}
          <div className="mt-4 space-y-2">
            {vehicleAlerts.alerts?.slice(0, 5).map((v) => {
              const getMinDays = () => {
                const days = [
                  v.insurance_days,
                  v.fc_days,
                  v.permit_days,
                ].filter((d) => d !== null);
                return Math.min(...days);
              };
              const minDays = getMinDays();
              const isExpired = minDays < 0;

              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between p-3 rounded-md ${isExpired ? "bg-red/5" : "bg-pending/5"}`}
                >
                  <div>
                    <span className="font-semibold text-primarytext">
                      {v.vehicle_number}
                    </span>
                    <span className="text-secondarytext text-sm ml-2">
                      ({v.vehicle_type})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      {v.insurance_days !== null && v.insurance_days <= 10 && (
                        <span
                          className={`mr-3 ${v.insurance_days < 0 ? "text-red font-semibold" : "text-pending"}`}
                        >
                          Insurance:{" "}
                          {v.insurance_days < 0
                            ? "Expired"
                            : `${v.insurance_days}d`}
                        </span>
                      )}
                      {v.fc_days !== null && v.fc_days <= 10 && (
                        <span
                          className={`mr-3 ${v.fc_days < 0 ? "text-red font-semibold" : "text-pending"}`}
                        >
                          FC: {v.fc_days < 0 ? "Expired" : `${v.fc_days}d`}
                        </span>
                      )}
                      {v.permit_days !== null && v.permit_days <= 10 && (
                        <span
                          className={`${v.permit_days < 0 ? "text-red font-semibold" : "text-pending"}`}
                        >
                          Permit:{" "}
                          {v.permit_days < 0 ? "Expired" : `${v.permit_days}d`}
                        </span>
                      )}
                    </div>
                    {hasExistingRequest(v.id) ? (
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                        Request Pending
                      </span>
                    ) : (
                      <button
                        onClick={() => openRequestModal(v)}
                        className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary/90 flex items-center gap-1"
                      >
                        <Wrench className="w-3 h-3" /> Request Replacement
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FC Replacement Requests Section */}
      {fcReplacements.length > 0 && (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-primarytext mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Your FC/Insurance/Permit Replacement Requests
          </h3>
          <div className="space-y-3">
            {fcReplacements.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <span className="font-semibold text-primarytext">
                    {req.original_vehicle_number}
                  </span>
                  <span className="text-secondarytext text-sm ml-2 capitalize">
                    ({req.replacement_type})
                  </span>
                  <p className="text-xs text-secondarytext mt-1">
                    {formatDate(req.start_date)} -{" "}
                    {formatDate(req.expected_end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {req.replacement_vehicle_number && (
                    <span className="text-sm text-green">
                      → {req.replacement_vehicle_number}
                    </span>
                  )}
                  {getStatusBadge(req.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Replacement Modal */}
      {showRequestModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primarytext">
                Request Replacement Vehicle
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Vehicle
                </label>
                <div className="p-3 bg-gray-50 rounded-md">
                  <span className="font-semibold">
                    {selectedVehicle.vehicle_number}
                  </span>
                  <span className="text-secondarytext text-sm ml-2">
                    ({selectedVehicle.vehicle_type})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Replacement Type
                </label>
                <select
                  value={requestForm.replacement_type}
                  onChange={(e) =>
                    setRequestForm({
                      ...requestForm,
                      replacement_type: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="fc">FC (Fitness Certificate)</option>
                  <option value="insurance">Insurance</option>
                  <option value="permit">Permit</option>
                  <option value="maintenance">General Maintenance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={requestForm.start_date}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        start_date: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Expected End Date
                  </label>
                  <input
                    type="date"
                    value={requestForm.expected_end_date}
                    onChange={(e) =>
                      setRequestForm({
                        ...requestForm,
                        expected_end_date: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Reason
                </label>
                <textarea
                  value={requestForm.reason}
                  onChange={(e) =>
                    setRequestForm({...requestForm, reason: e.target.value})
                  }
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  placeholder="Reason for replacement..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your request will be sent to the admin
                  for approval. Once approved, a replacement vehicle will be
                  assigned.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-secondarytext hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
