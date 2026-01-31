-- Add start_time and end_time to leave_requests
ALTER TABLE leave_requests
  ADD COLUMN start_time TIME NULL AFTER start_date,
  ADD COLUMN end_time TIME NULL AFTER end_date;

-- Optional backfill for existing rows (set default working hours)
-- UPDATE leave_requests
-- SET start_time = '09:00:00', end_time = '18:00:00'
-- WHERE start_time IS NULL OR end_time IS NULL;
