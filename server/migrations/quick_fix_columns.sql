-- Quick fix: Add missing columns to vehiclerequests table
-- Run each statement one by one, ignore errors for columns that already exist

ALTER TABLE vehiclerequests ADD COLUMN status ENUM('pending', 'approved', 'assigned', 'completed', 'rejected', 'cancelled') DEFAULT 'pending';
ALTER TABLE vehiclerequests ADD COLUMN admin_remarks TEXT;
ALTER TABLE vehiclerequests ADD COLUMN vehicle_id INT DEFAULT NULL;
ALTER TABLE vehiclerequests ADD COLUMN driver_id INT DEFAULT NULL;
ALTER TABLE vehiclerequests ADD COLUMN approved_by INT DEFAULT NULL;
ALTER TABLE vehiclerequests ADD COLUMN approved_at DATETIME DEFAULT NULL;
ALTER TABLE vehiclerequests ADD COLUMN assigned_at DATETIME DEFAULT NULL;
ALTER TABLE vehiclerequests ADD COLUMN ContactName VARCHAR(100);
ALTER TABLE vehiclerequests ADD COLUMN ContactPhone VARCHAR(20);
ALTER TABLE vehiclerequests ADD COLUMN faculty_id INT;
