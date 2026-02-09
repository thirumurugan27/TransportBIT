-- Migration: Fix strict-mode insert failures for vehiclerequests
-- Makes legacy indenter-related columns nullable so inserts that don't provide them won't fail.
-- Safe to run multiple times.

-- IndenterDesignation
SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'IndenterDesignation'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN IndenterDesignation VARCHAR(255) NULL',
    "SELECT 'IndenterDesignation column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- (Optional) keep other known legacy columns nullable as well
SET @exist := (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'vehiclerequests'
            AND COLUMN_NAME = 'IndenterDepartment'
);
SET @sql := IF(
        @exist > 0,
        'ALTER TABLE vehiclerequests MODIFY COLUMN IndenterDepartment VARCHAR(255) NULL',
        "SELECT 'IndenterDepartment column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'IndenterMobileNo'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN IndenterMobileNo VARCHAR(50) NULL',
    "SELECT 'IndenterMobileNo column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'MobileNumber'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN MobileNumber VARCHAR(50) NULL',
    "SELECT 'MobileNumber column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'Guestname'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN Guestname VARCHAR(255) NULL',
    "SELECT 'Guestname column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'Address'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN Address VARCHAR(255) NULL',
    "SELECT 'Address column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'PurposeOfVisit'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN PurposeOfVisit TEXT NULL',
    "SELECT 'PurposeOfVisit column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'TaskID'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN TaskID VARCHAR(100) NULL',
    "SELECT 'TaskID column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'IndenterName'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN IndenterName VARCHAR(255) NULL',
    "SELECT 'IndenterName column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'IndenterID'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN IndenterID VARCHAR(50) NULL',
    "SELECT 'IndenterID column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'DeptName'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN DeptName VARCHAR(255) NULL',
    "SELECT 'DeptName column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehiclerequests'
      AND COLUMN_NAME = 'Designation'
);
SET @sql := IF(
    @exist > 0,
    'ALTER TABLE vehiclerequests MODIFY COLUMN Designation VARCHAR(255) NULL',
    "SELECT 'Designation column not present'"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
