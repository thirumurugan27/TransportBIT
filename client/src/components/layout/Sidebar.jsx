import React, {useState} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {getMenuConfigByRole} from "../../config/menuConfig";
import {ChevronDownIcon, LogoutIcon} from "./Icons";
import transportLogo from "../../assets/transportlogo.png";
import {useAuth} from "../../context/AuthContext";

/**
 * Unified Sidebar Component
 * Renders different menu items based on user role
 * Uses React Router for navigation
 */
export default function Sidebar({role, useLogo = true, isCollapsed = false}) {
  const [vehiclesOpen, setVehiclesOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {logout} = useAuth();

  // Get menu config based on role
  const menuConfig = getMenuConfigByRole(role);

  const handleLogout = async () => {
    await logout();
  };

  const handleMenuClick = (item) => {
    if (item.hasSubmenu) {
      setVehiclesOpen(!vehiclesOpen);
    } else {
      const path = menuConfig.basePath + (item.path || "");
      navigate(path);
    }
  };

  const handleSubmenuClick = (subItem) => {
    const path = menuConfig.basePath + (subItem.path || "");
    navigate(path);
  };

  // Check if a menu item is active based on current path
  const isActive = (item) => {
    const itemPath = menuConfig.basePath + (item.path || "");
    if (
      itemPath === menuConfig.basePath &&
      location.pathname === menuConfig.basePath
    ) {
      return true;
    }
    return (
      location.pathname === itemPath ||
      (item.path && location.pathname.startsWith(itemPath))
    );
  };

  const isSubmenuActive = (subItem) => {
    const itemPath = menuConfig.basePath + (subItem.path || "");
    return location.pathname === itemPath;
  };

  const isVehicleSubmenuActive = () => {
    return menuConfig.items
      .find((item) => item.hasSubmenu)
      ?.submenu?.some((sub) => isSubmenuActive(sub));
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-[220px]"
      } bg-white shadow-md transition-all duration-300 flex flex-col h-screen fixed top-0 left-0 z-50`}
    >
      {/* Logo/Header Section */}
      <div className="shrink-0 p-4">
        <div className="flex flex-col items-center justify-center py-4">
          {useLogo ? (
            <img
              src={transportLogo}
              alt="Transport Logo"
              className="w-14 h-14 rounded-md shadow-md"
            />
          ) : (
            <div className="w-14 h-14 bg-primary rounded-md flex items-center justify-center shadow-md shadow-primary/20">
              <span className="text-2xl">
                {role === "INCHARGE" ? "👔" : role === "STUDENT" ? "🎓" : "👤"}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <div className="text-center mt-2">
              <h1 className="font-bold text-lg text-primarytext">
                {menuConfig.portalName}
              </h1>
              <p className="text-xs text-secondarytext">
                {menuConfig.portalSubtitle}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-4 space-y-2">
        {menuConfig.items.map((item) => (
          <div key={item.key}>
            {item.hasSubmenu ? (
              <>
                {/* Parent menu item with submenu */}
                <button
                  onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 group
                    rounded-md transition-all duration-300 ease-in-out ${
                      isVehicleSubmenuActive()
                        ? "text-primary font-medium"
                        : "text-secondarytext hover:bg-primarybg"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        isVehicleSubmenuActive()
                          ? "text-primary"
                          : "text-gray-400 group-hover:text-primary"
                      }
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="font-medium text-[15px]">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && <ChevronDownIcon isOpen={vehiclesOpen} />}
                </button>

                {/* Submenu */}
                {!isCollapsed && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      vehiclesOpen
                        ? "max-h-40 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="mt-1 ml-4 space-y-1">
                      {item.submenu.map((subItem) => (
                        <button
                          key={subItem.key}
                          onClick={() => handleSubmenuClick(subItem)}
                          className={`w-full flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out text-[14px] ${
                            isSubmenuActive(subItem)
                              ? "bg-primary text-white shadow-md shadow-primary/20"
                              : "text-secondarytext hover:text-primary hover:bg-primarybg"
                          }`}
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Regular menu item */
              <button
                onClick={() => handleMenuClick(item)}
                className={`w-full flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out group ${
                  isActive(item)
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-secondarytext hover:bg-primarybg hover:text-primary"
                }`}
              >
                <span
                  className={
                    isActive(item)
                      ? "text-white"
                      : "text-gray-400 group-hover:text-primary"
                  }
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="ml-3 font-medium text-[15px]">
                    {item.label}
                  </span>
                )}
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Logout Button - Fixed at bottom */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out text-secondarytext hover:bg-red-50 hover:text-red-600"
        >
          <span className="text-gray-400">
            <LogoutIcon />
          </span>
          {!isCollapsed && (
            <span className="ml-3 font-medium text-[15px]">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
