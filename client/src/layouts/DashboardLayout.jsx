import React, {useState, useRef, useEffect} from "react";
import SharedSidebar from "../components/SharedSidebar";
import transportLogo from "../assets/transportlogo.png";

export default function DashboardLayout({
  children,
  activePage,
  setActivePage,
  menuItems,
  userRole,
  userName,
  portalName,
  onLogout,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setSidebarOpen(false);
      }
    };
    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen]);

  // Get current page title
  const getCurrentPageTitle = () => {
    for (const item of menuItems) {
      if (item.key === activePage) {
        return item.label?.replace(/^[^\w\s]+\s*/, "") || "Dashboard";
      }
      if (item.submenu) {
        const subItem = item.submenu.find((sub) => sub.key === activePage);
        if (subItem) {
          return subItem.label?.replace(/^[^\w\s]+\s*/, "") || "Dashboard";
        }
      }
    }
    return "Dashboard";
  };

  return (
    <div className="flex h-screen bg-primarybg">
      {/* Mobile Menu Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-md shadow-md border border-gray-200"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div ref={sidebarRef}>
        <SharedSidebar
          activePage={activePage}
          setActivePage={(page) => {
            setActivePage(page);
            setSidebarOpen(false);
          }}
          menuItems={menuItems}
          portalName={portalName}
          onLogout={onLogout}
          isOpen={sidebarOpen}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-[70px]">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between sticky top-0 z-10">
          {/* Left - Logo and Portal Name */}
          <div className="flex items-center gap-3 ml-10 md:ml-0">
            <img
              src={transportLogo}
              alt="Logo"
              className="w-9 h-9 rounded-md object-cover"
            />
            <h1 className="text-lg font-bold text-gray-800">{portalName}</h1>
          </div>

          {/* Right - User Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center overflow-hidden shadow-md shadow-primary/20">
              <img
                src={`https://ui-avatars.com/api/?name=${userName}&background=7D53F6&color=fff`}
                alt={userName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500">{userRole}</p>
              <p className="text-sm font-semibold text-gray-800">{userName}</p>
            </div>
          </div>
        </header>

        {/* Page Title Section */}
        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            {getCurrentPageTitle()}
          </h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
