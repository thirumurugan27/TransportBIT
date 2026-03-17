/**
 * API utility functions for making authenticated requests.
 *
 * SECURITY: All requests use credentials: 'include' so the HttpOnly
 * TRANSPORT_AUTH cookie is sent automatically. No token is ever read
 * from or written to localStorage.
 *
 * Any 401 response is treated as "session expired" and the user is
 * redirected to /login so stale state is never shown.
 */

export const API_BASE = import.meta.env.VITE_API_BASE;
const BASE_HEADERS = {
    'Content-Type': 'application/json',
    'X-Tunnel-Skip-Efficiency-Check': 'true',
};
/** Redirect to login on 401 — session expired or not authenticated */
const handleUnauthorized = (res) => {
    if (res.status === 401) {
        window.location.href = '/login';
    }
    return res;
};

/**
 * Make an authenticated GET request
 * @param {string} endpoint - API endpoint (e.g., '/api/driver/assignments')
 * @returns {Promise<Response>}
 */
export const apiGet = async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        credentials: 'include',
        headers: BASE_HEADERS,
    });
    return handleUnauthorized(res);
};
/**
 * Make an authenticated POST request
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPost = async (endpoint, body) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: BASE_HEADERS,
        body: JSON.stringify(body),
    });
    return handleUnauthorized(res);
};
/**
 * Make an authenticated PUT request
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPut = async (endpoint, body) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        credentials: 'include',
        headers: BASE_HEADERS,
        body: JSON.stringify(body),
    });
    return handleUnauthorized(res);
};
/**
 * Make an authenticated DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Response>}
 */
export const apiDelete = async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: BASE_HEADERS,
    });
    return handleUnauthorized(res);
};
/**
 * Make an authenticated file upload request (multipart/form-data)
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - FormData instance containing the file(s)
 * @returns {Promise<Response>}
 */
export const apiUpload = async (endpoint, formData) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'X-Tunnel-Skip-Efficiency-Check': 'true',
            // No Content-Type: browser sets it automatically with boundary for FormData
        },
        body: formData,
    });
    return handleUnauthorized(res);
};
/**
 * Helper to get today's date in YYYY-MM-DD format
 * @returns {string}
 */
export const getToday = () => {
    return new Date().toISOString().split('T')[0];
};