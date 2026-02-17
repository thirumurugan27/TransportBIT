/**
 * Date and Time Formatting Utilities
 * Backend now returns dates in dd-mm-yyyy format and times in 12-hour format (hh:mm AM/PM)
 * These utilities now just pass through the formatted values from backend
 */

/**
 * Return date as-is from backend (already in dd-mm-yyyy format)
 * @param {string} dateStr - Date string from backend
 * @returns {string} Date string or "-" if empty
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return dateStr;
};

/**
 * Format JavaScript Date object or date string to dd-mm-yyyy format
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date in dd-mm-yyyy format or "-" if invalid
 */
export const formatDateToDDMMYYYY = (date) => {
    if (!date) return "-";

    let dateObj;
    if (date instanceof Date) {
        dateObj = date;
    } else {
        dateObj = new Date(date);
    }

    if (isNaN(dateObj.getTime())) return "-";

    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
};

/**
 * Return time as-is from backend (already in hh:mm AM/PM format)
 * If time is in 24-hour format (legacy), convert it to 12-hour format
 * @param {string} timeStr - Time string (hh:mm AM/PM or HH:MM:SS)
 * @returns {string} Formatted time (hh:mm AM/PM)
 */
export const formatTime = (timeStr) => {
    if (!timeStr) return "-";

    // If already in 12-hour format (contains AM/PM), return as-is
    if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) {
        return timeStr;
    }

    // Legacy: Handle 24-hour time string like "14:30:00" or "14:30"
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
 * @param {string} dateStr - Date string (dd-mm-yyyy from backend)
 * @param {string} timeStr - Time string (hh:mm AM/PM from backend)
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "-";
    if (!timeStr) return dateStr;
    const formattedTime = formatTime(timeStr);
    return `${dateStr}, ${formattedTime}`;
};

/**
 * Parse dd-mm-yyyy date string to Date object (for calculations only)
 * @param {string} dateStr - Date string in dd-mm-yyyy format
 * @returns {Date|null} Parsed Date object or null
 */
export const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    // Check if dd-mm-yyyy format
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
    }

    const date = new Date(dateStr);
    return isNaN(date) ? null : date;
};

/**
 * Calculate duration between two dates
 * @param {string} startDate - Start date (dd-mm-yyyy)
 * @param {string} endDate - End date (dd-mm-yyyy)
 * @returns {string} Duration (e.g., "3 days")
 */
export const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return "-";

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start || !end) return "-";

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
