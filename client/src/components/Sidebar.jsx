import React from "react";
import {useAuth} from "../context/AuthContext";

// Tooltip Component
const Tooltip = ({children, text}) => (
  <div className="group relative">
    {children}
    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
      {text}
    </div>
  </div>
);

// Icons as SVG components for clean design
const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const VehicleIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7h8m-8 5h8m-4-9v18M3 12h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const DriversIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const ScheduleIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const AssignmentIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
    />
  </svg>
);

const KmIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const LeaveIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const AnalyticsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

export default function Sidebar({activePage, setActivePage}) {
  const {logout} = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const menuItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
    },
    {
      key: "vehicles",
      label: "Vehicles",
      icon: <VehicleIcon />,
    },
    {
      key: "drivers",
      label: "Drivers",
      icon: <DriversIcon />,
    },
    {
      key: "scheduleManagement",
      label: "Schedule Management",
      icon: <ScheduleIcon />,
    },
    {
      key: "allAssignments",
      label: "All Assignments",
      icon: <AssignmentIcon />,
    },
    {
      key: "kmSummary",
      label: "KM Summary",
      icon: <KmIcon />,
    },
    {
      key: "leave",
      label: "Leave Approvals",
      icon: <LeaveIcon />,
    },
    {
      key: "leaveHistory",
      label: "Leave Analytics",
      icon: <AnalyticsIcon />,
    },
    {
      key: "attendanceHistory",
      label: "Attendance Records",
      icon: <ScheduleIcon />,
    },
  ];

  const isActive = (key) => activePage === key;

  return (
    <aside className="w-[70px] hidden lg:flex bg-white shadow-lg h-screen flex-col fixed top-0 left-0 z-40">
      {/* Logo Section */}
      <div className="flex-shrink-0 py-4 flex justify-center">
        <div className="w-10 h-10 bg-gray-800 rounded-md flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </div>
      </div>

      {/* Navigation Menu - Icon Only */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col items-center space-y-2">
        {menuItems.map((item) => (
          <Tooltip key={item.key} text={item.label}>
            <button
              onClick={() => setActivePage(item.key)}
              className={`w-11 h-11 rounded-md flex items-center justify-center transition-all duration-200 ${
                isActive(item.key)
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "text-gray-400 hover:bg-gray-100 hover:text-primary"
              }`}
            >
              <span className="w-5 h-5">{item.icon}</span>
            </button>
          </Tooltip>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-100">
        <Tooltip text="Logout">
          <button
            onClick={handleLogout}
            className="w-11 h-11 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          >
            <LogoutIcon />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
