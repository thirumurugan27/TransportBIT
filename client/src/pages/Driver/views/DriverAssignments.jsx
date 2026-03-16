import React, {useState, useEffect} from "react";
import {useAuth} from "../../../context/AuthContext";
import {apiGet} from "../../../utils/api";
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

  const getShiftTimeLabel = (assignment) => {
    const shifts = getAssignmentShifts(assignment);
    if (shifts.length <= 1) {
      const firstShift = shifts[0] || {};
      return `${firstShift.start_time || assignment?.start_time || "-"} - ${firstShift.end_time || assignment?.end_time || "-"}`;
    }
    return `${shifts.length} shifts assigned`;
  };

  const getVehicleDisplay = (vehicle) => {
    const vehicleName = normalizeText(vehicle?.vehicle_name);
    const vehicleNumber = normalizeText(vehicle?.vehicle_number);

    if (vehicleName && vehicleNumber && vehicleName !== vehicleNumber) {
      return {title: vehicleName, subtitle: vehicleNumber};
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
                const vehicleReplacement =
                  getVehicleReplacementDetails(assignment);

                // EV Assignment Card - Show as Group
                if (isEV) {
                  const shiftCount = getAssignmentShifts(assignment).length;
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
                            {getDateRangeLabel(assignment)}
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-2xl sm:rounded-md shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-scaleIn border border-gray-200">
            <div className="p-5 sm:p-6 flex items-start justify-between gap-4 border-b border-gray-200">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="p-3 bg-gray-100 rounded-md">
                  <Zap size={22} className="text-gray-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                    EV Assignment Details
                  </h3>
                  <p className="text-gray-600 text-sm mt-1 truncate">
                    {selectedEVAssignment.vehicle_group_name || "EV Group"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors shrink-0 text-gray-600"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 max-h-[68vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-md border border-gray-200 bg-white">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Date Range
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {getDateRangeLabel(selectedEVAssignment)}
                  </p>
                </div>
                <div className="p-4 rounded-md border border-gray-200 bg-white">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Shift
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {getAssignmentShifts(selectedEVAssignment)[0]?.shift_name ||
                      "EV Duty"}
                  </p>
                  <p className="text-[11px] text-secondarytext mt-1 font-medium">
                    {getAssignmentShifts(selectedEVAssignment)[0]?.start_time ||
                      "-"}{" "}
                    -{" "}
                    {getAssignmentShifts(selectedEVAssignment)[0]?.end_time ||
                      "-"}
                  </p>
                </div>
                <div className="p-4 rounded-md border border-gray-200 bg-white">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Vehicle Group
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {selectedEVAssignment.vehicle_group_name || "EV Group"}
                  </p>
                  <p className="text-[11px] text-secondarytext mt-1 font-medium">
                    {selectedEVAssignment.group_vehicles?.length || 0} vehicles
                  </p>
                </div>
                <div className="p-4 rounded-md border border-gray-200 bg-white">
                  <p className="text-xs font-semibold text-secondarytext mb-1">
                    Driver Group
                  </p>
                  <p className="font-bold text-primarytext text-sm leading-6">
                    {selectedEVAssignment.driver_group_name || "Driver Group"}
                  </p>
                  <p className="text-[11px] text-secondarytext mt-1 font-medium">
                    {selectedEVAssignment.group_drivers?.length || 0} drivers
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-4 sm:p-5 bg-white">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Clock size={18} className="text-secondarytext" />
                    Shift Details
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-secondarytext">
                    1 shift
                  </span>
                </div>
                <div className="p-4 bg-white rounded-md border border-gray-200">
                  <p className="font-bold text-primarytext text-sm">
                    {getAssignmentShifts(selectedEVAssignment)[0]?.shift_name ||
                      "EV Duty"}
                  </p>
                  <p className="text-xs text-secondarytext mt-1 font-mono">
                    {getAssignmentShifts(selectedEVAssignment)[0]?.start_time ||
                      "-"}{" "}
                    -{" "}
                    {getAssignmentShifts(selectedEVAssignment)[0]?.end_time ||
                      "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-4 sm:p-5 bg-white">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Car size={18} className="text-secondarytext" />
                    Assigned Vehicles
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-secondarytext">
                    {selectedEVAssignment.group_vehicles?.length || 0}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEVAssignment.group_vehicles?.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-4 bg-white rounded-md border border-gray-200"
                    >
                      <p className="font-bold text-primarytext truncate">
                        {vehicle.vehicle_name || vehicle.vehicle_number}
                      </p>
                      <p className="text-xs text-secondarytext mt-1 truncate">
                        {vehicle.vehicle_number}
                      </p>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_vehicles ||
                    selectedEVAssignment.group_vehicles.length === 0) && (
                    <p className="sm:col-span-2 text-gray-500 text-sm text-center py-6">
                      No vehicles are linked to this EV group yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-4 sm:p-5 bg-white">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-primarytext flex items-center gap-2">
                    <Users size={18} className="text-secondarytext" />
                    Assigned Drivers
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-secondarytext">
                    {selectedEVAssignment.group_drivers?.length || 0}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEVAssignment.group_drivers?.map((driver) => (
                    <div
                      key={driver.id}
                      className="p-4 bg-white rounded-md border border-gray-200 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 bg-gray-100 rounded-md flex items-center justify-center text-gray-700 font-bold shrink-0">
                        {driver.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {driver.name}
                        </p>
                        <p className="text-xs text-secondarytext mt-1">
                          {selectedEVAssignment.driver_group_name ||
                            "Driver group member"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!selectedEVAssignment.group_drivers ||
                    selectedEVAssignment.group_drivers.length === 0) && (
                    <p className="sm:col-span-2 text-gray-500 text-sm text-center py-6">
                      No drivers are linked to this EV group yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-md border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-primarytext">
                    Assignment Status
                  </p>
                  <p className="text-xs text-secondarytext mt-1">
                    EV group assignment is ready for duty.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-gray-100 text-primarytext border border-gray-200">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {getStatusConfig(selectedEVAssignment.status).label}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => setSelectedEVAssignment(null)}
                className="w-full sm:w-auto sm:min-w-36 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-md transition-colors ml-auto block"
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
