import React, {useState, useEffect} from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

// Get driver ID from JWT token
const getDriverIdFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.driver_id || null;
  } catch {
    return null;
  }
};

export default function DriverCarBookings() {
  const [bookings, setBookings] = useState([]);
  const [todayBookings, setTodayBookings] = useState([]);
  const [carAssignments, setCarAssignments] = useState([]); // Admin-created car assignments
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("assignments"); // assignments, today, all
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showAssignmentOTPModal, setShowAssignmentOTPModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const driverId = getDriverIdFromToken();
      
      // Fetch car assignments (admin-created)
      if (driverId) {
        const assignRes = await fetch(`${API_BASE}/api/driver/assignment/car-assignments?driver_id=${driverId}`, {
          headers: {Authorization: `Bearer ${token}`},
          credentials: "include",
        });
        if (assignRes.ok) {
          const data = await assignRes.json();
          setCarAssignments(data);
        }
      }
      
      // Fetch today's bookings (faculty bookings)
      const todayRes = await fetch(`${API_BASE}/api/driver/car-bookings/today`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });
      if (todayRes.ok) {
        const data = await todayRes.json();
        setTodayBookings(data);
      }

      // Fetch all bookings (faculty bookings)
      const allRes = await fetch(`${API_BASE}/api/driver/car-bookings`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });
      if (allRes.ok) {
        const data = await allRes.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP for car assignments
  const handleVerifyAssignmentOTP = async () => {
    if (!otp || otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const driverId = getDriverIdFromToken();
      const res = await fetch(`${API_BASE}/api/driver/assignment/verify-otp?driver_id=${driverId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          otp: otp,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        alert("OTP verified successfully! Assignment confirmed.");
        setShowAssignmentOTPModal(false);
        setOtp("");
        setSelectedAssignment(null);
        fetchData();
      } else {
        alert(data.error || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      alert("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/driver/car-bookings/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          otp: otp,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        alert("OTP verified successfully! Booking confirmed.");
        setShowOTPModal(false);
        setOtp("");
        fetchData();
      } else {
        alert(data.error || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      alert("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleComplete = async (bookingId) => {
    if (!window.confirm("Mark this trip as completed?")) {
      return;
    }

    setCompleting(bookingId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/driver/car-bookings/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({booking_id: bookingId}),
        credentials: "include",
      });

      if (res.ok) {
        alert("Trip completed successfully!");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete trip");
      }
    } catch (error) {
      console.error("Error completing trip:", error);
      alert("Network error. Please try again.");
    } finally {
      setCompleting(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      onhold: "bg-purple-100 text-purple-800",
      booked: "bg-green-100 text-green-800",
      assigned: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status) => {
    const labels = {
      onhold: "Awaiting Verification",
      booked: "Confirmed",
      assigned: "Confirmed",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  const displayBookings = activeTab === "today" ? todayBookings : bookings;
  const pendingAssignments = carAssignments.filter(a => a.status === "onhold");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Car Bookings & Assignments</h1>
        <p className="text-gray-600 mt-1">Manage your assigned car trips</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "assignments"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Car Assignments
          {pendingAssignments.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {pendingAssignments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("today")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "today"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Today's Faculty Trips
          {todayBookings.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {todayBookings.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All Faculty Bookings
        </button>
      </div>

      {/* Car Assignments Tab */}
      {activeTab === "assignments" && (
        <>
          {carAssignments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">No car assignments from admin</p>
            </div>
          ) : (
            <div className="space-y-4">
              {carAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Car Assignment #{assignment.id}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(assignment.status)}`}>
                            {getStatusLabel(assignment.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Date</p>
                            <p className="font-medium text-gray-900">{assignment.date}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Time</p>
                            <p className="font-medium text-gray-900">
                              {assignment.start_time || "N/A"} - {assignment.end_time || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vehicle</p>
                            <p className="font-medium text-gray-900">{assignment.vehicle_number}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vehicle Type</p>
                            <p className="font-medium text-gray-900">{assignment.vehicle_type}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {assignment.purpose && (
                            <div>
                              <p className="text-gray-500">Purpose</p>
                              <p className="font-medium text-gray-900">{assignment.purpose}</p>
                            </div>
                          )}
                          {assignment.destination && (
                            <div>
                              <p className="text-gray-500">Destination</p>
                              <p className="font-medium text-gray-900">{assignment.destination}</p>
                            </div>
                          )}
                        </div>

                        {/* Show OTP for onhold assignments */}
                        {assignment.status === "onhold" && assignment.otp && (
                          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm text-purple-700 mb-2">OTP for Verification</p>
                            <p className="text-2xl font-mono font-bold text-purple-900 tracking-widest">
                              {assignment.otp}
                            </p>
                            <p className="text-xs text-purple-600 mt-2">
                              Enter this OTP to confirm the assignment
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {assignment.status === "onhold" && (
                          <button
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setOtp("");
                              setShowAssignmentOTPModal(true);
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Verify OTP
                          </button>
                        )}

                        {assignment.status === "assigned" && (
                          <div className="flex items-center gap-2 text-green-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium">Confirmed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Faculty Bookings Tab */}
      {(activeTab === "today" || activeTab === "all") && (
        <>
          {displayBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-gray-500 text-lg">
            {activeTab === "today"
              ? "No car bookings scheduled for today"
              : "No car bookings assigned to you"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.faculty_name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">{booking.booking_date}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Time</p>
                        <p className="font-medium text-gray-900">
                          {booking.start_time} - {booking.end_time}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Vehicle</p>
                        <p className="font-medium text-gray-900">{booking.vehicle_number}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Passengers</p>
                        <p className="font-medium text-gray-900">{booking.passenger_count}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Purpose</p>
                        <p className="font-medium text-gray-900">{booking.purpose}</p>
                      </div>
                      {booking.destination && (
                        <div>
                          <p className="text-gray-500">Destination</p>
                          <p className="font-medium text-gray-900">{booking.destination}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Faculty Contact</p>
                      <p className="text-sm text-gray-900">{booking.faculty_phone || "N/A"}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {booking.status === "onhold" && (
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setOtp("");
                          setShowOTPModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Enter OTP
                      </button>
                    )}

                    {booking.status === "booked" && (
                      <button
                        onClick={() => handleComplete(booking.id)}
                        disabled={completing === booking.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {completing === booking.id ? "Completing..." : "Complete Trip"}
                      </button>
                    )}

                    {booking.status === "completed" && (
                      <div className="flex items-center gap-2 text-green-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* OTP Verification Modal for Faculty Bookings */}
      {showOTPModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Verify Faculty Booking OTP</h2>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">{selectedBooking.faculty_name}</p>
              <p className="text-sm text-gray-600">{selectedBooking.purpose}</p>
              <p className="text-sm text-gray-500">
                {selectedBooking.booking_date} • {selectedBooking.start_time}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit OTP from Faculty
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Ask the faculty to share the OTP they received upon booking approval
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOTPModal(false);
                  setOtp("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOTP}
                disabled={verifying || otp.length !== 6}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal for Car Assignments */}
      {showAssignmentOTPModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Verify Car Assignment OTP</h2>
            
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <p className="font-medium text-gray-900">Assignment #{selectedAssignment.id}</p>
              <p className="text-sm text-gray-600">{selectedAssignment.purpose || "No purpose specified"}</p>
              <p className="text-sm text-gray-500">
                {selectedAssignment.date} • {selectedAssignment.start_time || "N/A"}
              </p>
              <p className="text-sm text-gray-500">
                Vehicle: {selectedAssignment.vehicle_number}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter the OTP provided by admin to confirm this assignment
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAssignmentOTPModal(false);
                  setOtp("");
                  setSelectedAssignment(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyAssignmentOTP}
                disabled={verifying || otp.length !== 6}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
