/**
 * Date and Time Formatting Utilities
 * Format: dd-mm-yyyy for dates, hh:mm for times
 */

/**
 * Format date string to dd-mm-yyyy
 * @param {string|Date} dateStr - Date string or Date object
 * @returns {string} Formatted date (dd-mm-yyyy)
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date)) return "-";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};

/**
 * Format time string to hh:mm AM/PM
 * @param {string} timeStr - Time string (HH:MM:SS or HH:MM)
 * @returns {string} Formatted time (hh:mm AM/PM)
 */
export const formatTime = (timeStr) => {
    if (!timeStr) return "-";

    // Handle time string like "14:30:00" or "14:30"
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;

    let hours = parseInt(parts[0]);
    const minutes = parts[1];

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // Convert to 12-hour format

    return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
};

/**
 * Format date and time together
 * @param {string} dateStr - Date string
 * @param {string} timeStr - Time string
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "-";
    const formattedDate = formatDate(dateStr);
    if (!timeStr) return formattedDate;
    const formattedTime = formatTime(timeStr);
    return `${formattedDate}, ${formattedTime}`;
};

/**
 * Calculate duration between two dates
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {string} Duration (e.g., "3 days")
 */
export const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return "-";

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) return "-";

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
};

/**
 * Get status label for display
 * @param {object} leave - Leave object
 * @returns {string} Formatted status label
 */
export const getStatusLabel = (leave) => {
    const status = (leave?.status || "").toLowerCase().trim();
    if (status === "rejected") return "Rejected";

    // If explicitly approved or both approvals are present
    if (status === "approved" || (leave.admin_approved_at && leave.incharge_approved_at)) {
        return "Approved";
    }

    // Check individual approvals
    if (status === "admin_approved") {
        return "Admin Approved";
    }
    if (status === "incharge_approved") {
        return "Incharge Approved";
    }
    if (status === "rejected") {
        return "Rejected";
    }
    if (status === "pending" || status === "") {
        return "Pending";
    }

    // Capitalize first letter of each word for unknown statuses
    return status.split("_").map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
};

/**
 * Get status color classes
 * @param {object} leave - Leave object
 * @returns {object} Object with bg and text color classes
 */
export const getStatusColor = (leave) => {
    const status = (leave?.status || "").toLowerCase().trim();
    if (status === "rejected") {
        return {
            bg: "bg-red-100",
            text: "text-red-700",
            badge: "bg-red-500"
        };
    }

    // Check if both approved - fully approved
    if (status === "approved" || (leave.admin_approved_at && leave.incharge_approved_at)) {
        return {
            bg: "bg-green-100",
            text: "text-green-700",
            badge: "bg-green-500"
        };
    }

    // Partially approved
    if (status === "incharge_approved") {
        return {
            bg: "bg-blue-100",
            text: "text-blue-700",
            badge: "bg-blue-500"
        };
    }

    if (status === "admin_approved") {
        return {
            bg: "bg-indigo-100",
            text: "text-indigo-700",
            badge: "bg-indigo-500"
        };
    }

    // Default: pending
    return {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        badge: "bg-yellow-500"
    };
};
