-- Add audit fields to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS created_by INT NULL,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT fk_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add audit fields to temporary_assignments table
ALTER TABLE temporary_assignments 
ADD COLUMN IF NOT EXISTS created_by INT NULL,
ADD CONSTRAINT fk_temp_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
