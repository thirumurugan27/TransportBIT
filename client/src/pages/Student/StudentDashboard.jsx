import React, {useState} from "react";
import {Routes, Route, useNavigate} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import StudentHome from "./views/StudentHome";
import StudentTrackBus from "./views/StudentTrackBus";
import StudentTransport from "./views/StudentTransport";
import ComingSoon from "./views/ComingSoon";
import {useAuth} from "../../context/AuthContext";

export default function StudentDashboard() {
  const {user, logout} = useAuth();
  const studentName = user?.full_name || user?.username || "Student";
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar
        role="STUDENT"
        useLogo={true}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-[220px]">
        <DashboardHeader
          title="Student Portal"
          user={{name: studentName, role: "Student"}}
          onLogout={logout}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-3 sm:p-4 lg:p-6">
          <Routes>
            <Route path="" element={<StudentHome />} />
            <Route path="my-bus" element={<StudentTransport />} />
            <Route path="my-transport" element={<StudentTransport />} />
            <Route path="track-bus" element={<StudentTrackBus />} />
            <Route
              path="bus-pass"
              element={<ComingSoon title="Digital Bus Pass" />}
            />
            <Route
              path="profile"
              element={<ComingSoon title="Profile Settings" />}
            />
            <Route path="*" element={<StudentHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
