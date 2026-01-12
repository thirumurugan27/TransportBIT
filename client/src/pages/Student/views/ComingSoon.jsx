import React from "react";

export default function ComingSoon({title}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-md shadow-sm border border-gray-100 h-64">
      <div className="text-4xl mb-4">🎓</div>
      <h2 className="text-xl font-bold text-gray-800">
        {title || "Student Module"}
      </h2>
      <p className="text-gray-500 mt-2">This feature is under maintenance.</p>
    </div>
  );
}
