import React, {useState, useEffect} from "react";
import {useSearchParams} from "react-router-dom";
import Loading from "../../../components/ui/Loading";
import {
  User,
  Users,
  Calendar,
  Phone,
  Mail,
  Award,
  Search,
  Edit2,
  Trash2,
  Plus,
  X,
  Key,
  BadgeCheck,
  Grid,
  List,
  AlertTriangle,
  Clock,
  FileText,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  fetchVehicleTypes,
  toVehicleTypeLabel,
} from "../../../utils/vehicleTypes";

import {apiGet, apiPost, apiPut, apiDelete} from "../../../utils/api";

export default function AdminDrivers() {
  const {showToast} = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drivers, setDrivers] = useState([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "all",
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const initialFormState = {
    username: "",
    password: "",
    full_name: "",
    phone: "",
    email: "",
    license_number: "",
    license_type: "LMV",
    license_expiry: "",
    date_of_joining: "",
    date_of_relieving: "",
    experience_years: 0,
    allowed_vehicle_type: "CAR",
    status: "ACTIVE",
  };

  const [driverForm, setDriverForm] = useState(initialFormState);

  const isLicenseExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const parts = expiryDate.split("-");
    if (parts.length !== 3) return false;
    const expiry = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isLicenseExpired = (expiryDate) => {
    if (!expiryDate) return false;
    const parts = expiryDate.split("-");
    if (parts.length !== 3) return false;
    const expiry = new Date(parts[2], parts[1] - 1, parts[0]);
    return expiry < new Date();
  };

  const expiringLicenses = drivers.filter((d) =>
    isLicenseExpiringSoon(d.license_expiry),
  );
  const expiredLicenses = drivers.filter((d) =>
    isLicenseExpired(d.license_expiry),
  );

  const stats = [
    {
      label: "Total Drivers",
      value: drivers.length,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Present",
      value: drivers.filter((d) => d.status === "present").length,
      icon: BadgeCheck,
      color: "bg-freen/10 text-freen",
    },
    {
      label: "Absent",
      value: drivers.filter((d) => d.status === "absent").length,
      icon: AlertTriangle,
      color: "bg-red/10 text-red",
    },
    {
      label: "On Leave",
      value: drivers.filter((d) => d.status === "on_leave").length,
      icon: Calendar,
      color: "bg-pending/10 text-pending",
    },
    {
      label: "Not Marked",
      value: drivers.filter((d) => d.status === "not_marked").length,
      icon: Clock,
      color: "bg-primarybg text-secondarytext",
    },
  ];

  useEffect(() => {
    fetchDrivers();
    fetchAllowedVehicleTypes();
  }, []);

  const fetchAllowedVehicleTypes = async () => {
    const masterTypes = await fetchVehicleTypes();
    const mapped = masterTypes.map((t) => ({
      value: t.type,
      label: t.label || toVehicleTypeLabel(t.type),
    }));
    if (mapped.length > 0) {
      setVehicleTypeOptions(mapped);
    }
  };

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/api/admin/drivers");
      const data = await res.json();
      setDrivers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const handleRowClick = (driver) => {
    setSelectedDriver(driver);
    setShowDetailsModal(true);
  };

  const handleEditFromDetails = () => {
    if (!selectedDriver) return;
    setDriverForm({
      username: selectedDriver.username || "",
      password: "",
      full_name: selectedDriver.full_name,
      phone: selectedDriver.phone,
      email: selectedDriver.email,
      license_number: selectedDriver.license_number,
      license_type: selectedDriver.license_type,
      license_expiry: formatDateForInput(selectedDriver.license_expiry),
      date_of_joining: formatDateForInput(selectedDriver.date_of_joining),
      date_of_relieving: selectedDriver.date_of_relieving
        ? formatDateForInput(selectedDriver.date_of_relieving)
        : "",
      experience_years: selectedDriver.experience_years,
      allowed_vehicle_type: selectedDriver.allowed_vehicle_type,
      status: selectedDriver.status,
    });
    setEditId(selectedDriver.id);
    setIsEditing(true);
    setShowDetailsModal(false);
    setShowCreateModal(true);
  };

  const handleDeleteFromDetails = async () => {
    if (!selectedDriver) return;
    if (
      !confirm(`Are you sure you want to delete ${selectedDriver.full_name}?`)
    )
      return;

    try {
      const res = await apiDelete(
        `/api/admin/drivers/delete?id=${selectedDriver.id}`,
      );
      if (res.ok) {
        showToast("Driver deleted successfully", "success");
        setShowDetailsModal(false);
        fetchDrivers();
      } else {
        showToast("Failed to delete driver", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error deleting driver", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...driverForm,
        experience_years: parseInt(driverForm.experience_years),
      };

      let endpoint = "/api/admin/drivers/create";

      if (isEditing) {
        endpoint = `/api/admin/drivers/update?id=${editId}`;
        if (!payload.password) delete payload.password;
      }

      const res = isEditing
        ? await apiPut(endpoint, payload)
        : await apiPost(endpoint, payload);

      if (res.ok) {
        showToast(
          isEditing
            ? "Driver updated successfully"
            : "Driver created successfully",
          "success",
        );
        setShowCreateModal(false);
        setDriverForm(initialFormState);
        setIsEditing(false);
        setEditId(null);
        fetchDrivers();
      } else {
        const err = await res.json();
        showToast("Failed: " + (err.error || "Unknown error"), "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error saving driver", "error");
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
      (filterStatus === "all" || d.status === filterStatus),
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* License Expiry Alert */}
      {(expiredLicenses.length > 0 || expiringLicenses.length > 0) && (
        <div className="bg-red/5 border-l-4 border-red rounded-md p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red/10 rounded-md flex items-center justify-center text-red shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-red text-base mb-1">
                License Expiry Alert
              </h4>
              <p className="text-sm text-secondarytext">
                {expiredLicenses.length > 0 && (
                  <span className="text-red font-semibold">
                    {expiredLicenses.length} expired
                  </span>
                )}
                {expiredLicenses.length > 0 &&
                  expiringLicenses.length > 0 &&
                  " • "}
                {expiringLicenses.length > 0 && (
                  <span className="text-pending font-semibold">
                    {expiringLicenses.length} expiring within 30 days
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-secondarybg p-6 rounded-md border border-primarybg hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-secondarytext uppercase tracking-wider mb-2">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-extrabold text-primarytext">
                  {stat.value}
                </h3>
              </div>
              <div className={`p-3 rounded-md ${stat.color} shadow-sm`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondarybg p-5 rounded-md border border-primarybg shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name, phone, or license..."
              className="w-full pl-10 pr-4 py-3 bg-primarybg border border-primarybg/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm font-medium transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <CustomDropdown
            value={filterStatus}
            onChange={(val) => {
              setFilterStatus(val);
              if (val === "all") {
                searchParams.delete("status");
              } else {
                searchParams.set("status", val);
              }
              setSearchParams(searchParams);
            }}
            options={[
              {value: "all", label: "All Status"},
              {value: "present", label: "Present"},
              {value: "absent", label: "Absent"},
              {value: "on_leave", label: "On Leave"},
              {value: "not_marked", label: "Not Marked"},
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-primarybg rounded-md p-1.5 border border-primarybg shadow-sm">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2.5 rounded-md transition-all duration-200 ${
                viewMode === "table"
                  ? "bg-primary text-secondarybg shadow-md"
                  : "text-secondarytext hover:text-primary hover:bg-primarybg"
              }`}
            >
              <List size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 rounded-md transition-all duration-200 ${
                viewMode === "grid"
                  ? "bg-primary text-secondarybg shadow-md"
                  : "text-secondarytext hover:text-primary hover:bg-primarybg"
              }`}
            >
              <Grid size={18} strokeWidth={2.5} />
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primarydull text-secondarybg px-6 py-3 rounded-md flex items-center gap-2 shadow-lg shadow-primary/30 transition-all duration-300 text-sm font-bold hover:scale-105"
          >
            <Plus size={18} strokeWidth={2.5} /> Add Driver
          </button>
        </div>
      </div>

      {/* Card View */}
      {viewMode === "grid" ? (
        <div className="space-y-4">
          {loading ? (
            <Loading fullScreen={false} />
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-12 text-secondarytext">
              <Users size={48} className="mx-auto mb-3 opacity-20" />
              <p>No drivers found</p>
            </div>
          ) : (
            filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                onClick={() => handleRowClick(driver)}
                className="bg-secondarybg p-5 rounded-md border border-primarybg hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-between gap-6"
              >
                {/* Left: Driver Info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-md bg-gradient-to-br from-primary to-primarydull flex items-center justify-center text-white">
                    <User size={28} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primarytext">
                      {driver.full_name}
                    </h3>
                    <p className="text-sm text-secondarytext">
                      {driver.license_number}
                    </p>
                  </div>
                </div>

                {/* Middle: License & Experience */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-primary/10 text-primary rounded-md text-sm font-semibold">
                      {driver.license_type}
                    </span>
                    <div className="text-sm text-secondarytext">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-primary" />
                        {driver.phone}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-secondarytext">
                    <div className="flex items-center gap-2">
                      <Award size={14} className="text-primary" />
                      {driver.experience_years} Years Exp
                    </div>
                  </div>

                  {driver.date_of_joining && (
                    <div className="text-sm text-secondarytext">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-primary" />
                        Joined: {driver.date_of_joining}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Status & Driver Name */}
                <div className="flex items-center gap-4">
                  <span
                    className={`px-4 py-2 rounded-md text-sm font-semibold ${
                      driver.status === "present"
                        ? "bg-freen/10 text-freen"
                        : driver.status === "absent"
                          ? "bg-red/10 text-red"
                          : driver.status === "on_leave"
                            ? "bg-pending/10 text-pending"
                            : "bg-primarybg text-secondarytext"
                    }`}
                  >
                    {driver.status === "not_marked"
                      ? "Not Marked"
                      : driver.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Table View - Proper Table with Headers */
        <div className="bg-secondarybg rounded-md shadow-sm overflow-hidden border border-primarybg">
          {loading ? (
            <Loading fullScreen={false} />
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-12 text-secondarytext">
              <Users size={48} className="mx-auto mb-3 opacity-20" />
              <p>No drivers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primarybg border-b border-primarybg">
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      License
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Experience
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Joining Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primarybg/30">
                  {filteredDrivers.map((driver) => (
                    <tr
                      key={driver.id}
                      onClick={() => handleRowClick(driver)}
                      className="hover:bg-primarybg/50 transition-all duration-200 cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary to-primarydull flex items-center justify-center text-white text-sm font-bold">
                            {driver.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-primarytext">
                              {driver.full_name}
                            </p>
                            <p className="text-xs text-secondarytext">
                              ID: #{driver.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="flex items-center gap-2 text-primarytext">
                            <Phone size={14} className="text-primary" />
                            <span>{driver.phone}</span>
                          </div>
                          {driver.email && (
                            <div className="flex items-center gap-2 text-secondarytext mt-1">
                              <Mail size={14} className="text-primary" />
                              <span className="truncate max-w-[150px]">
                                {driver.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-primarytext">
                            {driver.license_number}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-semibold">
                            {driver.license_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Award size={16} className="text-primary" />
                          <span className="font-medium text-primarytext">
                            {driver.experience_years} Years
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-primarytext">
                          {driver.date_of_joining || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                              driver.status === "present"
                                ? "bg-freen/10 text-freen"
                                : driver.status === "absent"
                                  ? "bg-red/10 text-red"
                                  : driver.status === "on_leave"
                                    ? "bg-pending/10 text-pending"
                                    : "bg-primarybg text-secondarytext"
                            }`}
                          >
                            {driver.status === "not_marked"
                              ? "Not Marked"
                              : driver.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Driver Details Modal */}
      {showDetailsModal && selectedDriver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4 animate-fadeIn"
          onClick={() => setShowDetailsModal(false)}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl max-w-2xl w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-primarybg/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-md bg-primary flex items-center justify-center text-secondarybg shadow-lg">
                    <User size={28} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      {selectedDriver.full_name}
                    </h2>
                    <p className="text-sm text-secondarytext">
                      {selectedDriver.license_number} • Driver
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Information */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Personal Information
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">Phone</span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.phone}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">Email</span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.email || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Username
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.username || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* License Information */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      License Information
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        License Number
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.license_number}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        License Type
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.license_type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Expiry Date
                      </span>
                      <span
                        className={`text-sm font-semibold ${isLicenseExpired(selectedDriver.license_expiry) ? "text-red" : "text-primarytext"}`}
                      >
                        {selectedDriver.license_expiry}
                        {isLicenseExpired(selectedDriver.license_expiry) &&
                          " (Expired)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Employment Details */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Award size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Employment Details
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Experience
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.experience_years} Years
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Date of Joining
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.date_of_joining || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Date of Relieving
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.date_of_relieving || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Allowed Vehicle Type
                      </span>
                      <span className="text-sm font-semibold text-primarytext">
                        {selectedDriver.allowed_vehicle_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Status
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-secondarytext">
                        Current Status
                      </span>
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-semibold ${
                          selectedDriver.status === "present"
                            ? "bg-freen/20 text-freen"
                            : selectedDriver.status === "absent"
                              ? "bg-red/20 text-red"
                              : selectedDriver.status === "on_leave"
                                ? "bg-pending/20 text-pending"
                                : "bg-primarybg text-secondarytext"
                        }`}
                      >
                        {selectedDriver.status === "not_marked"
                          ? "Not Marked"
                          : selectedDriver.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-primarybg flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors font-semibold text-sm"
              >
                Close
              </button>
              <button
                onClick={handleDeleteFromDetails}
                className="px-5 py-2.5 bg-red/10 text-red rounded-md hover:bg-red/20 transition-colors font-semibold text-sm flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <button
                onClick={handleEditFromDetails}
                className="px-5 py-2.5 bg-primary text-white rounded-md hover:bg-primarydull transition-colors font-semibold text-sm flex items-center gap-2"
              >
                <Edit2 size={16} />
                Edit Driver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-secondarybg rounded-md shadow-2xl w-full max-w-4xl my-8 animate-scaleIn">
            {/* Header */}
            <div className="p-6 border-b border-primarybg/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-md bg-primary">
                    {isEditing ? (
                      <Edit2 className="text-secondarybg" size={24} />
                    ) : (
                      <User className="text-secondarybg" size={24} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primarytext">
                      {isEditing ? "Edit Driver" : "Add New Driver"}
                    </h2>
                    <p className="text-sm text-secondarytext">
                      {isEditing
                        ? "Update driver information"
                        : "Create a new driver account"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="text-secondarytext hover:text-primarytext rounded-md p-2 hover:bg-primarybg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Personal Information */}
                {/* Personal Information */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Personal Information
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        Full Name *
                      </label>
                      <input
                        required
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        value={driverForm.full_name}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            full_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Phone *
                        </label>
                        <input
                          required
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
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
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
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
                  </div>
                </div>

                {/* License Information */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      License Information
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        License Number *
                      </label>
                      <input
                        required
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                        value={driverForm.license_number}
                        onChange={(e) =>
                          setDriverForm({
                            ...driverForm,
                            license_number: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Type *
                        </label>
                        <CustomDropdown
                          isWhite
                          value={driverForm.license_type}
                          onChange={(val) =>
                            setDriverForm({
                              ...driverForm,
                              license_type: val,
                            })
                          }
                          options={[
                            {value: "LMV", label: "LMV"},
                            {value: "HMV", label: "HMV"},
                            {value: "MCWG", label: "MCWG"},
                          ]}
                          width="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Expiry Date *
                        </label>
                        <input
                          type="date"
                          required
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
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
                  </div>
                </div>

                {/* Employment Details */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Award size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Employment Details
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Experience (Years) *
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
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
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Vehicle Type *
                        </label>
                        <CustomDropdown
                          isWhite
                          value={driverForm.allowed_vehicle_type}
                          onChange={(val) =>
                            setDriverForm({
                              ...driverForm,
                              allowed_vehicle_type: val,
                            })
                          }
                          options={vehicleTypeOptions}
                          width="w-full"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Date of Joining
                        </label>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          value={driverForm.date_of_joining}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              date_of_joining: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-primarytext mb-1">
                          Date of Relieving
                        </label>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
                          value={driverForm.date_of_relieving}
                          onChange={(e) =>
                            setDriverForm({
                              ...driverForm,
                              date_of_relieving: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Credentials */}
                <div className="bg-primarybg rounded-md p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Key size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-secondarytext uppercase tracking-wider">
                      Account Credentials
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        Username *
                      </label>
                      <input
                        required
                        disabled={isEditing}
                        className={`w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium ${
                          isEditing ? "opacity-50 cursor-not-allowed" : ""
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
                      <label className="block text-sm font-semibold text-primarytext mb-1">
                        {isEditing ? "New Password (Optional)" : "Password *"}
                      </label>
                      <input
                        type="password"
                        required={!isEditing}
                        placeholder={
                          isEditing ? "Leave blank to keep current" : ""
                        }
                        className="w-full px-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-secondarybg text-primarytext font-medium"
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

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-primarybg">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors font-semibold text-sm"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                  {isEditing ? "Update Driver" : "Create Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
