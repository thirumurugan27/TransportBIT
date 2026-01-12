import React from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-md shadow-2xl ${maxWidth} w-full max-h-[90vh] overflow-hidden animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all duration-200 hover:scale-105"
          >
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
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Common form input style - Tailwind classes
export const inputStyles =
  "w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm bg-gray-50/50 hover:bg-white";

// Common button styles - Tailwind classes
export const btnPrimary =
  "w-full px-4 py-3 bg-primary text-white rounded-md hover:bg-blue-700 transition-all duration-200 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5";
export const btnSecondary =
  "w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all duration-200 font-medium";
export const btnDanger =
  "w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-md hover:from-red-600 hover:to-rose-700 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25";
export const btnSuccess =
  "w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-md hover:from-emerald-600 hover:to-green-700 transition-all duration-200 font-semibold shadow-lg shadow-emerald-500/25";
