import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet} from "../../../utils/api";
import {formatTime} from "../../../utils/dateFormat";
import Loading from "../../../components/ui/Loading";
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
  FileText,
  Key,
  Truck,
} from "lucide-react";

export default function DriverAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEVAssignment, setSelectedEVAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const {user} = useAuth();
  const driverId = user?.driver_id;

  useEffect(() => {
    if (driverId) {
      fetchAssignments();
    }
  }, [driverId, filterDate]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const dateParam = filterDate ? `&date=${filterDate}` : "";
      const res = await apiGet(
        `/api/driver/assignments?driver_id=${driverId}${dateParam}`,
      );
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
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          icon: <CheckCircle2 size={14} />,
          label: "Completed",
        };
      case "SCHEDULED":
      case "ASSIGNED":
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
      case "ONHOLD":
        return {
          color: "text-primarydull",
          bg: "bg-primarydull/10",
          border: "border-primarydull/20",
          icon: <Key size={14} />,
          label: "On Hold",
        };
      default:
        return {
          color: "text-secondarytext",
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays className="text-primary" size={24} />
            My Assignments
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            View your vehicle assignments for a selected date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[38px] px-3 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          />
          {filterDate !== new Date().toISOString().split("T")[0] && (
            <button
              onClick={() =>
                setFilterDate(new Date().toISOString().split("T")[0])
              }
              className="px-3 py-2 text-xs text-primary border border-primary/30 rounded-md hover:bg-primary/5 font-semibold transition-colors whitespace-nowrap"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setFilterDate("")}
            className={`px-3 py-2 text-xs rounded-md font-semibold transition-colors whitespace-nowrap ${
              filterDate === ""
                ? "bg-primary text-white"
                : "text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={fetchAssignments}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-1.5 sm:p-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-md font-medium text-xs sm:text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-md text-xs font-bold ${
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
        <Loading fullScreen={false} />
      ) : (
        <>
          {filteredAssignments.length === 0 ? (
            <div className="bg-white rounded-md p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center mb-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
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
                      className="bg-white rounded-md p-5 border-2 border-green shadow-sm hover:shadow-lg transition-all duration-200 group relative overflow-hidden cursor-pointer"
                    >
                      {/* Top Accent Bar */}
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-green"></div>

                      {/* EV Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-green text-white text-xs font-bold px-2.5 py-1 rounded-md">
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
                        <div className="flex items-start gap-3 p-3 bg-green/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-green">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Shift / Time
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.shift_name}
                            </p>
                            <p className="text-xs text-secondarytext font-mono mt-0.5">
                              {formatTime(assignment.start_time)} -{" "}
                              {formatTime(assignment.end_time)}
                            </p>
                          </div>
                        </div>

                        {/* Vehicle Group Row */}
                        <div className="flex items-start gap-3 p-3 bg-green/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-green">
                            <Zap size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Vehicle Group
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.vehicle_group_name}
                            </p>
                            <p className="text-xs text-green mt-0.5">
                              {assignment.group_vehicles?.length || 0} Vehicles
                            </p>
                          </div>
                        </div>

                        {/* Driver Group Row */}
                        <div className="flex items-start gap-3 p-3 bg-green/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-green">
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Driver Group
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.driver_group_name}
                            </p>
                            <p className="text-xs text-green mt-0.5">
                              {assignment.group_drivers?.length || 0} Drivers
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* View Details Footer */}
                      <div className="mt-4 pt-3 border-t border-dashed border-green/30">
                        <div className="flex items-center justify-center gap-2 text-green group-hover:opacity-80">
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
                      className="bg-white rounded-md p-5 border-2 border-primary shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden"
                    >
                      {/* Top Accent Bar */}
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>

                      {/* Car Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-md">
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
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${status.bg} ${status.color} ${status.border} mt-6`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </div>

                      {/* Info Grid */}
                      <div className="space-y-3">
                        {/* Shift Row */}
                        <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-primary">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Shift / Time
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.shift_name}
                            </p>
                            <p className="text-xs text-secondarytext font-mono mt-0.5">
                              {formatTime(assignment.start_time)} -{" "}
                              {formatTime(assignment.end_time)}
                            </p>
                          </div>
                        </div>

                        {/* Vehicle Row */}
                        <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-primary">
                            <Car size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Vehicle
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.vehicle_name ||
                                assignment.vehicle_number}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        {assignment.description && (
                          <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-md">
                            <div className="bg-white p-2 rounded-md shadow-sm text-primary">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-secondarytext">
                                Description
                              </p>
                              <p className="text-sm font-bold text-primarytext">
                                {assignment.description}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Regular/Temporary Assignment Card (Bus, etc.)
                return (
                  <div
                    key={`reg-${assignment.id || index}`}
                    className={`bg-white rounded-md p-5 border-2 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden ${
                      isTemp ? "border-pending" : "border-gray-200"
                    }`}
                  >
                    {/* Top Accent Bar */}
                    <div
                      className={`absolute top-0 left-0 w-full h-1.5 ${
                        isTemp ? "bg-pending" : "bg-primary"
                      }`}
                    ></div>

                    {/* Type Badge */}
                    {isTemp ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-pending text-white text-xs font-bold px-2.5 py-1 rounded-md">
                        <RefreshCcw size={12} />
                        RELIEF
                      </div>
                    ) : assignment.vehicle_type !== "BUS" &&
                      assignment.vehicle_type !== "CAR" ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-pending text-white text-xs font-bold px-2.5 py-1 rounded-md">
                        <Truck size={12} />
                        {assignment.vehicle_type}
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-md">
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
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${status.bg} ${status.color} ${status.border} mt-6`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-3">
                      {/* Shift Row */}
                      <div
                        className={`flex items-start gap-3 p-3 rounded-md ${isTemp ? "bg-pending/10" : "bg-primarybg"}`}
                      >
                        <div
                          className={`bg-white p-2 rounded-md shadow-sm ${isTemp ? "text-pending" : "text-primary"}`}
                        >
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-secondarytext">
                            Shift / Time
                          </p>
                          <p className="text-sm font-bold text-primarytext">
                            {assignment.shift_name}
                          </p>
                          <p className="text-xs text-secondarytext font-mono mt-0.5">
                            {formatTime(assignment.start_time)} -{" "}
                            {formatTime(assignment.end_time)}
                          </p>
                        </div>
                      </div>

                      {/* Vehicle Row */}
                      <div
                        className={`flex items-start gap-3 p-3 rounded-md ${isTemp ? "bg-pending/10" : "bg-primarybg"}`}
                      >
                        <div
                          className={`bg-white p-2 rounded-md shadow-sm ${isTemp ? "text-pending" : "text-primary"}`}
                        >
                          <Bus size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-secondarytext">
                            Vehicle Details
                          </p>
                          <p className="text-sm font-bold text-primarytext">
                            {assignment.vehicle_name ||
                              assignment.vehicle_number}
                          </p>
                          <p className="text-xs text-secondarytext mt-0.5">
                            {assignment.vehicle_type}
                          </p>
                        </div>
                      </div>

                      {/* Description Row */}
                      {assignment.description && (
                        <div
                          className={`flex items-start gap-3 p-3 rounded-md ${isTemp ? "bg-pending/10" : "bg-primarybg"}`}
                        >
                          <div
                            className={`bg-white p-2 rounded-md shadow-sm ${isTemp ? "text-pending" : "text-primary"}`}
                          >
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Description
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {assignment.description}
                            </p>
                          </div>
                        </div>
                      )}
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
        <div className="fixed inset-0 bg-black/50  flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-2xl sm:rounded-md shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-green text-white p-4 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-md">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold">
                    EV Assignment Details
                  </h3>
                  <p className="text-white/80 text-sm">
                    {selectedEVAssignment.shift_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-white/20 rounded-md transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Date & Time Info */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-green/10 rounded-md">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Date Range
                  </p>
                  <p className="font-bold text-primarytext text-sm">
                    {selectedEVAssignment.start_date ===
                    selectedEVAssignment.end_date
                      ? selectedEVAssignment.start_date
                      : `${selectedEVAssignment.start_date} - ${selectedEVAssignment.end_date}`}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-green/10 rounded-md">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Shift Time
                  </p>
                  <p className="font-bold text-primarytext text-sm">
                    {formatTime(selectedEVAssignment.start_time)} -{" "}
                    {formatTime(selectedEVAssignment.end_time)}
                  </p>
                </div>
              </div>

              {/* Vehicle Group */}
              <div>
                <h4 className="font-bold text-primarytext mb-3 flex items-center gap-2">
                  <Car size={18} className="text-green" />
                  Vehicle Group: {selectedEVAssignment.vehicle_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-3 bg-primarybg rounded-md border border-gray-200"
                    >
                      <p className="font-bold text-primarytext">
                        {vehicle.vehicle_name || vehicle.vehicle_number}
                      </p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-green/10 text-green">
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
                <h4 className="font-bold text-primarytext mb-3 flex items-center gap-2">
                  <Users size={18} className="text-green" />
                  Driver Group: {selectedEVAssignment.driver_group_name}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-3 bg-primarybg rounded-md border border-gray-200 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-green/10 rounded-md flex items-center justify-center text-green font-bold">
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
              <div className="flex items-center justify-between p-4 bg-green/10 rounded-md">
                <span className="text-secondarytext font-medium">Status</span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold bg-green/10 text-green">
                  <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  {selectedEVAssignment.status}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-md transition-colors"
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
