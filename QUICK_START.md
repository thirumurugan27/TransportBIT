# ⚡ Quick Start Guide - Admin Profile Management

## 🚀 Start Your System in 3 Steps

### Step 1: Start Backend (Terminal 1)
```bash
cd server
go run main.go
```
✅ When you see: `Server running on port 8080`

### Step 2: Start Frontend (Terminal 2)
```bash
cd client
npm run dev
```
✅ When you see: `Local: http://localhost:5173`

### Step 3: Open in Browser
```
http://localhost:5173
```

---

## 🔑 Login Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `#Qwerty1234` |

---

## ✨ Features You Can Use

### 1. View Your Profile
- Click your name in top-right corner
- Click "Edit Profile"
- See all your information in the modal

### 2. Edit Your Profile
- Change Full Name, Email, Phone
- Click "Save Profile"
- ✅ Success message appears
- ✅ Your name updates in topbar

### 3. Change Password
- In Edit Profile modal, click "Password" tab
- Type a new password
- ✅ See requirements update in real-time
- Type: `NewPass@123` as example strong password
- ✅ Requirements all turn green (Strong)
- ✅ "Confirm Password" field appears
- Enter same password
- Click "Change Password"
- ✅ Success message appears

### 4. Login with New Password
- Close modal and Logout
- Login with new password: `NewPass@123`
- ✅ Should work!

---

## 📊 Password Requirements (Visualized)

```
Weak (Red)  ───────────── Medium (Orange) ───────────── Strong (Green)
  │                              │                              │
  0-3 met                     4-5 met                      ALL 6 met

Your password must have:
✓ Minimum 8 characters
✓ At least 1 UPPERCASE letter (A-Z)
✓ At least 1 lowercase letter (a-z)
✓ At least 1 number (0-9)
✓ At least 1 special character (@#$%&!_-)
✓ No spaces
```

---

## 🐛 If Something Goes Wrong

### Issue: Can't login
- ✅ Check if backend is running (port 8080)
- ✅ Check if database is running (MySQL)
- ✅ Try username: `admin`, password: `#Qwerty1234`

### Issue: Modal doesn't open
- ✅ Hard refresh: `Ctrl+Shift+R`
- ✅ Check browser console: Press `F12`
- ✅ Look for red error messages

### Issue: Changes not saving
- ✅ Check server console for error messages
- ✅ Verify database connection is working

---

## 📁 Important Files

```
your-project/
├── SETUP_COMPLETE.md          ← Full setup guide
├── ADMIN_PROFILE_GUIDE.md     ← Technical documentation
├── SYSTEM_OVERVIEW.md         ← Complete overview
│
├── server/
│   └── main.go                ← Backend endpoints
│
└── client/
    └── src/
        ├── pages/Admin/
        │   ├── AdminDashboard.jsx    ← Main dashboard
        │   └── EditProfile.jsx       ← Profile modal
        └── styles/
            ├── editProfile.css       ← Modal styling
            └── passwordValidation.css ← Password UI
```

---

## 💡 Pro Tips

1. **Test Password Validation**
   - Type: `weak` → See red bar (Weak)
   - Type: `Pass123` → See orange bar (Medium)
   - Type: `NewPass@123` → See green bar (Strong)

2. **Check Requirements in Real-Time**
   - Type letters to see requirements update instantly
   - Watch green checkmarks appear as you meet each requirement
   - When all 6 are green, "Confirm Password" field appears

3. **Profile Updates**
   - Your full name in topbar updates immediately after save
   - Changes are saved to database permanently
   - Close and reopen modal to verify

4. **Password Changes**
   - Can only change password when strength is "Strong"
   - Confirm password must match exactly
   - After changing, logout and login with new password

---

## 🎯 Common Tasks

### Task: Change My Full Name
1. Click profile menu (top-right)
2. Click "Edit Profile"
3. Go to "Profile" tab (already there)
4. Change "Full Name" field
5. Click "Save Profile"
6. ✅ Done! Name updates in topbar

### Task: Update My Email
1. Click profile menu
2. Click "Edit Profile"
3. In "Profile" tab, change "Email Address"
4. Click "Save Profile"
5. ✅ Email is updated in database

### Task: Create Strong Password
1. Click profile menu
2. Click "Edit Profile"
3. Go to "Password" tab
4. Type password with:
   - At least 8 characters
   - 1 uppercase letter
   - 1 lowercase letter
   - 1 number
   - 1 special character (@#$%&!_-)
   - No spaces
5. When green (Strong), confirm password appears
6. Click "Change Password"
7. ✅ Done!

---

## 📞 Need More Info?

| Topic | File |
|-------|------|
| Complete Setup | [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) |
| Technical Details | [ADMIN_PROFILE_GUIDE.md](./ADMIN_PROFILE_GUIDE.md) |
| System Overview | [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) |

---

## ✅ Checklist Before Using

- [ ] Backend is running (`go run main.go`)
- [ ] Frontend is running (`npm run dev`)
- [ ] Browser opened to `http://localhost:5173`
- [ ] Can see login page
- [ ] Database is running (MySQL)
- [ ] No red errors in browser console (F12)

---

## 🎉 You're All Set!

Your admin profile management system is ready to use. Everything is working:

✅ Login with bcrypt
✅ Profile editing
✅ Password change with real-time validation
✅ Database integration
✅ Professional UI
✅ All 6 password requirements visible

**Start using it now by logging in with:** `admin` / `#Qwerty1234`

---

**Made with ❤️ | Transport Management System Admin Panel**
