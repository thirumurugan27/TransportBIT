import React, {useState, useEffect} from "react";
import {Outlet, useLocation, useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";

/**
 * DashboardLayout Component
 * Shared layout for all dashboard pages with role-based sidebar
 */
export default function DashboardLayout({role}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Get user name based on role
    const name =
      localStorage.getItem("fullName") ||
      localStorage.getItem("adminName") ||
      localStorage.getItem("driverName") ||
      localStorage.getItem("inchargeName") ||
      "User";
    setUserName(name);
  }, []);

  // Get current active page from URL path
  const getActivePage = () => {
    const pathParts = location.pathname.split("/");
    return pathParts[pathParts.length - 1] || "dashboard";
  };

  // Navigate to page when sidebar item is clicked
  const handlePageChange = (pageKey) => {
    const basePath = `/${role.toLowerCase()}-dashboard`;
    if (pageKey === "dashboard") {
      navigate(basePath);
    } else {
      navigate(`${basePath}/${pageKey}`);
    }
  };

  // Get role display text
  const getRoleDisplay = () => {
    const roles = {
      ADMIN: "Administrator",
      DRIVER: "Driver",
      INCHARGE: "Incharge",
      STUDENT: "Student",
    };
    return roles[role] || role;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Unified Sidebar */}
      <Sidebar
        role={role}
        activePage={getActivePage()}
        setActivePage={handlePageChange}
        useLogo={role !== "INCHARGE"}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-[220px] flex flex-col">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="pl-10 lg:pl-0">
            <h3 className="text-base sm:text-xl font-semibold text-gray-800 capitalize">
              {getActivePage()
                .replace(/([A-Z])/g, " $1")
                .trim()}
            </h3>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-md flex items-center justify-center text-white font-bold shadow-lg shadow-rose-500/25">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-rose-500">{getRoleDisplay()}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Rendered via Outlet */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
