import React, {useState, useRef, useEffect} from "react";
import {ChevronDown, Check} from "lucide-react";

/**
 * CustomDropdown - A professional dropdown select component
 *
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback when value changes
 * @param {Array} options - Array of { value: string, label: string, icon?: React.Component, iconColor?: string }
 * @param {string} placeholder - Placeholder text when no value selected
 * @param {string} className - Additional CSS classes for the container
 * @param {string} width - Width of the dropdown (default: "w-48")
 * @param {boolean} isWhite - Use white background instead of primarybg (default: false)
 */
export default function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  className = "",
  width = "w-48",
  isWhite = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const SelectedIcon = selectedOption?.icon;
  const selectedIconColor = selectedOption?.iconColor || "text-primary";

  const bgClass = isWhite ? "bg-white" : "bg-primarybg";
  const dropdownBgClass = isWhite ? "bg-white" : "bg-primarybg";
  const hoverBgClass = isWhite ? "hover:bg-gray-50" : "hover:bg-primarybg/70";

  return (
    <div ref={dropdownRef} className={`relative ${width} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[42px] cursor-pointer px-3 ${bgClass} border border-gray-200 rounded-md text-sm text-left flex
         items-center justify-between gap-2 focus:border-primary `}
      >
        <span
          className={`flex items-center gap-2 ${selectedOption ? "text-primarytext" : "text-secondarytext"}`}
        >
          {SelectedIcon && (
            <SelectedIcon size={15} className={selectedIconColor} />
          )}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-secondarytext transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-full ${dropdownBgClass} border border-gray-200 rounded-md shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          {options.map((option) => {
            const OptionIcon = option.icon;
            const optionIconColor = option.iconColor || "text-primary";
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between ${hoverBgClass} transition-colors ${
                  value === option.value
                    ? "text-primary font-medium bg-primary/5"
                    : "text-primarytext"
                }`}
              >
                <span className="flex items-center gap-2">
                  {OptionIcon && (
                    <OptionIcon size={15} className={optionIconColor} />
                  )}
                  {option.label}
                </span>
                {value === option.value && (
                  <Check size={14} className="text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
