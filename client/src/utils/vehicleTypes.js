import { apiGet } from "./api";

const FALLBACK_VEHICLE_TYPES = [
    { id: 1, type: "BUS", label: "College Bus" },
    { id: 2, type: "CAR", label: "Car" },
    { id: 3, type: "BATTERY_VEHICLE", label: "Battery Vehicle" },
    { id: 4, type: "OTHER", label: "Others" },
];

export async function fetchVehicleTypes() {
    try {
        const res = await apiGet("/api/vehicle-types");
        if (!res.ok) {
            return FALLBACK_VEHICLE_TYPES;
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            return FALLBACK_VEHICLE_TYPES;
        }
        return data;
    } catch (_err) {
        return FALLBACK_VEHICLE_TYPES;
    }
}

export function toVehicleTypeLabel(type) {
    if (!type) return "";
    return type
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
