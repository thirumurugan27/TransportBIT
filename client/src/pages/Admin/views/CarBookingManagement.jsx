import React, {useState, useEffect} from "react";
import {Plus} from "lucide-react";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import {formatTime} from "../../../utils/dateFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function CarBookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [availableCars, setAvailableCars] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [createdOTP, setCreatedOTP] = useState(null);
  const [approveForm, setApproveForm] = useState({
    vehicle_id: "",
    driver_id: "",
    admin_remarks: "",
  });
  const [rejectForm, setRejectForm] = useState({
    admin_remarks: "",
  });
  const [createForm, setCreateForm] = useState({
    requester_name: "",
    requester_phone: "",
    requester_department: "",
    faculty_id: "",
    booking_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "17:00",
    purpose: "",
    destination: "",
    passenger_count: 1,
    vehicle_id: "",
    driver_id: "",
  });

  useEffect(() => {
    fetchBookings();
    fetchFaculties();
  }, [filter]);

  const fetchFaculties = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/faculty`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setFaculties(data?.faculties || data || []);
      }
    } catch (err) {
      console.error("Error fetching faculty list:", err);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      let url = `${API_BASE}/api/admin/car-bookings`;
      if (filter !== "all") {
        url += `?status=${filter}`;
      }
      const res = await fetch(url, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableResources = async (date, startTime, endTime) => {
    try {
      const token = localStorage.getItem("token");

      // Build query params with time for conflict checking
      let params = `date=${date}`;
      if (startTime) params += `&start_time=${encodeURIComponent(startTime)}`;
      if (endTime) params += `&end_time=${encodeURIComponent(endTime)}`;

      // Fetch available cars
      const carsRes = await fetch(
        `${API_BASE}/api/admin/car-bookings/available-cars?${params}`,
        {
          headers: {Authorization: `Bearer ${token}`},
          credentials: "include",
        },
      );
      if (carsRes.ok) {
        const cars = await carsRes.json();
        setAvailableCars(cars);
      }

      // Fetch available drivers
      const driversRes = await fetch(
        `${API_BASE}/api/admin/car-bookings/available-drivers?${params}`,
        {
          headers: {Authorization: `Bearer ${token}`},
          credentials: "include",
        },
      );
      if (driversRes.ok) {
        const drivers = await driversRes.json();
        setAvailableDrivers(drivers);
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    }
  };

  const handleFacultyChange = (val) => {
    const selected = faculties.find((f) => String(f.id) === String(val));
    setCreateForm((prev) => ({
      ...prev,
      faculty_id: val,
      requester_name: selected?.full_name || "",
      requester_phone: selected?.phone || "",
      requester_department: selected?.department || "",
    }));
  };

  const handleOpenCreateModal = () => {
    setCreateForm({
      requester_name: "",
      requester_phone: "",
      requester_department: "",
      faculty_id: "",
      booking_date: new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "17:00",
      purpose: "",
      destination: "",
      passenger_count: 1,
      vehicle_id: "",
      driver_id: "",
    });
    setCreatedOTP(null);
    const today = new Date().toISOString().split("T")[0];
    fetchAvailableResources(today, "09:00", "17:00");
    setShowCreateModal(true);
  };

  const handleCreateBooking = async () => {
    if (
      !createForm.faculty_id ||
      !createForm.vehicle_id ||
      !createForm.driver_id
    ) {
      alert("Please select faculty, vehicle, and driver");
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/car-bookings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requester_name: createForm.requester_name,
          requester_phone: createForm.requester_phone,
          requester_department: createForm.requester_department,
          faculty_id: parseInt(createForm.faculty_id),
          booking_date: createForm.booking_date,
          start_time: createForm.start_time,
          end_time: createForm.end_time,
          purpose: createForm.purpose,
          destination: createForm.destination,
          passenger_count: parseInt(createForm.passenger_count) || 1,
          vehicle_id: parseInt(createForm.vehicle_id),
          driver_id: parseInt(createForm.driver_id),
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedOTP(data.otp);
        fetchBookings();
      } else {
        alert(data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveClick = (booking) => {
    setSelectedBooking(booking);
    setApproveForm({vehicle_id: "", driver_id: "", admin_remarks: ""});
    fetchAvailableResources(
      booking.booking_date,
      booking.start_time,
      booking.end_time,
    );
    setShowApproveModal(true);
  };

  const handleRejectClick = (booking) => {
    setSelectedBooking(booking);
    setRejectForm({admin_remarks: ""});
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!approveForm.vehicle_id || !approveForm.driver_id) {
      alert("Please select both vehicle and driver");
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/car-bookings/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          vehicle_id: parseInt(approveForm.vehicle_id),
          driver_id: parseInt(approveForm.driver_id),
          admin_remarks: approveForm.admin_remarks,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          `Booking approved! OTP: ${data.otp}\n\nThis OTP has been shared with the faculty.`,
        );
        setShowApproveModal(false);
        fetchBookings();
      } else {
        alert(data.error || "Failed to approve booking");
      }
    } catch (error) {
      console.error("Error approving booking:", error);
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/car-bookings/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          admin_remarks: rejectForm.admin_remarks,
        }),
        credentials: "include",
      });

      if (res.ok) {
        setShowRejectModal(false);
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reject booking");
      }
    } catch (error) {
      console.error("Error rejecting booking:", error);
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelOnhold = async (booking) => {
    const reason = prompt("Enter reason for cancellation (optional):");
    if (reason === null) return; // User clicked cancel on prompt

    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/car-bookings/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          admin_remarks: reason || "Cancelled by admin",
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          "Booking cancelled successfully. Vehicle and driver have been released.",
        );
        fetchBookings();
      } else {
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      onhold: "bg-purple-100 text-purple-800",
      booked: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pending",
      approved: "Approved",
      onhold: "On Hold",
      booked: "Confirmed",
      completed: "Completed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Car Booking Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage faculty car booking requests
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
        >
          <Plus size={16} /> Add Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          {key: "pending", label: "Pending"},
          {key: "onhold", label: "On Hold"},
          {key: "booked", label: "Confirmed"},
          {key: "completed", label: "Completed"},
          {key: "rejected", label: "Rejected"},
          {key: "cancelled", label: "Cancelled"},
          {key: "all", label: "All"},
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p>No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faculty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle/Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {booking.faculty_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.department}
                        </div>
                        <div className="text-xs text-gray-400">
                          {booking.faculty_phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {booking.booking_date}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatTime(booking.start_time)} -{" "}
                        {formatTime(booking.end_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {booking.purpose}
                      </div>
                      {booking.destination && (
                        <div className="text-sm text-gray-500">
                          To: {booking.destination}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {booking.passenger_count} passenger(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {booking.vehicle_number ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {booking.vehicle_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.driver_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(booking.status)}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                      {booking.otp && booking.status === "onhold" && (
                        <div className="mt-1 text-xs text-purple-600 font-mono">
                          OTP: {booking.otp}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {booking.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveClick(booking)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectClick(booking)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {booking.status === "onhold" && (
                        <div className="flex flex-col gap-2">
                          <span className="text-purple-600 text-xs">
                            Awaiting OTP verification
                          </span>
                          <button
                            onClick={() => handleCancelOnhold(booking)}
                            disabled={processing}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Approve Booking
            </h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">
                {selectedBooking.faculty_name}
              </p>
              <p className="text-sm text-gray-600">{selectedBooking.purpose}</p>
              <p className="text-sm text-gray-500">
                {selectedBooking.booking_date} •{" "}
                {formatTime(selectedBooking.start_time)} -{" "}
                {formatTime(selectedBooking.end_time)}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Vehicle <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={approveForm.vehicle_id}
                  onChange={(val) =>
                    setApproveForm({...approveForm, vehicle_id: val})
                  }
                  placeholder="Choose a vehicle..."
                  showAvailability={true}
                  options={availableCars.map((car) => ({
                    value: String(car.id),
                    label: car.vehicle_number,
                    subtitle: car.seating_capacity
                      ? `${car.seating_capacity} seats`
                      : undefined,
                    available: car.is_available !== false,
                    availableText:
                      car.is_available === false
                        ? car.conflict_info || "Booked"
                        : undefined,
                  }))}
                  emptyMessage="No cars available"
                />
                {availableCars.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    No cars available for this date
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Driver <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={approveForm.driver_id}
                  onChange={(val) =>
                    setApproveForm({...approveForm, driver_id: val})
                  }
                  placeholder="Choose a driver..."
                  showAvailability={true}
                  options={availableDrivers.map((driver) => ({
                    value: String(driver.id),
                    label: driver.full_name,
                    subtitle: driver.license_number || undefined,
                    available: driver.is_available !== false,
                    availableText:
                      driver.is_available === false
                        ? driver.conflict_info || "Assigned"
                        : undefined,
                  }))}
                  emptyMessage="No drivers available"
                />
                {availableDrivers.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    No drivers available for this date
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={approveForm.admin_remarks}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      admin_remarks: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={
                  processing ||
                  !approveForm.vehicle_id ||
                  !approveForm.driver_id
                }
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Approve & Generate OTP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Reject Booking
            </h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">
                {selectedBooking.faculty_name}
              </p>
              <p className="text-sm text-gray-600">{selectedBooking.purpose}</p>
              <p className="text-sm text-gray-500">
                {selectedBooking.booking_date} •{" "}
                {formatTime(selectedBooking.start_time)} -{" "}
                {formatTime(selectedBooking.end_time)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection
              </label>
              <textarea
                value={rejectForm.admin_remarks}
                onChange={(e) => setRejectForm({admin_remarks: e.target.value})}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter reason for rejecting this request..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Reject Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {createdOTP ? (
              // OTP Success Screen
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Booking Created Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Share this OTP with the driver for verification
                </p>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
                  <p className="text-sm text-purple-600 mb-2">OTP Code</p>
                  <p className="text-4xl font-mono font-bold text-purple-900 tracking-widest">
                    {createdOTP}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedOTP(null);
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              // Create Form
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Create Car Booking
                </h2>

                <div className="space-y-4">
                  {/* Requester Details */}
                  <div className="border-b pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Requester Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Faculty <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={faculties.map((f) => ({
                            value: String(f.id),
                            label: f.full_name,
                            subtitle:
                              [f.department, f.phone]
                                .filter(Boolean)
                                .join(" • ") || undefined,
                          }))}
                          value={createForm.faculty_id}
                          onChange={handleFacultyChange}
                          placeholder="Search or select faculty"
                        />
                        {faculties.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            No faculty found. Please add faculty first.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={createForm.requester_name}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                            placeholder="Auto-filled from faculty"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="text"
                            value={createForm.requester_phone}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                            placeholder="Auto-filled"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Department
                          </label>
                          <input
                            type="text"
                            value={createForm.requester_department}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                            placeholder="Auto-filled"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="border-b pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Date & Time
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={createForm.booking_date}
                          onChange={(e) => {
                            setCreateForm({
                              ...createForm,
                              booking_date: e.target.value,
                            });
                            fetchAvailableResources(
                              e.target.value,
                              createForm.start_time,
                              createForm.end_time,
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={createForm.start_time}
                          onChange={(e) => {
                            setCreateForm({
                              ...createForm,
                              start_time: e.target.value,
                            });
                            fetchAvailableResources(
                              createForm.booking_date,
                              e.target.value,
                              createForm.end_time,
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={createForm.end_time}
                          onChange={(e) => {
                            setCreateForm({
                              ...createForm,
                              end_time: e.target.value,
                            });
                            fetchAvailableResources(
                              createForm.booking_date,
                              createForm.start_time,
                              e.target.value,
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="border-b pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Trip Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Purpose
                        </label>
                        <input
                          type="text"
                          value={createForm.purpose}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              purpose: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Site visit, Guest pickup"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Destination
                        </label>
                        <input
                          type="text"
                          value={createForm.destination}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              destination: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Destination"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passengers
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={createForm.passenger_count}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            passenger_count: e.target.value,
                          })
                        }
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Vehicle & Driver */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Assign Vehicle & Driver
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Vehicle <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={createForm.vehicle_id}
                          onChange={(val) =>
                            setCreateForm({...createForm, vehicle_id: val})
                          }
                          placeholder="Select a vehicle"
                          showAvailability={true}
                          options={availableCars.map((car) => ({
                            value: String(car.id),
                            label: car.vehicle_number,
                            subtitle: car.seating_capacity
                              ? `${car.seating_capacity} seats • ${car.fuel_type || "Petrol"}`
                              : car.fuel_type,
                            available: car.is_available !== false,
                            availableText:
                              car.is_available === false
                                ? car.conflict_info || "Booked"
                                : undefined,
                          }))}
                          emptyMessage="No cars found"
                        />
                        {availableCars.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            No cars available for selected date/time
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Driver <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={createForm.driver_id}
                          onChange={(val) =>
                            setCreateForm({...createForm, driver_id: val})
                          }
                          placeholder="Select a driver"
                          showAvailability={true}
                          options={availableDrivers.map((driver) => ({
                            value: String(driver.id),
                            label: driver.full_name,
                            subtitle:
                              driver.license_number ||
                              driver.phone ||
                              undefined,
                            available: driver.is_available !== false,
                            availableText:
                              driver.is_available === false
                                ? driver.conflict_info || "Assigned"
                                : undefined,
                          }))}
                          emptyMessage="No drivers found"
                        />
                        {availableDrivers.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            No drivers available for selected date/time
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBooking}
                    disabled={
                      processing ||
                      !createForm.requester_name ||
                      !createForm.vehicle_id ||
                      !createForm.driver_id
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {processing ? "Creating..." : "Create Booking"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
