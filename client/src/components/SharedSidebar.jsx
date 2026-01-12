import React, {useState} from "react";

// Tooltip Component
const Tooltip = ({children, text}) => (
  <div className="group relative">
    {children}
    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
      {text}
    </div>
  </div>
);

// Logout Icon
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

export default function SharedSidebar({
  activePage,
  setActivePage,
  menuItems = [],
  portalName = "Transport BIT",
  onLogout,
  isOpen = false,
}) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const isActive = (key) => activePage === key;

  const isItemActive = (item) => {
    if (item.submenu) {
      return item.submenu.some((sub) => sub.key === activePage);
    }
    return activePage === item.key;
  };

  // Remove emoji from label for display
  const cleanLabel = (label) => {
    return label?.replace(/^[^\w\s]+\s*/, "") || label;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-[70px] bg-white shadow-lg transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 flex flex-col h-screen`}
    >
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
        {menuItems.map((item) => {
          const active = isItemActive(item);
          return (
            <Tooltip key={item.key} text={cleanLabel(item.label)}>
              <button
                onClick={() => {
                  if (item.submenu && item.submenu.length > 0) {
                    setActivePage(item.submenu[0].key);
                  } else {
                    setActivePage(item.key);
                  }
                }}
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-11 h-11 rounded-md flex items-center justify-center transition-all duration-200 ${
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-gray-400 hover:bg-gray-100 hover:text-primary"
                }`}
              >
                <span className="w-5 h-5">{item.icon}</span>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* Logout Button */}
      {onLogout && (
        <div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-100">
          <Tooltip text="Logout">
            <button
              onClick={onLogout}
              className="w-11 h-11 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
            >
              <LogoutIcon />
            </button>
          </Tooltip>
        </div>
      )}
    </aside>
  );
}
