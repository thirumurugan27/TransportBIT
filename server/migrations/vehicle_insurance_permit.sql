-- Add insurance, FC (Fitness Certificate), and permit fields to vehicles table
-- Run: mysql -u root -p transport_bit < migrations/vehicle_insurance_permit.sql

ALTER TABLE vehicles 
ADD COLUMN insurance_expire_date DATE NULL AFTER status,
ADD COLUMN fc_expire_date DATE NULL AFTER insurance_expire_date,
ADD COLUMN permit_expire_date DATE NULL AFTER fc_expire_date;

-- Update existing vehicles with default future dates (optional)
-- UPDATE vehicles SET 
--     insurance_expire_date = DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
--     fc_expire_date = DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
--     permit_expire_date = DATE_ADD(CURDATE(), INTERVAL 3 YEAR);
