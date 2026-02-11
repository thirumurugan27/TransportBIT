/**
 * API utility functions for making authenticated requests
 * All requests include credentials (cookies) for authentication
 */

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

/**
 * Make an authenticated GET request
 * @param {string} endpoint - API endpoint (e.g., '/api/driver/assignments')
 * @returns {Promise<Response>}
 */
export const apiGet = async (endpoint) => {
    return fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Tunnel-Skip-Efficiency-Check': 'true',
        },
    });
};

/**
 * Make an authenticated POST request
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPost = async (endpoint, body) => {
    return fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Tunnel-Skip-Efficiency-Check': 'true',
        },
        body: JSON.stringify(body),
    });
};

/**
 * Make an authenticated DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Response>}
 */
export const apiDelete = async (endpoint) => {
    return fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Tunnel-Skip-Efficiency-Check': 'true',
        },
    });
};

/**
 * Helper to get today's date in YYYY-MM-DD format
 * @returns {string}
 */
export const getToday = () => {
    return new Date().toISOString().split('T')[0];
};
