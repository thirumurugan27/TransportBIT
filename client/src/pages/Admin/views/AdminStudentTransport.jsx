import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminStudentTransport() {
  const [activeTab, setActiveTab] = useState("transport-requests");
  const [students, setStudents] = useState([]);
  const [studentTransports, setStudentTransports] = useState([]);
  const [buses, setBuses] = useState([]);
  const [stops, setStops] = useState([]);
  const [transportFees, setTransportFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stopChangeRequests, setStopChangeRequests] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [busesWithStudents, setBusesWithStudents] = useState([]);
  const [selectedBusStudents, setSelectedBusStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTransportCount, setPendingTransportCount] = useState(0);

  // Modals
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showTransportProcessModal, setShowTransportProcessModal] = useState(false);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);

  // Forms
  const [studentForm, setStudentForm] = useState({
    username: "",
    password: "password",
    full_name: "",
    phone: "",
    email: "",
    department: "",
    year: 1,
    roll_number: "",
  });
  const [assignForm, setAssignForm] = useState({
    user_id: 0,
    bus_id: 0,
    stop_id: 0,
    academic_year: "2025-2026",
  });
  const [paymentForm, setPaymentForm] = useState({
    student_transport_id: 0,
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    transaction_id: "",
    receipt_number: "",
    remarks: "",
  });
  const [feeForm, setFeeForm] = useState({
    stop_id: 0,
    fee_amount: 0,
    academic_year: "2025-2026",
  });
  const [processForm, setProcessForm] = useState({
    request_id: 0,
    status: "",
    admin_remarks: "",
  });
  const [transportProcessForm, setTransportProcessForm] = useState({
    request_id: 0,
    status: "",
    admin_remarks: "",
  });

  const [selectedBusStops, setSelectedBusStops] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStudents(),
      fetchStudentTransports(),
      fetchBuses(),
      fetchStops(),
      fetchTransportFees(),
      fetchPayments(),
      fetchStopChangeRequests(),
      fetchPendingCount(),
      fetchTransportRequests(),
      fetchPendingTransportCount(),
      fetchBusesWithStudents(),
    ]);
    setLoading(false);
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStudents(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchStudentTransports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/student-transport`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStudentTransports(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchBuses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus-fleet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBuses(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchStops = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStops(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchTransportFees = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-fees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTransportFees(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPayments(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchStopChangeRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stop-change-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStopChangeRequests(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stop-change-requests/pending-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count || 0);
      }
    } catch (err) { console.error(err); }
  };

  const fetchTransportRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTransportRequests(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchPendingTransportCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-requests/pending-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingTransportCount(data.count || 0);
      }
    } catch (err) { console.error(err); }
  };

  const fetchBusesWithStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/buses/with-students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBusesWithStudents(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  const fetchStudentsByBus = async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/buses/${busId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSelectedBusStudents(await res.json() || []);
        setSelectedBusId(busId);
      }
    } catch (err) { console.error(err); }
  };

  const fetchBusStops = async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus/${busId}/stops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSelectedBusStops(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  // Handlers
  const handleAssign = async () => {
    if (!assignForm.user_id || !assignForm.bus_id || !assignForm.stop_id) {
      alert("Please fill all required fields");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/student-transport/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(assignForm),
      });
      if (res.ok) {
        alert("Student transport assigned successfully!");
        setShowAssignModal(false);
        setAssignForm({ user_id: 0, bus_id: 0, stop_id: 0, academic_year: "2025-2026" });
        fetchStudentTransports();
        fetchStudents();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign");
      }
    } catch (err) {
      alert("Error assigning transport");
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.student_transport_id || !paymentForm.amount) {
      alert("Please select student and enter amount");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-payments/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(paymentForm),
      });
      if (res.ok) {
        alert("Payment recorded successfully!");
        setShowPaymentModal(false);
        setPaymentForm({
          student_transport_id: 0,
          amount: 0,
          payment_date: new Date().toISOString().split("T")[0],
          payment_method: "cash",
          transaction_id: "",
          receipt_number: "",
          remarks: "",
        });
        fetchPayments();
        fetchStudentTransports();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record payment");
      }
    } catch (err) {
      alert("Error recording payment");
    }
  };

  const handleCreateFee = async () => {
    if (!feeForm.stop_id || !feeForm.fee_amount) {
      alert("Please select stop and enter fee amount");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-fees/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(feeForm),
      });
      if (res.ok) {
        alert("Transport fee created successfully!");
        setShowFeeModal(false);
        setFeeForm({ stop_id: 0, fee_amount: 0, academic_year: "2025-2026" });
        fetchTransportFees();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create fee");
      }
    } catch (err) {
      alert("Error creating fee");
    }
  };

  const handleProcessRequest = async (status) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stop-change-requests/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          request_id: processForm.request_id,
          status: status,
          admin_remarks: processForm.admin_remarks,
        }),
      });
      if (res.ok) {
        alert(`Request ${status} successfully!`);
        setShowProcessModal(false);
        setProcessForm({ request_id: 0, status: "", admin_remarks: "" });
        fetchStopChangeRequests();
        fetchStudentTransports();
        fetchPendingCount();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process request");
      }
    } catch (err) {
      alert("Error processing request");
    }
  };

  const handleProcessTransportRequest = async (status) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-requests/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          request_id: transportProcessForm.request_id,
          status: status,
          admin_remarks: transportProcessForm.admin_remarks,
        }),
      });
      if (res.ok) {
        alert(`Transport request ${status} successfully!`);
        setShowTransportProcessModal(false);
        setTransportProcessForm({ request_id: 0, status: "", admin_remarks: "" });
        fetchTransportRequests();
        fetchPendingTransportCount();
        fetchStudentTransports();
        fetchBusesWithStudents();
        if (selectedBusId) fetchStudentsByBus(selectedBusId);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process request");
      }
    } catch (err) {
      alert("Error processing transport request");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">🎓 Student Transport Management</h2>
        <p className="text-indigo-100">Manage student bus assignments, fees, and stop change requests</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto">
        {[
          { id: "transport-requests", label: `Bus Requests ${pendingTransportCount > 0 ? `(${pendingTransportCount})` : ""}`, icon: "📨" },
          { id: "students-by-bus", label: "Students by Bus", icon: "🚌" },
          { id: "assignments", label: "All Assignments", icon: "👥" },
          { id: "fees", label: "Transport Fees", icon: "💰" },
          { id: "payments", label: "Payments", icon: "💳" },
          { id: "requests", label: `Stop Requests ${pendingCount > 0 ? `(${pendingCount})` : ""}`, icon: "📝" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-b-2 border-indigo-500 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Transport Requests Tab - NEW STUDENT BUS REQUESTS */}
      {activeTab === "transport-requests" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📨 Student Bus Requests</h3>
          <p className="text-sm text-gray-500 mb-4">Students request a bus and stop. Approve to assign them to the bus.</p>
          
          {transportRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transport requests found</p>
          ) : (
            <div className="space-y-4">
              {transportRequests.map((req) => (
                <div key={req.id} className={`border rounded-lg p-4 ${req.status === "pending" ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-800 text-lg">{req.student_name}</div>
                      <div className="text-sm text-gray-500">{req.email}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {req.department && `${req.department} - `}
                        {req.year > 0 && `Year ${req.year} - `}
                        {req.roll_number && `Roll: ${req.roll_number}`}
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 mb-3 border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Requested Bus</div>
                        <div className="font-medium">{req.bus_name}</div>
                        <div className="text-xs text-gray-500">{req.route}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Requested Stop</div>
                        <div className="font-medium">{req.stop_name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Transport Fee</div>
                        <div className="font-bold text-indigo-600">₹{req.fee?.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Academic Year: {req.academic_year}
                    </div>
                  </div>
                  
                  {req.reason && (
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 mb-3">
                    Requested on: {new Date(req.created_at).toLocaleString()}
                  </div>
                  
                  {req.status === "pending" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTransportProcessForm({ request_id: req.id, status: "", admin_remarks: "" });
                          setShowTransportProcessModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => {
                          setTransportProcessForm({ request_id: req.id, status: "rejected", admin_remarks: "" });
                          setShowTransportProcessModal(true);
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                  
                  {req.admin_remarks && req.status !== "pending" && (
                    <div className="text-sm text-gray-600 mt-2">
                      <strong>Admin Remarks:</strong> {req.admin_remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Students by Bus Tab */}
      {activeTab === "students-by-bus" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bus List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚌 Select a Bus</h3>
            <div className="space-y-2">
              {busesWithStudents.map((bus) => (
                <button
                  key={bus.id}
                  onClick={() => fetchStudentsByBus(bus.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedBusId === bus.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">{bus.name}</div>
                  <div className="text-sm text-gray-500">{bus.route}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">Driver: {bus.driver_name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      bus.student_count > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {bus.student_count} students
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Students in Selected Bus */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              👥 Students {selectedBusId && `(${selectedBusStudents.length})`}
            </h3>
            
            {!selectedBusId ? (
              <p className="text-gray-500 text-center py-8">← Select a bus to view students</p>
            ) : selectedBusStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No students assigned to this bus</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedBusStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => {
                      setSelectedStudent(student);
                      setShowStudentDetailModal(true);
                    }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-800">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                        {student.stop_name}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {student.department && `${student.department}`}
                      {student.year > 0 && ` • Year ${student.year}`}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                      <span>Fee: ₹{student.total_fee?.toLocaleString()}</span>
                      <span className={student.paid_amount < student.total_fee ? "text-red-600" : "text-green-600"}>
                        Paid: ₹{student.paid_amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Assignments Tab */}
      {activeTab === "assignments" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Student Transport Assignments</h3>
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              + Assign Student
            </button>
          </div>
          {studentTransports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No student assignments found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bus</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Stop</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total Fee</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Paid</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Balance</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentTransports.map((st) => (
                    <tr key={st.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{st.student_name}</div>
                          <div className="text-sm text-gray-500">{st.student_email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{st.bus_name}</div>
                        <div className="text-sm text-gray-500">{st.bus_number}</div>
                      </td>
                      <td className="px-4 py-3">{st.stop_name}</td>
                      <td className="px-4 py-3">₹{st.total_fee?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600">₹{st.paid_amount?.toLocaleString()}</td>
                      <td className={`px-4 py-3 font-medium ${st.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{st.balance?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(st.status)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setPaymentForm({ ...paymentForm, student_transport_id: st.id });
                            setShowPaymentModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          💳 Add Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transport Fees Tab */}
      {activeTab === "fees" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Stop-wise Transport Fees</h3>
            <button
              onClick={() => setShowFeeModal(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              + Add Fee
            </button>
          </div>
          {transportFees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transport fees defined</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transportFees.map((fee) => (
                <div key={fee.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-800">{fee.stop_name}</h4>
                      <p className="text-sm text-gray-500">{fee.academic_year}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${fee.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {fee.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-bold text-indigo-600">
                    ₹{fee.fee_amount?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Payment Records</h3>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              + Record Payment
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No payment records found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Receipt #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">{p.payment_date}</td>
                      <td className="px-4 py-3 font-medium">{p.student_name}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">₹{p.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                      <td className="px-4 py-3">{p.receipt_number || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{p.recorded_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stop Change Requests Tab */}
      {activeTab === "requests" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Stop Change Requests</h3>
          {stopChangeRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No stop change requests found</p>
          ) : (
            <div className="space-y-4">
              {stopChangeRequests.map((req) => (
                <div key={req.id} className={`border rounded-lg p-4 ${req.status === "pending" ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-800">{req.student_name}</div>
                      <div className="text-sm text-gray-500">{req.student_email}</div>
                      <div className="text-sm text-gray-500 mt-1">Submitted: {req.created_at}</div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm text-gray-500">From</div>
                        <div className="font-medium">{req.current_stop_name}</div>
                        <div className="text-sm text-gray-600">₹{req.current_fee?.toLocaleString()}</div>
                      </div>
                      <div className="text-2xl">→</div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-500">To</div>
                        <div className="font-medium">{req.requested_stop_name}</div>
                        <div className="text-sm text-gray-600">₹{req.new_fee?.toLocaleString()}</div>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-sm text-gray-500">Fee Difference</div>
                        <div className={`font-bold ${req.fee_difference >= 0 ? "text-red-600" : "text-green-600"}`}>
                          {req.fee_difference >= 0 ? "+" : ""}₹{req.fee_difference?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {req.reason && (
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  )}
                  {req.status === "pending" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setProcessForm({ request_id: req.id, status: "", admin_remarks: "" });
                          setShowProcessModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => {
                          setProcessForm({ request_id: req.id, status: "rejected", admin_remarks: "" });
                          setShowProcessModal(true);
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                  {req.admin_remarks && req.status !== "pending" && (
                    <div className="text-sm text-gray-600 mt-2">
                      <strong>Admin Remarks:</strong> {req.admin_remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🎓 Assign Student to Bus</h3>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Student</label>
            <select
              value={assignForm.user_id}
              onChange={(e) => setAssignForm({ ...assignForm, user_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value={0}>-- Select Student --</option>
              {students.filter(s => !s.has_transport).map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name} ({s.email})
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Select Bus</label>
            <select
              value={assignForm.bus_id}
              onChange={(e) => {
                const busId = parseInt(e.target.value);
                setAssignForm({ ...assignForm, bus_id: busId, stop_id: 0 });
                if (busId > 0) fetchBusStops(busId);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value={0}>-- Select Bus --</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_name} - {b.vehicle_number} ({b.start_point} → {b.end_point})
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Select Stop</label>
            <select
              value={assignForm.stop_id}
              onChange={(e) => setAssignForm({ ...assignForm, stop_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              disabled={!assignForm.bus_id}
            >
              <option value={0}>-- Select Stop --</option>
              {selectedBusStops.map((s) => (
                <option key={s.stop_id} value={s.stop_id}>
                  {s.stop_name} (Arrival: {s.arrival_time})
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <select
              value={assignForm.academic_year}
              onChange={(e) => setAssignForm({ ...assignForm, academic_year: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="flex-1 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Assign Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">💳 Record Payment</h3>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Student</label>
            <select
              value={paymentForm.student_transport_id}
              onChange={(e) => setPaymentForm({ ...paymentForm, student_transport_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value={0}>-- Select Student --</option>
              {studentTransports.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.student_name} - Balance: ₹{st.balance?.toLocaleString()}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
            <input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              placeholder="Enter amount"
            />

            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            />

            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select
              value={paymentForm.payment_method}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Number (Optional)</label>
            <input
              type="text"
              value={paymentForm.receipt_number}
              onChange={(e) => setPaymentForm({ ...paymentForm, receipt_number: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              placeholder="Enter receipt number"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Fee Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">💰 Add Transport Fee</h3>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Stop</label>
            <select
              value={feeForm.stop_id}
              onChange={(e) => setFeeForm({ ...feeForm, stop_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value={0}>-- Select Stop --</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.stop_name}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Amount (₹)</label>
            <input
              type="number"
              value={feeForm.fee_amount}
              onChange={(e) => setFeeForm({ ...feeForm, fee_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              placeholder="Enter fee amount"
            />

            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <select
              value={feeForm.academic_year}
              onChange={(e) => setFeeForm({ ...feeForm, academic_year: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFeeModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFee}
                className="flex-1 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Create Fee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Request Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📝 Process Stop Change Request</h3>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Remarks (Optional)</label>
            <textarea
              value={processForm.admin_remarks}
              onChange={(e) => setProcessForm({ ...processForm, admin_remarks: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              rows={3}
              placeholder="Enter any remarks..."
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowProcessModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessRequest("rejected")}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleProcessRequest("approved")}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Transport Request Modal */}
      {showTransportProcessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📨 Process Transport Request</h3>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Remarks (Optional)</label>
            <textarea
              value={transportProcessForm.admin_remarks}
              onChange={(e) => setTransportProcessForm({ ...transportProcessForm, admin_remarks: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              rows={3}
              placeholder="Enter any remarks for the student..."
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowTransportProcessModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessTransportRequest("rejected")}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleProcessTransportRequest("approved")}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">👤 Student Details</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-800">{selectedStudent.name}</div>
                  <div className="text-gray-500">{selectedStudent.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <div className="text-sm text-gray-500">Department</div>
                  <div className="font-medium">{selectedStudent.department || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Year</div>
                  <div className="font-medium">{selectedStudent.year > 0 ? `Year ${selectedStudent.year}` : "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Roll Number</div>
                  <div className="font-medium">{selectedStudent.roll_number || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Academic Year</div>
                  <div className="font-medium">{selectedStudent.academic_year}</div>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="text-sm text-indigo-600 font-medium mb-2">🚌 Transport Details</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Stop</div>
                    <div className="font-medium">{selectedStudent.stop_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Stop Fee</div>
                    <div className="font-medium">₹{selectedStudent.stop_fee?.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-sm text-gray-500">Total Fee</div>
                  <div className="text-lg font-bold text-gray-800">₹{selectedStudent.total_fee?.toLocaleString()}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-sm text-gray-500">Paid</div>
                  <div className="text-lg font-bold text-green-600">₹{selectedStudent.paid_amount?.toLocaleString()}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "bg-red-50" : "bg-green-50"}`}>
                  <div className="text-sm text-gray-500">Balance</div>
                  <div className={`text-lg font-bold ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                    ₹{(selectedStudent.total_fee - selectedStudent.paid_amount)?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStudentDetailModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setPaymentForm({ ...paymentForm, student_transport_id: selectedStudent.id });
                  setShowStudentDetailModal(false);
                  setShowPaymentModal(true);
                }}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                💳 Add Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
