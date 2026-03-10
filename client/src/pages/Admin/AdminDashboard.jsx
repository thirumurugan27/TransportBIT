import React, {useState, useEffect} from "react";
import {Routes, Route, useNavigate} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import AdminHome from "./views/AdminHome";
import AdminDrivers from "./views/AdminDrivers";
import AdminVehicles from "./views/Vehicles";
import AdminBusFleet from "./views/AdminBusFleet";
import Assignments from "./views/Assignments";
import LeaveApprovals from "./views/LeaveApprovals";
import ScheduleManagement from "./views/ScheduleManagement";
import KmManagement from "./views/KmManagement";
import AttendanceRecords from "./views/AttendanceRecords";
import VehicleReplacements from "./views/VehicleReplacements";
import VehicleRequests from "./views/VehicleRequests";
import AdminStudentTransport from "./views/AdminStudentTransport";
import ServiceRecords from "./views/ServiceRecords";
import PartsPurchases from "./views/PartsPurchases";
import ServiceReminders from "./views/ServiceReminders";
import Vendors from "./views/Vendors";
import Reports from "./views/Reports";
import AdminFuelIndents from "./views/AdminFuelIndents";

import {useAuth} from "../../context/AuthContext";
import {apiGet, getToday} from "../../utils/api";

export default function AdminDashboard() {
  const {user, logout} = useAuth();
  const [absentAlerts, setAbsentAlerts] = useState([]);
  const navigate = useNavigate();
  const adminName = user?.full_name || user?.username || "Admin";

  // Fetch absent driver alerts logic
  useEffect(() => {
    const fetchAbsentAlerts = async () => {
      try {
        const res = await apiGet(
          `/api/admin/assignments/absent-alerts?date=${getToday()}`,
        );
        const data = await res.json();
        setAbsentAlerts(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAbsentAlerts();
    const interval = setInterval(fetchAbsentAlerts, 30000);

    // Trigger group expiry check (creates notifications if any groups are expiring/expired)
    apiGet("/api/admin/group-expiry-check").catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-primarybg">
      <Sidebar
        role="ADMIN"
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          title="BIT Transport"
          user={{name: adminName, role: "Admin"}}
          onLogout={logout}
          alerts={absentAlerts}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-x-hidden bg-primarybg p-3 sm:p-4 lg:p-6">
          {/* Global Alert Banner */}
          {absentAlerts.length > 0 && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-red-500 text-xl mr-3">⚠️</span>
                <div>
                  <p className="font-bold text-red-700">Action Required</p>
                  <p className="text-sm text-red-600">
                    {absentAlerts.length} drivers are absent for assigned
                    duties.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/admin-dashboard/all-assignments")}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Resolve
              </button>
            </div>
          )}

          <Routes>
            <Route path="" element={<AdminHome />} />
            <Route path="vehicles" element={<AdminVehicles />} />
            <Route path="bus-fleet" element={<AdminBusFleet />} />
            <Route path="drivers" element={<AdminDrivers />} />
            <Route
              path="schedule-management"
              element={<ScheduleManagement />}
            />
            <Route path="all-assignments" element={<Assignments />} />
            <Route path="km-management" element={<KmManagement />} />
            <Route path="leave-approvals" element={<LeaveApprovals />} />
            <Route path="attendance-records" element={<AttendanceRecords />} />
            <Route
              path="vehicle-replacements"
              element={<VehicleReplacements />}
            />
            <Route path="vehicle-requests" element={<VehicleRequests />} />
            <Route
              path="student-transport"
              element={<AdminStudentTransport />}
            />
            <Route path="service-records" element={<ServiceRecords />} />
            <Route path="parts-purchases" element={<PartsPurchases />} />
            <Route path="service-reminders" element={<ServiceReminders />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="reports" element={<Reports />} />
            <Route path="fuel-indents" element={<AdminFuelIndents />} />
            <Route path="*" element={<AdminHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
