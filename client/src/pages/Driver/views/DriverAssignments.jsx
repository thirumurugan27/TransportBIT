import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { apiGet } from "../../../utils/api";
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
  ChevronDown,
  ChevronUp,
  FileText,
  Key,
  Truck,
  TrendingUp,
  MapPin,
  Users2,
} from "lucide-react";

export default function DriverAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEVAssignment, setSelectedEVAssignment] = useState(null);
  const [selectedRouteAssignment, setSelectedRouteAssignment] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const { user } = useAuth();
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
        let data = await res.json();
        data = data || [];

        // Sort assignments by start_time
        const parseTime = (timeStr) => {
          if (!timeStr) return 0;
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 0;
          let [_, hours, minutes, modifier] = match;
          hours = parseInt(hours, 10);
          if (hours === 12) hours = modifier.toUpperCase() === "AM" ? 0 : 12;
          else if (modifier.toUpperCase() === "PM") hours += 12;
          return hours * 60 + parseInt(minutes, 10);
        };
        data.sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));

        setAssignments(data);
        // Reset expanded state when data refreshes
        setRouteInfo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteInfo = async (assignment) => {
    if (!assignment?.vehicle_id) return;
    
    setSelectedRouteAssignment(assignment);
    setRouteLoading(true);
    setRouteInfo(null);
    
    try {
      const res = await apiGet(`/api/driver/bus/${assignment.vehicle_id}/route-info`);
      if (res.ok) {
        const data = await res.json();
        setRouteInfo(data);
      }
    } catch (err) {
      console.error("Route info fetch error:", err);
    } finally {
      setRouteLoading(false);
    }
  };

  const normalizeText = (value) =>
    typeof value === "string" ? value.trim() : "";

  const getAssignmentShifts = (assignment) => {
    if (Array.isArray(assignment?.shifts) && assignment.shifts.length > 0) {
      return assignment.shifts;
    }
    if (
      assignment?.shift_name ||
      assignment?.start_time ||
      assignment?.end_time
    ) {
      return [
        {
          shift_id: assignment?.shift_id,
          shift_name: assignment?.shift_name || "EV Duty",
          start_time: assignment?.start_time || "",
          end_time: assignment?.end_time || "",
        },
      ];
    }
    return [];
  };

  const getShiftHeadline = (assignment) => {
    const shifts = getAssignmentShifts(assignment);
    if (shifts.length === 0) return "EV Duty";
    if (shifts.length === 1) return shifts[0].shift_name || "EV Duty";
    return `${shifts[0].shift_name || "EV Duty"} +${shifts.length - 1} more`;
  };

  const getShiftTimeWindow = (shift = {}, assignment = {}) => {
    const start = shift.start_time || assignment?.start_time || "-";
    const end = shift.end_time || assignment?.end_time || "-";
    return `${start} - ${end}`;
  };

  const getShiftTimeLabel = (assignment) => {
    const shifts = getAssignmentShifts(assignment);
    if (shifts.length <= 1) {
      const firstShift = shifts[0] || {};
      return getShiftTimeWindow(firstShift, assignment);
    }
    return `${shifts.length} shifts assigned`;
  };

  const getVehicleDisplay = (vehicle) => {
    const vehicleName = normalizeText(vehicle?.vehicle_name);
    const vehicleNumber = normalizeText(vehicle?.vehicle_number);

    if (vehicleName && vehicleNumber && vehicleName !== vehicleNumber) {
      return { title: vehicleName, subtitle: vehicleNumber };
    }

    return {
      title: vehicleNumber || vehicleName || "Unknown vehicle",
      subtitle: vehicleName && vehicleName !== vehicleNumber ? vehicleName : "",
    };
  };

  const getVehicleReplacementDetails = (assignment) => {
    const previousVehicle = getVehicleDisplay({
      vehicle_name: assignment?.vehicle_name,
      vehicle_number: assignment?.vehicle_number,
    });
    const replacementVehicle = getVehicleDisplay({
      vehicle_name: assignment?.replacement_vehicle_name,
      vehicle_number: assignment?.replacement_vehicle_number,
    });

    const hasReplacement =
      normalizeText(assignment?.replacement_vehicle_number) !== "" ||
      normalizeText(assignment?.replacement_vehicle_name) !== "";

    return {
      hasReplacement,
      previousVehicle,
      activeVehicle: hasReplacement ? replacementVehicle : previousVehicle,
      replacementVehicle,
    };
  };

  const getDateRangeLabel = (assignment) =>
    assignment.start_date === assignment.end_date
      ? assignment.start_date
      : `${assignment.start_date} - ${assignment.end_date}`;

  const getStatusConfig = (status) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return {
          color: "text-green",
          bg: "bg-green/10",
          border: "border-green/20",
          icon: <CheckCircle2 size={14} />,
          label: "Active",
        };
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
    { id: "bus", label: "Bus", icon: <Bus size={16} />, count: counts.bus },
    { id: "car", label: "Car", icon: <Car size={16} />, count: counts.car },
    { id: "ev", label: "EV", icon: <Zap size={16} />, count: counts.ev },
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

  const selectedEVShifts = selectedEVAssignment
    ? getAssignmentShifts(selectedEVAssignment)
    : [];

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
            className="h-9.5 px-3 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
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
            className={`px-3 py-2 text-xs rounded-md font-semibold transition-colors whitespace-nowrap ${filterDate === ""
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
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-md font-medium text-xs sm:text-sm transition-all ${activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-md text-xs font-bold ${activeTab === tab.id
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
                const isCancelled = assignment.status?.toUpperCase() === "CANCELLED";
                const vehicleReplacement =
                  getVehicleReplacementDetails(assignment);

                // EV Assignment Card - Show as Group
                if (isEV) {
                  const shiftCount = getAssignmentShifts(assignment).length;
                  return (
                    <div
                      key={`ev-${assignment.id || index}`}
                      onClick={() => setSelectedEVAssignment(assignment)}
                      className={`rounded-md p-5 border-2 ${isCancelled ? "bg-gray-50 border-red opacity-60" : "bg-white border-green"} shadow-sm hover:shadow-lg transition-all duration-200 group relative overflow-hidden cursor-pointer z-0`}
                    >
                      {/* Cancelled Watermark */}
                      {isCancelled && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 text-red font-black text-5xl pointer-events-none uppercase tracking-widest z-0 whitespace-nowrap">
                          Cancelled
                        </div>
                      )}

                      {/* Top Accent Bar */}
                      <div className={`absolute top-0 left-0 w-full h-1.5 ${isCancelled ? "bg-red" : "bg-green"}`}></div>

                      {/* EV Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-green text-white text-xs font-bold px-2.5 py-1 rounded-md">
                        <Zap size={12} />
                        EV
                      </div>

                      {/* Header: Date & Status */}
                      <div className="flex justify-between items-start mb-4 pt-1 relative z-10">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                            Date Range
                          </p>
                          <p className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            {getDateRangeLabel(assignment)}
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
                        <div className="flex items-start gap-3 p-3 bg-green/10 rounded-md">
                          <div className="bg-white p-2 rounded-md shadow-sm text-green">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondarytext">
                              Shift / Time
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {getShiftHeadline(assignment)}
                            </p>
                            <p className="text-xs text-secondarytext font-mono mt-0.5">
                              {getShiftTimeLabel(assignment)}
                            </p>
                            {shiftCount > 1 && (
                              <p className="text-[11px] text-green mt-1 font-medium">
                                {shiftCount} shift blocks configured
                              </p>
                            )}
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
                            <p className="text-xs text-green mt-0.5 font-medium">
                              {assignment.group_vehicles?.length || 0} vehicles
                              ready
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
                            <p className="text-xs text-green mt-0.5 font-medium">
                              {assignment.group_drivers?.length || 0} drivers
                              assigned
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
                      className={`rounded-md p-5 border-2 ${isCancelled ? "bg-gray-50 border-red opacity-60" : "bg-white border-primary"} shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden z-0`}
                    >
                      {/* Cancelled Watermark */}
                      {isCancelled && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 text-red font-black text-5xl pointer-events-none uppercase tracking-widest z-0 whitespace-nowrap">
                          Cancelled
                        </div>
                      )}

                      {/* Top Accent Bar */}
                      <div className={`absolute top-0 left-0 w-full h-1.5 ${isCancelled ? "bg-red" : "bg-primary"}`}></div>

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
                              {assignment.start_time || "-"} -{" "}
                              {assignment.end_time || "-"}
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
                              Current Vehicle
                            </p>
                            <p className="text-sm font-bold text-primarytext">
                              {vehicleReplacement.activeVehicle.title}
                            </p>
                            {vehicleReplacement.activeVehicle.subtitle && (
                              <p className="text-xs text-secondarytext mt-0.5">
                                {vehicleReplacement.activeVehicle.subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        {vehicleReplacement.hasReplacement && (
                          <div className="flex items-start gap-3 p-3 bg-skyblue/10 rounded-md border border-skyblue/15">
                            <div className="bg-white p-2 rounded-md shadow-sm text-skyblue">
                              <RefreshCcw size={16} />
                            </div>
                            <div className="w-full">
                              <p className="text-xs font-semibold text-secondarytext">
                                Vehicle Replacement
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-semibold">
                                <span className="px-2 py-1 rounded-md bg-white text-gray-700 border border-gray-200">
                                  Previous:{" "}
                                  {vehicleReplacement.previousVehicle.title}
                                </span>
                                <ChevronRight
                                  size={14}
                                  className="text-skyblue"
                                />
                                <span className="px-2 py-1 rounded-md bg-white text-skyblue border border-skyblue/30">
                                  Replaced:{" "}
                                  {vehicleReplacement.replacementVehicle.title}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

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
                    className={`rounded-md p-5 border-2 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden z-0 ${isCancelled ? "bg-gray-50 border-red opacity-60" : isTemp ? "bg-white border-pending" : "bg-white border-gray-200"
                      }`}
                  >
                    {/* Cancelled Watermark */}
                    {isCancelled && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 text-red font-black text-5xl pointer-events-none uppercase tracking-widest z-0 whitespace-nowrap">
                        Cancelled
                      </div>
                    )}

                    {/* Top Accent Bar */}
                    <div
                      className={`absolute top-0 left-0 w-full h-1.5 ${isCancelled ? "bg-red" : isTemp ? "bg-pending" : "bg-primary"
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
                            : `${assignment.start_date} to ${assignment.end_date}`}
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
                            {assignment.start_time || "-"} -{" "}
                            {assignment.end_time || "-"}
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
                            Current Vehicle
                          </p>
                          <p className="text-sm font-bold text-primarytext">
                            {vehicleReplacement.activeVehicle.title}
                          </p>
                          {vehicleReplacement.activeVehicle.subtitle && (
                            <p className="text-xs text-secondarytext mt-0.5">
                              {vehicleReplacement.activeVehicle.subtitle}
                            </p>
                          )}
                          <p className="text-xs text-secondarytext mt-0.5">
                            {assignment.vehicle_type}
                          </p>
                        </div>
                      </div>

                      {/* Bus Route Row — clickable to open modal */}
                      {(assignment.route_from || assignment.route_to || assignment.vehicle_type === "BUS") && (
                        <button
                          onClick={() => fetchRouteInfo(assignment)}
                          className={`w-full flex items-center gap-3 p-3 rounded-md transition-all duration-150 text-left border-2 border-transparent hover:border-primary/20 hover:shadow-sm ${
                            isTemp ? "bg-pending/10 hover:bg-pending/20" : "bg-primarybg hover:bg-blue-50"
                          }`}
                        >
                          <div className={`bg-white p-2 rounded-md shadow-sm shrink-0 ${isTemp ? "text-pending" : "text-primary"}`}>
                            <TrendingUp size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-secondarytext leading-none mb-1 text-left">Bus Route & Stops</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignment.route_from && (
                                <span className="text-sm font-bold text-primarytext truncate">{assignment.route_from}</span>
                              )}
                              {assignment.route_from && assignment.route_to && (
                                <ChevronRight size={13} className={isTemp ? "text-pending" : "text-primary"} />
                              )}
                              {assignment.route_to && (
                                <span className="text-sm font-bold text-primarytext truncate">{assignment.route_to}</span>
                              )}
                            </div>
                          </div>
                          <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-white shadow-sm border ${isTemp ? "text-pending border-pending/20" : "text-primary border-primary/20"}`}>
                            <Eye size={12} />
                            View
                          </div>
                        </button>
                      )}

                      {vehicleReplacement.hasReplacement && (
                        <div
                          className={`flex items-start gap-3 p-3 rounded-md border ${isTemp ? "bg-pending/10 border-pending/20" : "bg-skyblue/10 border-skyblue/20"}`}
                        >
                          <div
                            className={`bg-white p-2 rounded-md shadow-sm ${isTemp ? "text-pending" : "text-skyblue"}`}
                          >
                            <RefreshCcw size={16} />
                          </div>
                          <div className="w-full">
                            <p className="text-xs font-semibold text-secondarytext">
                              Vehicle Replacement
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-semibold">
                              <span className="px-2 py-1 rounded-md bg-white text-gray-700 border border-gray-200">
                                Previous:{" "}
                                {vehicleReplacement.previousVehicle.title}
                              </span>
                              <ChevronRight
                                size={14}
                                className={
                                  isTemp ? "text-pending" : "text-skyblue"
                                }
                              />
                              <span
                                className={`px-2 py-1 rounded-md bg-white border ${isTemp ? "text-pending border-pending/30" : "text-skyblue border-skyblue/30"}`}
                              >
                                Replaced:{" "}
                                {vehicleReplacement.replacementVehicle.title}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

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
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setSelectedEVAssignment(null)}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Clean Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-white rounded-t-xl">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-14 h-14 rounded-md bg-green-600 flex items-center justify-center shadow-md">
                    <Zap size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {selectedEVAssignment.vehicle_group_name ||
                        "EV Group Assignment"}
                    </h2>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                      <span className="font-medium text-primary">
                        {selectedEVAssignment.driver_group_name ||
                          "Driver Group"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">•</span>
                        <span>
                          {selectedEVAssignment.shift_name ||
                            "Default Schedule"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEVAssignment(null)}
                  className="text-gray-400 cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Details Grid */}
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shift Details */}
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                  <Clock size={14} /> Shift Details
                </h4>
                {(selectedEVShifts.length > 0
                  ? selectedEVShifts
                  : [
                    {
                      shift_name:
                        selectedEVAssignment.shift_name || "EV Duty",
                      start_time: selectedEVAssignment.start_time,
                      end_time: selectedEVAssignment.end_time,
                    },
                  ]
                ).map((shift, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-md p-3 border border-primary/10 flex items-center justify-between gap-3 mb-2 last:mb-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock size={13} className="text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-primarytext">
                        {shift.shift_name || "Default"}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-secondarytext bg-gray-100 px-2.5 py-1 rounded-md whitespace-nowrap">
                      {getShiftTimeWindow(shift, selectedEVAssignment)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Assignment Period */}
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                  <Calendar size={14} /> Assignment Period
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-secondarytext">Start Date</span>
                    <span className="font-medium text-primarytext">
                      {selectedEVAssignment.start_date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondarytext">End Date</span>
                    <span className="font-medium text-primarytext">
                      {selectedEVAssignment.end_date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondarytext">Status</span>
                    <span
                      className={`font-medium px-2 py-0.5 rounded-md text-xs ${getStatusConfig(selectedEVAssignment.status).bg
                        } ${getStatusConfig(selectedEVAssignment.status).color
                        } border ${getStatusConfig(selectedEVAssignment.status).border
                        }`}
                    >
                      {getStatusConfig(selectedEVAssignment.status).label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Vehicles Section */}
            {selectedEVAssignment.group_vehicles &&
              selectedEVAssignment.group_vehicles.length > 0 && (
                <div className="px-4 sm:px-6 pb-4">
                  <div className="bg-primarybg rounded-md p-4">
                    <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                      <Zap size={14} /> Assigned Vehicles (
                      {selectedEVAssignment.group_vehicles.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {selectedEVAssignment.group_vehicles.map((v) => {
                        const vDisplay = getVehicleDisplay(v);
                        return (
                          <div
                            key={v.id}
                            className="bg-green-50 p-3 rounded-md flex items-center gap-2.5"
                          >
                            <div className="w-10 h-10 bg-green-600 rounded-md flex items-center justify-center text-white shrink-0">
                              <Zap size={16} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-primarytext truncate">
                                {vDisplay.title}
                              </p>
                              <p className="text-xs text-secondarytext truncate">
                                {vDisplay.subtitle || "EV Vehicle"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            {/* Cluster Drivers Section */}
            <div className="px-4 sm:px-6 pb-4">
              <div className="bg-primarybg rounded-md p-4">
                <h4 className="text-xs text-secondarytext uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
                  <Users size={14} /> Cluster Drivers (
                  {selectedEVAssignment.group_drivers?.length || 0})
                </h4>
                {selectedEVAssignment.group_drivers &&
                  selectedEVAssignment.group_drivers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedEVAssignment.group_drivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="flex items-center justify-between p-3 bg-white rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-md bg-primary text-white flex items-center justify-center text-base font-bold">
                            {driver.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-primarytext">
                              {driver.name}
                            </p>
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-medium">
                              <CheckCircle2 size={10} />
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-secondarytext">
                    <Users size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No drivers in this cluster</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedEVAssignment(null);
                }}
                className="w-full sm:w-auto px-4 py-2 text-secondarytext rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bus Route Info Modal */}
      {selectedRouteAssignment && (
        <div
          className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center z-60 p-3 sm:p-4 overflow-y-auto animate-fadeIn backdrop-blur-sm"
          onClick={() => setSelectedRouteAssignment(null)}
        >
          <div
            className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-md flex items-center justify-center shadow-md ${selectedRouteAssignment.is_temporary_replacement ? "bg-pending" : "bg-primary"}`}>
                  <TrendingUp size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-none mb-1">Bus Route Details</h2>
                  <p className="text-xs text-secondarytext font-medium flex items-center gap-1">
                    <Bus size={10} /> {selectedRouteAssignment.vehicle_number} • {selectedRouteAssignment.shift_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRouteAssignment(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Route Path (Premium Visual) */}
              <div className="p-4 bg-primarybg rounded-md border border-primary/5">
                <p className="text-[10px] font-bold text-secondarytext uppercase tracking-widest mb-3">Service Route</p>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-tighter">Origin</span>
                    </div>
                    <p className="text-lg font-black text-primarytext truncate">{selectedRouteAssignment.route_from || "Main Campus"}</p>
                  </div>
                  <div className="shrink-0">
                    <ChevronRight size={24} className="text-primary/30" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <span className="text-xs font-bold text-secondarytext uppercase tracking-tighter">Destination</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-pending ring-4 ring-pending/10" />
                    </div>
                    <p className="text-lg font-black text-primarytext truncate">{selectedRouteAssignment.route_to || "Point A"}</p>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              {routeInfo && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border-2 border-primary/10 rounded-md p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider leading-none mb-1">Stops</p>
                      <p className="text-2xl font-black text-primarytext leading-none">{(routeInfo.stops || []).length}</p>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-pending/10 rounded-md p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 bg-pending/10 rounded-full flex items-center justify-center text-pending">
                      <Users2 size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-secondarytext uppercase tracking-wider leading-none mb-1">Students</p>
                      <p className="text-2xl font-black text-primarytext leading-none">{routeInfo.total_students || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Stops Timeline */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  Stops Overview
                </h3>

                {routeLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-secondarytext">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Fetching stop details...</p>
                  </div>
                ) : routeInfo ? (
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[7.5px] top-2 bottom-6 w-0.5 bg-gray-100" />
                    {(routeInfo.stops || []).map((stop, si) => (
                      <div key={stop.id} className="relative pb-6 last:pb-0">
                        <div className={`absolute -left-[24.5px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center z-10 ${
                          si === 0 || si === (routeInfo.stops?.length || 0) - 1 ? "border-primary" : "border-gray-300"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             si === 0 || si === (routeInfo.stops?.length || 0) - 1 ? "bg-primary" : "bg-gray-300"
                          }`} />
                        </div>
                        <div className="bg-gray-50/50 hover:bg-gray-50 p-4 rounded-md border border-gray-100 transition-colors flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className="font-bold text-primarytext leading-none mb-1.5 truncate">{stop.stop_name}</h4>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-secondarytext uppercase tracking-tighter flex items-center gap-1">
                                <Clock size={10} /> {stop.arrival_time || "TBD"}
                              </span>
                              {stop.distance_km > 0 && (
                                <span className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter flex items-center gap-1">
                                  <MapPin size={10} /> {stop.distance_km} KM
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-md border-2 font-black text-sm ${
                            stop.student_count > 0 
                              ? "bg-white border-primary/20 text-primary shadow-sm" 
                              : "bg-gray-50 border-gray-100 text-gray-400"
                          }`}>
                            <Users2 size={16} />
                            {stop.student_count}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!routeInfo.stops || routeInfo.stops.length === 0) && (
                      <div className="py-8 text-center bg-gray-50 rounded-md border border-dashed border-gray-200">
                        <MapPin size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-secondarytext font-medium">No stops configured for this route</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-secondarytext">
                    <p className="text-sm">Unable to load route information.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedRouteAssignment(null)}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm"
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
