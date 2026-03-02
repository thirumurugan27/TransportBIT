import React, {useState} from "react";
import {Routes, Route} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import FacultyHome from "./views/FacultyHome";
import FacultyProfile from "./views/FacultyProfile";
import VehicleRequestForm from "./views/VehicleRequestForm";
import VehicleBooking from "./views/VehicleBooking";
import {useAuth} from "../../context/AuthContext";

export default function FacultyDashboard() {
  const {user, logout} = useAuth();
  const facultyName = user?.full_name || user?.username || "Faculty";

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-primarybg">
      <Sidebar
        role="FACULTY"
        useLogo={true}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          title="Faculty Portal"
          user={{name: facultyName, role: "Faculty"}}
          onLogout={logout}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden bg-primarybg p-3 sm:p-4 lg:p-6">
          <Routes>
            <Route path="" element={<FacultyHome />} />
            <Route path="vehicle-booking" element={<VehicleBooking />} />
            <Route path="new-request" element={<VehicleRequestForm />} />
            <Route path="profile" element={<FacultyProfile />} />
            <Route path="*" element={<FacultyHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
