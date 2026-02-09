-- Migration: Add missing columns to vehiclerequests table
-- This is a safe migration that only adds columns if they don't exist

-- Add status column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'status');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN status ENUM('pending', 'approved', 'assigned', 'completed', 'rejected', 'cancelled') DEFAULT 'pending'", 
    "SELECT 'status column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add admin_remarks column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'admin_remarks');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN admin_remarks TEXT", 
    "SELECT 'admin_remarks column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add vehicle_id column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'vehicle_id');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN vehicle_id INT DEFAULT NULL", 
    "SELECT 'vehicle_id column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add driver_id column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'driver_id');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN driver_id INT DEFAULT NULL", 
    "SELECT 'driver_id column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add approved_by column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'approved_by');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN approved_by INT DEFAULT NULL", 
    "SELECT 'approved_by column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add approved_at column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'approved_at');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN approved_at DATETIME DEFAULT NULL", 
    "SELECT 'approved_at column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add assigned_at column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'assigned_at');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN assigned_at DATETIME DEFAULT NULL", 
    "SELECT 'assigned_at column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add ContactName column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'ContactName');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN ContactName VARCHAR(100)", 
    "SELECT 'ContactName column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add ContactPhone column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'ContactPhone');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN ContactPhone VARCHAR(20)", 
    "SELECT 'ContactPhone column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Simpler approach: Just run ALTER TABLE with IGNORE
-- ALTER TABLE vehiclerequests 
--     ADD COLUMN IF NOT EXISTS status ENUM('pending', 'approved', 'assigned', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
--     ADD COLUMN IF NOT EXISTS admin_remarks TEXT,
--     ADD COLUMN IF NOT EXISTS vehicle_id INT DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS driver_id INT DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS approved_by INT DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS approved_at DATETIME DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS assigned_at DATETIME DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS ContactName VARCHAR(100),
--     ADD COLUMN IF NOT EXISTS ContactPhone VARCHAR(20);
