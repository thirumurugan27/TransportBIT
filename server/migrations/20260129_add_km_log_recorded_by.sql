-- Adds recorded-by metadata columns to km_logs so driver/incharge/admin handlers can
-- capture who submitted each KM entry.

ALTER TABLE km_logs
  ADD COLUMN recorded_by_user_id INT NULL AFTER assignment_id,
  ADD COLUMN recorded_by_role VARCHAR(32) NOT NULL DEFAULT 'DRIVER' AFTER recorded_by_user_id,
  ADD COLUMN recorded_by_name VARCHAR(191) NOT NULL DEFAULT '' AFTER recorded_by_role,
  ADD CONSTRAINT fk_km_logs_recorded_by_user FOREIGN KEY (recorded_by_user_id)
    REFERENCES users(id) ON DELETE SET NULL;
