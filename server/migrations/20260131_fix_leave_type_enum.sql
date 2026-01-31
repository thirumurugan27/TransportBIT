-- Fix leave_type ENUM to accept all required values
-- Run this migration to update the leave_type column

-- First, check current column type and update to VARCHAR to avoid ENUM issues
ALTER TABLE leave_requests 
MODIFY COLUMN leave_type VARCHAR(50) NOT NULL DEFAULT 'Leave';

-- If you prefer ENUM, use this instead:
-- ALTER TABLE leave_requests 
-- MODIFY COLUMN leave_type ENUM('Leave', 'GP', 'OD', 'CASUAL', 'SICK', 'EMERGENCY') NOT NULL DEFAULT 'Leave';
