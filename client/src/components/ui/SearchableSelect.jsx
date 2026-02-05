import React, {useState, useRef, useEffect} from "react";
import {Search, X, Check, ChevronDown} from "lucide-react";

/**
 * SearchableSelect - Type-ahead autocomplete component
 * @param {Object} props
 * @param {Array} props.options - Array of {value, label, subtitle?, available?, availableText?} objects
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Disable the select
 * @param {string} props.emptyMessage - Message when no options match
 * @param {boolean} props.showAvailability - Whether to show availability indicators
 */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Type to search...",
  disabled = false,
  emptyMessage = "No options available",
  showAvailability = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find selected option and update input when value changes
  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  useEffect(() => {
    if (selectedOption && !isOpen) {
      setInputValue(selectedOption.label);
    }
  }, [selectedOption, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        if (selectedOption) {
          setInputValue(selectedOption.label);
        } else {
          setInputValue("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  // Filter options based on input
  const filteredOptions = options.filter((option) => {
    if (!inputValue.trim()) return true;
    const query = inputValue.toLowerCase();
    const label = (option.label || "").toLowerCase();
    const subtitle = (option.subtitle || "").toLowerCase();
    return label.includes(query) || subtitle.includes(query);
  });

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleClear = () => {
    onChange("");
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleChevronClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        inputRef.current?.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredOptions[focusedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      if (selectedOption) {
        setInputValue(selectedOption.label);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-[42px] pl-10 pr-20 border rounded-md bg-primarybg text-sm text-primarytext placeholder:text-gray-400 transition-all focus:outline-none ${
            disabled
              ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              : isOpen
                ? "border-primary ring-2 ring-primary/20"
                : "border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 rounded-md transition-colors"
              title="Clear"
            >
              <X size={14} className="text-gray-500" />
            </button>
          )}
          <button
            type="button"
            onClick={handleChevronClick}
            className="p-1 transition-colors"
            title={isOpen ? "Close" : "Open"}
            disabled={disabled}
          >
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-primary rounded-md shadow-lg max-h-64 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((option, index) => {
                const isSelected = String(option.value) === String(value);
                const isFocused = index === focusedIndex;
                const isAvailable = option.available !== false;
                const showStatus =
                  showAvailability && option.available !== undefined;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left transition-all ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : isFocused
                          ? "bg-primary/5"
                          : showStatus && !isAvailable
                            ? "bg-red-50/30 text-gray-500 hover:bg-red-50"
                            : "text-primarytext hover:bg-primary/5"
                    }`}
                  >
                    <span className="flex-1 flex flex-col gap-0.5">
                      <span
                        className={`flex items-center gap-2 font-medium ${showStatus && !isAvailable ? "text-gray-500" : ""}`}
                      >
                        {option.label}
                        {showStatus && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                              isAvailable
                                ? "bg-green/10 text-green"
                                : "bg-red/10 text-red"
                            }`}
                          >
                            {isAvailable
                              ? "Available"
                              : option.availableText || "Assigned"}
                          </span>
                        )}
                      </span>
                      {option.subtitle && (
                        <span
                          className={`text-xs ${
                            isSelected
                              ? "text-primary/70"
                              : showStatus && !isAvailable
                                ? "text-gray-400"
                                : "text-secondarytext"
                          }`}
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
            <div className="py-6 px-4 text-center text-sm text-secondarytext">
              {inputValue ? (
                <>
                  <Search size={24} className="mx-auto mb-2 opacity-30" />
                  <p>No results for "{inputValue}"</p>
                </>
              ) : (
                <p>{emptyMessage}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
