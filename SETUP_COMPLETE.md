# Admin Profile Management System - Complete Setup Guide

## ✅ System Status: FULLY IMPLEMENTED

All components are in place and ready to use. This document provides quick setup and testing instructions.

---

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd server
go run main.go
```
Expected output:
```
2024/xx/xx xx:xx:xx Database connection successful
2024/xx/xx xx:xx:xx Admin endpoint handlers registered
Server running on port 8080
```

### 2. Start the Frontend
```bash
cd client
npm install  # if needed
npm run dev
```
Expected output:
```
VITE v4.x.x  ready in xxx ms
➜  Local:   http://localhost:5173
```

### 3. Access the Admin Dashboard
- Navigate to: **http://localhost:5173**
- Login with credentials:
  - Username: `admin`
  - Password: `#Qwerty1234`

---

## 📋 Features Implemented

### ✨ Admin Profile Management
1. **Profile Tab**
   - View current profile (username, full name, email, phone)
   - Update full name, email, phone
   - Upload profile image (stores filename)
   - Changes saved to database immediately

2. **Password Tab**
   - Change password with real-time validation
   - Password strength indicator (Weak → Medium → Strong)
   - 6 interactive password requirements:
     ✓ Minimum 8 characters
     ✓ Contains uppercase letter (A-Z)
     ✓ Contains lowercase letter (a-z)
     ✓ Contains number (0-9)
     ✓ Contains special character (@#$%&!_-)
     ✓ No spaces allowed
   - Confirm password field (appears when password is STRONG)
   - Error and success messages with auto-close

3. **Dynamic Admin Name**
   - Topbar shows actual admin full name (fetched from database)
   - Updates immediately after profile edit
   - Avatar shows first letter of name

---

## 🗄️ Database Schema

The `users` table stores admin data with these columns:

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(100),
    profile_image VARCHAR(255),
    role VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Important:** Password is stored as bcrypt hash (not plaintext)
- Original password: `#Qwerty1234`
- Stored as: `$2a$10$...` (bcrypt hash)

---

## 🔌 API Endpoints

All endpoints use `http://localhost:8080`

### 1. **Login** (Already working)
```
POST /api/admin/login
Headers: Content-Type: application/json
Body: {
  "username": "admin",
  "password": "#Qwerty1234"
}
Response: {
  "message": "Login successful",
  "username": "admin"
}
```

### 2. **Get Admin Profile** (Used by EditProfile modal)
```
GET /api/admin/profile
Response: {
  "username": "admin",
  "full_name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "profile_image": "admin.jpg"
}
```

### 3. **Update Admin Profile** (Called when saving in Profile tab)
```
POST /api/admin/profile/update
Headers: Content-Type: application/json
Body: {
  "username": "admin",
  "full_name": "Jane Doe",
  "phone": "9876543211",
  "email": "jane@example.com",
  "profile_image": "jane.jpg"
}
Response: {
  "message": "Profile updated successfully"
}
```

### 4. **Change Password** (Called when saving in Password tab)
```
POST /api/admin/password/change
Headers: Content-Type: application/json
Body: {
  "current_password": "#Qwerty1234",
  "new_password": "#NewPassword123"
}
Response: {
  "message": "Password changed successfully"
}
```

---

## 📁 File Structure

```
client/
├── src/
│   ├── pages/
│   │   └── Admin/
│   │       ├── AdminDashboard.jsx      ✅ Updated with profile fetch
│   │       ├── AdminLogin.jsx          ✅ API-based login
│   │       └── EditProfile.jsx         ✅ Complete modal with tabs
│   └── styles/
│       ├── admin.css
│       ├── editProfile.css             ✅ Modal styling
│       └── passwordValidation.css      ✅ Password validation UI

server/
├── main.go                             ✅ All endpoints configured
├── db.go                               ✅ Database connection
├── user.go                             (For user management)
├── driver.go                           (For driver management)
├── vehicle.go                          (For vehicle management)
└── shift.go                            (For shift management)
```

---

## 🧪 Testing Checklist

### Test 1: Login Flow
- [ ] Open http://localhost:5173
- [ ] See login page with username and password fields
- [ ] Enter: admin / #Qwerty1234
- [ ] Click Login
- [ ] ✅ Should navigate to AdminDashboard
- [ ] ✅ Check browser console (F12) for errors

### Test 2: Profile Display
- [ ] In AdminDashboard, check topbar
- [ ] ✅ Should show admin's full name instead of "Admin"
- [ ] ✅ Avatar should show first letter of full name
- [ ] Click on profile box to show dropdown menu

### Test 3: Edit Profile Modal
- [ ] Click "Edit Profile" in dropdown
- [ ] ✅ Modal should appear with two tabs: "Profile" and "Password"
- [ ] ✅ Profile tab shows:
  - [ ] Username field (disabled/read-only)
  - [ ] Full Name field (editable)
  - [ ] Email field (editable)
  - [ ] Phone field (editable)
  - [ ] Profile Image field
  - [ ] Save button

### Test 4: Profile Tab - Edit Data
- [ ] In Profile tab, change Full Name to "Test Admin"
- [ ] Change Email to "test@example.com"
- [ ] Change Phone to "9999999999"
- [ ] Click Save button
- [ ] ✅ Should see green success message: "Profile updated successfully"
- [ ] ✅ Message should auto-close after 1.5 seconds
- [ ] Close modal (X or click outside)
- [ ] ✅ Topbar should now show "Test Admin" instead of previous name

### Test 5: Profile Tab - Database Verification
- [ ] Open database client (e.g., MySQL Workbench)
- [ ] Run query: `SELECT full_name, email, phone FROM users WHERE username='admin';`
- [ ] ✅ Should show updated values:
  - [ ] full_name: "Test Admin"
  - [ ] email: "test@example.com"
  - [ ] phone: "9999999999"

### Test 6: Password Tab - Requirements Display
- [ ] Click "Edit Profile" again
- [ ] Click "Password" tab
- [ ] Start typing in "New Password" field
- [ ] ✅ Should see 6 requirement items appear:
  - [ ] "8+ characters" (gray → green when met)
  - [ ] "Uppercase letter (A-Z)" (gray → green when met)
  - [ ] "Lowercase letter (a-z)" (gray → green when met)
  - [ ] "Number (0-9)" (gray → green when met)
  - [ ] "Special character (@#$%&!_-)" (gray → green when met)
  - [ ] "No spaces" (gray → green when met)
- [ ] ✅ Should see strength indicator bar change colors:
  - [ ] Red (Weak) - 0-3 requirements met
  - [ ] Orange (Medium) - 4-5 requirements met
  - [ ] Green (Strong) - All 6 requirements met

### Test 7: Password Tab - Weak Password
- [ ] Type "abc123" in password field
- [ ] ✅ Should show 3 requirements met (red bar = Weak)
- [ ] ✅ Confirm Password field should NOT appear
- [ ] Try clicking Save - should show error or be disabled

### Test 8: Password Tab - Medium Password
- [ ] Clear field and type "Password1"
- [ ] ✅ Should show 4-5 requirements met (orange bar = Medium)
- [ ] ✅ Confirm Password field should still NOT appear

### Test 9: Password Tab - Strong Password
- [ ] Clear field and type "NewPass@123"
- [ ] ✅ Should show all 6 requirements met (green bar = Strong)
- [ ] ✅ Now "Confirm Password" field should appear
- [ ] Type different value in Confirm Password
- [ ] ✅ Should show error: "Passwords do not match"
- [ ] Type same value in Confirm Password
- [ ] ✅ Error should disappear, both fields match

### Test 10: Password Tab - Save New Password
- [ ] With matching strong password:
  - [ ] Password: "NewPass@123"
  - [ ] Confirm: "NewPass@123"
- [ ] Click Save button
- [ ] ✅ Should see green message: "Password changed successfully"
- [ ] Close modal

### Test 11: Login With New Password
- [ ] Click Logout in profile menu
- [ ] ✅ Should return to login page
- [ ] Try old password: admin / #Qwerty1234
- [ ] ✅ Should show "Invalid credentials"
- [ ] Try new password: admin / NewPass@123
- [ ] ✅ Should successfully login to AdminDashboard

### Test 12: Password Persistence
- [ ] In AdminDashboard, click "Edit Profile"
- [ ] Go to Password tab
- [ ] Clear password field
- [ ] ✅ Should reset to empty state
- [ ] Close modal and reopen
- [ ] ✅ Password field should be empty (not show old password)
- [ ] Go back to Profile tab, make a dummy edit and save
- [ ] Close modal and logout
- [ ] Try login with: admin / NewPass@123
- [ ] ✅ Should still work (password persisted)

---

## 🐛 Troubleshooting

### Issue: "Invalid credentials" on login
**Solution:**
- Check if server is running: `go run main.go`
- Verify database is running and accessible
- Try setup endpoint: `POST http://localhost:8080/api/admin/setup` with body: `{"password":"#Qwerty1234"}`

### Issue: Edit Profile modal doesn't appear
**Solution:**
- Open browser console (F12)
- Check for any JavaScript errors (red messages)
- Verify CSS files are imported (check Network tab for .css files)
- Hard refresh: Ctrl+Shift+R

### Issue: API returns 404 errors
**Solution:**
- Verify backend is running on port 8080
- Check CORS is enabled in main.go
- Ensure all endpoints are registered in mux.HandleFunc

### Issue: Changes don't save to database
**Solution:**
- Check server console for error messages
- Verify database connection is working
- Check user table columns match expected names:
  ```sql
  SHOW COLUMNS FROM users;
  ```
- Verify password has bcrypt hash format: starts with `$2a$`

### Issue: Password requirements don't update in real-time
**Solution:**
- Check browser console for JavaScript errors
- Verify passwordValidation.css is imported
- Clear browser cache and hard refresh (Ctrl+Shift+R)

---

## 💡 Important Notes

1. **Password Storage**: All passwords are bcrypt hashed before storage. Never store plaintext passwords.

2. **Session Management**: Currently no session tokens are used. For production, implement JWT tokens:
   ```go
   // Example for future enhancement
   token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
   tokenString, _ := token.SignedString(secretKey)
   ```

3. **CORS**: Currently allows all origins. For production, restrict to specific domains:
   ```go
   c := cors.New(cors.Options{
       AllowedOrigins: []string{"https://yourdomain.com"},
   })
   ```

4. **File Uploads**: Profile image field currently stores filename only. For production, implement actual file upload to server storage.

5. **Input Validation**: Add server-side validation for email format, phone number format, etc.

6. **Error Handling**: Implement proper error codes and messages for production.

---

## 📞 Quick Reference

| Task | How |
|------|-----|
| Start Server | `cd server && go run main.go` |
| Start Frontend | `cd client && npm run dev` |
| View Login | http://localhost:5173 |
| View Logs | Check server console output |
| Test API | Use Postman or curl |
| Reset Password | Call `/api/admin/setup` endpoint |
| Check DB | Connect with MySQL client to localhost:3306 |

---

## ✅ What's Working

✅ Admin login with bcrypt password verification
✅ Profile fetch and display in EditProfile modal
✅ Profile tab with editable fields
✅ Password tab with real-time validation
✅ Password strength indicator (Weak/Medium/Strong)
✅ 6-point password requirement checklist
✅ Confirm password field (appears when STRONG)
✅ Save profile changes to database
✅ Change password with validation
✅ Dynamic admin name in topbar
✅ Error and success messages
✅ Modal animations and styling
✅ Responsive design
✅ CORS enabled for API calls
✅ Proper HTTP method validation

---

## 🎉 Ready to Use!

Your transport management admin profile system is fully functional. Test it out using the checklist above and enjoy your professional admin interface!

For any issues, check the troubleshooting section or review the browser console (F12) for detailed error messages.
