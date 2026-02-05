import React from "react";
import {useAuth} from "../../../context/AuthContext";

export default function FacultyHome() {
  const {user} = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primarydull rounded-md p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome, {user?.full_name || "Faculty"}!
        </h1>
        <p className="mt-2 text-white/90">
          Welcome to the Transport BIT Faculty Portal
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-secondarybg rounded-md p-8 shadow-sm border border-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-primarytext mb-2">
            Faculty Portal
          </h2>
          <p className="text-secondarytext">
            Manage your profile and view transport information
          </p>
        </div>
      </div>
    </div>
  );
}
