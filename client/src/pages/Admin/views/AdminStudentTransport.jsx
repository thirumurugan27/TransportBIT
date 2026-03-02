import React, {useState, useEffect} from "react";
import {useToast} from "../../../context/ToastContext";
import Loading from "../../../components/ui/Loading";
import {
  Users,
  Bus,
  MapPin,
  IndianRupee,
  CreditCard,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Plus,
  Search,
  Filter,
  Eye,
  TrendingUp,
  AlertCircle,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminStudentTransport() {
  const {showToast} = useToast();
  const [activeTab, setActiveTab] = useState("transport-requests");
  const [students, setStudents] = useState([]);
  const [studentTransports, setStudentTransports] = useState([]);
  const [buses, setBuses] = useState([]);
  const [stops, setStops] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stopChangeRequests, setStopChangeRequests] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [busesWithStudents, setBusesWithStudents] = useState([]);
  const [selectedBusStudents, setSelectedBusStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTransportCount, setPendingTransportCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [busReqSearch, setBusReqSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [stopReqSearch, setStopReqSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");

  // Modals
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showTransportProcessModal, setShowTransportProcessModal] =
    useState(false);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [feeSummary, setFeeSummary] = useState(null);
  const [feeSummaryLoading, setFeeSummaryLoading] = useState(false);

  // Fetch fee summary when student detail modal opens
  useEffect(() => {
    if (showStudentDetailModal && selectedStudent?.id) {
      setFeeSummaryLoading(true);
      fetch(
        `${API_BASE}/api/admin/student-transport/${selectedStudent.id}/fee-summary`,
        {
          headers: {Authorization: `Bearer ${localStorage.getItem("token")}`},
        },
      )
        .then((r) => r.json())
        .then((data) => {
          setFeeSummary(data);
          setFeeSummaryLoading(false);
        })
        .catch(() => setFeeSummaryLoading(false));
    } else {
      setFeeSummary(null);
    }
  }, [showStudentDetailModal, selectedStudent]);

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
  const [selectedStopFilter, setSelectedStopFilter] = useState("ALL");
  const [busStopSearch, setBusStopSearch] = useState("");
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
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setStudents((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentTransports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/student-transport`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setStudentTransports((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBuses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus-fleet`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setBuses((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStops = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stops`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setStops((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-payments`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setPayments((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStopChangeRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stop-change-requests`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setStopChangeRequests((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/stop-change-requests/pending-count`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransportRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/transport-requests`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setTransportRequests((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingTransportCount = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/transport-requests/pending-count`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      if (res.ok) {
        const data = await res.json();
        setPendingTransportCount(data.count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBusesWithStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/buses/with-students`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setBusesWithStudents((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentsByBus = async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/buses/${busId}/students`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) {
        setSelectedBusStudents((await res.json()) || []);
        setSelectedBusId(busId);
        setSelectedStopFilter("ALL");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBusStops = async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bus/${busId}/stops`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (res.ok) setSelectedBusStops((await res.json()) || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers
  const handleAssign = async () => {
    if (!assignForm.user_id || !assignForm.bus_id || !assignForm.stop_id) {
      showToast("Please fill all required fields", "warning");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/student-transport/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(assignForm),
        },
      );
      if (res.ok) {
        showToast("Student transport assigned successfully!", "success");
        setShowAssignModal(false);
        setAssignForm({
          user_id: 0,
          bus_id: 0,
          stop_id: 0,
          academic_year: "2025-2026",
        });
        fetchStudentTransports();
        fetchStudents();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to assign", "error");
      }
    } catch (err) {
      showToast("Error assigning transport", "error");
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.student_transport_id || !paymentForm.amount) {
      showToast("Please select student and enter amount", "warning");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/transport-payments/record`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(paymentForm),
        },
      );
      if (res.ok) {
        showToast("Payment recorded successfully!", "success");
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
        showToast(data.error || "Failed to record payment", "error");
      }
    } catch (err) {
      showToast("Error recording payment", "error");
    }
  };

  const handleProcessRequest = async (status) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/stop-change-requests/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            request_id: processForm.request_id,
            status: status,
            admin_remarks: processForm.admin_remarks,
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const msg = data.settlement
          ? `Request ${status} successfully!\n${data.settlement}\nBalance: ₹${data.balance?.toLocaleString()}`
          : `Request ${status} successfully!`;
        showToast(msg, "success");
        setShowProcessModal(false);
        setProcessForm({request_id: 0, status: "", admin_remarks: ""});
        fetchStopChangeRequests();
        fetchStudentTransports();
        fetchPendingCount();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to process request", "error");
      }
    } catch (err) {
      showToast("Error processing request", "error");
    }
  };

  const handleProcessTransportRequest = async (status) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/transport-requests/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            request_id: transportProcessForm.request_id,
            status: status,
            admin_remarks: transportProcessForm.admin_remarks,
          }),
        },
      );
      if (res.ok) {
        showToast(`Transport request ${status} successfully!`, "success");
        setShowTransportProcessModal(false);
        setTransportProcessForm({request_id: 0, status: "", admin_remarks: ""});
        fetchTransportRequests();
        fetchPendingTransportCount();
        fetchStudentTransports();
        fetchBusesWithStudents();
        if (selectedBusId) fetchStudentsByBus(selectedBusId);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to process request", "error");
      }
    } catch (err) {
      showToast("Error processing transport request", "error");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-pending/10 text-pending border border-pending/20",
      approved: "bg-green/10 text-green border border-green/20",
      rejected: "bg-red/10 text-red border border-red/20",
      active: "bg-green/10 text-green border border-green/20",
      inactive:
        "bg-secondarytext/10 text-secondarytext border border-secondarytext/20",
    };
    return (
      <span
        className={`px-3 py-1 rounded-md text-xs font-semibold ${styles[status] || "bg-secondarybg"}`}
      >
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  // Calculate stats
  const stats = [
    {
      label: "Total Students",
      value: studentTransports.length,
      icon: Users,
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Pending Requests",
      value: pendingTransportCount,
      icon: Clock,
      color: "bg-pending/10",
      iconColor: "text-pending",
    },
    {
      label: "Stop Changes",
      value: pendingCount,
      icon: MapPin,
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Total Revenue",
      value: `₹${payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}`,
      icon: TrendingUp,
      color: "bg-green/10",
      iconColor: "text-green",
    },
  ];

  const tabs = [
    {
      id: "transport-requests",
      label: "Bus Requests",
      icon: Send,
      badge: pendingTransportCount,
    },
    {id: "students-by-bus", label: "Students by Bus", icon: Bus},
    {id: "assignments", label: "All Assignments", icon: Users},
    {id: "payments", label: "Payments", icon: CreditCard},
    {
      id: "requests",
      label: "Stop Requests",
      icon: FileText,
      badge: pendingCount,
    },
  ];

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  return (
    <div className="space-y-6 p-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primarytext">
            Student Transport
          </h1>
          <p className="text-sm text-secondarytext mt-1">
            Manage bus assignments, payments and transport requests
          </p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Assign Student
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-secondarybg rounded-md p-6 border border-primarybg hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondarytext text-sm font-medium mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-primarytext">
                  {stat.value}
                </p>
              </div>
              <div className={`${stat.color} p-3 rounded-md`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-secondarybg rounded-md border border-primary/10 p-1.5 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  activeTab === tab.id
                    ? "bg-white/25 text-white"
                    : "bg-red text-white"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-secondarybg rounded-md border border-primarybg">
        <div className="p-6">
          {/* Transport Requests Tab */}
          {activeTab === "transport-requests" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-primarytext">
                    Student Bus Requests
                  </h3>
                  <p className="text-sm text-secondarytext mt-0.5">
                    {transportRequests.length} total requests
                  </p>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
                  <input
                    type="text"
                    value={busReqSearch}
                    onChange={(e) => setBusReqSearch(e.target.value)}
                    placeholder="Search by name, email, bus, stop..."
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-primarybg bg-primarybg text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {(() => {
                const q = busReqSearch.trim().toLowerCase();
                const filtered = q
                  ? transportRequests.filter(
                      (r) =>
                        (r.student_name || "").toLowerCase().includes(q) ||
                        (r.email || "").toLowerCase().includes(q) ||
                        (r.department || "").toLowerCase().includes(q) ||
                        (r.roll_number || "").toLowerCase().includes(q) ||
                        (r.vehicle_name || "").toLowerCase().includes(q) ||
                        (r.stop_name || "").toLowerCase().includes(q) ||
                        (r.route || "").toLowerCase().includes(q) ||
                        (r.status || "").toLowerCase().includes(q),
                    )
                  : transportRequests;

                return filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                    <p className="text-secondarytext">
                      No transport requests found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((req) => (
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
                            <h4 className="font-semibold text-primarytext text-lg">
                              {req.student_name}
                            </h4>
                            <p className="text-sm text-secondarytext">
                              {req.email}
                            </p>
                            <p className="text-sm text-secondarytext">
                              {req.department && `${req.department} `}
                              {req.year > 0 && `• Year ${req.year} `}
                              {req.roll_number && `• Roll: ${req.roll_number}`}
                            </p>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondarybg rounded-md p-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Bus className="w-4 h-4 text-primary" />
                              <span className="text-sm text-secondarytext">
                                Bus
                              </span>
                            </div>
                            <p className="font-medium text-primarytext">
                              {req.vehicle_name}
                            </p>
                            <p className="text-xs text-secondarytext">
                              {req.route}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-4 h-4 text-primary" />
                              <span className="text-sm text-secondarytext">
                                Stop
                              </span>
                            </div>
                            <p className="font-medium text-primarytext">
                              {req.stop_name}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IndianRupee className="w-4 h-4 text-green" />
                              <span className="text-sm text-secondarytext">
                                Fee
                              </span>
                            </div>
                            <p className="font-bold text-green text-lg">
                              ₹{req.fee?.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {req.reason && (
                          <div className="bg-secondarybg rounded-md p-3 mb-3">
                            <p className="text-sm text-secondarytext">
                              <span className="font-semibold text-primarytext">
                                Reason:
                              </span>{" "}
                              {req.reason}
                            </p>
                          </div>
                        )}

                        <p className="text-xs text-secondarytext mb-3">
                          Requested: {req.created_at || "-"}
                        </p>

                        {req.status === "pending" && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setTransportProcessForm({
                                  request_id: req.id,
                                  status: "",
                                  admin_remarks: "",
                                });
                                setShowTransportProcessModal(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setTransportProcessForm({
                                  request_id: req.id,
                                  status: "rejected",
                                  admin_remarks: "",
                                });
                                setShowTransportProcessModal(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red text-white rounded-md hover:opacity-90 transition-opacity font-medium"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        )}

                        {req.admin_remarks && req.status !== "pending" && (
                          <div className="mt-3 text-sm text-secondarytext">
                            <span className="font-semibold text-primarytext">
                              Admin Remarks:
                            </span>{" "}
                            {req.admin_remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Students by Bus Tab */}
          {activeTab === "students-by-bus" &&
            (() => {
              // Compute student counts per stop from loaded students
              const stopStudentCounts = selectedBusStudents.reduce((acc, s) => {
                const name = s.stop_name || "Unassigned";
                if (!acc[name]) acc[name] = 0;
                acc[name]++;
                return acc;
              }, {});
              // Get all configured stops for selected bus from API data
              const selectedBusData = busesWithStudents.find(
                (b) => b.id === selectedBusId,
              );
              const allBusStopNames = selectedBusData?.stop_names || [];
              // Merge: include all configured stops + any "Unassigned" from students
              const allStopNames = [
                ...new Set([
                  ...allBusStopNames,
                  ...Object.keys(stopStudentCounts),
                ]),
              ].sort();
              const filteredStudents =
                selectedStopFilter === "ALL"
                  ? selectedBusStudents
                  : selectedBusStudents.filter(
                      (s) =>
                        (s.stop_name || "Unassigned") === selectedStopFilter,
                    );

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Bus List */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-primarytext mb-2">
                      Select Bus
                    </h3>
                    {/* Stop Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
                      <input
                        type="text"
                        value={busStopSearch}
                        onChange={(e) => setBusStopSearch(e.target.value)}
                        placeholder="Search by stop name..."
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-primarybg bg-primarybg text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {(() => {
                      const q = busStopSearch.trim().toLowerCase();
                      const filteredBuses = q
                        ? busesWithStudents.filter(
                            (bus) =>
                              (bus.stop_names || []).some((s) =>
                                s.toLowerCase().includes(q),
                              ) ||
                              bus.name.toLowerCase().includes(q) ||
                              (bus.route || "").toLowerCase().includes(q),
                          )
                        : busesWithStudents;
                      return filteredBuses.length === 0 ? (
                        <div className="text-center py-8 bg-primarybg rounded-md">
                          <MapPin className="w-8 h-8 text-secondarytext mx-auto mb-2" />
                          <p className="text-sm text-secondarytext">
                            No buses found for "{busStopSearch}"
                          </p>
                        </div>
                      ) : (
                        filteredBuses.map((bus) => (
                          <button
                            key={bus.id}
                            onClick={() => fetchStudentsByBus(bus.id)}
                            className={`w-full text-left p-4 rounded-md border transition-all ${
                              selectedBusId === bus.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-primarybg bg-primarybg hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="bg-primary/10 p-2 rounded-md">
                                <Bus className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-primarytext">
                                  {bus.name}
                                </p>
                                <p className="text-sm text-secondarytext">
                                  {bus.route}
                                </p>
                                {(bus.stop_names || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {bus.stop_names.map((s, i) => (
                                      <span
                                        key={i}
                                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          busStopSearch.trim() &&
                                          s
                                            .toLowerCase()
                                            .includes(
                                              busStopSearch
                                                .trim()
                                                .toLowerCase(),
                                            )
                                            ? "bg-primary/15 text-primary"
                                            : "bg-secondarytext/8 text-secondarytext"
                                        }`}
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-secondarytext">
                                    Driver: {bus.driver_name}
                                  </span>
                                  <span
                                    className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                      bus.student_count > 0
                                        ? "bg-green/10 text-green"
                                        : "bg-secondarytext/10 text-secondarytext"
                                    }`}
                                  >
                                    {bus.student_count} students
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      );
                    })()}
                  </div>

                  {/* Students List */}
                  <div className="lg:col-span-2">
                    {!selectedBusId ? (
                      <div className="text-center py-12 bg-primarybg rounded-md">
                        <Users className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                        <p className="text-secondarytext">
                          Select a bus to view students
                        </p>
                      </div>
                    ) : selectedBusStudents.length === 0 ? (
                      <div className="text-center py-12 bg-primarybg rounded-md">
                        <AlertCircle className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                        <p className="text-secondarytext">
                          No students assigned to this bus
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary Bar */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm font-semibold">
                            <Users className="w-4 h-4" />
                            {selectedBusStudents.length} Total Students
                          </div>
                          <div className="flex items-center gap-2 bg-pending/10 text-pending px-3 py-1.5 rounded-md text-sm font-semibold">
                            <MapPin className="w-4 h-4" />
                            {allStopNames.length} Stops
                          </div>
                        </div>

                        {/* Stop Filter Pills */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedStopFilter("ALL")}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                              selectedStopFilter === "ALL"
                                ? "bg-primary text-white"
                                : "bg-primarybg text-secondarytext hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            All ({selectedBusStudents.length})
                          </button>
                          {allStopNames.map((stop) => (
                            <button
                              key={stop}
                              onClick={() => setSelectedStopFilter(stop)}
                              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1.5 ${
                                selectedStopFilter === stop
                                  ? "bg-primary text-white"
                                  : "bg-primarybg text-secondarytext hover:bg-primary/10 hover:text-primary"
                              }`}
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              {stop} ({stopStudentCounts[stop] || 0})
                            </button>
                          ))}
                        </div>

                        {/* Students */}
                        <div className="grid grid-cols-1 gap-3">
                          {filteredStudents.map((student) => (
                            <div
                              key={student.id}
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowStudentDetailModal(true);
                              }}
                              className="p-4 bg-primarybg rounded-md border border-primarybg hover:border-primary/30 hover:shadow-md cursor-pointer transition-all"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-primarytext">
                                    {student.name}
                                  </h4>
                                  <p className="text-sm text-secondarytext">
                                    {student.email}
                                  </p>
                                  <p className="text-sm text-secondarytext mt-1">
                                    {student.department &&
                                      `${student.department}`}
                                    {student.year > 0 &&
                                      ` • Year ${student.year}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-primary" />
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
                                    {student.stop_name}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-between text-sm">
                                <span className="text-secondarytext">
                                  Fee: ₹{student.total_fee?.toLocaleString()}
                                </span>
                                <span
                                  className={
                                    student.paid_amount < student.total_fee
                                      ? "text-red font-semibold"
                                      : "text-green font-semibold"
                                  }
                                >
                                  Paid: ₹{student.paid_amount?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Assignments Tab */}
          {activeTab === "assignments" &&
            (() => {
              const q = assignmentSearch.trim().toLowerCase();
              const filteredTransports = q
                ? studentTransports.filter(
                    (st) =>
                      (st.student_name || "").toLowerCase().includes(q) ||
                      (st.student_email || "").toLowerCase().includes(q) ||
                      (st.vehicle_name || "").toLowerCase().includes(q) ||
                      (st.bus_number || "").toLowerCase().includes(q) ||
                      (st.stop_name || "").toLowerCase().includes(q) ||
                      (st.status || "").toLowerCase().includes(q),
                  )
                : studentTransports;
              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="text-lg font-semibold text-primarytext">
                        Student Transport Assignments
                      </h3>
                      <p className="text-sm text-secondarytext mt-0.5">
                        {studentTransports.length} total assignments
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
                        <input
                          type="text"
                          value={assignmentSearch}
                          onChange={(e) => setAssignmentSearch(e.target.value)}
                          placeholder="Search students, bus, stop..."
                          className="w-full pl-9 pr-3 py-2 rounded-md border border-primarybg bg-primarybg text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        Assign Student
                      </button>
                    </div>
                  </div>

                  {filteredTransports.length === 0 ? (
                    <div className="text-center py-12 bg-primarybg rounded-md">
                      <Users className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                      <p className="text-secondarytext">
                        {q
                          ? `No assignments matching "${q}"`
                          : "No assignments found"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-primarybg rounded-md border border-primarybg/50">
                      <table className="w-full">
                        <thead className="bg-primarybg/50 border-b border-primarybg">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Student
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Bus
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Stop
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Total Fee
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Paid
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Balance
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primarybg">
                          {filteredTransports.map((st) => (
                            <tr
                              key={st.id}
                              onClick={() => {
                                setSelectedStudent({
                                  id: st.id,
                                  name: st.student_name,
                                  email: st.student_email,
                                  department: st.department || "",
                                  year: st.year || 0,
                                  roll_number: st.roll_number || "",
                                  stop_name: st.stop_name,
                                  stop_fee: st.total_fee,
                                  total_fee: st.total_fee,
                                  paid_amount: st.paid_amount,
                                  academic_year: st.academic_year,
                                });
                                setShowStudentDetailModal(true);
                              }}
                              className="hover:bg-secondarybg transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-medium text-primarytext">
                                    {st.student_name}
                                  </div>
                                  <div className="text-xs text-secondarytext">
                                    {st.student_email}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-primarytext">
                                  {st.vehicle_name}
                                </div>
                                <div className="text-xs text-secondarytext">
                                  {st.bus_number}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-primarytext">
                                {st.stop_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-primarytext font-medium">
                                ₹{st.total_fee?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-green font-semibold">
                                ₹{st.paid_amount?.toLocaleString()}
                              </td>
                              <td
                                className={`px-4 py-3 text-sm font-semibold ${st.balance > 0 ? "text-red" : "text-green"}`}
                              >
                                ₹{st.balance?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                {getStatusBadge(st.status)}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPaymentForm({
                                      ...paymentForm,
                                      student_transport_id: st.id,
                                    });
                                    setShowPaymentModal(true);
                                  }}
                                  className="flex items-center gap-1 text-primary hover:text-primarydull text-sm font-medium"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  Add Payment
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Payments Tab */}
          {activeTab === "payments" &&
            (() => {
              const q = paymentSearch.trim().toLowerCase();
              const filteredPayments = q
                ? payments.filter(
                    (p) =>
                      (p.student_name || "").toLowerCase().includes(q) ||
                      (p.payment_method || "").toLowerCase().includes(q) ||
                      (p.receipt_number || "").toLowerCase().includes(q) ||
                      (p.recorded_by_name || "").toLowerCase().includes(q) ||
                      (p.payment_date || "").toLowerCase().includes(q) ||
                      String(p.amount || "").includes(q),
                  )
                : payments;
              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="text-lg font-semibold text-primarytext">
                        Payment Records
                      </h3>
                      <p className="text-sm text-secondarytext mt-0.5">
                        {payments.length} total transactions
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
                        <input
                          type="text"
                          value={paymentSearch}
                          onChange={(e) => setPaymentSearch(e.target.value)}
                          placeholder="Search payments..."
                          className="w-full pl-9 pr-3 py-2 rounded-md border border-primarybg bg-primarybg text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Record Payment
                      </button>
                    </div>
                  </div>

                  {filteredPayments.length === 0 ? (
                    <div className="text-center py-12 bg-primarybg rounded-md">
                      <CreditCard className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                      <p className="text-secondarytext">
                        No payment records found
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-primarybg rounded-md border border-primarybg/50">
                      <table className="w-full">
                        <thead className="bg-primarybg/50 border-b border-primarybg">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Student
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Method
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Receipt #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                              Recorded By
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primarybg">
                          {filteredPayments.map((p) => (
                            <tr
                              key={p.id}
                              className="hover:bg-secondarybg transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-secondarytext">
                                {p.payment_date}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-primarytext">
                                {p.student_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-green font-semibold">
                                ₹{p.amount?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-primarytext capitalize">
                                {p.payment_method}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondarytext">
                                {p.receipt_number || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondarytext">
                                {p.recorded_by_name}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Stop Change Requests Tab */}
          {activeTab === "requests" &&
            (() => {
              const q = stopReqSearch.trim().toLowerCase();
              const filteredStopReqs = q
                ? stopChangeRequests.filter(
                    (r) =>
                      (r.student_name || "").toLowerCase().includes(q) ||
                      (r.student_email || "").toLowerCase().includes(q) ||
                      (r.current_stop_name || "").toLowerCase().includes(q) ||
                      (r.requested_stop_name || "").toLowerCase().includes(q) ||
                      (r.reason || "").toLowerCase().includes(q) ||
                      (r.status || "").toLowerCase().includes(q),
                  )
                : stopChangeRequests;
              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="text-lg font-semibold text-primarytext">
                        Stop Change Requests
                      </h3>
                      <p className="text-sm text-secondarytext mt-0.5">
                        {stopChangeRequests.length} total requests
                      </p>
                    </div>
                    <div className="relative w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondarytext" />
                      <input
                        type="text"
                        value={stopReqSearch}
                        onChange={(e) => setStopReqSearch(e.target.value)}
                        placeholder="Search by name, email, stop..."
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-primarybg bg-primarybg text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {filteredStopReqs.length === 0 ? (
                    <div className="text-center py-12 bg-primarybg rounded-md">
                      <FileText className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                      <p className="text-secondarytext">
                        No stop change requests found
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredStopReqs.map((req) => (
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
                              <h4 className="font-semibold text-primarytext">
                                {req.student_name}
                              </h4>
                              <p className="text-sm text-secondarytext">
                                {req.student_email}
                              </p>
                              <p className="text-xs text-secondarytext mt-1">
                                Submitted: {req.created_at}
                              </p>
                            </div>
                            {getStatusBadge(req.status)}
                          </div>

                          <div className="flex items-center gap-4 bg-secondarybg rounded-md p-4 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-secondarytext" />
                                <span className="text-sm text-secondarytext">
                                  From
                                </span>
                              </div>
                              <p className="font-medium text-primarytext">
                                {req.current_stop_name}
                              </p>
                              <p className="text-sm text-green font-semibold">
                                ₹{req.current_fee?.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-2xl text-primary">→</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-primary" />
                                <span className="text-sm text-secondarytext">
                                  To
                                </span>
                              </div>
                              <p className="font-medium text-primarytext">
                                {req.requested_stop_name}
                              </p>
                              <p className="text-sm text-green font-semibold">
                                ₹{req.new_fee?.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex-1 text-right">
                              <div className="text-sm text-secondarytext mb-1">
                                Difference
                              </div>
                              <div
                                className={`font-bold text-lg ${req.fee_difference >= 0 ? "text-red" : "text-green"}`}
                              >
                                {req.fee_difference >= 0 ? "+" : ""}₹
                                {req.fee_difference?.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {req.reason && (
                            <div className="bg-secondarybg rounded-md p-3 mb-3">
                              <p className="text-sm text-secondarytext">
                                <span className="font-semibold text-primarytext">
                                  Reason:
                                </span>{" "}
                                {req.reason}
                              </p>
                            </div>
                          )}

                          {req.status === "pending" && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  setProcessForm({
                                    request_id: req.id,
                                    status: "",
                                    admin_remarks: "",
                                  });
                                  setShowProcessModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setProcessForm({
                                    request_id: req.id,
                                    status: "rejected",
                                    admin_remarks: "",
                                  });
                                  setShowProcessModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red text-white rounded-md hover:opacity-90 transition-opacity font-medium"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          )}

                          {req.admin_remarks && req.status !== "pending" && (
                            <div className="mt-3 text-sm text-secondarytext">
                              <span className="font-semibold text-primarytext">
                                Admin Remarks:
                              </span>{" "}
                              {req.admin_remarks}
                            </div>
                          )}

                          {req.status === "approved" && (
                            <div className="mt-3 p-3 bg-green/5 border border-green/20 rounded-md">
                              <p className="text-sm font-semibold text-primarytext mb-1">
                                Fee Settlement
                              </p>
                              {req.fee_difference > 0 ? (
                                <p className="text-sm text-red font-medium">
                                  Student needs to pay additional ₹
                                  {Math.abs(
                                    req.fee_difference,
                                  )?.toLocaleString()}
                                </p>
                              ) : req.fee_difference < 0 ? (
                                <p className="text-sm text-green font-medium">
                                  Student is eligible for refund of ₹
                                  {Math.abs(
                                    req.fee_difference,
                                  )?.toLocaleString()}
                                </p>
                              ) : (
                                <p className="text-sm text-secondarytext font-medium">
                                  No fee change
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Modals */}
      {/* I'll add the modal updates in the next part to keep things organized */}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full border border-primarybg animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primarytext">
                  Assign Student to Bus
                </h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-primarybg rounded-md text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                  Select Student
                </label>
                <select
                  value={assignForm.user_id}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      user_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                >
                  <option value={0}>-- Select Student --</option>
                  {students
                    .filter((s) => !s.has_transport)
                    .map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.full_name} ({s.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                  Select Bus
                </label>
                <select
                  value={assignForm.bus_id}
                  onChange={(e) => {
                    const busId = parseInt(e.target.value);
                    setAssignForm({...assignForm, bus_id: busId, stop_id: 0});
                    if (busId > 0) fetchBusStops(busId);
                  }}
                  className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                >
                  <option value={0}>-- Select Bus --</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.vehicle_name} - {b.vehicle_number} ({b.start_point} →{" "}
                      {b.end_point})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                  Select Stop
                </label>
                <select
                  value={assignForm.stop_id}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      stop_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm disabled:opacity-50"
                  disabled={!assignForm.bus_id}
                >
                  <option value={0}>-- Select Stop --</option>
                  {selectedBusStops.map((s) => (
                    <option key={s.stop_id} value={s.stop_id}>
                      {s.stop_name} (Arrival: {s.arrival_time || "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                  Academic Year
                </label>
                <select
                  value={assignForm.academic_year}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      academic_year: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                >
                  <option value="2025-2026">2025-2026</option>
                  <option value="2024-2025">2024-2025</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="flex-1 py-3 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
              >
                Assign Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full border border-primarybg animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-green/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green" />
                </div>
                <h3 className="text-xl font-bold text-primarytext">
                  Record Payment
                </h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-primarybg rounded-md text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                  Select Student
                </label>
                <select
                  value={paymentForm.student_transport_id}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      student_transport_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                >
                  <option value={0}>-- Select Student --</option>
                  {studentTransports.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.student_name} - Balance: ₹
                      {st.balance?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    value={paymentForm.receipt_number}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        receipt_number: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="flex-1 py-3 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Request Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full border border-primarybg animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-pending/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-pending" />
                </div>
                <h3 className="text-xl font-bold text-primarytext">
                  Process Stop Change Request
                </h3>
              </div>
              <button
                onClick={() => setShowProcessModal(false)}
                className="p-2 hover:bg-primarybg rounded-md text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                Admin Remarks{" "}
                <span className="normal-case font-normal">(Optional)</span>
              </label>
              <textarea
                value={processForm.admin_remarks}
                onChange={(e) =>
                  setProcessForm({
                    ...processForm,
                    admin_remarks: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                rows={3}
                placeholder="Enter any remarks..."
              />
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowProcessModal(false)}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessRequest("rejected")}
                className="flex-1 py-3 bg-red text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Reject
              </button>
              <button
                onClick={() => handleProcessRequest("approved")}
                className="flex-1 py-3 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Transport Request Modal */}
      {showTransportProcessModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full border border-primarybg animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-primarybg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-pending/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-pending" />
                </div>
                <h3 className="text-xl font-bold text-primarytext">
                  Process Transport Request
                </h3>
              </div>
              <button
                onClick={() => setShowTransportProcessModal(false)}
                className="p-2 hover:bg-primarybg rounded-md text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-xs font-semibold text-secondarytext uppercase tracking-wider mb-1.5">
                Admin Remarks{" "}
                <span className="normal-case font-normal">(Optional)</span>
              </label>
              <textarea
                value={transportProcessForm.admin_remarks}
                onChange={(e) =>
                  setTransportProcessForm({
                    ...transportProcessForm,
                    admin_remarks: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-primarybg text-primarytext text-sm"
                rows={3}
                placeholder="Enter any remarks for the student..."
              />
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowTransportProcessModal(false)}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessTransportRequest("rejected")}
                className="flex-1 py-3 bg-red text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Reject
              </button>
              <button
                onClick={() => handleProcessTransportRequest("approved")}
                className="flex-1 py-3 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full border border-primarybg animate-scaleIn max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-primarybg shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primarytext leading-tight">
                    {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-secondarytext">
                    {selectedStudent.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStudentDetailModal(false)}
                className="p-2 hover:bg-primarybg rounded-md text-secondarytext hover:text-primarytext transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Academic Info */}
              <div className="bg-primarybg rounded-md p-4">
                <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-3">
                  Academic Information
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Department
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      {selectedStudent.department || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Year
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      {selectedStudent.year > 0
                        ? `Year ${selectedStudent.year}`
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Roll Number
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      {selectedStudent.roll_number || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Academic Year
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      {selectedStudent.academic_year}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transport Details */}
              <div className="bg-primary/5 rounded-md p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Bus className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">
                    Transport Details
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Stop
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      {selectedStudent.stop_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-secondarytext mb-0.5">
                      Stop Fee
                    </div>
                    <div className="text-sm font-medium text-primarytext">
                      ₹{selectedStudent.stop_fee?.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primarybg rounded-md p-3 text-center">
                  <div className="text-xs text-secondarytext mb-1">
                    Total Fee
                  </div>
                  <div className="text-base font-bold text-primarytext">
                    ₹{selectedStudent.total_fee?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green/10 rounded-md p-3 text-center border border-green/20">
                  <div className="text-xs text-secondarytext mb-1">Paid</div>
                  <div className="text-base font-bold text-green">
                    ₹{selectedStudent.paid_amount?.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`rounded-md p-3 text-center ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "bg-red/10 border border-red/20" : "bg-green/10 border border-green/20"}`}
                >
                  <div className="text-xs text-secondarytext mb-1">Balance</div>
                  <div
                    className={`text-base font-bold ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "text-red" : "text-green"}`}
                  >
                    ₹
                    {(
                      selectedStudent.total_fee - selectedStudent.paid_amount
                    )?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Fee Breakdown & Stop Change History */}
              {feeSummaryLoading ? (
                <div className="text-center text-secondarytext py-4 text-sm">
                  Loading fee history...
                </div>
              ) : (
                feeSummary?.stop_changes?.length > 0 && (
                  <div className="bg-pending/5 rounded-md p-4 border border-pending/20">
                    <div className="flex items-center gap-2 text-pending font-semibold mb-3">
                      <TrendingUp className="w-4 h-4" />
                      Fee History (Stop Changes)
                    </div>
                    <div className="space-y-3">
                      {feeSummary.stop_changes.map((ch, idx) => (
                        <div
                          key={idx}
                          className="bg-secondarybg rounded-md p-3 border border-primarybg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3.5 h-3.5 text-secondarytext" />
                              <span className="text-secondarytext">
                                {ch.from_stop}
                              </span>
                              <span className="text-secondarytext">→</span>
                              <span className="font-medium text-primarytext">
                                {ch.to_stop}
                              </span>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                                ch.status === "approved"
                                  ? "bg-green/10 text-green"
                                  : ch.status === "rejected"
                                    ? "bg-red/10 text-red"
                                    : "bg-pending/10 text-pending"
                              }`}
                            >
                              {ch.status?.toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-secondarytext">
                                Old Fee:{" "}
                              </span>
                              <span className="font-medium text-primarytext">
                                ₹{ch.old_fee?.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-secondarytext">
                                New Fee:{" "}
                              </span>
                              <span className="font-medium text-primarytext">
                                ₹{ch.new_fee?.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-secondarytext">Diff: </span>
                              <span
                                className={`font-bold ${ch.difference > 0 ? "text-red" : ch.difference < 0 ? "text-green" : "text-primarytext"}`}
                              >
                                {ch.difference > 0 ? "+" : ""}₹
                                {ch.difference?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-secondarytext mt-2">
                            {ch.requested_at}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary note */}
                    {(() => {
                      const approvedChanges = feeSummary.stop_changes.filter(
                        (c) => c.status === "approved",
                      );
                      if (approvedChanges.length === 0) return null;
                      const totalAdjustment = approvedChanges.reduce(
                        (sum, c) => sum + c.difference,
                        0,
                      );
                      const balance =
                        selectedStudent.total_fee - selectedStudent.paid_amount;
                      return (
                        <div
                          className={`mt-3 p-3 rounded-md text-sm ${
                            balance > 0
                              ? "bg-red/10 border border-red/20"
                              : "bg-green/10 border border-green/20"
                          }`}
                        >
                          <div className="font-semibold text-primarytext mb-1">
                            Fee Summary
                          </div>
                          <div className="text-secondarytext">
                            Current stop fee:{" "}
                            <span className="font-medium text-primarytext">
                              ₹{selectedStudent.stop_fee?.toLocaleString()}
                            </span>
                          </div>
                          {totalAdjustment !== 0 && (
                            <div className="text-secondarytext">
                              Fee adjustment from stop changes:{" "}
                              <span
                                className={`font-medium ${totalAdjustment > 0 ? "text-red" : "text-green"}`}
                              >
                                {totalAdjustment > 0 ? "+" : ""}₹
                                {totalAdjustment?.toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="text-secondarytext">
                            Total paid:{" "}
                            <span className="font-medium text-green">
                              ₹{selectedStudent.paid_amount?.toLocaleString()}
                            </span>
                          </div>
                          {balance > 0 ? (
                            <div className="font-semibold text-red mt-1">
                              Outstanding balance: ₹{balance.toLocaleString()}{" "}
                              still needs to be paid
                            </div>
                          ) : balance < 0 ? (
                            <div className="font-semibold text-green mt-1">
                              Overpaid by ₹{Math.abs(balance).toLocaleString()}{" "}
                              — eligible for refund
                            </div>
                          ) : (
                            <div className="font-semibold text-green mt-1">
                              All fees are fully paid ✓
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-primarybg shrink-0">
              <button
                onClick={() => setShowStudentDetailModal(false)}
                className="flex-1 py-3 bg-primarybg text-primarytext rounded-md hover:bg-scroll transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setPaymentForm({
                    ...paymentForm,
                    student_transport_id: selectedStudent.id,
                  });
                  setShowStudentDetailModal(false);
                  setShowPaymentModal(true);
                }}
                className="flex-1 py-3 bg-green text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
