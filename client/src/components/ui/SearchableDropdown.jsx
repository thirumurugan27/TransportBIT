import React, {useState, useRef, useEffect, useMemo, useCallback} from "react";
import {ChevronDown, Check, Search, X} from "lucide-react";

/**
 * SearchableDropdown - A professional searchable dropdown select component
 * Clean UI with smooth search functionality and keyboard navigation
 * Uses project Tailwind colors from tailwind.config.js
 *
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback when value changes
 * @param {Array} options - Array of { value: string, label: string }
 * @param {string} placeholder - Placeholder text when no value selected
 * @param {string} className - Additional CSS classes for the container
 * @param {string} width - Width of the dropdown (default: "w-48")
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {boolean} isWhite - Use white background instead of primarybg (default: false)
 */
export default function SearchableDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  className = "",
  width = "w-48",
  searchPlaceholder = "Search...",
  isWhite = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
    if (!isOpen) {
      setSearchTerm("");
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term),
    );
  }, [options, searchTerm]);

  // Reset highlight when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions.length]);

  // Smooth scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            onChange(filteredOptions[highlightedIndex].value);
            setIsOpen(false);
            setSearchTerm("");
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm("");
          break;
        default:
          break;
      }
    },
    [isOpen, highlightedIndex, filteredOptions, onChange],
  );

  return (
    <div
      ref={dropdownRef}
      className={`relative ${width} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[42px] px-3 ${isWhite ? "bg-white" : "bg-primarybg"} border border-gray-200 rounded-md text-sm text-left flex items-center justify-between gap-2 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
      >
        <span
          className={
            selectedOption
              ? "text-primarytext truncate"
              : "text-secondarytext truncate"
          }
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-secondarytext shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-full ${isWhite ? "bg-white" : "bg-primarybg"} border border-gray-200 rounded-md shadow-lg animate-in fade-in duration-150`}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondarytext pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className={`w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md ${isWhite ? "bg-white" : "bg-primarybg"} focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-secondarytext`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-secondarytext hover:text-primarytext transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
            style={{scrollBehavior: "smooth"}}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-secondarytext text-center">
                No matching results
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(el) => (itemRefs.current[index] = el)}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between transition-colors ${isWhite ? "hover:bg-gray-50" : "hover:bg-primarybg/70"} ${
                    value === option.value
                      ? "text-primary font-medium bg-primary/5"
                      : highlightedIndex === index
                        ? "bg-gray-50 text-primarytext"
                        : "text-primarytext hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate pr-2">{option.label}</span>
                  {value === option.value && (
                    <Check size={14} className="text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          {searchTerm && filteredOptions.length > 0 && (
            <div
              className={`px-3 py-1.5 text-xs text-secondarytext border-t border-gray-100 ${isWhite ? "bg-gray-50" : "bg-primarybg/50"}`}
            >
              Showing {filteredOptions.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
