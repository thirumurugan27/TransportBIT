-- ============================================================
-- Migration 001: Database Cleanup & Optimization
-- Transport System - transport_bit
-- Date: 2026-02-12
-- ============================================================
-- Run this migration with:
--   mysql -u root -p transport_bit < migrations/001_cleanup_and_optimize.sql
-- ============================================================

-- ============================================
-- SECTION 1: DROP UNUSED TABLES (12 tables)
-- ============================================

-- Legacy / never-referenced tables
DROP TABLE IF EXISTS `approvals`;
DROP TABLE IF EXISTS `car_bookings`;
DROP TABLE IF EXISTS `driver_unavailability`;
DROP TABLE IF EXISTS `ev_group_assignments`;
DROP TABLE IF EXISTS `ev_vehicle_group_members`;
DROP TABLE IF EXISTS `ev_vehicle_groups`;
DROP TABLE IF EXISTS `fitnessdetails`;
DROP TABLE IF EXISTS `fuelbook`;
DROP TABLE IF EXISTS `greentaxdetails`;
DROP TABLE IF EXISTS `insurancedetails`;
DROP TABLE IF EXISTS `leaverecord`;
DROP TABLE IF EXISTS `vehicledetails`;

-- ============================================
-- SECTION 2: DROP UNUSED COLUMNS
-- (MySQL 8.0 doesn't support IF EXISTS for columns,
--  so we use separate ALTER TABLE statements. If a column
--  doesn't exist, the statement will error — safe to ignore.)
-- ============================================

-- assignments: remove 7 unused columns
ALTER TABLE `assignments` DROP COLUMN `otp`;
ALTER TABLE `assignments` DROP COLUMN `otp_generated_at`;
ALTER TABLE `assignments` DROP COLUMN `otp_verified_at`;
ALTER TABLE `assignments` DROP COLUMN `purpose`;
ALTER TABLE `assignments` DROP COLUMN `destination`;
ALTER TABLE `assignments` DROP COLUMN `start_time`;
ALTER TABLE `assignments` DROP COLUMN `end_time`;

-- driver_clusters: remove unused default_shift_id
ALTER TABLE `driver_clusters` DROP COLUMN `default_shift_id`;

-- buses: remove unused route_number
ALTER TABLE `buses` DROP COLUMN `route_number`;

-- ============================================
-- SECTION 4: CREATE MISSING TABLES
-- ============================================

-- fuel_indents: referenced in admin/fuel.go but table never existed
CREATE TABLE IF NOT EXISTS `fuel_indents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vehicle_id` INT NOT NULL,
  `driver_id` INT NOT NULL,
  `fuel_requested` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `fuel_filled` DECIMAL(10,2) DEFAULT NULL,
  `odometer_reading` INT NOT NULL DEFAULT 0,
  `status` ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_fuel_vehicle` (`vehicle_id`),
  INDEX `idx_fuel_driver` (`driver_id`),
  INDEX `idx_fuel_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- odometer_readings: referenced in admin/fuel.go but table never existed
CREATE TABLE IF NOT EXISTS `odometer_readings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vehicle_id` INT NOT NULL,
  `driver_id` INT NOT NULL,
  `from_reading` INT NOT NULL DEFAULT 0,
  `to_reading` INT NOT NULL DEFAULT 0,
  `fuel_used` DECIMAL(10,2) DEFAULT 0,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_odo_vehicle` (`vehicle_id`),
  INDEX `idx_odo_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- SECTION 5: CONSOLIDATE NOTIFICATIONS
-- Merge admin_notifications, driver_notifications,
-- user_notifications into a single `notifications` table
-- ============================================

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recipient_role` ENUM('ADMIN','DRIVER','STUDENT','FACULTY','INCHARGE') NOT NULL,
  `recipient_id` INT NOT NULL COMMENT 'user_id for admin/student/faculty, driver_id for drivers',
  `type` VARCHAR(50) DEFAULT 'info',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `reference_id` INT DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_recipient` (`recipient_role`, `recipient_id`),
  INDEX `idx_notif_read` (`is_read`),
  INDEX `idx_notif_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrate existing data
INSERT INTO `notifications` (`recipient_role`, `recipient_id`, `type`, `title`, `message`, `is_read`, `created_at`)
  SELECT 'ADMIN', 0, COALESCE(`type`,'info'), COALESCE(`title`,''), COALESCE(`message`,''), COALESCE(`is_read`,0), `created_at`
  FROM `admin_notifications`;

INSERT INTO `notifications` (`recipient_role`, `recipient_id`, `type`, `title`, `message`, `reference_id`, `is_read`, `created_at`)
  SELECT 'DRIVER', `driver_id`, COALESCE(`type`,'info'), `title`, `message`, `related_id`, COALESCE(`is_read`,0), `created_at`
  FROM `driver_notifications`;

INSERT INTO `notifications` (`recipient_role`, `recipient_id`, `type`, `title`, `message`, `reference_id`, `is_read`, `created_at`)
  SELECT 'STUDENT', `user_id`, COALESCE(`type`,'general'), `title`, COALESCE(`message`,''), `related_id`, COALESCE(`is_read`,0), `created_at`
  FROM `user_notifications`;

-- Drop old notification tables after migration
DROP TABLE IF EXISTS `admin_notifications`;
DROP TABLE IF EXISTS `driver_notifications`;
DROP TABLE IF EXISTS `user_notifications`;

-- ============================================
-- SECTION 6: ADD USEFUL INDEXES (ignored if duplicate)
-- Use a procedure to safely add indexes
-- ============================================

DELIMITER //
DROP PROCEDURE IF EXISTS add_index_if_not_exists//
CREATE PROCEDURE add_index_if_not_exists(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_index_if_not_exists('assignments', 'idx_assignments_date_status', '`start_date`, `end_date`, `status`');
CALL add_index_if_not_exists('assignments', 'idx_assignments_driver_date', '`driver_id`, `start_date`, `end_date`');
CALL add_index_if_not_exists('assignments', 'idx_assignments_vehicle_date', '`vehicle_id`, `start_date`, `end_date`');
CALL add_index_if_not_exists('attendance', 'idx_attendance_user_date', '`user_id`, `date`');
CALL add_index_if_not_exists('leave_requests', 'idx_leave_driver_status', '`driver_id`, `status`');
CALL add_index_if_not_exists('leave_requests', 'idx_leave_dates', '`start_date`, `end_date`');
CALL add_index_if_not_exists('km_logs', 'idx_km_logs_driver_date', '`driver_id`, `date`');
CALL add_index_if_not_exists('km_logs', 'idx_km_logs_vehicle_date', '`vehicle_id`, `date`');
CALL add_index_if_not_exists('temporary_assignments', 'idx_temp_assignments_dates', '`start_date`, `end_date`, `status`');
CALL add_index_if_not_exists('ev_assignments', 'idx_ev_assignments_dates', '`start_date`, `end_date`, `status`');
CALL add_index_if_not_exists('fc_replacement_requests', 'idx_fc_replacement_status', '`status`');
CALL add_index_if_not_exists('vehiclerequests', 'idx_vreq_status', '`status`');
CALL add_index_if_not_exists('vehiclerequests', 'idx_vreq_faculty', '`faculty_id`');
CALL add_index_if_not_exists('student_transport', 'idx_student_transport_user', '`user_id`');
CALL add_index_if_not_exists('transport_requests', 'idx_transport_requests_user', '`user_id`, `status`');

DROP PROCEDURE IF EXISTS add_index_if_not_exists;

-- ============================================
-- Done! Final table count: 30 tables
-- (was 42: dropped 12 unused, added 3 new)
-- ============================================
