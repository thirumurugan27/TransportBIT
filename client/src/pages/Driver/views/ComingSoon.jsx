import React from "react";

export default function ComingSoon({title}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-md shadow-sm border border-gray-100 h-64">
      <div className="w-16 h-16 bg-primarybg rounded-md flex items-center justify-center text-3xl mb-4">
        🚐
      </div>
      <h2 className="text-xl font-bold text-primarytext">
        {title || "Loading Module"}
      </h2>
      <p className="text-secondarytext mt-2">
        This driver feature is being updated.
      </p>
    </div>
  );
}
