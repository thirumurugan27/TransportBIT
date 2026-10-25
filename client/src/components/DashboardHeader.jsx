import React from "react";
import { User, Menu } from "lucide-react";

export default function DashboardHeader({
  title,
  user = { name: "User", role: "User" },
  onLogout,
  alerts = [],
  onMenuToggle,
}) {
  return (
    <header className="w-full bg-white h-16 flex items-center justify-between px-4 sm:px-6 drop-shadow-sm sticky top-0 z-40">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-secondarytext hover:text-primarytext transition-colors"
            aria-label="Open menu"
          >
            <Menu size={26} />
          </button>
        )}
        <h3 className="font-medium text-lg text-primarytext">{title}</h3>
      </div>

      {/* Right: Profile */}
      <div className="flex gap-7 items-center bg-primarybg py-1 px-5 rounded-md cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <User size={20} />
        </div>
        <div className="hidden sm:flex flex-col">
          <h2 className="text-[13px] font-medium text-secondarytext">
            {user.role}
          </h2>
          <h2 className="text-[16px] font-semibold text-primarytext">
            {user.name}
          </h2>
        </div>
      </div>
    </header>
  );
}
