// Menu configurations for each role
// Centralized configuration for sidebar navigation with route paths
import React from "react";

import {
  DashboardIcon,
  VehicleIcon,
  DriversIcon,
  ScheduleIcon,
  AssignmentIcon,
  KmIcon,
  LeaveIcon,
  ProfileIcon,
  AttendanceIcon,
  HistoryIcon,
  BusIcon,
  TrackIcon,
  BusPassIcon,
  WrenchIcon,
  SubVehicleListIcon,
  SubBusFleetIcon,
  SubDriversListIcon,
  SubLeaveIcon,
  SubAttendanceIcon,
  SubServiceRecordIcon,
  SubPartsIcon,
  SubServiceTypeIcon,
  SubReminderIcon,
  SubVendorIcon,
} from "../components/layout/Icons";

// Admin Menu Configuration
export const adminMenuConfig = {
  portalName: "Transport-BIT",
  portalSubtitle: "Management System",
  basePath: "/admin-dashboard",
  items: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "",
    },
    {
      key: "vehicles",
      label: "Vehicle Management",
      icon: <VehicleIcon />,
      hasSubmenu: true,
      submenu: [
        {
          key: "vehicles",
          label: "All Vehicles",
          icon: <SubVehicleListIcon />,
          path: "/vehicles",
        },
        {
          key: "busFleet",
          label: "Bus Fleet",
          icon: <SubBusFleetIcon />,
          path: "/bus-fleet",
        },
      ],
    },
    {
      key: "drivers",
      label: "Driver Management",
      icon: <DriversIcon />,
      hasSubmenu: true,
      submenu: [
        {
          key: "allDrivers",
          label: "All Drivers",
          icon: <SubDriversListIcon />,
          path: "/drivers",
        },
        {
          key: "attendanceHistory",
          label: "Attendance",
          icon: <SubAttendanceIcon />,
          path: "/attendance-records",
        },
        {
          key: "leave",
          label: "Leave Management",
          icon: <SubLeaveIcon />,
          path: "/leave-approvals",
        },
      ],
    },
    {
      key: "scheduleManagement",
      label: "Scheduling",
      icon: <ScheduleIcon />,
      path: "/schedule-management",
    },
    {
      key: "allAssignments",
      label: "Assignments",
      icon: <AssignmentIcon />,
      path: "/all-assignments",
    },
    {
      key: "vehicleRequests",
      label: "Vehicle Requests",
      icon: <VehicleIcon />,
      path: "/vehicle-requests",
    },
    {
      key: "serviceRepair",
      label: "Service & Repair",
      icon: <WrenchIcon />,
      hasSubmenu: true,
      submenu: [
        {
          key: "serviceRecords",
          label: "Service Records",
          icon: <SubServiceRecordIcon />,
          path: "/service-records",
        },
        {
          key: "partsPurchases",
          label: "Product Purchases",
          icon: <SubPartsIcon />,
          path: "/parts-purchases",
        },
        {
          key: "serviceTypes",
          label: "Service Types",
          icon: <SubServiceTypeIcon />,
          path: "/service-types",
        },
        {
          key: "serviceReminders",
          label: "Reminders",
          icon: <SubReminderIcon />,
          path: "/service-reminders",
        },
        {
          key: "vendors",
          label: "Vendors",
          icon: <SubVendorIcon />,
          path: "/vendors",
        },
      ],
    },
    {
      key: "kmManagement",
      label: "KM Management",
      icon: <KmIcon />,
      path: "/km-management",
    },
    {
      key: "vehicleReplacements",
      label: "Vehicle Replacements",
      icon: <AssignmentIcon />,
      path: "/vehicle-replacements",
    },
    {
      key: "studentTransport",
      label: "Student Transport",
      icon: <BusIcon />,
      path: "/student-transport",
    },
  ],
};

// Driver Menu Configuration
export const driverMenuConfig = {
  portalName: "Transport BIT",
  portalSubtitle: "Driver Portal",
  basePath: "/driver-dashboard",
  items: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "",
    },
    {
      key: "assignments",
      label: "My Assignments",
      icon: <AssignmentIcon />,
      path: "/assignments",
    },
    {
      key: "vehicle-requests",
      label: "Vehicle Requests",
      icon: <VehicleIcon />,
      path: "/vehicle-requests",
    },
    {
      key: "km-log",
      label: "KM Log",
      icon: <KmIcon />,
      path: "/km-log",
    },
    {
      key: "leave",
      label: "Apply Leave",
      icon: <LeaveIcon />,
      path: "/apply-leave",
    },
    {
      key: "serviceRepair",
      label: "Service & Repair",
      icon: <WrenchIcon />,
      path: "/service-repair",
    },
    {
      key: "profile",
      label: "My Profile",
      icon: <ProfileIcon />,
      path: "/profile",
    },
  ],
};

// Incharge Menu Configuration
export const inchargeMenuConfig = {
  portalName: "Incharge Portal",
  portalSubtitle: "Management System",
  basePath: "/incharge-dashboard",
  items: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "",
    },
    {
      key: "attendance",
      label: "Mark Attendance",
      icon: <AttendanceIcon />,
      path: "/mark-attendance",
    },
    {
      key: "driverHistory",
      label: "Driver History",
      icon: <HistoryIcon />,
      path: "/driver-history",
    },
    {
      key: "scheduleManagement",
      label: "Schedule Management",
      icon: <ScheduleIcon />,
      path: "/schedule-management",
    },
    {
      key: "assignmentManagement",
      label: "Assignment Management",
      icon: <AssignmentIcon />,
      path: "/assignment-management",
    },
    {
      key: "assignments",
      label: "My Assignments",
      icon: <AssignmentIcon />,
      path: "/assignments",
    },
    {
      key: "leaves",
      label: "Leave Approvals",
      icon: <LeaveIcon />,
      path: "/leave-approvals",
    },
    {
      key: "kmManagement",
      label: "KM Management",
      icon: <KmIcon />,
      path: "/km-management",
    },
    {
      key: "insuranceFCStatus",
      label: "Insurance & FC Status",
      icon: <VehicleIcon />,
      path: "/insurance-fc-status",
    },
    {
      key: "driverManagement",
      label: "Driver Management",
      icon: <DriversIcon />,
      path: "/driver-management",
    },
  ],
};

// Student Menu Configuration
export const studentMenuConfig = {
  portalName: "Transport BIT",
  portalSubtitle: "Student Portal",
  basePath: "/student-dashboard",
  items: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "",
    },
    {
      key: "myBus",
      label: "My Bus Details",
      icon: <BusIcon />,
      path: "/my-bus",
    },
    {
      key: "trackBus",
      label: "Track Bus",
      icon: <TrackIcon />,
      path: "/track-bus",
    },
    {
      key: "busPass",
      label: "Bus Pass",
      icon: <BusPassIcon />,
      path: "/bus-pass",
    },
    {
      key: "profile",
      label: "My Profile",
      icon: <ProfileIcon />,
      path: "/profile",
    },
  ],
};

// Faculty Menu Configuration
export const facultyMenuConfig = {
  portalName: "Transport BIT",
  portalSubtitle: "Faculty Portal",
  basePath: "/faculty-dashboard",
  items: [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: "",
    },
    {
      key: "vehicleBooking",
      label: "Vehicle Booking",
      icon: <VehicleIcon />,
      path: "/vehicle-booking",
    },
    {
      key: "profile",
      label: "My Profile",
      icon: <ProfileIcon />,
      path: "/profile",
    },
  ],
};

// Role-based menu getter
export const getMenuConfigByRole = (role) => {
  const configs = {
    ADMIN: adminMenuConfig,
    DRIVER: driverMenuConfig,
    INCHARGE: inchargeMenuConfig,
    STUDENT: studentMenuConfig,
    FACULTY: facultyMenuConfig,
  };
  return configs[role] || studentMenuConfig;
};

// Export all configs
export default {
  adminMenuConfig,
  driverMenuConfig,
  inchargeMenuConfig,
  studentMenuConfig,
  facultyMenuConfig,
  getMenuConfigByRole,
};
