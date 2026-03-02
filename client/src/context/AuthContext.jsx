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

  // Validate the session with the server. Called once on mount and after Google login.
  // The HttpOnly cookie is sent automatically by the browser — no token handling in JS.
  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        credentials: "include",
        headers: {"X-Tunnel-Skip-Efficiency-Check": "true"},
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (location.pathname === "/login" || location.pathname === "/") {
          redirectToDashboard(userData.role);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Submit credentials. Server validates and sets the HttpOnly cookie.
  // The response body gives us the user profile — we never touch the token.
  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Tunnel-Skip-Efficiency-Check": "true",
        },
        body: JSON.stringify({username, password}),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        redirectToDashboard(data.role);
        return {success: true};
      }
      const err = await res.json();
      return {success: false, error: err.error || "Invalid credentials"};
    } catch {
      return {success: false, error: "Network error. Please try again."};
    }
  };

  // Called by the Google OAuth popup after it sets the cookie server-side.
  const googleLoginSuccess = () => checkAuth();

  // Tell the server to expire the cookie, then clear React state.
  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Even if the request fails, clear local state and redirect
    }
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
