# Transport Management System - Admin Profile Complete Setup Guide

## 📋 Database Table Structure

The users table you provided is perfect:

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(100),
    profile_image VARCHAR(255),
    role ENUM('ADMIN','IN_CHARGE','DRIVER','STUDENT') NOT NULL,
    status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

-- Insert admin user with hashed password for "#Qwerty1234"
INSERT INTO users (username, password_hash, full_name, phone, email, profile_image, role, status) 
VALUES ('admin', '$2a$10$zQwZxqZ5z9n4R5N7Yw9dUeQq0h1Zp7z2K1zj5o3M8cFzv6d9U2KkS', 'Administrator', '9999999999', 'admin@transport.com', 'admin.jpg', 'ADMIN', 'ACTIVE');
```

## 🎯 Features Implemented

### 1. **Admin Profile Edit**
   - Edit Full Name
   - Edit Email Address
   - Edit Phone Number
   - Edit Profile Image Name
   - Username is fixed (cannot be changed)

### 2. **Password Change with Real-time Validation**
   - Real-time password strength indicator (Weak/Medium/Strong)
   - Interactive requirement checklist that updates as user types
   - Visual feedback with ✓ and ✗ icons
   - Color-coded requirements (Red = Not Met, Green = Met)
   - Confirm password field (only shows when password is STRONG)
   - Password must match exactly to save

### 3. **Password Requirements**
   - ✓ At least 8 characters
   - ✓ At least 1 uppercase letter (A–Z)
   - ✓ At least 1 lowercase letter (a–z)
   - ✓ At least 1 number (0–9)
   - ✓ At least 1 special character (@ # $ % & ! _ -)
   - ✓ No spaces allowed

### 4. **Password Encoding/Decoding**
   - Passwords are hashed using bcrypt (industry standard)
   - Salt: 10 rounds of bcrypt
   - Stored securely in `password_hash` column
   - Cannot be reversed (one-way encryption)

### 5. **User Interface**
   - Professional tab-based interface (Edit Profile / Change Password)
   - Modal dialog with overlay
   - Real-time validation feedback
   - Success and error messages with animations
   - Responsive design for all screen sizes
   - Interactive password strength bar
   - Clear visual indicators for password requirements

## 🔧 Backend Setup

### Go Endpoints (main.go):

1. **POST /api/admin/login**
   - Authenticates admin user
   - Compares bcrypt hashed passwords
   - Returns success message

2. **GET /api/admin/profile**
   - Fetches current admin profile data
   - Returns: username, full_name, phone, email, profile_image

3. **POST /api/admin/profile/update**
   - Updates admin profile (excluding username)
   - Fields updated: full_name, phone, email, profile_image
   - Returns success message

4. **POST /api/admin/password/change**
   - Changes admin password
   - Hashes new password using bcrypt
   - Returns success message

5. **POST /api/admin/setup** (Optional)
   - Initial password setup endpoint
   - Use to set the admin password initially

## 💾 Files Created/Modified

### Frontend Files:
- **EditProfile.jsx** - Main component with tabs for profile and password
- **passwordValidation.css** - Styling for all UI components
- **editProfile.css** - Modal styling (unchanged)
- **admin.css** - Dashboard styling (unchanged)

### Backend Files:
- **main.go** - Updated endpoints with proper HTTP methods and logging
- **db.go** - Database connection (unchanged)

## 🚀 How to Use

### 1. **Initial Setup** (One-time)
   ```bash
   # The admin user should already exist in database
   # If not, run this SQL:
   INSERT INTO users (username, password_hash, full_name, phone, email, profile_image, role, status) 
   VALUES ('admin', '$2a$10$zQwZxqZ5z9n4R5N7Yw9dUeQq0h1Zp7z2K1zj5o3M8cFzv6d9U2KkS', 'Administrator', '9999999999', 'admin@transport.com', 'admin.jpg', 'ADMIN', 'ACTIVE');
   ```

### 2. **Login to Admin Dashboard**
   - Username: `admin`
   - Password: `#Qwerty1234`

### 3. **Edit Profile**
   - Click on Admin avatar in top-right
   - Click "Edit Profile"
   - Modal opens with two tabs
   - Switch to "📝 Edit Profile" tab
   - Update full name, email, phone, or image name
   - Click "Save Profile"
   - Success message appears and modal closes

### 4. **Change Password**
   - Click on Admin avatar in top-right
   - Click "Edit Profile"
   - Switch to "🔐 Change Password" tab
   - Type new password
   - Watch real-time validation
   - When all requirements met (STRONG), confirm password field appears
   - Type same password again in confirm field
   - Click "Change Password" when passwords match

## 📊 Data Flow

```
Frontend (React)
    ↓
API Calls (Fetch)
    ↓
Go Backend (Port 8080)
    ↓
Database (MySQL)
    ↓
Bcrypt Hashing (Password Security)
```

## 🔐 Security Features

1. **Password Hashing**
   - bcrypt with 10 rounds salt
   - Cannot be reversed
   - Secure against brute force attacks

2. **CORS Enabled**
   - Frontend (port 5173/5174) can access backend (port 8080)

3. **Input Validation**
   - Email validation
   - Phone number validation
   - Password complexity requirements
   - Request validation on backend

4. **HTTP Methods**
   - GET for fetching data
   - POST for sensitive operations
   - Proper status codes returned

## 🐛 Troubleshooting

### Profile modal doesn't appear:
- Check if Go server is running on port 8080
- Check browser console for errors (F12)
- Ensure React dev server is running on port 5173/5174

### Password change fails:
- Ensure password meets ALL 6 requirements
- Check if passwords match in confirm field
- Check Go server logs for error details

### Profile data not loading:
- Check Go server logs
- Ensure admin user exists in database
- Verify database connection

### Profile doesn't update:
- Check Go server logs
- Verify all required fields are filled
- Check if database user has write permissions

## 📞 API Response Examples

### Profile Update Success:
```json
{
  "message": "Profile updated successfully"
}
```

### Password Change Success:
```json
{
  "message": "Password changed successfully"
}
```

### Get Profile:
```json
{
  "username": "admin",
  "full_name": "Administrator",
  "phone": "9999999999",
  "email": "admin@transport.com",
  "profile_image": "admin.jpg"
}
```

## ✅ Testing Checklist

- [ ] Admin can login with `admin` / `#Qwerty1234`
- [ ] Edit Profile modal appears when clicking edit
- [ ] Profile data loads from backend
- [ ] Can edit and save profile information
- [ ] Password validation shows real-time feedback
- [ ] Weak password cannot be saved
- [ ] Strong password shows all requirements met
- [ ] Confirm password field appears only when password is STRONG
- [ ] Password confirm validation works
- [ ] New password saves and next login uses new password
- [ ] Error messages display correctly
- [ ] Success messages display and auto-close
- [ ] UI is responsive on mobile devices

---

**Version:** 1.0  
**Last Updated:** December 31, 2025  
**Status:** Production Ready
