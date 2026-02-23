import React, {useState, useEffect, useRef} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {getMenuConfigByRole} from "../../config/menuConfig";
import {ChevronDownIcon, LogoutIcon} from "./Icons";
import transportLogo from "../../assets/transportlogo.png";
import {useAuth} from "../../context/AuthContext";

/**
 * Unified Sidebar Component
 * Renders different menu items based on user role
 * Uses React Router for navigation
 * Fully responsive: slide-out drawer on mobile, fixed on desktop
 */
export default function Sidebar({
  role,
  useLogo = true,
  isCollapsed = false,
  mobileOpen = false,
  onClose,
}) {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const {logout} = useAuth();
  const sidebarRef = useRef(null);

  // Get menu config based on role
  const menuConfig = getMenuConfigByRole(role);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose?.();
  }, [location.pathname]);

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    if (mobileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleMenuClick = (item) => {
    if (item.hasSubmenu) {
      setOpenSubmenu(openSubmenu === item.key ? null : item.key);
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

  const isSubmenuGroupActive = (item) => {
    return item.submenu?.some((sub) => isSubmenuActive(sub));
  };

  // Auto-open submenu if one of its children is active
  useEffect(() => {
    const activeSubmenu = menuConfig.items.find(
      (item) =>
        item.hasSubmenu && item.submenu?.some((sub) => isSubmenuActive(sub)),
    );
    if (activeSubmenu) setOpenSubmenu(activeSubmenu.key);
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40  z-[49] transition-opacity"
          onClick={() => onClose?.()}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`${
          isCollapsed ? "w-20" : "w-[220px]"
        } bg-white shadow-md flex flex-col h-screen fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
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
                  {role === "INCHARGE"
                    ? "👔"
                    : role === "STUDENT"
                      ? "🎓"
                      : "👤"}
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
                      isSubmenuGroupActive(item)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-secondarytext hover:bg-primarybg"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          isSubmenuGroupActive(item)
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
                    {!isCollapsed && (
                      <ChevronDownIcon isOpen={openSubmenu === item.key} />
                    )}
                  </button>

                  {/* Submenu */}
                  {!isCollapsed && (
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        openSubmenu === item.key
                          ? "max-h-80 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="mt-0.5 ml-6 space-y-0.5">
                        {item.submenu.map((subItem) => (
                          <button
                            key={subItem.key}
                            onClick={() => handleSubmenuClick(subItem)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ease-in-out text-[13px] group/sub ${
                              isSubmenuActive(subItem)
                                ? "bg-primary text-white"
                                : "text-secondarytext hover:text-primary hover:bg-primarybg"
                            }`}
                          >
                            {subItem.icon && (
                              <span
                                className={
                                  isSubmenuActive(subItem)
                                    ? "text-white"
                                    : "text-gray-400 group-hover/sub:text-primary"
                                }
                              >
                                {subItem.icon}
                              </span>
                            )}
                            <span className="font-medium">{subItem.label}</span>
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
    </>
  );
}
