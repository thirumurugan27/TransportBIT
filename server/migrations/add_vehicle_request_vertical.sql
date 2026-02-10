-- Add Vertical column to vehiclerequests table

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehiclerequests' AND COLUMN_NAME = 'Vertical');
SET @sql := IF(@exist = 0, 
    "ALTER TABLE vehiclerequests ADD COLUMN Vertical VARCHAR(255) DEFAULT NULL", 
    "SELECT 'Vertical column already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
