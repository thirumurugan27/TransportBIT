-- =====================================================
-- STUDENT TRANSPORT MANAGEMENT - DATABASE SCHEMA
-- =====================================================

-- 1. Transport Fees Table (Stop-wise fees)
-- Stores the transport fee for each stop
CREATE TABLE IF NOT EXISTS transport_fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stop_id INT NOT NULL,
    fee_amount DECIMAL(10, 2) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    UNIQUE KEY unique_stop_year (stop_id, academic_year)
);

-- 2. Student Transport Table
-- Links student to their assigned bus and stop
CREATE TABLE IF NOT EXISTS student_transport (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                    -- References students from users table
    bus_id INT NOT NULL,                     -- References buses table
    stop_id INT NOT NULL,                    -- Current assigned stop
    transport_fee_id INT,                    -- References transport_fees for fee amount
    total_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (total_fee - paid_amount) STORED,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    FOREIGN KEY (transport_fee_id) REFERENCES transport_fees(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_year (user_id, academic_year)
);

-- 3. Transport Payments Table
-- Records all payments made by students
CREATE TABLE IF NOT EXISTS transport_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_transport_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'upi', 'bank_transfer', 'card', 'other') DEFAULT 'cash',
    transaction_id VARCHAR(100),
    receipt_number VARCHAR(50),
    remarks TEXT,
    recorded_by INT,                        -- Admin who recorded the payment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_transport_id) REFERENCES student_transport(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Stop Change Requests Table
-- Handles student requests to change their stop
CREATE TABLE IF NOT EXISTS stop_change_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_transport_id INT NOT NULL,
    current_stop_id INT NOT NULL,
    requested_stop_id INT NOT NULL,
    current_fee DECIMAL(10, 2) NOT NULL,
    new_fee DECIMAL(10, 2) NOT NULL,
    fee_difference DECIMAL(10, 2) GENERATED ALWAYS AS (new_fee - current_fee) STORED,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_remarks TEXT,
    processed_by INT,                       -- Admin who processed the request
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_transport_id) REFERENCES student_transport(id) ON DELETE CASCADE,
    FOREIGN KEY (current_stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Transport Requests Table (NEW)
-- Students request to be assigned to a bus/stop - Admin approves
-- Note: stop_id references bus_stops.id (per-bus stops with fees)
CREATE TABLE IF NOT EXISTS transport_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                    -- Student requesting transport
    bus_id INT NOT NULL,                     -- Requested bus (buses.id which maps to vehicle_id in bus_stops)
    stop_id INT NOT NULL,                    -- Requested stop (bus_stops.id)
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_remarks TEXT,
    processed_by INT,                        -- Admin who processed
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Add student-specific columns to users table (if not exists)
-- These columns are needed for student details display
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS year INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Update name column from full_name if name is NULL
UPDATE users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- =====================================================
-- SAMPLE DATA INSERTION
-- =====================================================

-- Insert sample transport fees for existing stops
-- First check what stops exist and add fees for them
INSERT INTO transport_fees (stop_id, fee_amount, academic_year, is_active) 
SELECT s.id, 
    CASE 
        WHEN s.id % 5 = 0 THEN 15000.00
        WHEN s.id % 5 = 1 THEN 12000.00
        WHEN s.id % 5 = 2 THEN 10000.00
        WHEN s.id % 5 = 3 THEN 8000.00
        ELSE 6000.00
    END as fee_amount,
    '2025-2026',
    TRUE
FROM stops s
WHERE NOT EXISTS (
    SELECT 1 FROM transport_fees tf 
    WHERE tf.stop_id = s.id AND tf.academic_year = '2025-2026'
)
LIMIT 10;

-- If no stops exist, create some sample stops first
INSERT IGNORE INTO stops (stop_name, location) VALUES 
('Central Bus Stand', 'City Center, Main Road'),
('Railway Station', 'Station Road, Near Platform 1'),
('Tech Park', 'IT Corridor, Sector 5'),
('University Gate', 'University Road, Main Entrance'),
('Mall Junction', 'Commercial Area, Ring Road');

-- After inserting stops, add transport fees for any remaining stops without fees
INSERT INTO transport_fees (stop_id, fee_amount, academic_year, is_active)
SELECT s.id, 
    CASE s.stop_name
        WHEN 'Central Bus Stand' THEN 15000.00
        WHEN 'Railway Station' THEN 12000.00
        WHEN 'Tech Park' THEN 10000.00
        WHEN 'University Gate' THEN 8000.00
        WHEN 'Mall Junction' THEN 6000.00
        ELSE 10000.00
    END,
    '2025-2026',
    TRUE
FROM stops s
WHERE NOT EXISTS (
    SELECT 1 FROM transport_fees tf 
    WHERE tf.stop_id = s.id AND tf.academic_year = '2025-2026'
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_student_transport_user ON student_transport(user_id);
CREATE INDEX idx_student_transport_bus ON student_transport(bus_id);
CREATE INDEX idx_student_transport_status ON student_transport(status);
CREATE INDEX idx_transport_payments_date ON transport_payments(payment_date);
CREATE INDEX idx_stop_change_requests_status ON stop_change_requests(status);
CREATE INDEX idx_transport_fees_stop ON transport_fees(stop_id);
