-- Add OralApproval column to vehiclerequests table

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'OralApproval');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN OralApproval TINYINT(1) DEFAULT 0", 
    "SELECT 'OralApproval column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
