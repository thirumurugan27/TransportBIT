import React, {useState} from "react";
import {Routes, Route} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import InchargeHome from "./views/InchargeHome";
import LeaveApprovals from "./views/LeaveApprovals";
import InchargeAssignments from "./views/InchargeAssignments";
import MarkAttendance from "./views/MarkAttendance";
import DriverHistory from "./views/DriverHistory";
import KmManagement from "./views/KmManagement";
import InsuranceFCStatus from "./views/InsuranceFCStatus";
import DriverManagement from "./views/DriverManagement";
import Notifications from "./views/Notifications";
import ScheduleManagement from "./views/ScheduleManagement";
import Assignments from "./views/Assignments";
import {useAuth} from "../../context/AuthContext";

export default function InchargeDashboard() {
  const {user, logout} = useAuth();
  const inchargeName = user?.full_name || "Incharge";

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar
        role="INCHARGE"
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-[220px]">
        <DashboardHeader
          title="Incharge Dashboard"
          user={{name: inchargeName, role: "Incharge"}}
          onLogout={logout}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-3 sm:p-4 lg:p-6">
          <Routes>
            <Route path="" element={<InchargeHome />} />
            <Route path="mark-attendance" element={<MarkAttendance />} />
            <Route path="driver-history" element={<DriverHistory />} />
            <Route path="assignments" element={<InchargeAssignments />} />
            <Route path="leave-approvals" element={<LeaveApprovals />} />
            <Route path="km-management" element={<KmManagement />} />
            <Route path="insurance-fc-status" element={<InsuranceFCStatus />} />
            <Route path="driver-management" element={<DriverManagement />} />
            <Route path="notifications" element={<Notifications />} />
            <Route
              path="schedule-management"
              element={<ScheduleManagement />}
            />
            <Route path="assignment-management" element={<Assignments />} />
            <Route path="*" element={<InchargeHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
