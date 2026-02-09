-- Migration: Add Faculty and Vehicle Booking Tables
-- Run this SQL in your MySQL database

-- First, modify the users table to add FACULTY to the role ENUM
ALTER TABLE users MODIFY COLUMN role ENUM('ADMIN', 'DRIVER', 'INCHARGE', 'STUDENT', 'FACULTY') NOT NULL;

-- Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    department VARCHAR(100),
    designation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vehicle Requests Table (Faculty vehicle booking)
CREATE TABLE IF NOT EXISTS vehicle_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    faculty_id INT NOT NULL,
    trip_type VARCHAR(50) DEFAULT 'one_way',
    request_under VARCHAR(100),
    oral_approval BOOLEAN DEFAULT FALSE,
    purpose VARCHAR(500) NOT NULL,
    total_passengers INT DEFAULT 1,
    declaration_accepted BOOLEAN DEFAULT FALSE,
    mteam_approval BOOLEAN DEFAULT FALSE,
    mteam_approved_by VARCHAR(100),
    vehicle_id INT DEFAULT NULL,
    driver_id INT DEFAULT NULL,
    status ENUM('pending', 'approved', 'assigned', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
    admin_remarks TEXT,
    approved_by INT DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    assigned_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Vehicle Request Trips Table (Individual trip legs)
CREATE TABLE IF NOT EXISTS vehicle_request_trips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    trip_order INT DEFAULT 1,
    departure_date DATE NOT NULL,
    departure_time VARCHAR(10) NOT NULL,
    departure_location VARCHAR(255) NOT NULL,
    arrival_date DATE NOT NULL,
    arrival_time VARCHAR(10) NOT NULL,
    arrival_location VARCHAR(255) NOT NULL,
    num_passengers INT DEFAULT 1,
    passenger_contacts TEXT,
    outcome_auditable TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES vehicle_requests(id) ON DELETE CASCADE
);

-- Create indexes for vehicle_requests
CREATE INDEX idx_vehicle_requests_faculty ON vehicle_requests(faculty_id);
CREATE INDEX idx_vehicle_requests_vehicle ON vehicle_requests(vehicle_id);
CREATE INDEX idx_vehicle_requests_driver ON vehicle_requests(driver_id);
CREATE INDEX idx_vehicle_requests_status ON vehicle_requests(status);
CREATE INDEX idx_vehicle_request_trips_request ON vehicle_request_trips(request_id);
CREATE INDEX idx_vehicle_request_trips_date ON vehicle_request_trips(departure_date);
