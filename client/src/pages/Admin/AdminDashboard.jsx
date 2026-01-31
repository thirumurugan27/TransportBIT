import React, {useState, useEffect} from "react";
import {Routes, Route, useNavigate} from "react-router-dom";
import {Sidebar} from "../../components/layout";
import DashboardHeader from "../../components/DashboardHeader";
import AdminHome from "./views/AdminHome";
import AdminDrivers from "./views/AdminDrivers";
import AdminVehicles from "./views/Vehicles";
import AdminBusFleet from "./views/AdminBusFleet";
import Assignments from "./views/Assignments";
import TemporaryAssignments from "./views/TemporaryAssignments";
import LeaveApprovals from "./views/LeaveApprovals";
import ScheduleManagement from "./views/ScheduleManagement";
import KmManagement from "./views/KmManagement";
import AttendanceRecords from "./views/AttendanceRecords";
import InsuranceFCStatus from "./views/InsuranceFCStatus";
import FCReplacementManagement from "./views/FCReplacementManagement";
import AdminStudentTransport from "./views/AdminStudentTransport";
import ComingSoon from "./views/ComingSoon";

import {useAuth} from "../../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminDashboard() {
  const {user, logout} = useAuth();
  const [absentAlerts, setAbsentAlerts] = useState([]);
  const navigate = useNavigate();
  const adminName = user?.full_name || user?.username || "Admin";

  // Fetch absent driver alerts logic
  useEffect(() => {
    const fetchAbsentAlerts = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(
          `${API_BASE}/api/admin/assignments/absent-alerts?date=${today}`,
        );
        const data = await res.json();
        setAbsentAlerts(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAbsentAlerts();
    const interval = setInterval(fetchAbsentAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-primarybg">
      <Sidebar role="ADMIN" />

      <div className="flex-1 flex flex-col overflow-hidden ml-[220px]">
        <DashboardHeader
          title="Admin Dashboard"
          user={{name: adminName, role: "Admin"}}
          onLogout={logout}
          alerts={absentAlerts}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primarybg p-6">
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
            <Route path="insurance-fc-status" element={<InsuranceFCStatus />} />
            <Route
              path="fc-replacement"
              element={<FCReplacementManagement />}
            />
            <Route
              path="student-transport"
              element={<AdminStudentTransport />}
            />
            <Route path="*" element={<AdminHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
