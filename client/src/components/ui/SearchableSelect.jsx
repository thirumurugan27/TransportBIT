import React, {useState, useRef, useEffect} from "react";
import {Search, ChevronDown, X, Check} from "lucide-react";

/**
 * SearchableSelect - Professional searchable dropdown component
 * @param {Object} props
 * @param {Array} props.options - Array of {value, label, subtitle?} objects
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Disable the select
 * @param {string} props.emptyMessage - Message when no options match
 */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  disabled = false,
  emptyMessage = "No options available",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = options.filter((option) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const label = (option.label || "").toLowerCase();
    const subtitle = (option.subtitle || "").toLowerCase();
    return label.includes(query) || subtitle.includes(query);
  });

  // Find currently selected option
  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
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

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border rounded-lg text-sm text-left transition-all ${
          disabled
            ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
            : isOpen
              ? "border-primary ring-2 ring-primary/20 bg-white"
              : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <span
          className={`flex-1 truncate ${!selectedOption ? "text-gray-400" : "text-gray-800 font-medium"}`}
        >
          {selectedOption ? (
            <span className="flex flex-col">
              <span>{selectedOption.label}</span>
              {selectedOption.subtitle && (
                <span className="text-xs text-gray-500 font-normal">
                  {selectedOption.subtitle}
                </span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              title="Clear selection"
            >
              <X size={14} className="text-gray-500" />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option) => {
                  const isSelected = String(option.value) === String(value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex-1 flex flex-col">
                        <span>{option.label}</span>
                        {option.subtitle && (
                          <span
                            className={`text-xs ${isSelected ? "text-primary/70" : "text-gray-500"}`}
                          >
                            {option.subtitle}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check size={16} className="shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 px-4 text-center text-sm text-gray-400">
                {searchQuery ? (
                  <>
                    <Search size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No results for "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <p>{emptyMessage}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
