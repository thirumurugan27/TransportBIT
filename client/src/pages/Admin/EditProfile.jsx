import React, {useEffect, useState} from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function EditProfile({onClose, onUpdate}) {
  const [profile, setProfile] = useState({
    username: "admin",
    full_name: "",
    phone: "",
    email: "",
    profile_image: "",
  });

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const inputClass =
    "w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm bg-gray-50/50 hover:bg-white disabled:bg-gray-100 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  // Fetch admin profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/profile`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          if (data.profile_image) {
            setImagePreview(`${API_BASE}/uploads/${data.profile_image}`);
          }
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Could not load profile data");
      }
    };

    fetchProfile();
  }, []);

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }

      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  // Password validation
  const validatePassword = (pwd) => {
    const rules = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[@#$%&!_-]/.test(pwd),
      noSpace: !/\s/.test(pwd),
    };

    const passedRules = Object.values(rules).filter(Boolean).length;
    let strength = "weak";

    if (passedRules === 6) strength = "strong";
    else if (passedRules >= 4) strength = "medium";

    return {rules, strength, passedRules};
  };

  const passwordValidation = validatePassword(passwords.newPassword);
  const isPasswordsMatch =
    passwords.newPassword &&
    passwords.confirmPassword &&
    passwords.newPassword === passwords.confirmPassword;

  const getStrengthColor = () => {
    if (passwordValidation.strength === "strong") return "bg-emerald-500";
    if (passwordValidation.strength === "medium") return "bg-amber-500";
    return "bg-red-500";
  };

  const getStrengthWidth = () => {
    if (passwordValidation.strength === "strong") return "w-full";
    if (passwordValidation.strength === "medium") return "w-2/3";
    return "w-1/3";
  };

  const RequirementItem = ({met, text}) => (
    <div
      className={`flex items-center gap-2 py-1 ${
        met ? "text-emerald-600" : "text-gray-400"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
          met ? "bg-emerald-100" : "bg-gray-100"
        }`}
      >
        {met ? "✓" : "○"}
      </span>
      <span className="text-sm">{text}</span>
    </div>
  );

  // Save profile
  const handleSaveProfile = async () => {
    try {
      setError(null);
      setSuccess(null);

      let profileData = {
        full_name: profile.full_name,
        phone: profile.phone,
        email: profile.email,
        profile_image: profile.profile_image,
      };

      // If new image selected, use FormData to upload
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("full_name", profile.full_name);
        formData.append("phone", profile.phone);
        formData.append("email", profile.email);

        const response = await fetch(`${API_BASE}/api/admin/profile/upload`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setProfile({...profile, profile_image: data.profile_image});
          setImageFile(null);
          setSuccess("✓ Profile updated successfully!");
          if (onUpdate) onUpdate();
          setTimeout(() => onClose(), 1500);
        } else {
          setError("Failed to upload image");
        }
      } else {
        // No image, just update profile data
        const response = await fetch(`${API_BASE}/api/admin/profile/update`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(profileData),
        });

        if (response.ok) {
          setSuccess("✓ Profile updated successfully!");
          if (onUpdate) onUpdate();
          setTimeout(() => onClose(), 1500);
        } else {
          setError("Failed to update profile");
        }
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (passwordValidation.strength !== "strong") {
      setError("Password must be STRONG to be accepted!");
      return;
    }

    if (!isPasswordsMatch) {
      setError("Passwords do not match!");
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`${API_BASE}/api/admin/password/change`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({new_password: passwords.newPassword}),
      });

      if (response.ok) {
        setSuccess("✓ Password changed successfully!");
        setPasswords({newPassword: "", confirmPassword: ""});
        setTimeout(() => onClose(), 1500);
      } else {
        setError("Failed to change password");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
              ⚙️
            </span>
            Admin Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === "profile"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => {
              setActiveTab("profile");
              setError(null);
              setSuccess(null);
            }}
          >
            📝 Edit Profile
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === "password"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => {
              setActiveTab("password");
              setError(null);
              setSuccess(null);
            }}
          >
            🔐 Change Password
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-2 animate-slideDown">
              <span className="w-5 h-5 bg-red-100 rounded-md flex items-center justify-center text-xs">
                ⚠️
              </span>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm flex items-center gap-2 animate-slideDown">
              <span className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center text-xs">
                ✓
              </span>
              {success}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Username (Fixed)</label>
                <input
                  type="text"
                  value={profile.username}
                  disabled
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your username cannot be changed
                </p>
              </div>

              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  value={profile.full_name || ""}
                  onChange={(e) =>
                    setProfile({...profile, full_name: e.target.value})
                  }
                  placeholder="Enter your full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) =>
                    setProfile({...profile, email: e.target.value})
                  }
                  placeholder="your.email@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({...profile, phone: e.target.value})
                  }
                  placeholder="9999999999"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Profile Image</label>
                {imagePreview && (
                  <div className="mb-3 text-center p-4 bg-gray-50 rounded-md">
                    <img
                      src={imagePreview}
                      alt="Profile Preview"
                      className="w-24 h-24 rounded-md border-2 border-blue-500 object-cover mx-auto"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {imageFile ? imageFile.name : "Current image"}
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full p-3 border-2 border-dashed border-blue-300 rounded-md cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer"
                />
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, GIF - Max 5MB
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 py-3 px-4 bg-primary text-white font-medium rounded-md hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
                >
                  ✓ Save Profile
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">🔐</span>
                </div>
                <h3 className="font-semibold text-gray-900">
                  Create a Strong Password
                </h3>
                <p className="text-sm text-gray-500">
                  Your password must meet all requirements
                </p>
              </div>

              <div>
                <label className={labelClass}>New Password</label>
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({...passwords, newPassword: e.target.value})
                  }
                  placeholder="Enter a strong password"
                  className={inputClass}
                />
              </div>

              {/* Password Strength Indicator */}
              {passwords.newPassword && (
                <div className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStrengthColor()} ${getStrengthWidth()} transition-all duration-300`}
                    ></div>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      passwordValidation.strength === "strong"
                        ? "text-emerald-600"
                        : passwordValidation.strength === "medium"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    Strength: {passwordValidation.strength.toUpperCase()} (
                    {passwordValidation.passedRules}/6 met)
                  </p>
                </div>
              )}

              {/* Password Requirements */}
              {passwords.newPassword && (
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Password Requirements:
                  </h4>
                  <div className="grid grid-cols-1 gap-1">
                    <RequirementItem
                      met={passwordValidation.rules.length}
                      text={`At least 8 characters ${
                        !passwordValidation.rules.length
                          ? `(${passwords.newPassword.length})`
                          : ""
                      }`}
                    />
                    <RequirementItem
                      met={passwordValidation.rules.uppercase}
                      text="At least 1 uppercase letter (A–Z)"
                    />
                    <RequirementItem
                      met={passwordValidation.rules.lowercase}
                      text="At least 1 lowercase letter (a–z)"
                    />
                    <RequirementItem
                      met={passwordValidation.rules.number}
                      text="At least 1 number (0–9)"
                    />
                    <RequirementItem
                      met={passwordValidation.rules.special}
                      text="At least 1 special character (@ # $ % & ! _ -)"
                    />
                    <RequirementItem
                      met={passwordValidation.rules.noSpace}
                      text="No spaces allowed"
                    />
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              {passwordValidation.strength === "strong" && (
                <div className="animate-slideDown">
                  <label className={labelClass}>Confirm Password</label>
                  <input
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Re-enter your password"
                    className={`${inputClass} ${
                      passwords.confirmPassword
                        ? isPasswordsMatch
                          ? "border-emerald-500 ring-2 ring-emerald-500/20"
                          : "border-red-500 ring-2 ring-red-500/20"
                        : ""
                    }`}
                  />
                  {passwords.confirmPassword && (
                    <p
                      className={`text-xs mt-1 ${
                        isPasswordsMatch ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {isPasswordsMatch
                        ? "✓ Passwords match"
                        : "✗ Passwords do not match"}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleChangePassword}
                  disabled={
                    passwordValidation.strength !== "strong" ||
                    !isPasswordsMatch
                  }
                  className={`flex-1 py-3 px-4 font-medium rounded-md transition-all duration-200 ${
                    passwordValidation.strength === "strong" && isPasswordsMatch
                      ? "bg-primary text-white hover:shadow-lg hover:shadow-blue-500/25"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  🔐 Change Password
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
