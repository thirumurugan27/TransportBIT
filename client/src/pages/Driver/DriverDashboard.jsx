import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Sidebar } from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import DriverHome from "./views/DriverHome";
import DriverAssignments from "./views/DriverAssignments";
import DriverKmLog from "./views/DriverKmLog";
import DriverApplyLeave from "./views/DriverApplyLeave";
import DriverProfile from "./views/DriverProfile";
import ComingSoon from "./views/ComingSoon";
import { useAuth } from "../../context/AuthContext";

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const driverName = user?.full_name || user?.username || "Driver";
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar role="DRIVER" />

      <div className="flex-1 flex flex-col overflow-hidden ml-[220px]">
        <DashboardHeader
          title="Driver Dashboard"
          user={{ name: driverName, role: "Driver" }}
          onLogout={logout}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-6">
          <Routes>
            <Route path="" element={<DriverHome />} />
            <Route path="assignments" element={<DriverAssignments />} />
            <Route path="km-log" element={<DriverKmLog />} />
            <Route path="apply-leave" element={<DriverApplyLeave />} />
            <Route path="profile" element={<DriverProfile />} />
            <Route path="*" element={<DriverHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
