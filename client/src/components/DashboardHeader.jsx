import React, {useState} from "react";
import {Link} from "react-router-dom";

export default function DashboardHeader({
  title,
  user = {name: "User", role: "User"},
  onLogout,
  alerts = [],
  onMenuToggle,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-gray-200/60 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-2">
        {/* Hamburger - mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        )}
        <h2 className="text-base sm:text-xl font-bold text-primarytext">
          {title}
        </h2>
      </div>

      {/* Right: Profile */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 rounded-md bg-primarybg shadow-sm">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-md bg-primary shadow-primary/20">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-medium text-secondarytext block uppercase mb-0.5">
              {user.role}
            </span>
            <span className="text-sm font-bold text-primarytext block uppercase tracking-wide">
              {user.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
