import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";
import Loading from "../../../components/ui/Loading";
import {
  Bus,
  MapPin,
  IndianRupee,
  CreditCard,
  Clock,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Calendar,
  User,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function StudentTransport() {
  const {user} = useAuth();
  const {showToast} = useToast();
  const studentName = user?.full_name || user?.username || "Student";
  const [transport, setTransport] = useState(null);
  const [payments, setPayments] = useState([]);
  const [stopRequests, setStopRequests] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [allBuses, setAllBuses] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const [stopChangeBusId, setStopChangeBusId] = useState(0);
  const [stopChangeStops, setStopChangeStops] = useState([]);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  // Stop change request form
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    requested_stop_id: 0,
    reason: "",
  });

  // Transport request form (for new students)
  const [showTransportRequestModal, setShowTransportRequestModal] =
    useState(false);
  const [transportRequestForm, setTransportRequestForm] = useState({
    bus_id: 0,
    stop_id: 0,
    academic_year:
      new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchTransport();
    fetchPayments();
    fetchStopRequests();
    fetchTransportRequests();
    fetchAllBuses();
  }, []);

  const fetchTransport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/transport`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setTransport(data);
        setError(null);
      } else if (res.status === 404 || res.status === 401) {
        setError("not_assigned");
      } else {
        setError("not_assigned");
      }
    } catch (err) {
      console.error(err);
      setError("not_assigned");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/transport/payments`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStopRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/stop-change/requests`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setStopRequests(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransportRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/transport/requests`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setTransportRequests(data || []);
        const hasApproved = (data || []).some((r) => r.status === "approved");
        if (hasApproved && !transport) {
          fetchTransport();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllBuses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/all-buses`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setAllBuses(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBusStops = async (busId, setter = setBusStops) => {
    if (!busId) {
      setter([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/student/bus/${busId}/stops`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setter(data || []);
      } else {
        setter([]);
      }
    } catch (err) {
      console.error(err);
      setter([]);
    }
  };

  const handleOpenRequestModal = () => {
    const defaultBusId = transport?.bus_id || 0;
    setStopChangeBusId(defaultBusId);
    setRequestForm({requested_stop_id: 0, reason: ""});
    if (defaultBusId) {
      fetchBusStops(defaultBusId, setStopChangeStops);
    } else {
      setStopChangeStops([]);
    }
    setShowRequestModal(true);
  };

  const handleOpenTransportRequestModal = () => {
    setShowTransportRequestModal(true);
  };

  const handleBusChange = (e) => {
    const busId = parseInt(e.target.value);
    setTransportRequestForm({
      ...transportRequestForm,
      bus_id: busId,
      stop_id: 0,
    });
    if (busId > 0) {
      fetchBusStops(busId);
    } else {
      setBusStops([]);
    }
  };

  const handleStopChangeBusSelect = (e) => {
    const busId = parseInt(e.target.value);
    setStopChangeBusId(busId);
    setRequestForm({...requestForm, requested_stop_id: 0});
    if (busId > 0) {
      fetchBusStops(busId, setStopChangeStops);
    } else {
      setStopChangeStops([]);
    }
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setStopChangeBusId(0);
    setStopChangeStops([]);
    setRequestForm({requested_stop_id: 0, reason: ""});
  };

  const handleSubmitRequest = async () => {
    if (!stopChangeBusId) {
      showToast("Please select a bus", "warning");
      return;
    }
    if (!requestForm.requested_stop_id) {
      showToast("Please select a stop", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/student/stop-change/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestForm),
      });
      if (res.ok) {
        showToast("Stop change request submitted successfully!", "success");
        closeRequestModal();
        fetchStopRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to submit request", "error");
      }
    } catch (err) {
      showToast("Error submitting request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelStopRequest = async (requestId) => {
    if (!requestId) return;
    const confirmCancel = await showConfirm(
      "Cancel Request",
      "Cancel this request?\nYou can submit a new one afterwards.",
    );
    if (!confirmCancel) return;

    setCancellingRequestId(requestId);
    try {
      const res = await fetch(
        `${API_BASE}/api/student/stop-change/request/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({request_id: requestId}),
        },
      );
      if (res.ok) {
        showToast("Request cancelled", "success");
        fetchStopRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel request", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error cancelling request", "error");
    } finally {
      setCancellingRequestId(null);
    }
  };

  const handleSubmitTransportRequest = async () => {
    if (!transportRequestForm.bus_id || !transportRequestForm.stop_id) {
      showToast("Please select a bus and stop", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/student/transport/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transportRequestForm),
      });
      if (res.ok) {
        showToast(
          "Transport request submitted successfully! Please wait for admin approval.",
          "success",
        );
        setShowTransportRequestModal(false);
        setTransportRequestForm({
          bus_id: 0,
          stop_id: 0,
          academic_year:
            new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
          reason: "",
        });
        fetchTransportRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to submit request", "error");
      }
    } catch (err) {
      showToast("Error submitting request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-pending/10 text-pending border border-pending/20",
      approved: "bg-green/10 text-green border border-green/20",
      rejected: "bg-red/10 text-red border border-red/20",
    };
    return (
      <span
        className={`px-3 py-1 rounded-md text-xs font-semibold ${styles[status] || "bg-secondarybg"}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  // Show request UI if not assigned or transport is null
  if (error === "not_assigned" || !transport) {
    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-secondarybg rounded-md p-6 border border-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primarytext mb-2">
                Request Bus Transport
              </h1>
              <p className="text-secondarytext">
                You're not assigned to a bus yet. Request a bus and stop to get
                started!
              </p>
            </div>
            <div className="bg-primary/10 p-4 rounded-md">
              <Bus className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Request Transport Card */}
        <div className="bg-secondarybg rounded-md shadow-sm border border-primarybg p-8 text-center">
          <div className="bg-primary/10 w-20 h-20 rounded-md flex items-center justify-center mx-auto mb-4">
            <Send className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-primarytext mb-2">
            No Bus Assigned Yet
          </h3>
          <p className="text-secondarytext mb-6 max-w-md mx-auto">
            Request a bus route and stop. Once approved by the admin, you will
            be assigned to the bus.
          </p>
          <button
            onClick={handleOpenTransportRequestModal}
            className="px-8 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-semibold text-lg shadow-lg"
          >
            Request Bus Transport
          </button>
        </div>

        {/* My Transport Requests */}
        <div className="bg-secondarybg rounded-md shadow-sm border border-primarybg p-6">
          <h3 className="text-lg font-semibold text-primarytext mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            My Transport Requests
          </h3>
          {transportRequests.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-secondarytext mx-auto mb-3" />
              <p className="text-secondarytext">
                No transport requests yet. Submit a request above!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transportRequests.map((req) => (
                <div
                  key={req.id}
                  className={`bg-primarybg rounded-md p-5 border ${
                    req.status === "pending"
                      ? "border-pending/30"
                      : "border-primarybg"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Bus className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-primarytext text-lg">
                          {req.vehicle_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-secondarytext">
                        <MapPin className="w-4 h-4" />
                        Stop: {req.stop_name}
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-secondarybg rounded-md p-3">
                    <div>
                      <span className="text-secondarytext">Academic Year:</span>
                      <span className="ml-2 font-semibold text-primarytext">
                        {req.academic_year}
                      </span>
                    </div>
                    <div>
                      <span className="text-secondarytext">Fee:</span>
                      <span className="ml-2 font-semibold text-green">
                        ₹{req.fee?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {req.reason && (
                    <div className="mt-3 text-sm text-secondarytext bg-secondarybg rounded-md p-3">
                      <span className="font-semibold text-primarytext">
                        Reason:
                      </span>{" "}
                      {req.reason}
                    </div>
                  )}
                  {req.admin_remarks && req.status !== "pending" && (
                    <div className="mt-2 text-sm text-secondarytext bg-secondarybg rounded-md p-3">
                      <span className="font-semibold text-primarytext">
                        Admin Remarks:
                      </span>{" "}
                      {req.admin_remarks}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-secondarytext">
                    Requested: {req.created_at || "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transport Request Modal */}
        {showTransportRequestModal && (
          <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-secondarybg rounded-md shadow-2xl max-w-md w-full p-6 border border-primarybg animate-scaleIn">
              <h3 className="text-xl font-bold text-primarytext mb-6">
                Request Bus Transport
              </h3>

              <label className="block text-sm font-semibold text-primarytext mb-2">
                Select Bus Route
              </label>
              <select
                value={transportRequestForm.bus_id}
                onChange={handleBusChange}
                className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
              >
                <option value={0}>-- Select Bus --</option>
                {allBuses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.name} - {bus.route}
                  </option>
                ))}
              </select>

              {transportRequestForm.bus_id > 0 && (
                <>
                  <label className="block text-sm font-semibold text-primarytext mb-2">
                    Select Stop
                  </label>
                  <select
                    value={transportRequestForm.stop_id}
                    onChange={(e) =>
                      setTransportRequestForm({
                        ...transportRequestForm,
                        stop_id: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
                  >
                    <option value={0}>-- Select Stop --</option>
                    {busStops.map((stop) => (
                      <option
                        key={stop.stop_id || stop.id}
                        value={stop.stop_id || stop.id}
                      >
                        {stop.stop_name} - ₹{stop.fee?.toLocaleString()}
                        {stop.arrival_time
                          ? ` (Arrives ${stop.arrival_time})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label className="block text-sm font-semibold text-primarytext mb-2">
                Academic Year
              </label>
              <input
                type="text"
                value={transportRequestForm.academic_year}
                onChange={(e) =>
                  setTransportRequestForm({
                    ...transportRequestForm,
                    academic_year: e.target.value,
                  })
                }
                placeholder="e.g., 2024-2025"
                className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
              />

              <label className="block text-sm font-semibold text-primarytext mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={transportRequestForm.reason}
                onChange={(e) =>
                  setTransportRequestForm({
                    ...transportRequestForm,
                    reason: e.target.value,
                  })
                }
                placeholder="Any additional information..."
                className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
                rows={3}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransportRequestModal(false)}
                  className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTransportRequest}
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium disabled:opacity-50"
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

  const tabs = [
    {id: "details", label: "Transport Details", icon: Bus},
    {id: "fees", label: "Fee & Payments", icon: IndianRupee},
    {id: "requests", label: "Stop Change Requests", icon: FileText},
  ];

  return (
    <div className="space-y-6 p-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-secondarybg rounded-md p-6 border border-primary/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primarytext mb-2">
              My Transport
            </h1>
            <p className="text-secondarytext">
              View your bus details, fees, and manage stop change requests
            </p>
          </div>
          <div className="bg-primary/10 p-4 rounded-md">
            <Bus className="w-8 h-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-secondarybg rounded-md border border-primarybg overflow-hidden">
        <div className="flex border-b border-primarybg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
                activeTab === tab.id
                  ? "text-primary bg-primary/5 border-b-2 border-primary"
                  : "text-secondarytext hover:text-primarytext hover:bg-primarybg/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Transport Details Tab */}
          {activeTab === "details" && transport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bus Info Card */}
                <div className="bg-primarybg rounded-md p-6 border border-primarybg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-primary/10 p-2 rounded-md">
                      <Bus className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-primarytext">
                      Bus Information
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-primarybg">
                      <span className="text-secondarytext">Bus Name</span>
                      <span className="font-semibold text-primarytext">
                        {transport.vehicle_name}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-primarybg">
                      <span className="text-secondarytext">Bus Number</span>
                      <span className="font-semibold text-primarytext">
                        {transport.bus_number}
                      </span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-secondarytext">Route</span>
                      <span className="font-semibold text-primarytext">
                        {transport.route_start} → {transport.route_end}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stop Info Card */}
                <div className="bg-primarybg rounded-md p-6 border border-primarybg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-primary/10 p-2 rounded-md">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-primarytext">
                      My Stop
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-primarybg">
                      <span className="text-secondarytext">Stop Name</span>
                      <span className="font-semibold text-primarytext">
                        {transport.stop_name}
                      </span>
                    </div>
                    {transport.stop_location && (
                      <div className="flex justify-between py-3 border-b border-primarybg">
                        <span className="text-secondarytext">Location</span>
                        <span className="font-semibold text-primarytext">
                          {transport.stop_location}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-b border-primarybg">
                      <span className="text-secondarytext">Arrival Time</span>
                      <span className="font-semibold text-primarytext">
                        {transport.arrival_time
                          ? transport.arrival_time
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-secondarytext">Departure Time</span>
                      <span className="font-semibold text-primarytext">
                        {transport.departure_time
                          ? transport.departure_time
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenRequestModal}
                    className="mt-6 w-full py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
                  >
                    Request Stop Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fee & Payments Tab */}
          {activeTab === "fees" && transport && (
            <div className="space-y-6">
              {/* Fee Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primarybg rounded-md p-6 text-center border border-primarybg">
                  <div className="text-sm text-secondarytext mb-2">
                    Total Fee
                  </div>
                  <div className="text-3xl font-bold text-primarytext">
                    ₹{transport.total_fee?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green/5 rounded-md p-6 text-center border border-green/20">
                  <div className="text-sm text-secondarytext mb-2">
                    Paid Amount
                  </div>
                  <div className="text-3xl font-bold text-green">
                    ₹{transport.paid_amount?.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`rounded-md p-6 text-center border ${
                    transport.balance > 0
                      ? "bg-red/5 border-red/20"
                      : "bg-green/5 border-green/20"
                  }`}
                >
                  <div className="text-sm text-secondarytext mb-2">
                    Balance Due
                  </div>
                  <div
                    className={`text-3xl font-bold ${transport.balance > 0 ? "text-red" : "text-green"}`}
                  >
                    ₹{transport.balance?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-primarybg rounded-md p-6 border border-primarybg">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-primarytext">
                    Payment History
                  </h3>
                </div>
                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                    <p className="text-secondarytext">
                      No payment records found
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-primarybg">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                            Method
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                            Receipt #
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-primarybg hover:bg-secondarybg transition-colors"
                          >
                            <td className="px-4 py-3 text-primarytext">
                              {p.payment_date}
                            </td>
                            <td className="px-4 py-3 font-semibold text-green">
                              ₹{p.amount?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-primarytext capitalize">
                              {p.payment_method}
                            </td>
                            <td className="px-4 py-3 text-secondarytext">
                              {p.receipt_number || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stop Change Requests Tab */}
          {activeTab === "requests" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-primarytext flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  My Stop Change Requests
                </h3>
                <button
                  onClick={handleOpenRequestModal}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
                >
                  <Send className="w-4 h-4" />
                  New Request
                </button>
              </div>

              {stopRequests.length === 0 ? (
                <div className="text-center py-12 bg-primarybg rounded-md">
                  <FileText className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                  <p className="text-secondarytext">
                    No stop change requests found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stopRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`bg-primarybg rounded-md p-5 border ${
                        req.status === "pending"
                          ? "border-pending/30"
                          : "border-primarybg"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 text-lg font-semibold text-primarytext mb-1">
                            <MapPin className="w-5 h-5 text-primary" />
                            {req.current_stop_name}
                            <ArrowRight className="w-5 h-5 text-secondarytext" />
                            {req.requested_stop_name}
                          </div>
                          <div className="text-sm text-secondarytext">
                            {req.created_at}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(req.status)}
                          {req.status === "pending" && (
                            <button
                              onClick={() => handleCancelStopRequest(req.id)}
                              disabled={cancellingRequestId === req.id}
                              className="px-3 py-1 text-sm rounded-md border border-red/20 text-red hover:bg-red/10 disabled:opacity-50 font-medium"
                            >
                              {cancellingRequestId === req.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm bg-secondarybg rounded-md p-4">
                        <div>
                          <span className="text-secondarytext">
                            Current Fee:
                          </span>
                          <div className="font-semibold text-primarytext mt-1">
                            ₹{req.current_fee?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-secondarytext">New Fee:</span>
                          <div className="font-semibold text-primarytext mt-1">
                            ₹{req.new_fee?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-secondarytext">
                            Difference:
                          </span>
                          <div
                            className={`font-semibold mt-1 ${req.fee_difference >= 0 ? "text-red" : "text-green"}`}
                          >
                            {req.fee_difference >= 0 ? "+" : ""}₹
                            {req.fee_difference?.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {req.reason && (
                        <div className="mt-3 text-sm text-secondarytext bg-secondarybg rounded-md p-3">
                          <span className="font-semibold text-primarytext">
                            Reason:
                          </span>{" "}
                          {req.reason}
                        </div>
                      )}
                      {req.admin_remarks && req.status !== "pending" && (
                        <div className="mt-2 text-sm text-secondarytext bg-secondarybg rounded-md p-3">
                          <span className="font-semibold text-primarytext">
                            Admin Remarks:
                          </span>{" "}
                          {req.admin_remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stop Change Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-md w-full p-6 border border-primarybg animate-scaleIn">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Request Stop Change
            </h3>

            {transport && (
              <div className="bg-primarybg rounded-md p-4 mb-4 border border-primary/20">
                <div className="text-sm text-secondarytext mb-1">
                  Current Stop
                </div>
                <div className="font-semibold text-primarytext">
                  {transport.stop_name}
                </div>
                <div className="text-sm text-green font-semibold">
                  Fee: ₹{transport.total_fee?.toLocaleString()}
                </div>
              </div>
            )}

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Select Bus
            </label>
            <select
              value={stopChangeBusId}
              onChange={handleStopChangeBusSelect}
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
            >
              <option value={0}>-- Select Bus --</option>
              {allBuses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.vehicle_name || bus.vehicle_number}{" "}
                  {bus.route ? `- ${bus.route}` : ""}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Select New Stop
            </label>
            <select
              value={requestForm.requested_stop_id}
              onChange={(e) =>
                setRequestForm({
                  ...requestForm,
                  requested_stop_id: parseInt(e.target.value),
                })
              }
              disabled={!stopChangeBusId}
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext disabled:opacity-50"
            >
              <option value={0}>
                {stopChangeBusId ? "-- Select Stop --" : "Select a bus first"}
              </option>
              {stopChangeStops.map((stop) => (
                <option
                  key={stop.stop_id || stop.id}
                  value={stop.stop_id || stop.id}
                >
                  {stop.stop_name} - ₹{stop.fee?.toLocaleString()}
                  {stop.arrival_time ? ` (Arrives ${stop.arrival_time})` : ""}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Reason for Change
            </label>
            <textarea
              value={requestForm.reason}
              onChange={(e) =>
                setRequestForm({...requestForm, reason: e.target.value})
              }
              placeholder="Please explain why you need to change your stop..."
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={closeRequestModal}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium disabled:opacity-50"
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
