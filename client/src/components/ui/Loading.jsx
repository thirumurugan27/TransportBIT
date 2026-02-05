import React from "react";

const Loading = ({fullScreen = true, size = "default", text = ""}) => {
  const sizeClasses = {
    small: "w-6 h-6",
    default: "w-12 h-12",
    large: "w-16 h-16",
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-primarybg/80 backdrop-blur-sm"
    : "flex items-center justify-center py-12";

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative">
          {/* Outer ring */}
          <div
            className={`${sizeClasses[size]} rounded-full border-[3px] border-primary/20`}
          />
          {/* Spinning arc */}
          <div
            className={`${sizeClasses[size]} absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin`}
            style={{animationDuration: "0.8s"}}
          />
          {/* Inner pulse dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{animationDuration: "1s"}}
            />
          </div>
        </div>

        {/* Loading text */}
        {text && (
          <p className="text-sm font-medium text-secondarytext animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  );
};

export default Loading;
