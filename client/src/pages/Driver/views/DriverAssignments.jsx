import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet} from "../../../utils/api";
import {
  Calendar,
  Clock,
  Bus,
  RefreshCcw,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  CalendarCheck,
  Truck,
} from "lucide-react";

export default function DriverAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const {user} = useAuth();
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
    }
  }, [driverId]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/driver/assignments?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "COMPLETED":
        return {
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          icon: <CheckCircle2 size={14} />,
          label: "Completed",
        };
      case "SCHEDULED":
        return {
          color: "text-primary",
          bg: "bg-primary/10",
          border: "border-primary/20",
          icon: <CalendarCheck size={14} />,
          label: "Scheduled",
        };
      case "CANCELLED":
        return {
          color: "text-red",
          bg: "bg-red/10",
          border: "border-red/20",
          icon: <AlertCircle size={14} />,
          label: "Cancelled",
        };
      case "IN_PROGRESS":
        return {
          color: "text-pending",
          bg: "bg-pending/10",
          border: "border-pending/20",
          icon: <RefreshCcw size={14} />,
          label: "In Progress",
        };
      default:
        return {
          color: "text-secondarytext",
          bg: "bg-gray-100",
          border: "border-gray-200",
          icon: <Calendar size={14} />,
          label: status,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays className="text-primary" size={28} />
            My Assignments
          </h2>
          <p className="text-sm text-secondarytext mt-1">
            View your upcoming trips and schedule history
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-full"></div>
        </div>
      ) : (
        <>
          {assignments.length === 0 ? (
            <div className="bg-white rounded-md p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Calendar className="text-gray-300" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                No Assignments Found
              </h3>
              <p className="text-secondarytext mt-1 max-w-sm">
                You don't have any vehicle assignments scheduled at the moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {assignments.map((assignment, index) => {
                const status = getStatusConfig(assignment.status);
                const isTemp = assignment.is_temporary_replacement;

                return (
                  <div
                    key={assignment.id || index}
                    className={`bg-white rounded-md p-5 border shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden ${
                      isTemp
                        ? "border-pending border-2 shadow-pending/10 bg-linear-to-br from-white to-orange-50"
                        : "border-gray-100"
                    }`}
                  >
                    {/* Top Accent Bar */}
                    <div
                      className={`absolute top-0 left-0 w-full ${
                        isTemp ? "h-1.5 bg-pending" : "h-1 bg-primary"
                      } opacity-80`}
                    ></div>

                    {/* Header: Date & Status */}
                    <div className="flex justify-between items-start mb-4 pt-1">
                      <div>
                        <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-0.5">
                          Date Range
                        </p>
                        <p className="text-base font-bold text-gray-800 flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400" />
                          {assignment.start_date === assignment.end_date
                            ? assignment.start_date
                            : `${assignment.start_date} - ${assignment.end_date}`}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.color} ${status.border}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-3">
                      {/* Shift Row */}
                      <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-md">
                        <div className="bg-white p-1.5 rounded-md shadow-sm text-primary">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-secondarytext">
                            Shift / Time
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {assignment.shift_name}
                          </p>
                          <p className="text-xs text-secondarytext font-mono mt-0.5">
                            {assignment.start_time} - {assignment.end_time}
                          </p>
                        </div>
                      </div>

                      {/* Vehicle Row */}
                      <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-md">
                        <div className="bg-white p-1.5 rounded-md shadow-sm text-primary">
                          {assignment.vehicle_type === "CAR" ? (
                            <Truck size={16} />
                          ) : (
                            <Bus size={16} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-secondarytext">
                            Vehicle Details
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {assignment.vehicle_number}
                          </p>
                          <p className="text-xs text-secondarytext mt-0.5">
                            {assignment.vehicle_type}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Temp Assignment Info */}
                    {isTemp && (
                      <div className="mt-4 pt-3 border-t border-dashed border-pending/30">
                        <div className="flex items-center gap-2 text-pending">
                          <AlertCircle size={16} />
                          <span className="text-xs font-bold uppercase">
                            Relief Assignment
                          </span>
                        </div>
                        <p className="text-xs text-secondarytext mt-1 pl-6">
                          Covering for:{" "}
                          <span className="font-semibold text-gray-700">
                            {assignment.original_driver_name}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
