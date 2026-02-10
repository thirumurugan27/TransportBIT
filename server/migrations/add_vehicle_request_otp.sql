-- Migration: Add OTP fields to vehiclerequests table for trip start/end verification
-- Flow: Admin assigns → start_otp generated → requester shares with driver → 
--       driver enters start_otp → trip_started → end_otp generated →
--       requester shares with driver → driver enters end_otp → trip_ended

ALTER TABLE vehiclerequests
ADD COLUMN IF NOT EXISTS start_otp VARCHAR(6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS end_otp VARCHAR(6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS start_otp_generated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS end_otp_generated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS trip_started_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS trip_ended_at TIMESTAMP NULL;

-- Update status ENUM to include new statuses
ALTER TABLE vehiclerequests 
MODIFY COLUMN status ENUM('pending','approved','rejected','assigned','trip_started','completed','cancelled') DEFAULT 'pending';
