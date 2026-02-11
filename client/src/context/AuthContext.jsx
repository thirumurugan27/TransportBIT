import React, {createContext, useContext, useState, useEffect} from "react";
import {useNavigate, useLocation} from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Use credentials: 'include' to send cookies
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: {
          "X-Tunnel-Skip-Efficiency-Check": "true",
          // If you are using a token in header as fallback:
          // 'Authorization': `Bearer ${token}`
          // But since the user wants to avoid local storage, we rely on the HttpOnly cookie set by backend
        },
        credentials: "include",
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);

        // Handle redirect if on login page and already logged in
        if (location.pathname === "/login" || location.pathname === "/") {
          redirectToDashboard(userData.role);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tunnel-Skip-Efficiency-Check": "true",
        },
        body: JSON.stringify({username, password}),
        credentials: "include", // Important for setting the cookie
      });

      if (res.ok) {
        const data = await res.json();
        // Save token to localStorage for API calls
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        setUser(data);
        redirectToDashboard(data.role);
        return {success: true};
      } else {
        const err = await res.json();
        return {success: false, error: err.error};
      }
    } catch (err) {
      return {success: false, error: "Network error"};
    }
  };

  // Google Login just refreshes state because the popup handles the cookie setting
  const googleLoginSuccess = () => {
    checkAuth();
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout failed", err);
    }
    // Clear localStorage
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const redirectToDashboard = (role) => {
    switch (role) {
      case "ADMIN":
        navigate("/admin-dashboard");
        break;
      case "DRIVER":
        navigate("/driver-dashboard");
        break;
      case "INCHARGE":
        navigate("/incharge-dashboard");
        break;
      case "STUDENT":
        navigate("/student-dashboard");
        break;
      case "FACULTY":
        navigate("/faculty-dashboard");
        break;
      default:
        navigate("/dashboard");
    }
  };

  return (
    <AuthContext.Provider
      value={{user, login, logout, googleLoginSuccess, loading}}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
