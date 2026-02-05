import React, {useState} from "react";
import {Link} from "react-router-dom";

export default function DashboardHeader({
  title,
  user = {name: "User", role: "User"},
  onLogout,
  alerts = [],
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200/60 flex items-center justify-between px-6 sticky top-0 z-40">
      <h2 className="text-xl font-bold text-primarytext">{title}</h2>

      <div className="flex items-center gap-6">
        {/* Profile */}
        <div className="flex items-center gap-4 px-6 py-2 rounded-md bg-primarybg shadow-sm">
          <div className="w-10 h-10 rounded-md text-white flex items-center justify-center font-bold text-base shadow-md bg-primary shadow-primary/20">
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
