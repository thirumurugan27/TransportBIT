import React from "react";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import Login from "./pages/Auth/Login";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import DriverDashboard from "./pages/Driver/DriverDashboard";
import InchargeDashboard from "./pages/Incharge/InchargeDashboard";
import StudentDashboard from "./pages/Student/StudentDashboard";
import FacultyDashboard from "./pages/Faculty/FacultyDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

import {AuthProvider} from "./context/AuthContext";
import {ToastProvider} from "./context/ToastContext";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Root is now Login */}
            <Route path="/" element={<Login />} />

            {/* Unified Login */}
            <Route path="/login" element={<Login />} />

            {/* Legacy Login Routes (redirect to unified login) */}
            <Route
              path="/admin-login"
              element={<Navigate to="/login" replace />}
            />
            <Route
              path="/driver-login"
              element={<Navigate to="/login" replace />}
            />
            <Route
              path="/incharge-login"
              element={<Navigate to="/login" replace />}
            />

            {/* Admin Dashboard - Protected with nested routes */}
            <Route
              path="/admin-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Driver Dashboard - Protected with nested routes */}
            <Route
              path="/driver-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["DRIVER"]}>
                  <DriverDashboard />
                </ProtectedRoute>
              }
            />

            {/* Incharge Dashboard - Protected with nested routes */}
            <Route
              path="/incharge-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["INCHARGE"]}>
                  <InchargeDashboard />
                </ProtectedRoute>
              }
            />

            {/* Student Dashboard - Protected with nested routes */}
            <Route
              path="/student-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["STUDENT"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Faculty Dashboard - Protected with nested routes */}
            <Route
              path="/faculty-dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["FACULTY"]}>
                  <FacultyDashboard />
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
