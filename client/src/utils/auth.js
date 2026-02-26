/**
 * Auth utility functions
 */

export const logout = async () => {
    try {
        // Call the logout API to clear the HttpOnly cookie on the server
        await fetch('http://localhost:8080/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (err) {
        console.error("Logout API call failed:", err);
    }

    // Clear all auth data from localStorage
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("fullName");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    localStorage.removeItem("driverId");
    localStorage.removeItem("driverName");

    // Redirect to login
    window.location.href = "/login";
};

export const getCurrentUser = () => {
    return {
        userId: localStorage.getItem("userId"),
        username: localStorage.getItem("username"),
        fullName: localStorage.getItem("fullName"),
        email: localStorage.getItem("email"),
        role: localStorage.getItem("role"),
        driverId: localStorage.getItem("driverId"),
    };
};

export const isAuthenticated = () => {
    return !!localStorage.getItem("userId") && !!localStorage.getItem("role");
};

export const hasRole = (allowedRoles) => {
    const role = localStorage.getItem("role");
    return allowedRoles.includes(role);
};

export const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};
