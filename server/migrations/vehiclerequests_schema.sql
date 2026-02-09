-- Migration: Vehicle Requests Table (Complete Schema)
-- Run this SQL in your MySQL database

-- First, ensure faculty table exists
CREATE TABLE IF NOT EXISTS faculty (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    department VARCHAR(100),
    designation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Drop and recreate vehiclerequests table with correct schema
-- BACKUP YOUR DATA FIRST if you have existing records!

DROP TABLE IF EXISTS vehiclerequests;

CREATE TABLE vehiclerequests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    faculty_id INT NOT NULL,
    
    -- Booking Details
    BookingType VARCHAR(50) DEFAULT 'faculty',  -- 'faculty', 'guest', 'official'
    TripType VARCHAR(50) DEFAULT 'one_way',     -- 'one_way', 'round_trip'
    TripMode VARCHAR(50) DEFAULT 'official',    -- 'official', 'personal'
    Purpose TEXT NOT NULL,
    CountPerson INT DEFAULT 1,
    
    -- Onward Trip
    OnwardFromPlace VARCHAR(255) NOT NULL,
    OnwardToPlace VARCHAR(255) NOT NULL,
    OnwardFromDateTime DATETIME NOT NULL,
    OnwardTodateTime DATETIME,
    
    -- Return Trip (for round trip)
    ReturnFromPlace VARCHAR(255),
    ReturnToPlace VARCHAR(255),
    ReturnFromDateTime DATETIME,
    ReturnTodateTime DATETIME,
    
    -- Contact Info
    ContactName VARCHAR(100),
    ContactPhone VARCHAR(20),
    
    -- Assignment
    vehicle_id INT DEFAULT NULL,
    driver_id INT DEFAULT NULL,
    
    -- Status and Approval
    status ENUM('pending', 'approved', 'assigned', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
    admin_remarks TEXT,
    approved_by INT DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    assigned_at DATETIME DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_vehiclerequests_faculty ON vehiclerequests(faculty_id);
CREATE INDEX idx_vehiclerequests_status ON vehiclerequests(status);
CREATE INDEX idx_vehiclerequests_vehicle ON vehiclerequests(vehicle_id);
CREATE INDEX idx_vehiclerequests_driver ON vehiclerequests(driver_id);
CREATE INDEX idx_vehiclerequests_onward_date ON vehiclerequests(OnwardFromDateTime);
