import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet} from "../../../utils/api";
import {formatTime} from "../../../utils/dateFormat";
import {
  Calendar,
  Clock,
  Bus,
  RefreshCcw,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  CalendarCheck,
  Users,
  Car,
  Zap,
  X,
  Eye,
  ChevronRight,
  MapPin,
  FileText,
  Key,
  Truck,
} from "lucide-react";

export default function DriverAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEVAssignment, setSelectedEVAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
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
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return {
          color: "text-green-600",
          bg: "bg-green-50",
          border: "border-green-200",
          icon: <CheckCircle2 size={14} />,
          label: "Completed",
        };
      case "SCHEDULED":
      case "ASSIGNED":
        return {
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: <CalendarCheck size={14} />,
          label: "Scheduled",
        };
      case "CANCELLED":
        return {
          color: "text-red-600",
          bg: "bg-red-50",
          border: "border-red-200",
          icon: <AlertCircle size={14} />,
          label: "Cancelled",
        };
      case "IN_PROGRESS":
        return {
          color: "text-amber-600",
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: <RefreshCcw size={14} />,
          label: "In Progress",
        };
      case "ONHOLD":
        return {
          color: "text-purple-600",
          bg: "bg-purple-50",
          border: "border-purple-200",
          icon: <Key size={14} />,
          label: "Pending OTP",
        };
      default:
        return {
          color: "text-gray-600",
          bg: "bg-gray-50",
          border: "border-gray-200",
          icon: <Calendar size={14} />,
          label: status || "Unknown",
        };
    }
  };

  // Filter assignments based on active tab
  const filteredAssignments = assignments.filter((assignment) => {
    if (activeTab === "all") return true;
    if (activeTab === "bus")
      return (
        assignment.vehicle_type === "BUS" &&
        !assignment.is_ev_assignment &&
        !assignment.is_temporary_replacement
      );
    if (activeTab === "car")
      return (
        assignment.vehicle_type === "CAR" &&
        !assignment.is_temporary_replacement
      );
    if (activeTab === "ev") return assignment.is_ev_assignment;
    if (activeTab === "other")
      return (
        !assignment.is_ev_assignment &&
        !assignment.is_temporary_replacement &&
        assignment.vehicle_type !== "BUS" &&
        assignment.vehicle_type !== "CAR" &&
        assignment.vehicle_type !== "EV"
      );
    if (activeTab === "temporary") return assignment.is_temporary_replacement;
    return true;
  });

  // Get counts for each tab
  const getCounts = () => {
    return {
      all: assignments.length,
      bus: assignments.filter(
        (a) =>
          a.vehicle_type === "BUS" &&
          !a.is_ev_assignment &&
          !a.is_temporary_replacement,
      ).length,
      car: assignments.filter(
        (a) => a.vehicle_type === "CAR" && !a.is_temporary_replacement,
      ).length,
      ev: assignments.filter((a) => a.is_ev_assignment).length,
      other: assignments.filter(
        (a) =>
          !a.is_ev_assignment &&
          !a.is_temporary_replacement &&
          a.vehicle_type !== "BUS" &&
          a.vehicle_type !== "CAR" &&
          a.vehicle_type !== "EV",
      ).length,
      temporary: assignments.filter((a) => a.is_temporary_replacement).length,
    };
  };

  const counts = getCounts();

  const tabs = [
    {
      id: "all",
      label: "All",
      icon: <CalendarDays size={16} />,
      count: counts.all,
    },
    {id: "bus", label: "Bus", icon: <Bus size={16} />, count: counts.bus},
    {id: "car", label: "Car", icon: <Car size={16} />, count: counts.car},
    {id: "ev", label: "EV", icon: <Zap size={16} />, count: counts.ev},
    {
      id: "other",
      label: "Other",
      icon: <Truck size={16} />,
      count: counts.other,
    },
    {
      id: "temporary",
      label: "Relief",
      icon: <RefreshCcw size={16} />,
      count: counts.temporary,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays className="text-primary" size={28} />
            My Assignments
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            View all your vehicle assignments across all dates
          </p>
        </div>
        <button
          onClick={fetchAssignments}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary rounded-full"></div>
        </div>
      ) : (
        <>
          {filteredAssignments.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Calendar className="text-gray-300" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                No Assignments Found
              </h3>
              <p className="text-gray-500 mt-1 max-w-sm">
                {activeTab === "all"
                  ? "You don't have any vehicle assignments at the moment."
                  : `No ${activeTab} assignments found.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAssignments.map((assignment, index) => {
                const status = getStatusConfig(assignment.status);
                const isTemp = assignment.is_temporary_replacement;
                const isEV = assignment.is_ev_assignment;
                const isCar = assignment.vehicle_type === "CAR";

                // EV Assignment Card - Show as Group
                if (isEV) {
                  return (
                    <div
                      key={`ev-${assignment.id || index}`}
                      onClick={() => setSelectedEVAssignment(assignment)}
                      className="bg-white rounded-xl p-5 border-2 border-green-500 shadow-sm hover:shadow-lg transition-all duration-200 group relative overflow-hidden cursor-pointer"
                    >
                      {/* Top Accent Bar */}
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 to-green-600"></div>

                      {/* EV Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <Zap size={12} />
                        EV
                      </div>

                      {/* Header: Date & Status */}
                      <div className="flex justify-between items-start mb-4 pt-1">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                            Date Range
                          </p>
                          <p className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            {assignment.start_date === assignment.end_date
                              ? assignment.start_date
                              : `${assignment.start_date} - ${assignment.end_date}`}
                          </p>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="space-y-3">
                        {/* Shift Row */}
                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-green-600">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              Shift / Time
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {assignment.shift_name}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                              {formatTime(assignment.start_time)} -{" "}
                              {formatTime(assignment.end_time)}
                            </p>
                          </div>
                        </div>

                        {/* Vehicle Group Row */}
                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-green-600">
                            <Zap size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              Vehicle Group
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {assignment.vehicle_group_name}
                            </p>
                            <p className="text-xs text-green-600 mt-0.5">
                              {assignment.group_vehicles?.length || 0} Vehicles
                            </p>
                          </div>
                        </div>

                        {/* Driver Group Row */}
                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-green-600">
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              Driver Group
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {assignment.driver_group_name}
                            </p>
                            <p className="text-xs text-green-600 mt-0.5">
                              {assignment.group_drivers?.length || 0} Drivers
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* View Details Footer */}
                      <div className="mt-4 pt-3 border-t border-dashed border-green-300">
                        <div className="flex items-center justify-center gap-2 text-green-600 group-hover:text-green-700">
                          <Eye size={16} />
                          <span className="text-sm font-bold">
                            View Details
                          </span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  );
                }

                // Car Assignment Card
                if (isCar && !isTemp) {
                  return (
                    <div
                      key={`car-${assignment.id || index}`}
                      className="bg-white rounded-xl p-5 border-2 border-indigo-500 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden"
                    >
                      {/* Top Accent Bar */}
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

                      {/* Car Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <Car size={12} />
                        CAR
                      </div>

                      {/* Header: Date & Status */}
                      <div className="flex justify-between items-start mb-4 pt-1">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                            Date
                          </p>
                          <p className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            {assignment.start_date === assignment.end_date
                              ? assignment.start_date
                              : `${assignment.start_date} - ${assignment.end_date}`}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.color} ${status.border} mt-6`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </div>

                      {/* Info Grid */}
                      <div className="space-y-3">
                        {/* Shift Row */}
                        <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              Shift / Time
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {assignment.shift_name}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                              {formatTime(assignment.start_time)} -{" "}
                              {formatTime(assignment.end_time)}
                            </p>
                          </div>
                        </div>

                        {/* Vehicle Row */}
                        <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600">
                            <Car size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              Vehicle
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {assignment.vehicle_number}
                            </p>
                          </div>
                        </div>

                        {/* Purpose */}
                        {assignment.purpose && (
                          <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500">
                                Purpose
                              </p>
                              <p className="text-sm font-bold text-gray-800">
                                {assignment.purpose}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Destination */}
                        {assignment.destination && (
                          <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600">
                              <MapPin size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500">
                                Destination
                              </p>
                              <p className="text-sm font-bold text-gray-800">
                                {assignment.destination}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* OTP Footer for onhold status */}
                      {assignment.otp &&
                        assignment.status?.toLowerCase() === "onhold" && (
                          <div className="mt-4 pt-3 border-t border-dashed border-indigo-300">
                            <div className="flex items-center justify-center gap-2 bg-purple-100 text-purple-700 p-3 rounded-lg">
                              <Key size={18} />
                              <span className="text-sm font-bold">OTP: </span>
                              <span className="text-lg font-mono font-bold tracking-widest">
                                {assignment.otp}
                              </span>
                            </div>
                            <p className="text-xs text-center text-gray-500 mt-2">
                              Share this OTP with the faculty to confirm
                            </p>
                          </div>
                        )}
                    </div>
                  );
                }

                // Regular/Temporary Assignment Card (Bus, etc.)
                return (
                  <div
                    key={`reg-${assignment.id || index}`}
                    className={`bg-white rounded-xl p-5 border-2 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden ${
                      isTemp ? "border-amber-500" : "border-gray-200"
                    }`}
                  >
                    {/* Top Accent Bar */}
                    <div
                      className={`absolute top-0 left-0 w-full h-1.5 ${
                        isTemp
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-blue-500 to-blue-600"
                      }`}
                    ></div>

                    {/* Type Badge */}
                    {isTemp ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <RefreshCcw size={12} />
                        RELIEF
                      </div>
                    ) : assignment.vehicle_type !== "BUS" &&
                      assignment.vehicle_type !== "CAR" ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <Truck size={12} />
                        {assignment.vehicle_type}
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <Bus size={12} />
                        {assignment.vehicle_type}
                      </div>
                    )}

                    {/* Header: Date & Status */}
                    <div className="flex justify-between items-start mb-4 pt-1">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
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
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.color} ${status.border} mt-6`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-3">
                      {/* Shift Row */}
                      <div
                        className={`flex items-start gap-3 p-3 rounded-lg ${isTemp ? "bg-amber-50" : "bg-gray-50"}`}
                      >
                        <div
                          className={`bg-white p-2 rounded-lg shadow-sm ${isTemp ? "text-amber-600" : "text-blue-600"}`}
                        >
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">
                            Shift / Time
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {assignment.shift_name}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {formatTime(assignment.start_time)} -{" "}
                            {formatTime(assignment.end_time)}
                          </p>
                        </div>
                      </div>

                      {/* Vehicle Row */}
                      <div
                        className={`flex items-start gap-3 p-3 rounded-lg ${isTemp ? "bg-amber-50" : "bg-gray-50"}`}
                      >
                        <div
                          className={`bg-white p-2 rounded-lg shadow-sm ${isTemp ? "text-amber-600" : "text-blue-600"}`}
                        >
                          <Bus size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">
                            Vehicle Details
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {assignment.vehicle_number}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {assignment.vehicle_type}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Temp Assignment Info */}
                    {isTemp && (
                      <div className="mt-4 pt-3 border-t border-dashed border-amber-300">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertCircle size={16} />
                          <span className="text-xs font-bold uppercase">
                            Relief Assignment
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 pl-6">
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

      {/* EV Assignment Details Modal */}
      {selectedEVAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">EV Assignment Details</h3>
                  <p className="text-white/80 text-sm">
                    {selectedEVAssignment.shift_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Date & Time Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Date Range
                  </p>
                  <p className="font-bold text-gray-800">
                    {selectedEVAssignment.start_date ===
                    selectedEVAssignment.end_date
                      ? selectedEVAssignment.start_date
                      : `${selectedEVAssignment.start_date} - ${selectedEVAssignment.end_date}`}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Shift Time
                  </p>
                  <p className="font-bold text-gray-800">
                    {formatTime(selectedEVAssignment.start_time)} -{" "}
                    {formatTime(selectedEVAssignment.end_time)}
                  </p>
                </div>
              </div>

              {/* Vehicle Group */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Car size={18} className="text-green-600" />
                  Vehicle Group: {selectedEVAssignment.vehicle_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <p className="font-bold text-gray-800">
                        {vehicle.vehicle_number}
                      </p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {vehicle.fuel_type}
                      </span>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_vehicles ||
                    selectedEVAssignment.group_vehicles.length === 0) && (
                    <p className="col-span-2 text-gray-500 text-sm">
                      No vehicles in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Driver Group */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Users size={18} className="text-green-600" />
                  Driver Group: {selectedEVAssignment.driver_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                        {driver.name?.charAt(0).toUpperCase()}
                      </div>
                      <p className="font-medium text-gray-800 text-sm">
                        {driver.name}
                      </p>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_drivers ||
                    selectedEVAssignment.group_drivers.length === 0) && (
                    <p className="col-span-2 text-gray-500 text-sm">
                      No drivers in this group
                    </p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <span className="text-gray-600 font-medium">Status</span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-green-100 text-green-700">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {selectedEVAssignment.status}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
