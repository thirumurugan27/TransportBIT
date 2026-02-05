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
  FuelIcon,
  NotificationIcon,
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
      label: "Vehicles",
      icon: <VehicleIcon />,
      hasSubmenu: true,
      submenu: [
        {key: "vehicles", label: "All Vehicles", path: "/vehicles"},
        {key: "busFleet", label: "Bus Fleet", path: "/bus-fleet"},
      ],
    },
    {
      key: "drivers",
      label: "Drivers",
      icon: <DriversIcon />,
      path: "/drivers",
    },
    {
      key: "scheduleManagement",
      label: "Schedule Management",
      icon: <ScheduleIcon />,
      path: "/schedule-management",
    },
    {
      key: "allAssignments",
      label: "All Assignments",
      icon: <AssignmentIcon />,
      path: "/all-assignments",
    },
    {
      key: "kmManagement",
      label: "KM Management",
      icon: <KmIcon />,
      path: "/km-management",
    },
    {
      key: "leave",
      label: "Leave Approvals",
      icon: <LeaveIcon />,
      path: "/leave-approvals",
    },
    {
      key: "attendanceHistory",
      label: "Attendance Records",
      icon: <ScheduleIcon />,
      path: "/attendance-records",
    },
    {
      key: "fcReplacement",
      label: "FC Replacements",
      icon: <AssignmentIcon />,
      path: "/fc-replacement",
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
