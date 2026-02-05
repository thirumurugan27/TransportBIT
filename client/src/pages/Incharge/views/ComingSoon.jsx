import React from "react";

export default function ComingSoon({title}) {
  return (
    <div className="flex flex-col items-center justify-center h-96 bg-white rounded-md shadow-sm border border-gray-100 p-8 text-center">
      <div className="w-16 h-16 bg-primarybg text-primary rounded-md flex items-center justify-center text-3xl mb-4">
        🚧
      </div>
      <h2 className="text-2xl font-bold text-primarytext mb-2">
        {title || "Coming Soon"}
      </h2>
      <p className="text-secondarytext max-w-md">
        This module is currently being updated.
      </p>
    </div>
  );
}
