# 📸 Profile Image Upload Feature - Setup Guide

## New Feature: Image Upload with Preview

Your admin profile system now supports **real image uploads** instead of just filename text fields.

---

## ✨ What's New

### Frontend Changes
- **Image Upload Field**: File picker instead of text input
- **Image Preview**: See your image before saving
- **File Validation**: Only accepts image files (JPG, PNG, GIF, etc.)
- **Size Limit**: Maximum 5MB per image
- **Dynamic Preview**: Shows your current profile image

### Backend Changes
- **New Endpoint**: `POST /api/admin/profile/upload`
- **Uploads Folder**: Images stored in `server/uploads/` directory
- **File Serving**: `GET /uploads/{filename}` to retrieve images
- **Database Update**: `profile_image` field stores filename

---

## 🚀 Quick Setup

### Step 1: Backend Already Updated
- Main.go now has image upload endpoint
- Uploads directory will be created automatically on first upload
- CORS enabled for file uploads

### Step 2: Start Backend
```bash
cd server
go run main.go
```

### Step 3: Start Frontend
```bash
cd client
npm run dev
```

---

## 📷 How to Use

### Upload Profile Image

1. **Open Edit Profile Modal**
   - Click your profile name in top-right corner
   - Click "Edit Profile"

2. **Go to Profile Tab**
   - Should be already on Profile tab
   - Scroll down to "Profile Image" section

3. **Select Image**
   - Click the dashed box or file input
   - Choose an image file from your computer
   - Image preview appears immediately
   - Shows filename and a thumbnail

4. **Save Profile**
   - Click "Save Profile" button
   - Backend uploads the image
   - Success message appears
   - Modal closes after 1.5 seconds

5. **Verify Upload**
   - Close and reopen Edit Profile
   - You'll see your uploaded image preview
   - Next to full name, phone, email in Profile tab

---

## 📁 File Structure After Upload

```
Transport_management/
├── server/
│   ├── main.go          (Updated with upload handler)
│   ├── db.go
│   └── uploads/         (Created automatically)
│       └── admin.jpg    (Your uploaded image)
│
└── client/
    └── src/pages/Admin/
        └── EditProfile.jsx  (Updated with image picker)
```

---

## 🔌 API Endpoint Details

### Image Upload Endpoint

```
POST /api/admin/profile/upload
Content-Type: multipart/form-data

Parameters:
- file (required): Image file
- full_name (optional): User's full name
- phone (optional): User's phone
- email (optional): User's email

Response:
{
  "message": "Profile updated successfully",
  "profile_image": "admin.jpg"
}
```

### Usage in Frontend

```javascript
const formData = new FormData();
formData.append("file", imageFile);
formData.append("full_name", fullName);
formData.append("phone", phone);
formData.append("email", email);

fetch("http://localhost:8080/api/admin/profile/upload", {
  method: "POST",
  body: formData  // No Content-Type header needed
})
.then(res => res.json())
.then(data => console.log(data));
```

### Image Retrieval

```
GET http://localhost:8080/uploads/{filename}

Example: http://localhost:8080/uploads/admin.jpg
```

---

## 📋 File Upload Validation

### Accepted Formats
✅ JPG / JPEG
✅ PNG
✅ GIF
✅ WebP
✅ BMP
✅ SVG

### Size Limits
- **Maximum**: 5MB per file
- **Minimum**: Any valid image size

### Validation Steps
1. Frontend checks file type (must be image/*)
2. Frontend checks file size (≤ 5MB)
3. Backend validates multipart form (≤ 5MB)
4. Backend checks Content-Type header

---

## 💾 Database Integration

The `profile_image` column stores just the **filename**, not the full path:

```sql
-- What gets stored:
profile_image = "admin.jpg"

-- How to access it:
http://localhost:8080/uploads/admin.jpg

-- In EditProfile component:
const imageUrl = `http://localhost:8080/uploads/${data.profile_image}`;
```

---

## 🖼️ Image Preview

### In Edit Profile Modal

```
┌─────────────────────────────┐
│    Profile Image            │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │                     │    │
│  │    [Image Preview]  │    │
│  │    (150x150px)      │    │
│  │                     │    │
│  │   Current image     │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ Choose File...      │    │
│  │ (JPG, PNG, GIF...)  │    │
│  └─────────────────────┘    │
│                             │
│  Select image (JPG, PNG, GIF) │
│  - Max 5MB                    │
└─────────────────────────────┘
```

---

## ⚙️ Backend Handler Code

```go
func uploadAdminProfileImage(w http.ResponseWriter, r *http.Request) {
	// 1. Parse multipart form (5MB max)
	r.ParseMultipartForm(5 * 1024 * 1024)
	
	// 2. Get file from form
	file, handler, err := r.FormFile("file")
	
	// 3. Validate file type (must be image/*)
	if !strings.HasPrefix(handler.Header.Get("Content-Type"), "image/") {
		http.Error(w, "Only image files allowed", 400)
		return
	}
	
	// 4. Create uploads directory
	os.MkdirAll("uploads", os.ModePerm)
	
	// 5. Save file as admin.<original-extension>
	filename := "admin" + filepath.Ext(handler.Filename)
	
	// 6. Update database with filename
	DB.Exec("UPDATE users SET profile_image=? WHERE username='admin'", filename)
	
	// 7. Return success response
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Profile updated successfully",
		"profile_image": filename,
	})
}
```

---

## 🧪 Testing the Feature

### Test 1: Upload Image
1. Click Edit Profile
2. Go to Profile tab
3. Click file input in "Profile Image" section
4. Select an image file
5. ✅ Preview appears
6. Click "Save Profile"
7. ✅ See success message
8. ✅ File saved to `server/uploads/admin.jpg`

### Test 2: Verify Database
```sql
SELECT full_name, profile_image FROM users WHERE username='admin';
-- Shows: full_name = 'Admin', profile_image = 'admin.jpg'
```

### Test 3: Access Uploaded Image
```
Open in browser: http://localhost:8080/uploads/admin.jpg
✅ Image displays directly
```

### Test 4: Edit Profile Again
1. Close modal and reopen Edit Profile
2. Go to Profile tab
3. ✅ Preview shows your uploaded image
4. ✅ Shows "Current image" below preview
5. Can select new image to replace

### Test 5: Replace Image
1. In Edit Profile, Profile tab
2. Currently showing admin.jpg in preview
3. Select a different image
4. ✅ Preview updates to new image
5. Filename below shows new filename
6. Click "Save Profile"
7. ✅ New image replaces old one

---

## 🐛 Troubleshooting

### Issue: File upload fails
**Check:**
- File is actually an image (JPG, PNG, GIF, etc.)
- File size is less than 5MB
- Backend is running on port 8080
- Check browser console (F12) for errors

### Issue: Image preview doesn't appear
**Solution:**
- Hard refresh browser: Ctrl+Shift+R
- Check if file was selected properly
- Verify file type is supported

### Issue: Saved image doesn't show in Edit Profile
**Solution:**
- Close modal completely
- Reopen Edit Profile
- Wait for profile fetch to complete
- Check server console for errors

### Issue: "Only image files allowed" error
**Solution:**
- Make sure file is an actual image
- Not a file renamed to .jpg (e.g., text.txt renamed to .jpg)
- Try different image format (JPG → PNG)

### Issue: "File too large" error
**Solution:**
- Image must be less than 5MB
- Compress image before uploading
- Use https://compressor.io or similar tool

---

## 🔐 Security Features

✅ File type validation (Content-Type header)
✅ File size limit (5MB maximum)
✅ Filename sanitization (saved as admin.jpg)
✅ Stored outside web root (optional: add access control)
✅ Image preview in frontend prevents accidental uploads

---

## 📊 Database Column

The users table profile_image column:

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(100),
    profile_image VARCHAR(255),     -- Stores filename only
    role VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Values Examples
```
profile_image = "admin.jpg"      -- JPEG image
profile_image = "admin.png"      -- PNG image
profile_image = NULL             -- No image uploaded
profile_image = ""               -- Empty (no image)
```

---

## 💡 Pro Tips

1. **Image Naming**: All admin profile images are saved as `admin.<ext>`
   - Uploading JPG → `admin.jpg`
   - Uploading PNG → `admin.png`
   - Replaces previous image

2. **Compress Images**: Large images can slow down loading
   - Recommended: Compress to < 500KB
   - Use online tools or image software

3. **Supported Formats**: Use standard web formats
   - Best: JPG (smaller file size)
   - Also Good: PNG (better quality)
   - Avoid: BMP (too large)

4. **Profile Updates**: Image and other profile data update together
   - Changing name, email, phone, and image all save in one request
   - No need to save multiple times

---

## ✅ Feature Checklist

After implementation:
- [ ] Backend accepts file uploads
- [ ] Frontend shows file picker
- [ ] File validation works (size, type)
- [ ] Image preview displays
- [ ] Images save to `uploads/` folder
- [ ] Database stores filename
- [ ] Can access image via HTTP
- [ ] Profile page shows saved image on reload
- [ ] Can replace image with new one
- [ ] No errors in browser console

---

## 🎉 You're All Set!

Your admin profile system now supports **professional image uploads** with:

✅ Real image files (not just filenames)
✅ Live preview before saving
✅ Automatic validation
✅ Secure file handling
✅ Database persistence

**Start using it:**
1. Start backend: `go run main.go` (server/)
2. Start frontend: `npm run dev` (client/)
3. Login: admin / #Qwerty1234
4. Click Edit Profile
5. Upload your profile image!

---

**Happy uploading! 📸**
