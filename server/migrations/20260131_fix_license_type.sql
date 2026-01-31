-- Make license_type free-form to avoid enum truncation
ALTER TABLE drivers
  MODIFY COLUMN license_type VARCHAR(50) NOT NULL DEFAULT 'LMV';
