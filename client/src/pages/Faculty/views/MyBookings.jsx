import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {formatTime} from "../../../utils/dateFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/faculty/car-bookings`, {
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

  const handleCancel = async (bookingId) => {
    if (
      !window.confirm("Are you sure you want to cancel this booking request?")
    ) {
      return;
    }

    setCancellingId(bookingId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/faculty/car-bookings/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({booking_id: bookingId}),
        credentials: "include",
      });

      if (res.ok) {
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Network error. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-blue-100 text-blue-800 border-blue-200",
      onhold: "bg-purple-100 text-purple-800 border-purple-200",
      booked: "bg-green-100 text-green-800 border-green-200",
      completed: "bg-gray-100 text-gray-800 border-gray-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pending Approval",
      approved: "Approved",
      onhold: "On Hold",
      booked: "Confirmed",
      completed: "Completed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "active")
      return ["pending", "approved", "onhold", "booked"].includes(b.status);
    if (filter === "completed") return b.status === "completed";
    if (filter === "cancelled")
      return ["rejected", "cancelled"].includes(b.status);
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600 mt-1">
            View and manage your car booking requests
          </p>
        </div>
        <button
          onClick={() => navigate("/faculty-dashboard/book-car")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          {key: "all", label: "All"},
          {key: "active", label: "Active"},
          {key: "completed", label: "Completed"},
          {key: "cancelled", label: "Rejected/Cancelled"},
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

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
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
          <p className="text-gray-500 text-lg">No bookings found</p>
          <button
            onClick={() => navigate("/faculty-dashboard/book-car")}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Book a car →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.purpose}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(booking.status)}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">
                          {booking.booking_date}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Time</p>
                        <p className="font-medium text-gray-900">
                          {formatTime(booking.start_time)} -{" "}
                          {formatTime(booking.end_time)}
                        </p>
                      </div>
                      {booking.destination && (
                        <div>
                          <p className="text-gray-500">Destination</p>
                          <p className="font-medium text-gray-900">
                            {booking.destination}
                          </p>
                        </div>
                      )}
                      {booking.vehicle_number && (
                        <div>
                          <p className="text-gray-500">Vehicle</p>
                          <p className="font-medium text-gray-900">
                            {booking.vehicle_number}
                          </p>
                        </div>
                      )}
                      {booking.driver_name && (
                        <div>
                          <p className="text-gray-500">Driver</p>
                          <p className="font-medium text-gray-900">
                            {booking.driver_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Passengers</p>
                        <p className="font-medium text-gray-900">
                          {booking.passenger_count}
                        </p>
                      </div>
                    </div>

                    {booking.admin_remarks && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Admin Remarks</p>
                        <p className="text-sm text-gray-700">
                          {booking.admin_remarks}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* OTP Display for approved/onhold bookings */}
                  {booking.otp &&
                    ["approved", "onhold"].includes(booking.status) && (
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white min-w-[180px]">
                        <p className="text-sm text-blue-100 mb-1">Your OTP</p>
                        <p className="text-3xl font-bold tracking-wider">
                          {booking.otp}
                        </p>
                        <p className="text-xs text-blue-100 mt-2">
                          Share this with your driver on {booking.booking_date}
                        </p>
                      </div>
                    )}
                </div>

                {/* Actions */}
                {booking.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {cancellingId === booking.id
                        ? "Cancelling..."
                        : "Cancel Request"}
                    </button>
                  </div>
                )}

                {booking.status === "booked" && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-green-600">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium">
                        OTP Verified - Booking Confirmed
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
