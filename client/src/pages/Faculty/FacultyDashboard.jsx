import React from "react";
import {Routes, Route} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import FacultyHome from "./views/FacultyHome";
import FacultyProfile from "./views/FacultyProfile";
import VehicleBooking from "./views/VehicleBooking";
import {useAuth} from "../../context/AuthContext";

export default function FacultyDashboard() {
  const {user, logout} = useAuth();
  const facultyName = user?.full_name || user?.username || "Faculty";

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar role="FACULTY" useLogo={true} />

      <div className="flex-1 flex flex-col overflow-hidden ml-[220px]">
        <DashboardHeader
          title="Faculty Portal"
          user={{name: facultyName, role: "Faculty"}}
          onLogout={logout}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-6">
          <Routes>
            <Route path="" element={<FacultyHome />} />
            <Route path="vehicle-booking" element={<VehicleBooking />} />
            <Route path="profile" element={<FacultyProfile />} />
            <Route path="*" element={<FacultyHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
