import React, {useState} from "react";

export default function StudentHome() {
  const [studentName] = useState(localStorage.getItem("fullName") || "Student");

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-md p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Hello, {studentName}!</h2>
        <p className="text-pink-100">
          Access your bus schedule and pass details.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800">My Bus</h3>
          <p className="text-gray-500 text-sm mt-1">Bus details loading...</p>
        </div>
        <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800">Bus Pass</h3>
          <p className="text-gray-500 text-sm mt-1">Status: Active</p>
        </div>
      </div>
    </div>
  );
}
