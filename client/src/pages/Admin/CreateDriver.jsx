import React, {useState} from "react";
import {X, User, Shield, Settings} from "lucide-react";
import {useToast} from "../../context/ToastContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function CreateDriver({onClose}) {
  const {showToast} = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    phone: "",
    email: "",
    license_number: "",
    license_type: "HEAVY",
    license_expiry: "",
    experience_years: "",
    allowed_vehicle_type: "BUS",
    home_vehicle_id: "",
    home_stop_id: "",
    is_incharge: false,
  });

  const handleChange = (e) => {
    const {name, value, type, checked} = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const submitDriver = async () => {
    if (!form.username || !form.password || !form.full_name) {
      showToast("Username, password and name are required", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers/create`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          ...form,
          experience_years: Number(form.experience_years || 0),
          home_vehicle_id: form.home_vehicle_id
            ? Number(form.home_vehicle_id)
            : null,
          home_stop_id: form.home_stop_id ? Number(form.home_stop_id) : null,
        }),
      });

      if (res.ok) {
        showToast("Driver created successfully", "success");
        onClose();
      } else {
        const text = await res.text();
        showToast(`Failed (${res.status}): ${text}`, "error");
      }
    } catch (err) {
      showToast("Server error: " + err.message, "error");
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 text-sm bg-gray-50/50 hover:bg-white";
  const selectClass =
    "w-full px-4 py-3 border border-gray-200 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 text-sm bg-gray-50/50 hover:bg-white cursor-pointer";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Create New Driver
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Add a new driver to the system
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          {/* Account Details Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              Account Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Username *</label>
                <input
                  name="username"
                  placeholder="Enter username"
                  value={form.username}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  name="full_name"
                  placeholder="Enter full name"
                  value={form.full_name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    name="phone"
                    placeholder="Phone number"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    name="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* License Details Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                <Shield size={16} className="text-emerald-600" />
              </div>
              License Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>License Number</label>
                <input
                  name="license_number"
                  placeholder="Enter license number"
                  value={form.license_number}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>License Type</label>
                  <select
                    name="license_type"
                    value={form.license_type}
                    onChange={handleChange}
                    className={selectClass}
                  >
                    <option value="HEAVY">Heavy License</option>
                    <option value="LIGHT">Light License</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>License Expiry</label>
                  <input
                    type="date"
                    name="license_expiry"
                    value={form.license_expiry}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Experience (Years)</label>
                  <input
                    type="number"
                    name="experience_years"
                    placeholder="Years"
                    value={form.experience_years}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Vehicle Type</label>
                  <select
                    name="allowed_vehicle_type"
                    value={form.allowed_vehicle_type}
                    onChange={handleChange}
                    className={selectClass}
                  >
                    <option value="BUS">Bus</option>
                    <option value="CAR">Car</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Details */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
                <Settings size={16} className="text-purple-600" />
              </div>
              Additional Settings
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Home Vehicle ID</label>
                  <input
                    name="home_vehicle_id"
                    placeholder="Optional"
                    value={form.home_vehicle_id}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Home Stop ID</label>
                  <input
                    name="home_stop_id"
                    placeholder="Optional"
                    value={form.home_stop_id}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  name="is_incharge"
                  checked={form.is_incharge}
                  onChange={handleChange}
                  className="w-5 h-5 rounded-md border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    In-Charge Role
                  </span>
                  <p className="text-xs text-gray-500">
                    Grant in-charge permissions to this driver
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={submitDriver}
            className="flex-1 px-4 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-all duration-200 font-semibold shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-xl"
          >
            Create Driver
          </button>
        </div>
      </div>
    </div>
  );
}
