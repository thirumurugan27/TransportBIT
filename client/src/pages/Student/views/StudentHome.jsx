import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../../context/AuthContext";
import Loading from "../../../components/ui/Loading";
import {apiGet} from "../../../utils/api";

export default function StudentHome() {
  const {user} = useAuth();
  const studentName = user?.full_name || user?.username || "Student";
  const [transport, setTransport] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTransport();
    fetchTransportRequests();
  }, []);

  const fetchTransport = async () => {
    try {
      const res = await apiGet("/api/student/transport");
      if (res.ok) {
        const data = await res.json();
        setTransport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransportRequests = async () => {
    try {
      const res = await apiGet("/api/student/transport/requests");
      if (res.ok) {
        const data = await res.json();
        // Find pending request
        const pending = (data || []).find((r) => r.status === "pending");
        setPendingRequest(pending);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-primary rounded-md p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-1">Hello, {studentName}!</h2>
        <p className="text-white/80">
          Access your bus schedule, transport details, and fees information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Bus Info Card */}
        <div
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/student-dashboard/my-bus")}
        >
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-800">My Bus</h3>
          </div>
          {loading ? (
            <Loading fullScreen={false} size="small" />
          ) : transport ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-gray-800">
                {transport.vehicle_name}
              </p>
              <p className="text-gray-500 text-sm">{transport.bus_number}</p>
              <p className="text-gray-500 text-sm">
                {transport.route_start} → {transport.route_end}
              </p>
            </div>
          ) : pendingRequest ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-yellow-600">
                Pending Approval
              </p>
              <p className="text-gray-500 text-sm">
                Bus: {pendingRequest.vehicle_name}
              </p>
            </div>
          ) : (
            <p className="text-yellow-600 text-sm">No bus assigned yet</p>
          )}
        </div>

        {/* Stop Info Card */}
        <div
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/student-dashboard/my-bus")}
        >
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-800">My Stop</h3>
          </div>
          {loading ? (
            <Loading fullScreen={false} size="small" />
          ) : transport ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-gray-800">
                {transport.stop_name}
              </p>
              <p className="text-gray-500 text-sm">
                Arrival: {transport.arrival_time || "N/A"}
              </p>
            </div>
          ) : pendingRequest ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-yellow-600">
                Pending Approval
              </p>
              <p className="text-gray-500 text-sm">
                Stop: {pendingRequest.stop_name}
              </p>
            </div>
          ) : (
            <p className="text-yellow-600 text-sm">No stop assigned</p>
          )}
        </div>

        {/* Fee Status Card */}
        <div
          className="bg-white p-6 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/student-dashboard/my-bus")}
        >
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-800">Fee Status</h3>
          </div>
          {loading ? (
            <Loading fullScreen={false} size="small" />
          ) : transport ? (
            <div className="space-y-1">
              <p className="text-gray-500 text-sm">
                Total: ₹{transport.total_fee?.toLocaleString()}
              </p>
              <p className="text-green-600 text-sm">
                Paid: ₹{transport.paid_amount?.toLocaleString()}
              </p>
              <p
                className={`text-sm font-medium ${transport.balance > 0 ? "text-red-600" : "text-green-600"}`}
              >
                Balance: ₹{transport.balance?.toLocaleString()}
              </p>
            </div>
          ) : pendingRequest ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-yellow-600">
                Pending Approval
              </p>
              <p className="text-gray-500 text-sm">
                Fee: ₹{pendingRequest.fee?.toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No fee information</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/student-dashboard/my-bus")}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primarydull transition-colors"
          >
            View Transport Details
          </button>
          <button
            onClick={() => navigate("/student-dashboard/track-bus")}
            className="px-4 py-2 bg-green text-white rounded-md hover:opacity-90 transition-opacity"
          >
            Track My Bus
          </button>
        </div>
      </div>
    </div>
  );
}
