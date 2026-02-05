import React, {useState} from "react";

const BellIcon = () => (
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
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

export default function TopBar({
  pageTitle,
  adminName,
  absentAlerts = [],
  onProfileClick,
  onLogout,
  onEditProfile,
  onAlertClick,
  onReplaceDriver,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200/60 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-primarytext">{pageTitle}</h1>
        <p className="text-xs text-secondarytext">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        {absentAlerts && absentAlerts.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="relative p-2.5 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all duration-200 hover:scale-105"
            >
              <BellIcon />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-md flex items-center justify-center font-bold shadow-lg shadow-red-500/30 animate-pulse">
                {absentAlerts.length}
              </span>
            </button>

            {/* Alerts Dropdown */}
            {showAlerts && (
              <div className="absolute right-0 top-14 w-96 bg-white rounded-md shadow-2xl border border-gray-100 z-50 overflow-hidden animate-scaleIn">
                <div className="bg-linear-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-amber-100">
                  <h3 className="font-bold text-amber-800 flex items-center gap-2">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    Absent Driver Alerts
                  </h3>
                  <p className="text-xs text-amber-600 mt-1">
                    {absentAlerts.length} driver
                    {absentAlerts.length > 1 ? "s are" : " is"} absent but ha
                    {absentAlerts.length > 1 ? "ve" : "s"} assignments
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {absentAlerts.map((alert) => (
                    <div
                      key={alert.assignment_id}
                      className="px-5 py-4 border-b border-gray-50 hover:bg-primarybg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-red-600 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-md animate-pulse" />
                            {alert.driver_name}
                          </p>
                          {alert.cluster_name && (
                            <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">
                              {alert.cluster_name}
                            </span>
                          )}
                          <p className="text-sm text-secondarytext mt-1.5 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
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
                              {alert.vehicle_number}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {alert.shift_name}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            onReplaceDriver?.(alert);
                            setShowAlerts(false);
                          }}
                          className="px-4 py-2 bg-linear-to-r from-rose-500 to-pink-600 text-white text-xs font-medium rounded-md hover:from-rose-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                        >
                          Replace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                  <button
                    onClick={() => setShowAlerts(false)}
                    className="w-full text-sm text-secondarytext hover:text-primary py-1.5 rounded-md hover:bg-gray-100 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200"
          >
            <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md shadow-primary/20">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-sm font-semibold text-primarytext block">
                {adminName}
              </span>
              <span className="text-xs text-primary">Administrator</span>
            </div>
            <ChevronDownIcon />
          </button>

          {/* Profile Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 top-14 w-52 bg-white rounded-md shadow-2xl border border-gray-100 z-50 overflow-hidden animate-scaleIn">
              <div className="p-3 bg-linear-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                <p className="text-sm font-semibold text-primarytext">
                  {adminName}
                </p>
                <p className="text-xs text-secondarytext">Administrator</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    onEditProfile?.();
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-primarytext hover:bg-gray-50 rounded-md transition-colors flex items-center gap-3 font-medium"
                >
                  <div className="w-8 h-8 rounded-md bg-rose-50 flex items-center justify-center text-primary">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    onLogout?.();
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-3 font-medium"
                >
                  <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center text-red-500">
                    <svg
                      className="w-4 h-4"
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
                  </div>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
