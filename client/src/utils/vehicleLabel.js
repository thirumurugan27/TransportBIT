export const formatVehicleLabel = (item = {}) => {
    const name =
        item.bus_name ||
        item.vehicle_name ||
        item.name ||
        item.vehicleLabel ||
        item.model_name;
    const number =
        item.vehicle_number ||
        item.registration_number ||
        item.reg_no ||
        item.vrn ||
        "";

    if (name && number && name !== number) {
        return `${name} (${number})`;
    }

    return name || number || "Unnamed vehicle";
};
