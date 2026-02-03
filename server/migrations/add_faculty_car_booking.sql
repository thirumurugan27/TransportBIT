-- Migration: Add Faculty and Car Booking Tables
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

-- Car Bookings Table
CREATE TABLE IF NOT EXISTS car_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    faculty_id INT NOT NULL,
    vehicle_id INT DEFAULT NULL,
    driver_id INT DEFAULT NULL,
    booking_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    purpose VARCHAR(500) NOT NULL,
    destination VARCHAR(255),
    passenger_count INT DEFAULT 1,
    status ENUM('pending', 'approved', 'onhold', 'booked', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
    otp VARCHAR(6),
    otp_generated_at TIMESTAMP NULL,
    otp_verified_at TIMESTAMP NULL,
    admin_remarks TEXT,
    approved_by INT DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes (ignore if already exists)
CREATE INDEX idx_car_bookings_faculty ON car_bookings(faculty_id);
CREATE INDEX idx_car_bookings_vehicle ON car_bookings(vehicle_id);
CREATE INDEX idx_car_bookings_driver ON car_bookings(driver_id);
CREATE INDEX idx_car_bookings_date ON car_bookings(booking_date);
CREATE INDEX idx_car_bookings_status ON car_bookings(status);

-- Create 4 Faculty Users (only if they don't exist)
-- Faculty 1
INSERT INTO users (username, password, role, full_name, email, phone, status) 
SELECT 'faculty1', 'faculty123', 'FACULTY', 'Dr. Rajesh Kumar', 'rajesh@bit.edu', '9876543201', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'faculty1');
INSERT INTO faculty (user_id, department, designation) 
SELECT id, 'Computer Science', 'Professor' FROM users WHERE username = 'faculty1' 
AND NOT EXISTS (SELECT 1 FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.username = 'faculty1');

-- Faculty 2
INSERT INTO users (username, password, role, full_name, email, phone, status) 
SELECT 'faculty2', 'faculty123', 'FACULTY', 'Dr. Priya Sharma', 'priya@bit.edu', '9876543202', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'faculty2');
INSERT INTO faculty (user_id, department, designation) 
SELECT id, 'Electronics', 'Associate Professor' FROM users WHERE username = 'faculty2'
AND NOT EXISTS (SELECT 1 FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.username = 'faculty2');

-- Faculty 3
INSERT INTO users (username, password, role, full_name, email, phone, status) 
SELECT 'faculty3', 'faculty123', 'FACULTY', 'Dr. Anil Verma', 'anil@bit.edu', '9876543203', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'faculty3');
INSERT INTO faculty (user_id, department, designation) 
SELECT id, 'Mechanical', 'Professor' FROM users WHERE username = 'faculty3'
AND NOT EXISTS (SELECT 1 FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.username = 'faculty3');

-- Faculty 4
INSERT INTO users (username, password, role, full_name, email, phone, status) 
SELECT 'faculty4', 'faculty123', 'FACULTY', 'Dr. Sunita Patel', 'sunita@bit.edu', '9876543204', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'faculty4');
INSERT INTO faculty (user_id, department, designation) 
SELECT id, 'Civil', 'Assistant Professor' FROM users WHERE username = 'faculty4'
AND NOT EXISTS (SELECT 1 FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.username = 'faculty4');
