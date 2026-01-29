-- Migration to replace VAN vehicle type with BATTERY_VEHICLE
-- This updates all existing VAN entries to BATTERY_VEHICLE in the database

-- =============================================================================
-- OPTION 1: Disable Safe Update Mode (Recommended for this one-time migration)
-- =============================================================================
SET SQL_SAFE_UPDATES = 0;

-- Update existing vehicles table entries
UPDATE vehicles 
SET vehicle_type = 'BATTERY_VEHICLE' 
WHERE vehicle_type = 'VAN';

-- Re-enable Safe Update Mode
SET SQL_SAFE_UPDATES = 1;

-- Log the changes
SELECT 
    'Migration Complete' as status,
    COUNT(*) as updated_count 
FROM vehicles 
WHERE vehicle_type = 'BATTERY_VEHICLE';

-- =============================================================================
-- OPTION 2: Update with ID-based WHERE clause (if Option 1 doesn't work)
-- =============================================================================
-- Uncomment the following lines if you prefer to update with ID constraint:
/*
UPDATE vehicles 
SET vehicle_type = 'BATTERY_VEHICLE' 
WHERE vehicle_type = 'VAN' 
  AND id > 0;
*/
