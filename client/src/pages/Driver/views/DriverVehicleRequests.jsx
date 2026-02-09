import React, {useState, useEffect} from "react";
import {
  Clock,
  CheckCircle,
  Truck,
  MapPin,
  Calendar,
  Phone,
  User,
  Building,
  FileText,
  Eye,
  X,
  Users,
} from "lucide-react";
import Loading from "../../../components/ui/Loading";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? {Authorization: `Bearer ${token}`} : {};
};

const STATUS_CONFIG = {
  assigned: {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Truck,
    label: "Assigned",
  },
  completed: {
    color: "bg-green/10 text-green border-green/20",
    icon: CheckCircle,
    label: "Completed",
  },
};

export default function DriverVehicleRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState("assigned");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/driver/vehicle-requests`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setRequests((await res.json()) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = filterStatus
    ? requests.filter((r) => r.status === filterStatus)
    : requests;

  const upcomingRequests = requests.filter((r) => {
    if (r.status !== "assigned") return false;
    const today = new Date().toISOString().split("T")[0];
    return r.trips?.some((t) => t.departure_date >= today);
  });

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-6">
        <h3 className="text-2xl font-bold text-primarytext flex items-center gap-2">
          <FileText size={24} className="text-primary" />
          Vehicle Requests
        </h3>
        <p className="text-sm text-secondarytext mt-1">
          Faculty vehicle requests assigned to you
        </p>
      </div>

      {/* Upcoming Summary */}
      {upcomingRequests.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-primary" />
            <span className="font-semibold text-primarytext">
              Upcoming Trips ({upcomingRequests.length})
            </span>
          </div>
          <div className="space-y-2">
            {upcomingRequests.slice(0, 3).map((req) => {
              const nextTrip = req.trips?.find(
                (t) => t.departure_date >= new Date().toISOString().split("T")[0]
              );
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-secondarybg rounded-md p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primarytext truncate">
                      {req.faculty_name} - {req.purpose}
                    </p>
                    {nextTrip && (
                      <p className="text-xs text-secondarytext mt-0.5">
                        {nextTrip.departure_date} at {nextTrip.departure_time} · {nextTrip.departure_location} → {nextTrip.arrival_location}
                      </p>
                    )}
                  </div>
                  <Eye size={16} className="text-secondarytext ml-2" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = requests.filter((r) => r.status === key).length;
          const StatusIcon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={`flex-1 p-4 rounded-md border text-left transition-all bg-secondarybg ${
                filterStatus === key
                  ? "ring-2 ring-primary border-primary"
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon size={16} className={cfg.color.split(" ")[1]} />
                <span className="text-sm font-medium text-primarytext">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-primarytext">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Request List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-secondarybg rounded-md border border-gray-100 p-12 text-center">
          <FileText size={40} className="mx-auto text-secondarytext mb-3" />
          <p className="text-secondarytext">No vehicle requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.assigned;
            const StatusIcon = cfg.icon;
            const firstTrip = req.trips?.[0];

            return (
              <div
                key={req.id}
                className="bg-secondarybg rounded-md shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedRequest(req)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${cfg.color}`}
                      >
                        <StatusIcon size={12} />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-secondarytext">
                        #{req.id}
                      </span>
                    </div>
                    
                    <p className="text-sm font-medium text-primarytext">
                      {req.purpose}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-secondarytext">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {req.faculty_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building size={12} />
                        {req.faculty_department}
                      </span>
                    </div>

                    {firstTrip && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-secondarytext">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {firstTrip.departure_date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {firstTrip.departure_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {firstTrip.departure_location} → {firstTrip.arrival_location}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-xs mr-2">
                      <p className="text-primary font-medium flex items-center gap-1">
                        <Truck size={12} />
                        {req.vehicle_name || req.vehicle_number}
                      </p>
                      <p className="text-secondarytext">{req.vehicle_type}</p>
                    </div>
                    <Eye size={16} className="text-secondarytext" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-secondarybg rounded-md shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-secondarybg z-10">
              <h3 className="text-lg font-bold text-primarytext">
                Trip Details #{selectedRequest.id}
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-md hover:bg-primarybg transition-colors"
              >
                <X size={18} className="text-secondarytext" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Badge */}
              {(() => {
                const cfg =
                  STATUS_CONFIG[selectedRequest.status] || STATUS_CONFIG.assigned;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium border ${cfg.color}`}
                  >
                    <StatusIcon size={14} />
                    {cfg.label}
                  </div>
                );
              })()}

              {/* Faculty Info */}
              <div className="bg-primarybg rounded-md p-4">
                <p className="text-sm font-semibold text-primarytext mb-2">
                  Faculty Information
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-secondarytext" />
                    <span className="text-primarytext">{selectedRequest.faculty_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building size={14} className="text-secondarytext" />
                    <span className="text-primarytext">{selectedRequest.faculty_department}</span>
                  </div>
                  {selectedRequest.faculty_phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-secondarytext" />
                      <a href={`tel:${selectedRequest.faculty_phone}`} className="text-primary hover:underline">
                        {selectedRequest.faculty_phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-secondarytext" />
                    <span className="text-primarytext">{selectedRequest.total_passengers} passengers</span>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <span className="text-sm text-secondarytext">Purpose:</span>
                <p className="mt-1 text-sm text-primarytext bg-primarybg rounded-md p-3">
                  {selectedRequest.purpose}
                </p>
              </div>

              {/* Vehicle Info */}
              <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
                <p className="text-sm font-semibold text-primary mb-2">
                  Your Vehicle
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-secondarytext">Vehicle:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.vehicle_name || selectedRequest.vehicle_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-secondarytext">Type:</span>
                    <p className="font-medium text-primarytext">
                      {selectedRequest.vehicle_type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trip Legs */}
              <div>
                <p className="text-sm font-semibold text-primarytext mb-2">
                  Trip Schedule
                </p>
                {selectedRequest.trips?.map((trip, idx) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isUpcoming = trip.departure_date >= today;
                  const isPast = trip.departure_date < today;
                  
                  return (
                    <div
                      key={idx}
                      className={`border rounded-md p-4 mb-2 ${
                        isUpcoming 
                          ? "border-primary/30 bg-primary/5" 
                          : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-primarytext">
                          Leg {trip.trip_order}
                        </p>
                        {isUpcoming && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-md">
                            Upcoming
                          </span>
                        )}
                        {isPast && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                            Past
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-secondarybg rounded-md p-2.5">
                          <p className="text-primary font-medium mb-1">Departure</p>
                          <p className="text-primarytext font-medium">
                            {trip.departure_date} at {trip.departure_time}
                          </p>
                          <p className="text-secondarytext mt-1">
                            <MapPin size={10} className="inline mr-1" />
                            {trip.departure_location}
                          </p>
                        </div>
                        <div className="bg-secondarybg rounded-md p-2.5">
                          <p className="text-green font-medium mb-1">Arrival</p>
                          <p className="text-primarytext font-medium">
                            {trip.arrival_date} at {trip.arrival_time}
                          </p>
                          <p className="text-secondarytext mt-1">
                            <MapPin size={10} className="inline mr-1" />
                            {trip.arrival_location}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-secondarytext">
                        <Users size={10} className="inline mr-1" />
                        {trip.num_passengers} passenger(s)
                        {trip.passenger_contacts && ` · Contact: ${trip.passenger_contacts}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
