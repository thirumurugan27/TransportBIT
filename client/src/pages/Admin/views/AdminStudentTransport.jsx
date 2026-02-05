import React, {useState, useEffect} from "react";
import {useToast} from "../../../context/ToastContext";
import {formatTime} from "../../../utils/dateFormat";
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

  // Modals
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showTransportProcessModal, setShowTransportProcessModal] =
    useState(false);
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
        showToast(`Request ${status} successfully!`, "success");
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md p-6 border border-primary/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primarytext mb-2">
              Student Transport Management
            </h1>
            <p className="text-secondarytext">
              Manage student bus assignments, fees, and requests
            </p>
          </div>
          <div className="bg-primary/10 p-4 rounded-md">
            <Users className="w-8 h-8 text-primary" />
          </div>
        </div>
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
      <div className="bg-secondarybg rounded-md border border-primarybg overflow-hidden">
        <div className="flex overflow-x-auto border-b border-primarybg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "text-primary bg-primary/5 border-b-2 border-primary"
                  : "text-secondarytext hover:text-primarytext hover:bg-primarybg/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-red text-white text-xs font-bold px-2 py-0.5 rounded-md">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Transport Requests Tab */}
          {activeTab === "transport-requests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primarytext">
                  Student Bus Requests
                </h3>
              </div>

              {transportRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                  <p className="text-secondarytext">
                    No transport requests found
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
              )}
            </div>
          )}

          {/* Students by Bus Tab */}
          {activeTab === "students-by-bus" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bus List */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-primarytext mb-4">
                  Select Bus
                </h3>
                {busesWithStudents.map((bus) => (
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
                ))}
              </div>

              {/* Students List */}
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-primarytext mb-4">
                  Students {selectedBusId && `(${selectedBusStudents.length})`}
                </h3>

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
                  <div className="grid grid-cols-1 gap-3">
                    {selectedBusStudents.map((student) => (
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
                              {student.department && `${student.department}`}
                              {student.year > 0 && ` • Year ${student.year}`}
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
                )}
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === "assignments" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-primarytext">
                  Student Transport Assignments
                </h3>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Assign Student
                </button>
              </div>

              {studentTransports.length === 0 ? (
                <div className="text-center py-12 bg-primarybg rounded-md">
                  <Users className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                  <p className="text-secondarytext">No assignments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-primarybg rounded-md">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-primarybg">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Bus
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Stop
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Total Fee
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Balance
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentTransports.map((st) => (
                        <tr
                          key={st.id}
                          className="border-b border-primarybg hover:bg-secondarybg transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-primarytext">
                                {st.student_name}
                              </div>
                              <div className="text-sm text-secondarytext">
                                {st.student_email}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-primarytext">
                              {st.vehicle_name}
                            </div>
                            <div className="text-sm text-secondarytext">
                              {st.bus_number}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-primarytext">
                            {st.stop_name}
                          </td>
                          <td className="px-4 py-3 text-primarytext font-medium">
                            ₹{st.total_fee?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-green font-medium">
                            ₹{st.paid_amount?.toLocaleString()}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold ${st.balance > 0 ? "text-red" : "text-green"}`}
                          >
                            ₹{st.balance?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(st.status)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
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
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-primarytext">
                  Payment Records
                </h3>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-12 bg-primarybg rounded-md">
                  <CreditCard className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                  <p className="text-secondarytext">No payment records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-primarybg rounded-md">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-primarybg">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Student
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-primarytext">
                          Recorded By
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
                          <td className="px-4 py-3 font-medium text-primarytext">
                            {p.student_name}
                          </td>
                          <td className="px-4 py-3 text-green font-semibold">
                            ₹{p.amount?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-primarytext capitalize">
                            {p.payment_method}
                          </td>
                          <td className="px-4 py-3 text-secondarytext">
                            {p.receipt_number || "-"}
                          </td>
                          <td className="px-4 py-3 text-secondarytext">
                            {p.recorded_by_name}
                          </td>
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
            <div>
              <h3 className="text-lg font-semibold text-primarytext mb-4">
                Stop Change Requests
              </h3>

              {stopChangeRequests.length === 0 ? (
                <div className="text-center py-12 bg-primarybg rounded-md">
                  <FileText className="w-12 h-12 text-secondarytext mx-auto mb-3" />
                  <p className="text-secondarytext">
                    No stop change requests found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stopChangeRequests.map((req) => (
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals - keeping the existing modal code but with updated styling */}
      {/* I'll add the modal updates in the next part to keep things organized */}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full p-6 border border-primarybg">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Assign Student to Bus
            </h3>

            <label className="block text-sm font-semibold text-primarytext mb-2">
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
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
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

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Select Bus
            </label>
            <select
              value={assignForm.bus_id}
              onChange={(e) => {
                const busId = parseInt(e.target.value);
                setAssignForm({...assignForm, bus_id: busId, stop_id: 0});
                if (busId > 0) fetchBusStops(busId);
              }}
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
            >
              <option value={0}>-- Select Bus --</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.vehicle_name} - {b.vehicle_number} ({b.start_point} →{" "}
                  {b.end_point})
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
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
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext disabled:opacity-50"
              disabled={!assignForm.bus_id}
            >
              <option value={0}>-- Select Stop --</option>
              {selectedBusStops.map((s) => (
                <option key={s.stop_id} value={s.stop_id}>
                  {s.stop_name} (Arrival: {formatTime(s.arrival_time)})
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Academic Year
            </label>
            <select
              value={assignForm.academic_year}
              onChange={(e) =>
                setAssignForm({...assignForm, academic_year: e.target.value})
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
            >
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>

            <div className="flex gap-3">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full p-6 border border-primarybg">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Record Payment
            </h3>

            <label className="block text-sm font-semibold text-primarytext mb-2">
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
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
            >
              <option value={0}>-- Select Student --</option>
              {studentTransports.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.student_name} - Balance: ₹{st.balance?.toLocaleString()}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
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
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
              placeholder="Enter amount"
            />

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) =>
                setPaymentForm({...paymentForm, payment_date: e.target.value})
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
            />

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Payment Method
            </label>
            <select
              value={paymentForm.payment_method}
              onChange={(e) =>
                setPaymentForm({...paymentForm, payment_method: e.target.value})
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4 bg-secondarybg text-primarytext"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Receipt Number (Optional)
            </label>
            <input
              type="text"
              value={paymentForm.receipt_number}
              onChange={(e) =>
                setPaymentForm({...paymentForm, receipt_number: e.target.value})
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
              placeholder="Enter receipt number"
            />

            <div className="flex gap-3">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full p-6 border border-primarybg">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Process Stop Change Request
            </h3>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Admin Remarks (Optional)
            </label>
            <textarea
              value={processForm.admin_remarks}
              onChange={(e) =>
                setProcessForm({...processForm, admin_remarks: e.target.value})
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
              rows={3}
              placeholder="Enter any remarks..."
            />

            <div className="flex gap-3">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full p-6 border border-primarybg">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Process Transport Request
            </h3>

            <label className="block text-sm font-semibold text-primarytext mb-2">
              Admin Remarks (Optional)
            </label>
            <textarea
              value={transportProcessForm.admin_remarks}
              onChange={(e) =>
                setTransportProcessForm({
                  ...transportProcessForm,
                  admin_remarks: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-primarybg rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary mb-6 bg-secondarybg text-primarytext"
              rows={3}
              placeholder="Enter any remarks for the student..."
            />

            <div className="flex gap-3">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-2xl max-w-lg w-full p-6 border border-primarybg">
            <h3 className="text-xl font-bold text-primarytext mb-6">
              Student Details
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-primarybg rounded-md p-4">
                <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <div className="text-xl font-bold text-primarytext">
                    {selectedStudent.name}
                  </div>
                  <div className="text-secondarytext">
                    {selectedStudent.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-primarybg rounded-md p-4">
                <div>
                  <div className="text-sm text-secondarytext mb-1">
                    Department
                  </div>
                  <div className="font-medium text-primarytext">
                    {selectedStudent.department || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-secondarytext mb-1">Year</div>
                  <div className="font-medium text-primarytext">
                    {selectedStudent.year > 0
                      ? `Year ${selectedStudent.year}`
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-secondarytext mb-1">
                    Roll Number
                  </div>
                  <div className="font-medium text-primarytext">
                    {selectedStudent.roll_number || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-secondarytext mb-1">
                    Academic Year
                  </div>
                  <div className="font-medium text-primarytext">
                    {selectedStudent.academic_year}
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-md p-4 border border-primary/20">
                <div className="flex items-center gap-2 text-primary font-semibold mb-3">
                  <Bus className="w-4 h-4" />
                  Transport Details
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-secondarytext mb-1">Stop</div>
                    <div className="font-medium text-primarytext">
                      {selectedStudent.stop_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondarytext mb-1">
                      Stop Fee
                    </div>
                    <div className="font-medium text-primarytext">
                      ₹{selectedStudent.stop_fee?.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primarybg rounded-md p-3 text-center">
                  <div className="text-sm text-secondarytext mb-1">
                    Total Fee
                  </div>
                  <div className="text-lg font-bold text-primarytext">
                    ₹{selectedStudent.total_fee?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green/10 rounded-md p-3 text-center border border-green/20">
                  <div className="text-sm text-secondarytext mb-1">Paid</div>
                  <div className="text-lg font-bold text-green">
                    ₹{selectedStudent.paid_amount?.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`rounded-md p-3 text-center ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "bg-red/10 border border-red/20" : "bg-green/10 border border-green/20"}`}
                >
                  <div className="text-sm text-secondarytext mb-1">Balance</div>
                  <div
                    className={`text-lg font-bold ${selectedStudent.total_fee - selectedStudent.paid_amount > 0 ? "text-red" : "text-green"}`}
                  >
                    ₹
                    {(
                      selectedStudent.total_fee - selectedStudent.paid_amount
                    )?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
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
