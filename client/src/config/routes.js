// Route configuration for all dashboards
// Centralized route definitions with lazy loading support

import { lazy } from "react";

// Lazy load dashboard components
const AdminDashboard = lazy(() => import("../pages/Admin/AdminDashboard"));
const DriverDashboard = lazy(() => import("../pages/Driver/DriverDashboard"));
const InchargeDashboard = lazy(() => import("../pages/Incharge/InchargeDashboard"));
const StudentDashboard = lazy(() => import("../pages/Student/StudentDashboard"));

// Admin route configuration
export const adminRoutes = {
    basePath: "/admin-dashboard",
    allowedRoles: ["ADMIN"],
    routes: [
        { path: "", element: "dashboard" },
        { path: "vehicles", element: "vehicles" },
        { path: "bus-fleet", element: "busFleet" },
        { path: "drivers", element: "drivers" },
        { path: "schedule-management", element: "scheduleManagement" },
        { path: "all-assignments", element: "allAssignments" },
        { path: "km-summary", element: "kmSummary" },
        { path: "leave-approvals", element: "leave" },
        { path: "leave-analytics", element: "leaveHistory" },
        { path: "attendance-records", element: "attendanceHistory" },
    ],
};

// Driver route configuration
export const driverRoutes = {
    basePath: "/driver-dashboard",
    allowedRoles: ["DRIVER"],
    routes: [
        { path: "", element: "dashboard" },
        { path: "assignments", element: "assignments" },
        { path: "km-log", element: "km-log" },
        { path: "apply-leave", element: "leave" },
        { path: "leave-history", element: "leaveHistory" },
        { path: "profile", element: "profile" },
    ],
};

// Incharge route configuration
export const inchargeRoutes = {
    basePath: "/incharge-dashboard",
    allowedRoles: ["INCHARGE"],
    routes: [
        { path: "", element: "dashboard" },
        { path: "mark-attendance", element: "attendance" },
        { path: "driver-history", element: "driverHistory" },
        { path: "assignments", element: "assignments" },
        { path: "leave-approvals", element: "leaves" },
        { path: "km-summary", element: "kmSummary" },
    ],
};

// Student route configuration
export const studentRoutes = {
    basePath: "/student-dashboard",
    allowedRoles: ["STUDENT"],
    routes: [
        { path: "", element: "dashboard" },
        { path: "my-bus", element: "myBus" },
        { path: "track-bus", element: "trackBus" },
        { path: "bus-pass", element: "busPass" },
        { path: "profile", element: "profile" },
    ],
};

// Helper to get active page from URL path
export const getActivePageFromPath = (pathname, basePath) => {
    const path = pathname.replace(basePath, "").replace(/^\//, "");

    // Convert URL path to page key based on basePath (role-specific)
    const pathToKeyMap = {
        "": "dashboard",
        "vehicles": "vehicles",
        "bus-fleet": "busFleet",
        "drivers": "drivers",
        "schedule-management": "scheduleManagement",
        "all-assignments": "allAssignments",
        "km-summary": "kmSummary",
        // Handle leave-approvals based on role (admin uses "leave", incharge uses "leaves")
        "leave-approvals": basePath === "/incharge-dashboard" ? "leaves" : "leave",
        "leave-analytics": "leaveHistory",
        "attendance-records": "attendanceHistory",
        "assignments": "assignments",
        "km-log": "km-log",
        "apply-leave": "leave",
        "leave-history": "leaveHistory",
        "profile": "profile",
        "mark-attendance": "attendance",
        "driver-history": "driverHistory",
        "leaves": "leaves",
        "my-bus": "myBus",
        "track-bus": "trackBus",
        "bus-pass": "busPass",
    };

    return pathToKeyMap[path] || "dashboard";
};

export default {
    adminRoutes,
    driverRoutes,
    inchargeRoutes,
    studentRoutes,
    getActivePageFromPath,
};
