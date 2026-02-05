import React from "react";
import {Search} from "lucide-react";

/**
 * CustomSearch - A professional search input component
 *
 * @param {string} value - Current search value
 * @param {function} onChange - Callback when value changes
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes
 */
export default function CustomSearch({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={18}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[42px] pl-10 pr-4 border border-gray-200 rounded-md bg-primarybg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-primarytext placeholder:text-gray-400"
      />
    </div>
  );
}
