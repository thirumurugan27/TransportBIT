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
  SubReminderIcon,
  SubVendorIcon,
  FuelIcon,
} from "../components/layout/Icons";

// Admin Menu Configuration
export const adminMenuConfig = {
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
      key: "Purchases",
      label: "Purchases",
      icon: <SubPartsIcon />,
      hasSubmenu: true,
      submenu: [
        {
          label: "Purchase Log",
          icon: <SubPartsIcon />,
          key: "serviceRecords",
          path: "/parts-purchases",
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
          key: "serviceReminders",
          label: "Reminders",
          icon: <SubReminderIcon />,
          path: "/service-reminders",
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
      key: "fuelIndents",
      label: "Fuel Indents",
      icon: <FuelIcon />,
      path: "/fuel-indents",
    },
    {
      key: "studentTransport",
      label: "Student Transport",
      icon: <BusIcon />,
      path: "/student-transport",
    },
    {
      key: "adminActions",
      label: "Admin Actions",
      icon: <AssignmentIcon />,
      path: "/admin-actions",
    },
  ],
};

// Driver Menu Configuration
export const driverMenuConfig = {
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
      key: "fuelIndent",
      label: "Fuel Indent",
      icon: <FuelIcon />,
      path: "/fuel-indent",
    },
    {
      key: "profile",
      label: "My Profile",
      icon: <ProfileIcon />,
      path: "/profile",
    },
  ],
};

// Student Menu Configuration
export const studentMenuConfig = {
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
    STUDENT: studentMenuConfig,
    FACULTY: facultyMenuConfig,
  };
  return configs[role] || studentMenuConfig;
};

// Export all configs
export default {
  adminMenuConfig,
  driverMenuConfig,
  studentMenuConfig,
  facultyMenuConfig,
  getMenuConfigByRole,
};
