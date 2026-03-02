/**
 * Auth utility functions
 *
 * SECURITY: Authentication is handled entirely via HttpOnly cookies set by the
 * server. No tokens or sensitive user data are ever written to localStorage or
 * sessionStorage, preventing XSS token-theft attacks.
 *
 * For user data, consume the AuthContext (useAuth()) instead of these helpers
 * where possible. These helpers exist for edge-cases outside React tree.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

/**
 * Programmatically log the user out:
 * - Clears the HttpOnly cookie server-side
 * - Redirects to /login
 * NOTE: Do NOT call localStorage.setItem/removeItem for auth data anywhere.
 */
export const logout = async () => {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch (err) {
        console.error("Logout API call failed:", err);
    }
    window.location.href = "/login";
};

/**
 * Returns headers needed for every API request.
 * No Authorization header — the HttpOnly cookie is sent automatically
 * by the browser via credentials: 'include'.
 */
export const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Tunnel-Skip-Efficiency-Check': 'true',
});

/**
 * Check authentication status by calling the /api/me endpoint.
 * Never rely on localStorage to decide if a user is logged in.
 * @returns {Promise<object|null>} user object or null
 */
export const fetchCurrentUser = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            credentials: 'include',
            headers: getAuthHeaders(),
        });
        if (res.ok) return res.json();
        return null;
    } catch {
        return null;
    }
};
