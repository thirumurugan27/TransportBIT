-- Fuel & Mileage Management Tables
-- Run this migration to add fuel tracking capabilities

-- Fuel Indents Table
CREATE TABLE IF NOT EXISTS fuel_indents (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    fuel_requested DECIMAL(10,2) NOT NULL,
    fuel_filled DECIMAL(10,2),
    odometer_reading INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, rejected
    requested_at DATETIME NOT NULL,
    completed_at DATETIME,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Odometer Readings Table
CREATE TABLE IF NOT EXISTS odometer_readings (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    from_reading INTEGER NOT NULL,
    to_reading INTEGER NOT NULL,
    fuel_used DECIMAL(10,2),
    recorded_at DATETIME NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Note: MySQL does not support "IF NOT EXISTS" on CREATE INDEX
-- Run this migration once; rerunning will error if indexes already exist
CREATE INDEX idx_fuel_indents_vehicle ON fuel_indents(vehicle_id);
CREATE INDEX idx_fuel_indents_driver ON fuel_indents(driver_id);
CREATE INDEX idx_fuel_indents_status ON fuel_indents(status);
CREATE INDEX idx_odometer_vehicle ON odometer_readings(vehicle_id);
CREATE INDEX idx_odometer_driver ON odometer_readings(driver_id);
