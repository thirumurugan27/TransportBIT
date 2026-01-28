-- =====================================================
-- STUDENT TRANSPORT MANAGEMENT - DATABASE SCHEMA
-- Modified to use bus_stops instead of stops
-- =====================================================

-- 1. Transport Fees Table (Stop-wise fees) - Optional, fees are now on bus_stops
CREATE TABLE IF NOT EXISTS transport_fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stop_id INT NOT NULL,
    fee_amount DECIMAL(10, 2) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_stop_year (stop_id, academic_year)
);

-- 2. Student Transport Table
-- Links student to their assigned bus and stop (bus_stops.id)
CREATE TABLE IF NOT EXISTS student_transport (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                    -- References students from users table
    bus_id INT NOT NULL,                     -- References buses table
    stop_id INT NOT NULL,                    -- Current assigned stop (references bus_stops.id)
    transport_fee_id INT,                    -- References transport_fees for fee amount
    total_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (total_fee - paid_amount) STORED,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
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
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);
