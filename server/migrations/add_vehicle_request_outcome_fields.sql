-- Add TaskID, OutcomeExpected and OutcomeAuditable columns to vehiclerequests table

-- Add TaskID column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'TaskID');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN TaskID VARCHAR(100) DEFAULT NULL", 
    "SELECT 'TaskID column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add OutcomeExpected column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'OutcomeExpected');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN OutcomeExpected VARCHAR(500) DEFAULT NULL", 
    "SELECT 'OutcomeExpected column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add OutcomeAuditable column if not exists
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'OutcomeAuditable');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN OutcomeAuditable VARCHAR(500) DEFAULT NULL", 
    "SELECT 'OutcomeAuditable column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
