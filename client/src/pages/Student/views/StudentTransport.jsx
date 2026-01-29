import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {useToast} from "../../../context/ToastContext";
import {showConfirm} from "../../../utils/swal";

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
        // 404 = not assigned, 401 = token issue but treat as not assigned for UX
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
        // If there's an approved request and no transport yet, re-fetch transport
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
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || "bg-gray-100"}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show request UI if not assigned or transport is null
  if (error === "not_assigned" || !transport) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primarydull rounded-xl p-6 text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-1">Request Bus Transport</h2>
          <p className="text-white/80">
            You are not assigned to a bus yet. Request a bus and stop to get
            started!
          </p>
        </div>

        {/* Request Transport Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            No Bus Assigned Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Request a bus route and stop. Once approved by the admin, you will
            be assigned to the bus.
          </p>
          <button
            onClick={handleOpenTransportRequestModal}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors font-medium text-lg"
          >
            Request Bus Transport
          </button>
        </div>

        {/* My Transport Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            My Transport Requests
          </h3>
          {transportRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No transport requests yet. Submit a request above!
            </p>
          ) : (
            <div className="space-y-4">
              {transportRequests.map((req) => (
                <div
                  key={req.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-800">
                        {req.bus_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Stop: {req.stop_name}
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Academic Year:</span>
                      <span className="ml-2 font-medium">
                        {req.academic_year}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fee:</span>
                      <span className="ml-2 font-medium">
                        ₹{req.fee?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {req.reason && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  )}
                  {req.admin_remarks && req.status !== "pending" && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Admin Remarks:</strong> {req.admin_remarks}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-400">
                    Requested on: {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transport Request Modal */}
        {showTransportRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Request Bus Transport
              </h3>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bus Route
              </label>
              <select
                value={transportRequestForm.bus_id}
                onChange={handleBusChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
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

              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
              />

              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
                rows={2}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransportRequestModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTransportRequest}
                  disabled={submitting}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors font-medium disabled:opacity-50"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primarydull rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">My Transport</h2>
        <p className="text-white/80">
          View your bus details, fees, and manage stop change requests
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        {[
          {id: "details", label: "Transport Details"},
          {id: "fees", label: "Fee & Payments"},
          {id: "requests", label: "Stop Change Requests"},
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transport Details Tab */}
      {activeTab === "details" && transport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bus Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Bus Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Bus Name</span>
                <span className="font-medium text-gray-800">
                  {transport.bus_name}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Bus Number</span>
                <span className="font-medium text-gray-800">
                  {transport.bus_number}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Route</span>
                <span className="font-medium text-gray-800">
                  {transport.route_start} → {transport.route_end}
                </span>
              </div>
            </div>
          </div>

          {/* Stop Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              My Stop
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Stop Name</span>
                <span className="font-medium text-gray-800">
                  {transport.stop_name}
                </span>
              </div>
              {transport.stop_location && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-gray-800">
                    {transport.stop_location}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Arrival Time</span>
                <span className="font-medium text-gray-800">
                  {transport.arrival_time || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Departure Time</span>
                <span className="font-medium text-gray-800">
                  {transport.departure_time || "N/A"}
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenRequestModal}
              className="mt-4 w-full py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors font-medium"
            >
              Request Stop Change
            </button>
          </div>
        </div>
      )}

      {/* Fee & Payments Tab */}
      {activeTab === "fees" && transport && (
        <div className="space-y-6">
          {/* Fee Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
              <div className="text-sm text-gray-500 mb-1">Total Fee</div>
              <div className="text-2xl font-bold text-gray-800">
                ₹{transport.total_fee?.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
              <div className="text-sm text-gray-500 mb-1">Paid Amount</div>
              <div className="text-2xl font-bold text-green-600">
                ₹{transport.paid_amount?.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
              <div className="text-sm text-gray-500 mb-1">Balance Due</div>
              <div
                className={`text-2xl font-bold ${transport.balance > 0 ? "text-red-600" : "text-green-600"}`}
              >
                ₹{transport.balance?.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Payment History
            </h3>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No payment records found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Receipt #
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">{p.payment_date}</td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          ₹{p.amount?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {p.payment_method}
                        </td>
                        <td className="px-4 py-3">{p.receipt_number || "-"}</td>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              My Stop Change Requests
            </h3>
            <button
              onClick={handleOpenRequestModal}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors font-medium"
            >
              + New Request
            </button>
          </div>
          {stopRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No stop change requests found
            </p>
          ) : (
            <div className="space-y-4">
              {stopRequests.map((req) => (
                <div
                  key={req.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-800">
                        {req.current_stop_name} → {req.requested_stop_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {req.created_at}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleCancelStopRequest(req.id)}
                          disabled={cancellingRequestId === req.id}
                          className="px-3 py-1 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {cancellingRequestId === req.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Current Fee:</span>
                      <span className="ml-2 font-medium">
                        ₹{req.current_fee?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">New Fee:</span>
                      <span className="ml-2 font-medium">
                        ₹{req.new_fee?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Difference:</span>
                      <span
                        className={`ml-2 font-medium ${req.fee_difference >= 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {req.fee_difference >= 0 ? "+" : ""}₹
                        {req.fee_difference?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {req.reason && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  )}
                  {req.admin_remarks && req.status !== "pending" && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Admin Remarks:</strong> {req.admin_remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stop Change Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Request Stop Change
            </h3>

            {transport && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm text-gray-500">Current Stop</div>
                <div className="font-medium">{transport.stop_name}</div>
                <div className="text-sm text-gray-500">
                  Fee: ₹{transport.total_fee?.toLocaleString()}
                </div>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Bus
            </label>
            <select
              value={stopChangeBusId}
              onChange={handleStopChangeBusSelect}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
            >
              <option value={0}>-- Select Bus --</option>
              {allBuses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.name || bus.bus_name} {bus.route ? `- ${bus.route}` : ""}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 disabled:bg-gray-50"
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

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Change
            </label>
            <textarea
              value={requestForm.reason}
              onChange={(e) =>
                setRequestForm({...requestForm, reason: e.target.value})
              }
              placeholder="Please explain why you need to change your stop..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={closeRequestModal}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primarydull transition-colors font-medium disabled:opacity-50"
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
