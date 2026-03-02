import React, {useEffect} from "react";
import {Navigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import Loading from "./ui/Loading";

/**
 * ProtectedRoute Component
 * Checks if user is authenticated and has the required role
 */
export default function ProtectedRoute({children, allowedRoles}) {
  const {user, loading} = useAuth();

  if (loading) {
    return <Loading />;
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to the role's own dashboard if they try to access another role's page
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    switch (user.role) {
      case "ADMIN":
        return <Navigate to="/admin-dashboard" replace />;
      case "DRIVER":
        return <Navigate to="/driver-dashboard" replace />;
      case "STUDENT":
        return <Navigate to="/student-dashboard" replace />;
      case "FACULTY":
        return <Navigate to="/faculty-dashboard" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}
