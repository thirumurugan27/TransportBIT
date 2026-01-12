import React, {useState, useEffect} from "react";
import {
  User,
  Users,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Award,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Plus,
  Settings,
  X,
  Key,
  BadgeCheck,
  Grid,
  List,
  AlertTriangle,
  Clock,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'grid'
  const [filterStatus, setFilterStatus] = useState("all");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const initialFormState = {
    username: "",
    password: "", // Only for creation or password reset
    full_name: "",
    phone: "",
    email: "",
    license_number: "",
    license_type: "LMV",
    license_expiry: "",
    experience_years: 0,
    allowed_vehicle_type: "CAR",
    is_incharge: false,
    status: "ACTIVE",
  };

  const [driverForm, setDriverForm] = useState(initialFormState);

  // License expiry check (within 30 days)
  const isLicenseExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isLicenseExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const expiringLicenses = drivers.filter((d) =>
    isLicenseExpiringSoon(d.license_expiry)
  );
  const expiredLicenses = drivers.filter((d) =>
    isLicenseExpired(d.license_expiry)
  );

  // Stats
  const stats = [
    {
      label: "Total Drivers",
      value: drivers.length,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Active",
      value: drivers.filter((d) => d.status === "ACTIVE").length,
      icon: BadgeCheck,
      color: "bg-green/10 text-green",
    },
    {
      label: "On Leave",
      value: drivers.filter((d) => d.status === "LEAVE").length,
      icon: Calendar,
      color: "bg-pending/10 text-pending",
    },
    {
      label: "Incharges",
      value: drivers.filter((d) => d.is_incharge).length,
      icon: Award,
      color: "bg-primary/10 text-primary",
    },
  ];

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers`);
      const data = await res.json();
      setDrivers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (driver) => {
    setDriverForm({
      username: driver.username,
      password: "", // Keep empty to not change
      full_name: driver.full_name,
      phone: driver.phone,
      email: driver.email,
      license_number: driver.license_number,
      license_type: driver.license_type,
      license_expiry: driver.license_expiry,
      experience_years: driver.experience_years,
      allowed_vehicle_type: driver.allowed_vehicle_type,
      is_incharge: driver.is_incharge,
      status: driver.status,
    });
    setEditId(driver.id);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this driver?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers/delete?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDrivers();
      } else {
        alert("Failed to delete driver");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...driverForm,
        experience_years: parseInt(driverForm.experience_years),
      };

      let url = `${API_BASE}/api/admin/drivers/create`;
      let method = "POST";

      if (isEditing) {
        url = `${API_BASE}/api/admin/drivers/update?id=${editId}`;
        method = "PUT";
        // If password is empty in edit mode, remove it from payload so it doesn't get overwritten
        if (!payload.password) delete payload.password;
      }

      const res = await fetch(url, {
        method: method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setDriverForm(initialFormState);
        setIsEditing(false);
        setEditId(null);
        fetchDrivers();
      } else {
        const err = await res.json();
        alert("Failed: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Error saving driver");
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setDriverForm(initialFormState);
    setIsEditing(false);
    setEditId(null);
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      (d.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.phone.includes(searchTerm) ||
        d.license_number.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus === "all" || d.status === filterStatus)
  );

  return (
    <div className="space-y-6">
      {/* License Expiry Alert */}
      {(expiredLicenses.length > 0 || expiringLicenses.length > 0) && (
        <div className="bg-red/5 border border-red/20 rounded-md p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-red/10 rounded-md flex items-center justify-center text-red shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-red text-sm">License Expiry Alert</h4>
            <p className="text-sm text-secondarytext mt-1">
              {expiredLicenses.length > 0 && (
                <span className="text-red font-medium">
                  {expiredLicenses.length} expired
                </span>
              )}
              {expiredLicenses.length > 0 &&
                expiringLicenses.length > 0 &&
                " • "}
              {expiringLicenses.length > 0 && (
                <span className="text-pending font-medium">
                  {expiringLicenses.length} expiring within 30 days
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {[...expiredLicenses, ...expiringLicenses]
                .slice(0, 5)
                .map((d) => (
                  <span
                    key={d.id}
                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                      isLicenseExpired(d.license_expiry)
                        ? "bg-red/10 text-red"
                        : "bg-pending/10 text-pending"
                    }`}
                  >
                    {d.full_name}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-secondarybg p-5 rounded-md shadow-sm border border-gray-100 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-secondarytext uppercase tracking-wider">
                {stat.label}
              </p>
              <h3 className="text-2xl font-black text-primarytext mt-1">
                {stat.value}
              </h3>
            </div>
            <div className={`p-3 rounded-md ${stat.color}`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search drivers..."
              className="w-full pl-10 pr-4 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-secondarybg text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-primarybg border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="LEAVE">On Leave</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-primarybg rounded-md p-1 border border-gray-200">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-white shadow-sm"
                  : "text-secondarytext hover:text-primary"
              }`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-white shadow-sm"
                  : "text-secondarytext hover:text-primary"
              }`}
            >
              <Grid size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primarydull text-white px-5 py-2.5 rounded-md flex items-center gap-2 shadow-md shadow-primary/30 transition-all text-sm font-bold"
          >
            <Plus size={18} /> Add New Driver
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primarybg border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-secondarytext">
              <Users size={48} className="mx-auto mb-3 opacity-20" />
              <p>No drivers found matching your search.</p>
            </div>
          ) : (
            filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                className={`bg-secondarybg p-5 rounded-md shadow-sm border transition-all hover:shadow-md ${
                  isLicenseExpired(driver.license_expiry)
                    ? "border-red/30"
                    : isLicenseExpiringSoon(driver.license_expiry)
                    ? "border-pending/30"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                      {driver.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-primarytext">
                        {driver.full_name}
                      </h3>
                      <p className="text-xs text-secondarytext flex items-center gap-1">
                        <User size={10} /> {driver.username}
                        {driver.is_incharge && (
                          <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold">
                            INCHARGE
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      driver.status === "ACTIVE"
                        ? "bg-green/10 text-green"
                        : driver.status === "LEAVE"
                        ? "bg-pending/10 text-pending"
                        : "bg-gray-100 text-secondarytext"
                    }`}
                  >
                    {driver.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-secondarytext mb-4">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    {driver.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Award size={14} className="text-gray-400" />
                    {driver.license_number} • {driver.license_type}
                  </div>
                  <div
                    className={`flex items-center gap-2 ${
                      isLicenseExpired(driver.license_expiry)
                        ? "text-red font-medium"
                        : isLicenseExpiringSoon(driver.license_expiry)
                        ? "text-pending font-medium"
                        : ""
                    }`}
                  >
                    <Clock size={14} className="text-gray-400" />
                    Exp: {driver.license_expiry}
                    {isLicenseExpired(driver.license_expiry) && " (Expired!)"}
                    {isLicenseExpiringSoon(driver.license_expiry) && " (Soon)"}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-secondarytext">
                    {driver.experience_years} Years Exp
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(driver)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(driver.id)}
                      className="p-2 text-red hover:bg-red/10 rounded-md transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-secondarybg rounded-md shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[var(--color-primary)] rounded-full mb-4"></div>
              <p>Loading drivers directory...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      License Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Experience
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDrivers.map((driver) => (
                    <tr
                      key={driver.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm">
                            {driver.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {driver.full_name}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <User size={10} /> {driver.username}
                              {driver.is_incharge && (
                                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
                                  INCHARGE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400" />
                            {driver.phone}
                          </div>
                          {driver.email && (
                            <div className="flex items-center gap-2">
                              <Mail size={14} className="text-gray-400" />
                              {driver.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="font-medium">
                          {driver.license_number}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                          <span className="bg-gray-100 px-1.5 rounded">
                            {driver.license_type}
                          </span>
                          <span>Exp: {driver.license_expiry}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Award size={14} className="text-gray-400" />
                          {driver.experience_years} Years
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1
                        ${
                          driver.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : driver.status === "LEAVE"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              driver.status === "ACTIVE"
                                ? "bg-green-500"
                                : driver.status === "LEAVE"
                                ? "bg-orange-500"
                                : "bg-gray-500"
                            }`}
                          ></span>
                          {driver.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(driver)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDrivers.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        <Users size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No drivers found matching your search.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-[var(--color-primary)]/10 p-2 rounded-lg">
                  {isEditing ? (
                    <Edit2 className="text-[var(--color-primary)]" size={20} />
                  ) : (
                    <User className="text-[var(--color-primary)]" size={20} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  {isEditing ? "Edit Driver Details" : "Register New Driver"}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                {/* Personal Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                    <User size={16} /> Personal Information
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        value={driverForm.full_name}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            full_name: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.phone}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.email}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        value={driverForm.status}
                        onChange={(e) =>
                          setDriverForm({...driverForm, status: e.target.value})
                        }
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="LEAVE">On Leave</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Professional Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                    <Award size={16} /> Professional Details
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License Number
                      </label>
                      <input
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        value={driverForm.license_number}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            license_number: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.license_type}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              license_type: e.target.value,
                            })
                          }
                        >
                          <option value="LMV">LMV (Light)</option>
                          <option value="HMV">HMV (Heavy)</option>
                          <option value="MCWG">MCWG (Moto)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.license_expiry}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              license_expiry: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Experience (Yrs)
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.experience_years}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              experience_years: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role Perms
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          value={driverForm.allowed_vehicle_type}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              allowed_vehicle_type: e.target.value,
                            })
                          }
                        >
                          <option value="CAR">Car Only</option>
                          <option value="BUS">Bus Driver</option>
                          <option value="EV">EV / Van</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={driverForm.is_incharge}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              is_incharge: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-indigo-700">
                          Assign as Bus Incharge?
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Account Section - Full Width */}
                <div className="lg:col-span-2 pt-4 border-t">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Key size={16} /> Account Credentials
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        required
                        disabled={isEditing}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                          isEditing
                            ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                            : ""
                        }`}
                        value={driverForm.username}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            username: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isEditing ? "New Password (Optional)" : "Password"}
                      </label>
                      <input
                        type="password"
                        required={!isEditing}
                        placeholder={
                          isEditing ? "Leave blank to keep current" : ""
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        value={driverForm.password}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            password: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 shadow-sm transition-all font-medium text-sm flex items-center gap-2"
                >
                  {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                  {isEditing
                    ? "Update Driver Details"
                    : "Create Driver Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
