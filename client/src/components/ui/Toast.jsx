import React, {useEffect} from "react";

const Toast = ({id, message, type, removeToast}) => {
  // Determine styles based on type
  const typeStyles = {
    success: "bg-green text-white border-green",
    error: "bg-red text-white border-red",
    warning: "bg-pending text-primarytext border-pending",
    info: "bg-primary text-white border-primary",
  };

  const baseStyles =
    "fixed top-5 right-5 z-50 flex items-center w-full max-w-xs p-4 space-x-4 divide-x rounded-lg shadow space-x-reverse animate-slide-in-right border";
  // Attempting to match the user's theme.
  // 'primary': '#7D53F6'
  // 'green': '#008000'
  // 'red': '#FF5555'
  // 'pending': '#F0B041'

  const getStyles = (type) => {
    switch (type) {
      case "success":
        return "bg-white border-l-4 border-green text-green shadow-lg";
      case "error":
        return "bg-white border-l-4 border-red text-red shadow-lg";
      case "warning":
        return "bg-white border-l-4 border-pending text-pending shadow-lg";
      default:
        return "bg-white border-l-4 border-primary text-primary shadow-lg";
    }
  };

  return (
    <div
      className={`flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 ${getStyles(type)} transition-opacity duration-300`}
      role="alert"
    >
      <div className="text-sm font-normal text-primarytext font-sans">
        {message}
      </div>
      <button
        type="button"
        className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
        onClick={() => removeToast(id)}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg
          className="w-3 h-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
