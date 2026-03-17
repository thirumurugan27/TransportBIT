import React, {useState} from "react";
import {Routes, Route} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import DriverHome from "./views/DriverHome";
import DriverAssignments from "./views/DriverAssignments";
import DriverVehicleRequests from "./views/DriverVehicleRequests";
import DriverKmLog from "./views/DriverKmLog";
import DriverApplyLeave from "./views/DriverApplyLeave";
import DriverProfile from "./views/DriverProfile";
import Notifications from "./views/Notifications";
import DriverServiceRepair from "./views/DriverServiceRepair";
import DriverFuelIndent from "./views/DriverFuelIndent";
import {useAuth} from "../../context/AuthContext";

export default function DriverDashboard() {
  const {user, logout} = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const driverName = user?.full_name || user?.username || "Driver";

  return (
    <div className="flex min-h-screen bg-primarybg">
      <Sidebar
        role="DRIVER"
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          title="BIT Transport"
          user={{name: driverName, role: "Driver"}}
          onLogout={logout}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden bg-primarybg p-3 sm:p-4 lg:p-6">
          <Routes>
            <Route path="" element={<DriverHome />} />
            <Route path="assignments" element={<DriverAssignments />} />
            <Route
              path="vehicle-requests"
              element={<DriverVehicleRequests />}
            />
            <Route path="km-log" element={<DriverKmLog />} />
            <Route path="apply-leave" element={<DriverApplyLeave />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="service-repair" element={<DriverServiceRepair />} />
            <Route path="fuel-indent" element={<DriverFuelIndent />} />
            <Route path="profile" element={<DriverProfile />} />
            <Route path="*" element={<DriverHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
