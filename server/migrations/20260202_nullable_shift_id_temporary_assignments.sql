-- Make shift_id nullable in temporary_assignments to support EV cluster replacements
-- EV cluster assignments don't have shifts, they use cluster start/end times

ALTER TABLE temporary_assignments 
MODIFY COLUMN shift_id INT NULL;
