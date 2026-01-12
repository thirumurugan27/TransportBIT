import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet, getToday} from "../../../utils/api";
import {
  Calendar,
  Clock,
  Bus,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
} from "lucide-react";

export default function DriverHome() {
  const [assignments, setAssignments] = useState([]);
  const {user} = useAuth();
  const driverName = user?.full_name || "Driver";
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
    }
  }, [driverId]);

  const fetchAssignments = async () => {
    try {
      const today = getToday();
      // Use plural endpoint to get all assignments (Regular + EV)
      const res = await apiGet(
        `/api/driver/assignments/today?driver_id=${driverId}&date=${today}`
      );
      if (res.ok) {
        const data = await res.json();
        setAssignments(data || []);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error(err);
      setAssignments([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-primary to-primarydull rounded-md p-8 text-white shadow-xl">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {driverName}!</h2>
        <p className="text-white/80 text-lg">
          Drive safely and have a great day.
        </p>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-primarytext mb-4 flex items-center gap-2">
          <Calendar className="text-primary" size={24} />
          Today's Duties
        </h3>

        {assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment, index) => {
              const isTemp = assignment.is_temporary_replacement;
              return (
                <div
                  key={assignment.id || index}
                  className={`relative p-5 rounded-md transition-all hover:shadow-md group overflow-hidden ${
                    isTemp
                      ? "bg-linear-to-br from-white to-orange-50 border-pending border-2 shadow-pending/10"
                      : "bg-white border border-gray-100 hover:border-primarydull"
                  }`}
                >
                  {/* Accent Side Bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isTemp ? "bg-pending" : "bg-primary"
                    }`}
                  ></div>

                  <div className="flex flex-col md:flex-row md:items-center gap-5 pl-2">
                    {/* Icon */}
                    <div
                      className={`p-3 rounded-full shrink-0 ${
                        isTemp
                          ? "bg-pending/10 text-pending"
                          : "bg-primarybg text-primary group-hover:bg-primary group-hover:text-white transition-colors"
                      }`}
                    >
                      {assignment.vehicle_type === "CAR" ? (
                        <Truck size={24} />
                      ) : (
                        <Bus size={24} />
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Vehicle Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Vehicle
                        </p>
                        <p className="font-bold text-primarytext text-lg">
                          {assignment.vehicle_number}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              isTemp
                                ? "bg-pending/10 text-pending"
                                : "bg-green/10 text-green"
                            }`}
                          >
                            {assignment.vehicle_type}
                          </span>
                        </div>
                        {isTemp && (
                          <div className="flex items-center gap-1 mt-1 text-pending">
                            <RotateCcw size={12} />
                            <span className="text-xs font-bold">
                              Covering: {assignment.original_driver_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Shift Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Shift
                        </p>
                        <p className="font-medium text-primarytext">
                          {assignment.shift_name}
                        </p>
                      </div>

                      {/* Time Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Time
                        </p>
                        <div className="flex items-center gap-1.5 text-primarytext font-medium">
                          <Clock size={14} className="text-gray-400" />
                          {assignment.start_time} - {assignment.end_time}
                        </div>
                      </div>

                      {/* Status Info */}
                      <div>
                        <p className="text-xs text-secondarytext uppercase tracking-wider font-semibold">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            assignment.status === "completed"
                              ? "bg-green/10 text-green"
                              : isTemp
                              ? "bg-pending/10 text-pending"
                              : "bg-primarybg text-primary"
                          }`}
                        >
                          {assignment.status === "completed" ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          )}
                          {assignment.status || "Scheduled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-md border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-secondarytext font-medium">
              No duties assigned for today.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Check back later or contact admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
