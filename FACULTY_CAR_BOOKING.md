# Faculty Car Booking System

## Overview

This update introduces a new **Faculty** role and a **Car Booking System** that allows faculty members to request car bookings, which are approved by admins with OTP-based verification by drivers.

## New Features

### 1. Faculty Role
- New user role: `FACULTY`
- Faculty dashboard with similar structure to Driver/Student dashboards
- Faculty can view profile, book cars, and track booking requests

### 2. Car Booking Flow

```
Faculty Request → Admin Approval (with OTP generation) → Car Status: "OnHold"
                                                                    ↓
Faculty shares OTP with Driver on booking date → Driver verifies OTP → Status: "Booked"
                                                                           ↓
                                        Driver completes trip → Status: "Completed"
```

### Booking Statuses
- `pending` - Request submitted, waiting for admin review
- `approved` - Admin approved (internal state)
- `onhold` - Approved with OTP generated, waiting for OTP verification on booking date
- `booked` - OTP verified, booking confirmed
- `completed` - Trip completed
- `rejected` - Admin rejected the request
- `cancelled` - Faculty cancelled the request

## Database Changes

Run the migration script:
```sql
-- Located at: server/migrations/add_faculty_car_booking.sql
```

This creates:
1. `faculty` table - Stores faculty member details
2. `car_bookings` table - Stores all car booking requests with OTP

## API Endpoints

### Faculty Portal
- `GET /api/faculty/profile` - Get faculty profile
- `POST /api/faculty/profile/update` - Update faculty profile
- `GET /api/faculty/cars/available?date=YYYY-MM-DD` - Get available cars for a date
- `GET /api/faculty/car-bookings` - Get my booking requests
- `POST /api/faculty/car-bookings/create` - Submit new booking request
- `POST /api/faculty/car-bookings/cancel` - Cancel pending booking

### Admin Portal
- `GET /api/admin/faculty` - Get all faculty members
- `POST /api/admin/faculty/create` - Create new faculty user
- `DELETE /api/admin/faculty/delete` - Delete faculty member
- `GET /api/admin/car-bookings` - Get all car bookings
- `GET /api/admin/car-bookings/pending-count` - Get pending count
- `POST /api/admin/car-bookings/approve` - Approve with vehicle/driver assignment
- `POST /api/admin/car-bookings/reject` - Reject booking
- `GET /api/admin/car-bookings/available-cars?date=` - Get cars available for date
- `GET /api/admin/car-bookings/available-drivers?date=` - Get drivers available for date

### Driver Portal
- `GET /api/driver/car-bookings` - Get assigned car bookings
- `GET /api/driver/car-bookings/today` - Get today's car bookings
- `POST /api/driver/car-bookings/verify-otp` - Verify OTP from faculty
- `POST /api/driver/car-bookings/complete` - Mark booking as completed

## Frontend Routes

### Faculty Dashboard
- `/faculty-dashboard` - Dashboard home
- `/faculty-dashboard/book-car` - Book a car form
- `/faculty-dashboard/my-bookings` - View all bookings with OTP display
- `/faculty-dashboard/profile` - Profile settings

### Admin Dashboard
- `/admin-dashboard/car-bookings` - Manage car booking requests

### Driver Dashboard
- `/driver-dashboard/car-bookings` - View assigned car bookings with OTP verification

## Creating a Faculty User

### Via Admin Dashboard
Navigate to Admin Dashboard and use the Faculty management section (can be added to UI) or use the API:

```bash
curl -X POST http://localhost:8080/api/admin/faculty/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "username": "faculty1",
    "password": "password123",
    "full_name": "Dr. John Smith",
    "email": "john@example.com",
    "phone": "9876543210",
    "department": "Computer Science",
    "designation": "Professor"
  }'
```

### Via SQL
```sql
-- Create user
INSERT INTO users (username, password, role, full_name, email, phone) 
VALUES ('faculty1', 'password123', 'FACULTY', 'Dr. John Smith', 'john@example.com', '9876543210');

-- Create faculty record
INSERT INTO faculty (user_id, department, designation) 
VALUES (LAST_INSERT_ID(), 'Computer Science', 'Professor');
```

## OTP Workflow

1. **Faculty submits request** with date, time, purpose, destination
2. **Admin reviews** and approves with vehicle + driver assignment
3. **System generates 6-digit OTP** and sets status to `onhold`
4. **Faculty receives OTP** (displayed in My Bookings)
5. **On booking date**, faculty shares OTP with assigned driver
6. **Driver enters OTP** in the app to verify
7. **Status changes to `booked`** (confirmed)
8. **After trip**, driver marks as `completed`

## Files Added/Modified

### Server (Go)
- `server/models/models.go` - Added Faculty and CarBooking models
- `server/api/faculty/profile.go` - Faculty profile handlers
- `server/api/faculty/car_booking.go` - Faculty car booking handlers
- `server/api/admin/car_booking.go` - Admin car booking management
- `server/api/driver/car_booking.go` - Driver OTP verification
- `server/routes/routes.go` - Added new routes
- `server/utils/token.go` - Added GetUserIDFromToken helper
- `server/migrations/add_faculty_car_booking.sql` - Database migration

### Client (React)
- `client/src/pages/Faculty/FacultyDashboard.jsx` - Main dashboard
- `client/src/pages/Faculty/views/FacultyHome.jsx` - Dashboard home
- `client/src/pages/Faculty/views/CarBooking.jsx` - Book a car form
- `client/src/pages/Faculty/views/MyBookings.jsx` - View bookings with OTP
- `client/src/pages/Faculty/views/FacultyProfile.jsx` - Profile page
- `client/src/pages/Admin/views/CarBookingManagement.jsx` - Admin management
- `client/src/pages/Driver/views/DriverCarBookings.jsx` - Driver OTP verification
- `client/src/context/AuthContext.jsx` - Added FACULTY role redirect
- `client/src/config/menuConfig.jsx` - Added faculty menu config
- `client/src/config/routes.js` - Added faculty routes
- `client/src/App.jsx` - Added Faculty dashboard route
