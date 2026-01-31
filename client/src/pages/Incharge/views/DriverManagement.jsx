import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, apiPost, getToday} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";
import {showError} from "../../../utils/swal";
import {
  Users,
  Car,
  Calendar,
  MapPin,
  Plus,
  X,
  FileText,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function DriverManagement() {
  const {showToast} = useToast();
  const {user} = useAuth();
  const inchargeId = user?.driver_id;

  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDriver, setExpandedDriver] = useState(null);

  // Modals
  const [showKmModal, setShowKmModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  // KM Log form
  const [kmForm, setKmForm] = useState({
    date: getToday(),
    start_km: "",
    end_km: "",
    remarks: "",
    vehicle_type: "BUS",
    vehicle_id: "",
    assignment_id: "",
  });

  // Leave form
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "CASUAL",
    start_date: getToday(),
    start_time: "",
    end_date: getToday(),
    end_time: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [driverKmLogs, setDriverKmLogs] = useState([]);
  const [driverVehicles, setDriverVehicles] = useState([]);

  useEffect(() => {
    fetchData();
  }, [inchargeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [driversRes, assignmentsRes] = await Promise.all([
        apiGet("/api/incharge/all-drivers"),
        apiGet("/api/incharge/driver-assignments"),
      ]);

      if (driversRes.ok) setDrivers((await driversRes.json()) || []);
      if (assignmentsRes.ok)
        setAssignments((await assignmentsRes.json()) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverKmLogs = async (driverId) => {
    try {
      const res = await apiGet(
        `/api/incharge/driver-km-logs?driver_id=${driverId}`,
      );
      if (res.ok) {
        setDriverKmLogs((await res.json()) || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleDriverExpand = (driverId) => {
    if (expandedDriver === driverId) {
      setExpandedDriver(null);
      setDriverKmLogs([]);
    } else {
      setExpandedDriver(driverId);
      fetchDriverKmLogs(driverId);
    }
  };

  const openKmModal = (driver) => {
    setSelectedDriver(driver);
    // Get vehicles for this driver from assignments
    const driverAssigns = assignments.filter(
      (a) => a.driver_id === driver.driver_id,
    );
    const vehicles = driverAssigns.map((a) => ({
      id: a.vehicle_id,
      vehicle_number: a.vehicle_number,
      vehicle_type: a.vehicle_type,
      assignment_id: a.id,
    }));
    setDriverVehicles(vehicles);

    setKmForm({
      date: getToday(),
      start_km: "",
      end_km: "",
      remarks: "",
      vehicle_type: vehicles.length > 0 ? vehicles[0].vehicle_type : "BUS",
      vehicle_id: vehicles.length > 0 ? vehicles[0].id : "",
      assignment_id:
        vehicles.length > 0 && vehicles[0].assignment_id
          ? vehicles[0].assignment_id
          : "",
    });
    setShowKmModal(true);
  };

  const openLeaveModal = (driver) => {
    setSelectedDriver(driver);
    setLeaveForm({
      leave_type: "CASUAL",
      start_date: getToday(),
      end_date: getToday(),
      reason: "",
    });
    setShowLeaveModal(true);
  };

  const handleAddKmLog = async () => {
    if (!kmForm.start_km || !kmForm.end_km) {
      showToast("Please enter start and end KM", "warning");
      return;
    }

    if (!kmForm.vehicle_id) {
      showToast("Please select a vehicle", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost("/api/incharge/km-log/add", {
        incharge_id: parseInt(inchargeId),
        driver_id: selectedDriver.driver_id,
        date: kmForm.date,
        start_km: parseFloat(kmForm.start_km),
        end_km: parseFloat(kmForm.end_km),
        total_km: parseFloat(kmForm.end_km) - parseFloat(kmForm.start_km),
        remarks: kmForm.remarks,
        vehicle_type: kmForm.vehicle_type,
        vehicle_id: parseInt(kmForm.vehicle_id),
        assignment_id: kmForm.assignment_id
          ? parseInt(kmForm.assignment_id)
          : null,
      });

      if (res.ok) {
        showToast("KM log added successfully", "success");
        setShowKmModal(false);
        if (expandedDriver === selectedDriver.driver_id) {
          fetchDriverKmLogs(selectedDriver.driver_id);
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to add KM log", "error");
      }
    } catch (err) {
      showError("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!leaveForm.reason || !leaveForm.start_time || !leaveForm.end_time) {
      showToast("Please enter a reason for leave", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost("/api/incharge/leave/apply", {
        incharge_id: parseInt(inchargeId),
        driver_id: selectedDriver.driver_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        start_time: leaveForm.start_time,
        end_date: leaveForm.end_date,
        end_time: leaveForm.end_time,
        reason: leaveForm.reason,
      });

      if (res.ok) {
        showToast("Leave request submitted successfully", "success");
        setLeaveForm({
          leave_type: "CASUAL",
          start_date: getToday(),
          start_time: "",
          end_date: getToday(),
          end_time: "",
          reason: "",
        });
        setShowLeaveModal(false);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to submit leave request", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Get assignment for a driver
  const getDriverAssignment = (driverId) => {
    return assignments.find((a) => a.driver_id === driverId);
  };

  // Filter drivers
  const filteredDrivers = drivers.filter(
    (d) =>
      d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.assigned_vehicle?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
            <Users className="text-primary" /> Driver Management
          </h3>
          <p className="text-secondarytext text-sm">
            View assignments, add KM logs, and raise leave requests on behalf of
            drivers
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-primarytext">
                {drivers.length}
              </p>
              <p className="text-xs text-secondarytext">Total Drivers</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green/10 rounded-xl flex items-center justify-center">
              <Car className="text-green" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green">
                {assignments.length}
              </p>
              <p className="text-xs text-secondarytext">Active Assignments</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <MapPin className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {drivers.filter((d) => d.assigned_vehicle).length}
              </p>
              <p className="text-xs text-secondarytext">With Vehicles</p>
            </div>
          </div>
        </div>
        <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {drivers.filter((d) => !d.assigned_vehicle).length}
              </p>
              <p className="text-xs text-secondarytext">Unassigned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-secondarybg rounded-xl p-4 shadow-sm border border-primarybg">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by driver name or vehicle number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-primarybg border-none rounded-lg text-primarytext focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Driver List */}
      {loading ? (
        <div className="text-center py-12 text-secondarytext animate-pulse">
          Loading drivers...
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver) => {
              const assignment = getDriverAssignment(driver.driver_id);
              const isExpanded = expandedDriver === driver.driver_id;

              return (
                <div
                  key={driver.driver_id}
                  className="bg-secondarybg rounded-xl shadow-sm border border-primarybg overflow-hidden"
                >
                  {/* Main Row */}
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {driver.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h4 className="font-semibold text-primarytext">
                          {driver.full_name}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {driver.assigned_vehicle ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green/10 text-green text-xs font-medium rounded">
                              <Car size={12} /> {driver.assigned_vehicle}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded">
                              No Vehicle
                            </span>
                          )}
                          {driver.cluster_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded">
                              {driver.cluster_name}
                            </span>
                          )}
                          {driver.phone && (
                            <span className="text-xs text-secondarytext">
                              📞 {driver.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openKmModal(driver)}
                        className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 flex items-center gap-1"
                      >
                        <Plus size={14} /> Add KM Log
                      </button>
                      <button
                        onClick={() => openLeaveModal(driver)}
                        className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 flex items-center gap-1"
                      >
                        <Calendar size={14} /> Apply Leave
                      </button>
                      <button
                        onClick={() => toggleDriverExpand(driver.driver_id)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        Details
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-primarybg p-4 bg-primarybg/30">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Assignment Info */}
                        <div>
                          <h5 className="font-semibold text-primarytext mb-2 flex items-center gap-2">
                            <Car size={16} className="text-primary" />{" "}
                            Assignment Details
                          </h5>
                          {assignment ? (
                            <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                              <p>
                                <span className="text-secondarytext">
                                  Vehicle:
                                </span>{" "}
                                <span className="font-medium">
                                  {assignment.vehicle_number}
                                </span>{" "}
                                ({assignment.vehicle_type})
                              </p>
                              <p>
                                <span className="text-secondarytext">
                                  Shift:
                                </span>{" "}
                                <span className="font-medium">
                                  {assignment.shift_name || "N/A"}
                                </span>
                              </p>
                              {assignment.start_time && (
                                <p>
                                  <span className="text-secondarytext">
                                    Time:
                                  </span>{" "}
                                  <span className="font-medium">
                                    {assignment.start_time} -{" "}
                                    {assignment.end_time}
                                  </span>
                                </p>
                              )}
                              <p>
                                <span className="text-secondarytext">
                                  Status:
                                </span>
                                <span
                                  className={`ml-1 px-2 py-0.5 rounded text-xs font-medium ${
                                    assignment.assignment_status === "active"
                                      ? "bg-green/10 text-green"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {assignment.assignment_status}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-secondarytext text-sm">
                              No active assignment
                            </p>
                          )}
                        </div>

                        {/* Recent KM Logs */}
                        <div>
                          <h5 className="font-semibold text-primarytext mb-2 flex items-center gap-2">
                            <FileText size={16} className="text-primary" />{" "}
                            Recent KM Logs
                          </h5>
                          {driverKmLogs.length > 0 ? (
                            <div className="bg-white rounded-lg p-3 max-h-40 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-secondarytext text-xs">
                                    <th className="text-left pb-2">Date</th>
                                    <th className="text-right pb-2">Start</th>
                                    <th className="text-right pb-2">End</th>
                                    <th className="text-right pb-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {driverKmLogs.slice(0, 5).map((log) => (
                                    <tr key={log.id}>
                                      <td className="py-1">{log.date}</td>
                                      <td className="text-right py-1">
                                        {log.start_km}
                                      </td>
                                      <td className="text-right py-1">
                                        {log.end_km}
                                      </td>
                                      <td className="text-right py-1 font-medium text-primary">
                                        {log.total_km}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-secondarytext text-sm">
                              No KM logs found
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-secondarytext">
              No drivers found matching your search
            </div>
          )}
        </div>
      )}

      {/* Add KM Log Modal */}
      {showKmModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primarytext">
                Add KM Log
              </h3>
              <button
                onClick={() => setShowKmModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-primary/5 rounded-lg">
              <p className="text-sm text-primarytext">
                Adding KM log for:{" "}
                <span className="font-semibold">
                  {selectedDriver.full_name}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={kmForm.date}
                  onChange={(e) => setKmForm({...kmForm, date: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start KM
                  </label>
                  <input
                    type="number"
                    value={kmForm.start_km}
                    onChange={(e) =>
                      setKmForm({...kmForm, start_km: e.target.value})
                    }
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End KM
                  </label>
                  <input
                    type="number"
                    value={kmForm.end_km}
                    onChange={(e) =>
                      setKmForm({...kmForm, end_km: e.target.value})
                    }
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {kmForm.start_km && kmForm.end_km && (
                <div className="p-3 bg-green/10 rounded-lg text-center">
                  <p className="text-sm text-secondarytext">Total Distance</p>
                  <p className="text-2xl font-bold text-green">
                    {Math.max(
                      0,
                      parseFloat(kmForm.end_km || 0) -
                        parseFloat(kmForm.start_km || 0),
                    )}{" "}
                    KM
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Vehicle *
                </label>
                <select
                  value={kmForm.vehicle_id}
                  onChange={(e) => {
                    const selectedVehicle = driverVehicles.find(
                      (v) => v.id === parseInt(e.target.value),
                    );
                    setKmForm({
                      ...kmForm,
                      vehicle_id: e.target.value,
                      vehicle_type:
                        selectedVehicle?.vehicle_type || kmForm.vehicle_type,
                      assignment_id: selectedVehicle?.assignment_id || "",
                    });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                >
                  <option value="">Select Vehicle</option>
                  {driverVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
                {driverVehicles.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No vehicles assigned to this driver.
                  </p>
                )}
              </div>

              {/* Vehicle Type is auto-set from selected vehicle */}
              {kmForm.vehicle_id && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-secondarytext">Vehicle Type</p>
                  <p className="font-semibold text-primarytext">
                    {kmForm.vehicle_type}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Remarks
                </label>
                <textarea
                  value={kmForm.remarks}
                  onChange={(e) =>
                    setKmForm({...kmForm, remarks: e.target.value})
                  }
                  rows={2}
                  placeholder="Optional remarks..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowKmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-secondarytext hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKmLog}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Adding..." : "Add KM Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showLeaveModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primarytext">
                Apply Leave
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800">
                Applying leave for:{" "}
                <span className="font-semibold">
                  {selectedDriver.full_name}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) =>
                    setLeaveForm({...leaveForm, leave_type: e.target.value})
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="ANNUAL">Annual Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm({...leaveForm, start_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm({...leaveForm, end_date: e.target.value})
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    Start Time
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={leaveForm.start_time}
                      onChange={(e) =>
                        setLeaveForm({...leaveForm, start_time: e.target.value})
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondarytext mb-1">
                    End Time
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={leaveForm.end_time}
                      onChange={(e) =>
                        setLeaveForm({...leaveForm, end_time: e.target.value})
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondarytext mb-1">
                  Reason *
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({...leaveForm, reason: e.target.value})
                  }
                  rows={3}
                  placeholder="Enter reason for leave..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> This leave request will be submitted on
                  behalf of the driver and will require admin approval.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-secondarytext hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLeave}
                disabled={submitting || !leaveForm.reason}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
