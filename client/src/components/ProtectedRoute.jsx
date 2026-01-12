import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute Component
 * Checks if user is authenticated and has the required role
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has the required role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on their role
    switch (user.role) {
      case "ADMIN":
        return <Navigate to="/admin-dashboard" replace />;
      case "DRIVER":
        return <Navigate to="/driver-dashboard" replace />;
      case "INCHARGE":
        return <Navigate to="/incharge-dashboard" replace />;
      case "STUDENT":
        return <Navigate to="/student-dashboard" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}
