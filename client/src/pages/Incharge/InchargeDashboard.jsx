import React, {useState} from "react";
import {Routes, Route} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import InchargeHome from "./views/InchargeHome";
import LeaveApprovals from "./views/LeaveApprovals";
import InchargeAssignments from "./views/InchargeAssignments";
import MarkAttendance from "./views/MarkAttendance";
import DriverHistory from "./views/DriverHistory";
import KmSummary from "../Admin/views/KmSummary";
import {useAuth} from "../../context/AuthContext";

export default function InchargeDashboard() {
  const {user, logout} = useAuth();
  const inchargeName = user?.full_name || "Incharge";

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar role="INCHARGE" />

      <div className="flex-1 flex flex-col overflow-hidden ml-[220px]">
        <DashboardHeader
          title="Incharge Dashboard"
          user={{name: inchargeName, role: "Incharge"}}
          onLogout={logout}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-6">
          <Routes>
            <Route path="" element={<InchargeHome />} />
            <Route path="mark-attendance" element={<MarkAttendance />} />
            <Route path="driver-history" element={<DriverHistory />} />
            <Route path="assignments" element={<InchargeAssignments />} />
            <Route path="leave-approvals" element={<LeaveApprovals />} />
            <Route path="km-summary" element={<KmSummary />} />
            <Route path="*" element={<InchargeHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
