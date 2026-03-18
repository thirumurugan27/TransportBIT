import React, {useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {
  BarChart3,
  UserRoundCog,
  Search,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
const ACTIVITY_SECTIONS = [
  {
    key: "analytics",
    title: "Analytics",
    items: [
      {
        key: "reports",
        title: "Reports",
        subtitle: "Click to access",
        route: "/admin-dashboard/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    key: "user-management",
    title: "User Management",
    items: [
      {
        key: "user-updates",
        title: "User Update",
        subtitle: "Click to access",
        route: "/admin-dashboard/user-updates",
        icon: UserRoundCog,
      },
    ],
  },
];
export default function AdminActions() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const filteredSections = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return ACTIVITY_SECTIONS;
    return ACTIVITY_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.title.toLowerCase().includes(keyword) ||
          section.title.toLowerCase().includes(keyword),
      ),
    })).filter((section) => section.items.length > 0);
  }, [searchText]);
  return (
    <div className="min-h-screen bg-primarybg">
      <div className="mx-auto px-4 py-4 sm:px-4 lg:px-4">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full sm:w-80">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute inset-y-0 left-3 my-auto text-gray-400"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search activities..."
                className="mt-1 h-10 w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-secondarytext placeholder:text-sm focus:outline-primary"
              />
            </label>
          </div>
        </div>
        {filteredSections.map((section) => (
          <div key={section.key} className="mb-8">
            <div className="mb-1 flex items-center">
              <h2 className="text-lg font-semibold text-primarytext">
                {section.title}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="group cursor-pointer rounded-md border border-gray-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-primarytext transition-colors group-hover:text-primary">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-xs text-secondarytext">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ChevronRight
                          size={18}
                          className="text-gray-400 transition-colors group-hover:text-primary"
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredSections.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-white px-4 py-5 text-sm text-secondarytext shadow-sm">
            No activities found for your search.
          </div>
        )}
      </div>
    </div>
  );
}