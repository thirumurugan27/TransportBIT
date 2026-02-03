-- Migration: Add OTP and additional fields to assignments table for CAR type assignments
-- Run this SQL in your MySQL database

-- First, add vehicle_category column if it doesn't exist
-- This column stores the type of vehicle (BUS, CAR, EV, etc.) for the assignment
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(50) DEFAULT NULL;

-- Add OTP-related columns to assignments table
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS otp VARCHAR(6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS otp_generated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS purpose VARCHAR(500) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS destination VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS start_time VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS end_time VARCHAR(10) DEFAULT NULL;

-- Create index for quick lookup of unverified car assignments (ignore error if exists)
-- CREATE INDEX idx_assignments_otp ON assignments(otp);
-- CREATE INDEX idx_assignments_vehicle_category ON assignments(vehicle_category);
