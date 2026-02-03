import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function CarBooking() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableCars, setAvailableCars] = useState([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [formData, setFormData] = useState({
    booking_date: "",
    start_time: "",
    end_time: "",
    purpose: "",
    destination: "",
    passenger_count: 1,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Fetch available cars when date changes
  useEffect(() => {
    if (formData.booking_date) {
      fetchAvailableCars(formData.booking_date);
    }
  }, [formData.booking_date]);

  const fetchAvailableCars = async (date) => {
    setCarsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/faculty/cars/available?date=${date}`, {
        headers: {Authorization: `Bearer ${token}`},
        credentials: "include",
      });

      if (res.ok) {
        const cars = await res.json();
        setAvailableCars(cars);
      }
    } catch (error) {
      console.error("Error fetching cars:", error);
    } finally {
      setCarsLoading(false);
    }
  };

  const handleChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({...prev, [name]: value}));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.booking_date) {
      setError("Please select a booking date");
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      setError("Please select start and end time");
      return;
    }
    if (!formData.purpose.trim()) {
      setError("Please enter the purpose of travel");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        passenger_count: parseInt(formData.passenger_count, 10) || 1,
      };
      const res = await fetch(`${API_BASE}/api/faculty/car-bookings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Car booking request submitted successfully! You will be notified once it's approved.");
        setFormData({
          booking_date: "",
          start_time: "",
          end_time: "",
          purpose: "",
          destination: "",
          passenger_count: 1,
        });
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/faculty-dashboard/my-bookings");
        }, 2000);
      } else {
        setError(data.error || "Failed to submit booking request");
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Book a Car</h1>
        <p className="text-gray-600 mt-1">
          Submit a request to book a car for your travel needs.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="space-y-6">
              {/* Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="booking_date"
                    value={formData.booking_date}
                    onChange={handleChange}
                    min={getMinDate()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  placeholder="e.g., Official meeting, Conference, Site visit"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination
                </label>
                <input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="e.g., Chennai, Madurai, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Passenger Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Passengers
                </label>
                <input
                  type="number"
                  name="passenger_count"
                  value={formData.passenger_count}
                  onChange={handleChange}
                  min="1"
                  max="10"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate("/faculty-dashboard")}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit Booking Request"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Available Cars Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Available Cars
              {formData.booking_date && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  on {formData.booking_date}
                </span>
              )}
            </h3>

            {!formData.booking_date ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Select a date to see available cars
              </p>
            ) : carsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : availableCars.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No cars registered in the system
              </p>
            ) : (
              <div className="space-y-3">
                {availableCars.map((car) => (
                  <div
                    key={car.id}
                    className={`p-3 rounded-lg border ${
                      car.is_available
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{car.vehicle_number}</p>
                        <p className="text-xs text-gray-500">
                          {car.seating_capacity} seats • {car.fuel_type}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          car.is_available
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {car.is_available ? "Available" : "Booked"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Booking Process</h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Submit your booking request</li>
                <li>Admin reviews and approves</li>
                <li>Receive OTP upon approval</li>
                <li>Share OTP with driver on travel day</li>
                <li>Driver verifies OTP to confirm</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
