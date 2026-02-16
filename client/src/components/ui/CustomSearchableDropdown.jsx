import React, {useState, useRef, useEffect} from "react";
import {ChevronDown, Check, Search, X} from "lucide-react";

/**
 * CustomSearchableDropdown - A professional dropdown with integrated search functionality
 *
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback when value changes
 * @param {Array} options - Array of { value: string, label: string }
 * @param {string} placeholder - Placeholder text when no value selected
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {string} className - Additional CSS classes for the container
 * @param {string} width - Width of the dropdown (default: "w-48")
 * @param {number} maxHeight - Max height of dropdown list (default: 280)
 */
export default function CustomSearchableDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
  width = "w-48",
  maxHeight = 280,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
  };

  return (
    <div ref={dropdownRef} className={`relative ${width} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[42px] px-3 bg-primarybg border border-gray-200 rounded-md text-sm text-left flex items-center justify-between gap-2 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      >
        <span
          className={`flex-1 truncate ${
            selectedOption ? "text-primarytext" : "text-secondarytext"
          }`}
        >
          {selectedOption?.label || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <X
              size={14}
              className="text-secondarytext hover:text-primarytext transition-colors"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            size={16}
            className={`text-secondarytext transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-3 bg-primarybg border border-gray-200 rounded-md text-sm text-primarytext placeholder:text-secondarytext focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Options List */}
          <div
            className="py-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
            style={{maxHeight: `${maxHeight}px`}}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    value === option.value
                      ? "text-primary font-medium bg-primary/5"
                      : "text-primarytext"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && (
                    <Check
                      size={14}
                      className="text-primary flex-shrink-0 ml-2"
                    />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center text-sm text-secondarytext">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
