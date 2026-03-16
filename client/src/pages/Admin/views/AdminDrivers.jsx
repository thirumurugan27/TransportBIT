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
  Upload,
  Link2,
  CheckCircle2,
  FileSpreadsheet,
  HardDriveUpload,
} from "lucide-react";
import {useToast} from "../../../context/ToastContext";
import CustomDropdown from "../../../components/ui/CustomDropdown";
import {
  fetchVehicleTypes,
  toVehicleTypeLabel,
} from "../../../utils/vehicleTypes";

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
} from "../../../utils/api";

const bulkTemplateHeaders = [
  "full_name",
  "phone",
  "email",
  "license_number",
  "license_type",
  "license_expiry",
  "experience_years",
  "date_of_joining",
  "date_of_relieving",
  "allowed_vehicle_type",
];

const bulkTemplateFilePath = "/templates/driver_bulk_upload_example.csv";

export default function AdminDrivers() {
  const {showToast} = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drivers, setDrivers] = useState([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "all",
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [bulkSheetUrl, setBulkSheetUrl] = useState("");
  const [bulkSourceType, setBulkSourceType] = useState("google");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);

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
      color: "bg-green/10 text-green",
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

  const getVehicleTypeDisplay = (type) => {
    if (!type) return "-";
    const matched = vehicleTypeOptions.find((option) => option.value === type);
    return matched?.label || toVehicleTypeLabel(type) || type;
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

  const resetBulkUploadState = () => {
    setBulkSourceType("google");
    setBulkSheetUrl("");
    setBulkFile(null);
    setBulkPreview(null);
    setBulkPreviewLoading(false);
    setBulkImportLoading(false);
  };

  const closeBulkUploadModal = () => {
    setShowBulkUploadModal(false);
    resetBulkUploadState();
  };

  const handleCopyTemplateHeaders = async () => {
    try {
      if (!navigator?.clipboard) {
        showToast("Clipboard is not available in this browser", "error");
        return;
      }
      await navigator.clipboard.writeText(bulkTemplateHeaders.join(","));
      showToast("Template headers copied", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to copy template headers", "error");
    }
  };

  const handleBulkFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setBulkFile(selectedFile);
    setBulkPreview(null);
  };

  const handleBulkPreviewGoogle = async () => {
    const sheetUrl = bulkSheetUrl.trim();
    if (!sheetUrl) {
      showToast("Paste a Google Sheet URL to continue", "error");
      return;
    }

    setBulkPreviewLoading(true);
    try {
      const res = await apiPost("/api/admin/drivers/bulk-preview", {
        sheet_url: sheetUrl,
      });
      const data = await res.json();

      if (!res.ok) {
        setBulkPreview(data.preview || null);
        showToast(data.error || "Unable to validate the sheet", "error");
        return;
      }

      setBulkPreview(data);
      if (data.invalid_rows > 0) {
        showToast(
          `${data.invalid_rows} row(s) need attention before import`,
          "error",
        );
      } else {
        showToast(`${data.ready_rows} row(s) are ready to import`, "success");
      }
    } catch (error) {
      console.error(error);
      setBulkPreview(null);
      showToast("Unable to validate Google Sheet", "error");
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkPreviewFile = async () => {
    if (!bulkFile) {
      showToast("Choose an Excel or CSV file to continue", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", bulkFile);

    setBulkPreviewLoading(true);
    try {
      const res = await apiUpload(
        "/api/admin/drivers/bulk-preview-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        setBulkPreview(data.preview || null);
        showToast(data.error || "Unable to validate file", "error");
        return;
      }

      setBulkPreview(data);
      if (data.invalid_rows > 0) {
        showToast(
          `${data.invalid_rows} row(s) need attention before import`,
          "error",
        );
      } else {
        showToast(`${data.ready_rows} row(s) are ready to import`, "success");
      }
    } catch (error) {
      console.error(error);
      setBulkPreview(null);
      showToast("Unable to validate file", "error");
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkPreview = async () => {
    if (bulkSourceType === "file") {
      await handleBulkPreviewFile();
      return;
    }
    await handleBulkPreviewGoogle();
  };

  const handleBulkImportGoogle = async () => {
    const sheetUrl = bulkSheetUrl.trim();
    if (!sheetUrl) {
      showToast("Paste a Google Sheet URL to continue", "error");
      return;
    }

    setBulkImportLoading(true);
    try {
      const res = await apiPost("/api/admin/drivers/bulk-import", {
        sheet_url: sheetUrl,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.preview) {
          setBulkPreview(data.preview);
        }
        showToast(data.error || "Bulk import failed", "error");
        return;
      }

      showToast(data.message || "Drivers imported successfully", "success");
      fetchDrivers();
      closeBulkUploadModal();
    } catch (error) {
      console.error(error);
      showToast("Google Sheet import failed", "error");
    } finally {
      setBulkImportLoading(false);
    }
  };

  const handleBulkImportFile = async () => {
    if (!bulkFile) {
      showToast("Choose an Excel or CSV file to continue", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", bulkFile);

    setBulkImportLoading(true);
    try {
      const res = await apiUpload(
        "/api/admin/drivers/bulk-import-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        if (data.preview) {
          setBulkPreview(data.preview);
        }
        showToast(data.error || "File import failed", "error");
        return;
      }

      showToast(data.message || "Drivers imported successfully", "success");
      fetchDrivers();
      closeBulkUploadModal();
    } catch (error) {
      console.error(error);
      showToast("File import failed", "error");
    } finally {
      setBulkImportLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (bulkSourceType === "file") {
      await handleBulkImportFile();
      return;
    }
    await handleBulkImportGoogle();
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
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className="bg-primarybg hover:bg-primary/10 text-primary px-6 py-3 rounded-md flex items-center gap-2 border border-primary/20 transition-all duration-300 text-sm font-bold"
          >
            <Upload size={18} strokeWidth={2.5} /> Bulk Upload
          </button>
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

      {/* Card Grid View */}
      {viewMode === "grid" ? (
        <div>
          {loading ? (
            <Loading fullScreen={false} />
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-16 text-secondarytext">
              <Users size={52} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">No drivers found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  onClick={() => handleRowClick(driver)}
                  className="bg-secondarybg border-2 border-gray-300 rounded-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden group"
                >
                  {/* Card Top – colored band + status */}
                  <div className="relative h-20 bg-primary/10 flex items-end px-5 pb-0">
                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                        driver.status === "present"
                          ? "bg-green/15 text-green"
                          : driver.status === "absent"
                            ? "bg-red/15 text-red"
                            : driver.status === "on_leave"
                              ? "bg-pending/15 text-pending"
                              : "bg-primarybg text-secondarytext"
                      }`}
                    >
                      {driver.status === "not_marked"
                        ? "Not Marked"
                        : driver.status.charAt(0).toUpperCase() +
                          driver.status.slice(1).replace("_", " ")}
                    </span>
                    {/* Avatar overlapping the band */}
                    <div className="w-14 h-14 rounded-md bg-primary flex items-center justify-center text-white shadow-md translate-y-7 border-2 border-secondarybg">
                      <span className="text-xl font-extrabold">
                        {driver.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="pt-10 px-5 pb-5">
                    {/* Name & license number */}
                    <h3 className="text-base font-bold text-primarytext truncate">
                      {driver.full_name}
                    </h3>
                    <p className="text-xs text-secondarytext font-mono mt-0.5 truncate">
                      {driver.license_number}
                    </p>

                    {/* License type badge */}
                    <span className="inline-block mt-3 px-3 py-1 bg-primary/10 text-primary rounded-md text-xs font-bold tracking-wide">
                      {driver.license_type}
                    </span>

                    {/* Divider */}
                    <div className="my-4 border-t border-primarybg" />

                    {/* Info rows */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-sm text-secondarytext">
                        <Phone size={13} className="text-primary shrink-0" />
                        <span className="truncate">{driver.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-secondarytext">
                        <Award size={13} className="text-primary shrink-0" />
                        <span>{driver.experience_years} Years Experience</span>
                      </div>
                      {driver.date_of_joining && (
                        <div className="flex items-center gap-2 text-sm text-secondarytext">
                          <Calendar
                            size={13}
                            className="text-primary shrink-0"
                          />
                          <span>Joined {driver.date_of_joining}</span>
                        </div>
                      )}
                    </div>

                    {/* License expiry warning */}
                    {(isLicenseExpired(driver.license_expiry) ||
                      isLicenseExpiringSoon(driver.license_expiry)) && (
                      <div
                        className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                          isLicenseExpired(driver.license_expiry)
                            ? "bg-red/10 text-red"
                            : "bg-pending/10 text-pending"
                        }`}
                      >
                        <AlertTriangle size={12} />
                        {isLicenseExpired(driver.license_expiry)
                          ? "License Expired"
                          : "Expiring Soon"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-white text-sm font-bold">
                            {driver.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-primarytext">
                              {driver.full_name}
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
                              <span className="truncate max-w-37.5">
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
                                ? "bg-green/10 text-green"
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
                            ? "bg-green/20 text-green"
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

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 animate-fadeIn"
          onClick={closeBulkUploadModal}
        >
          <div
            className="bg-secondarybg rounded-md shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden animate-scaleIn flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-primarybg/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <HardDriveUpload size={18} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-primarytext leading-tight">
                    Bulk Upload Drivers
                  </h2>
                  <p className="text-xs text-secondarytext mt-0.5">
                    Import from Google Sheets or a local Excel / CSV file
                  </p>
                </div>
              </div>
              <button
                onClick={closeBulkUploadModal}
                className="w-8 h-8 flex items-center justify-center rounded-md text-secondarytext hover:text-primarytext hover:bg-primarybg transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-6 space-y-5">
                {/* Source selector */}
                <div className="flex items-center gap-2 p-1 bg-primarybg rounded-md w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSourceType("google");
                      setBulkPreview(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                      bulkSourceType === "google"
                        ? "bg-primary text-white shadow-sm"
                        : "text-secondarytext hover:text-primarytext"
                    }`}
                  >
                    <Link2 size={14} />
                    Google Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSourceType("file");
                      setBulkPreview(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                      bulkSourceType === "file"
                        ? "bg-primary text-white shadow-sm"
                        : "text-secondarytext hover:text-primarytext"
                    }`}
                  >
                    <FileSpreadsheet size={14} />
                    Local File
                  </button>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-5">
                  {/* Left column */}
                  <div className="space-y-4">
                    {/* Input section */}
                    <div className="border border-primarybg rounded-md p-5 bg-primarybg/30">
                      <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider mb-3">
                        {bulkSourceType === "google"
                          ? "Sheet URL"
                          : "Upload File"}
                      </p>
                      {bulkSourceType === "google" ? (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Link2
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondarytext pointer-events-none"
                              />
                              <input
                                type="url"
                                value={bulkSheetUrl}
                                onChange={(e) =>
                                  setBulkSheetUrl(e.target.value)
                                }
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                className="w-full pl-9 pr-4 py-2.5 border border-primarybg rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-secondarybg text-sm text-primarytext placeholder:text-secondarytext/60 transition-colors"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleBulkPreview}
                              disabled={
                                bulkPreviewLoading ||
                                bulkImportLoading ||
                                !bulkSheetUrl.trim()
                              }
                              className="px-4 py-2.5 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {bulkPreviewLoading ? "Validating…" : "Validate"}
                            </button>
                          </div>
                          <p className="text-xs text-secondarytext">
                            Ensure the sheet is publicly accessible or CSV
                            export requires no sign-in.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="flex flex-col items-center gap-3 p-5 border-2 border-dashed border-primarybg rounded-md cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group">
                            <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <Upload size={18} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-primarytext">
                                {bulkFile
                                  ? bulkFile.name
                                  : "Drop your file here or click to browse"}
                              </p>
                              <p className="text-xs text-secondarytext mt-0.5">
                                Supports .xlsx, .xlsm, .csv
                              </p>
                            </div>
                            <input
                              type="file"
                              accept=".xlsx,.xlsm,.xltx,.xltm,.csv"
                              onChange={handleBulkFileChange}
                              className="sr-only"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleBulkPreview}
                            disabled={
                              bulkPreviewLoading ||
                              bulkImportLoading ||
                              !bulkFile
                            }
                            className="w-full py-2.5 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {bulkPreviewLoading
                              ? "Validating…"
                              : "Validate File"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Template */}
                    <div className="border border-primarybg rounded-md p-5 bg-primarybg/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={15} className="text-primary" />
                          <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider">
                            Required Headers
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={bulkTemplateFilePath}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            <FileText size={12} />
                            Download CSV
                          </a>
                          <button
                            type="button"
                            onClick={handleCopyTemplateHeaders}
                            className="px-3 py-1.5 text-xs font-semibold text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            Copy Headers
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {bulkTemplateHeaders.map((header) => (
                          <span
                            key={header}
                            className="px-2.5 py-1 rounded-md bg-secondarybg border border-primarybg text-xs font-medium text-primarytext"
                          >
                            {header}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-secondarytext mt-3">
                        Phone and license number must be unique. Replace sample
                        values before importing.
                      </p>
                    </div>

                    {/* Steps */}
                    <div className="border border-primarybg rounded-md p-5 bg-primarybg/30">
                      <p className="text-xs font-semibold text-secondarytext uppercase tracking-wider mb-4">
                        How it works
                      </p>
                      <ol className="space-y-3">
                        {[
                          bulkSourceType === "google"
                            ? "Make the Google Sheet publicly accessible (anyone with link)."
                            : "Prepare your .xlsx or .csv with one driver per row.",
                          "Use the exact header names shown above in the first row.",
                          bulkSourceType === "google"
                            ? "Paste the URL above and click Validate, then Import."
                            : "Select the file above, click Validate, then Import.",
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-primary text-secondarybg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-secondarytext leading-snug">
                              {step}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Right column – Import Summary */}
                  <div className="border border-primarybg rounded-md bg-secondarybg p-5 flex flex-col gap-4">
                    {/* Panel header */}
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet
                        size={15}
                        className="text-primary shrink-0"
                      />
                      <p className="text-xs font-bold text-secondarytext uppercase tracking-widest">
                        Import Summary
                      </p>
                    </div>

                    {bulkPreview ? (
                      <>
                        {/* Stat row */}
                        <div className="grid grid-cols-3 divide-x divide-primarybg border border-primarybg rounded-md overflow-hidden">
                          <div className="flex flex-col items-center justify-center py-4 px-2 bg-primarybg/30">
                            <p className="text-2xl font-black text-primarytext leading-none tabular-nums">
                              {bulkPreview.total_rows}
                            </p>
                            <p className="text-[11px] font-semibold text-secondarytext mt-1.5 uppercase tracking-wide">
                              Total
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center py-4 px-2 bg-green/5">
                            <p className="text-2xl font-black text-green leading-none tabular-nums">
                              {bulkPreview.ready_rows}
                            </p>
                            <p className="text-[11px] font-semibold text-green/60 mt-1.5 uppercase tracking-wide">
                              Ready
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center py-4 px-2 bg-red/5">
                            <p className="text-2xl font-black text-red leading-none tabular-nums">
                              {bulkPreview.invalid_rows}
                            </p>
                            <p className="text-[11px] font-semibold text-red/60 mt-1.5 uppercase tracking-wide">
                              Invalid
                            </p>
                          </div>
                        </div>

                        {/* Status banner */}
                        <div
                          className={`flex items-center gap-3 pl-5 pr-4 py-3 rounded-md relative overflow-hidden ${
                            bulkPreview.invalid_rows > 0
                              ? "bg-red/5"
                              : "bg-green/5"
                          }`}
                        >
                          {/* left accent bar */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 ${
                              bulkPreview.invalid_rows > 0
                                ? "bg-red"
                                : "bg-green"
                            }`}
                          />
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                              bulkPreview.invalid_rows > 0
                                ? "bg-red/15 text-red"
                                : "bg-green/15 text-green"
                            }`}
                          >
                            {bulkPreview.invalid_rows > 0 ? (
                              <AlertTriangle size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primarytext leading-tight">
                              {bulkPreview.invalid_rows > 0
                                ? "Fix issues before import"
                                : "Ready to import"}
                            </p>
                            <p className="text-xs text-secondarytext mt-0.5">
                              {bulkPreview.invalid_rows > 0
                                ? "Fix highlighted rows, then validate again."
                                : "All rows passed validation."}
                            </p>
                          </div>
                        </div>

                        {/* Source */}
                        {bulkPreview.csv_url && (
                          <div className="px-4 py-3 rounded-md border border-primarybg bg-primarybg/30">
                            <p className="text-[11px] font-bold text-secondarytext uppercase tracking-widest mb-1.5">
                              Source
                            </p>
                            <p className="text-xs text-primarytext break-all leading-relaxed">
                              {bulkPreview.csv_url}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-10 rounded-md border border-dashed border-primarybg/80 bg-primarybg/20 min-h-48">
                        <div className="w-11 h-11 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                          <Upload size={20} className="text-primary/50" />
                        </div>
                        <p className="text-sm font-bold text-primarytext mb-1">
                          No data yet
                        </p>
                        <p className="text-xs text-secondarytext max-w-44 leading-relaxed">
                          Validate your file or sheet to see a summary here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row preview table */}
                {bulkPreview && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-primarytext">
                        Row Preview
                      </h3>
                      <p className="text-xs text-secondarytext mt-0.5">
                        Review each row. Only fully valid sheets can be
                        imported.
                      </p>
                    </div>

                    <div className="border border-primarybg rounded-md overflow-hidden">
                      <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-primarybg border-b border-primarybg/80">
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider w-16">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Driver
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Contact
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Vehicle
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider w-24">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-secondarytext uppercase tracking-wider">
                                Issues
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-primarybg/40 bg-secondarybg">
                            {bulkPreview.rows.map((row) => (
                              <tr
                                key={row.row_number}
                                className={`align-top transition-colors ${
                                  !row.is_valid
                                    ? "bg-red/5"
                                    : "hover:bg-primarybg/30"
                                }`}
                              >
                                <td className="px-4 py-3 text-xs font-bold text-secondarytext">
                                  {row.row_number}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-primarytext text-sm leading-tight">
                                    {row.full_name || "—"}
                                  </p>
                                  <p className="text-xs text-secondarytext mt-0.5">
                                    {row.license_number || "No license"}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-primarytext">
                                    {row.phone || "—"}
                                  </p>
                                  <p className="text-xs text-secondarytext mt-0.5">
                                    {row.email || "No email"}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-sm text-primarytext">
                                  {getVehicleTypeDisplay(
                                    row.allowed_vehicle_type,
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                                      row.is_valid
                                        ? "bg-green/10 text-green"
                                        : "bg-red/10 text-red"
                                    }`}
                                  >
                                    {row.is_valid ? "Ready" : "Fix"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {row.errors?.length ? (
                                    <ul className="space-y-0.5">
                                      {row.errors.map((error) => (
                                        <li
                                          key={`${row.row_number}-${error}`}
                                          className="text-xs text-red flex items-start gap-1"
                                        >
                                          <span className="mt-0.5 shrink-0">
                                            •
                                          </span>
                                          {error}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-xs text-green font-medium">
                                      No issues
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-primarybg/60 bg-secondarybg">
              <button
                type="button"
                onClick={closeBulkUploadModal}
                className="px-4 py-2.5 text-sm font-semibold text-secondarytext hover:text-primarytext hover:bg-primarybg rounded-md transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkPreview}
                  disabled={
                    bulkPreviewLoading ||
                    bulkImportLoading ||
                    (bulkSourceType === "google"
                      ? !bulkSheetUrl.trim()
                      : !bulkFile)
                  }
                  className="px-4 py-2.5 border border-primary/25 text-primary rounded-md hover:bg-primary/10 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkPreviewLoading
                    ? "Validating…"
                    : bulkSourceType === "google"
                      ? "Validate Sheet"
                      : "Validate File"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={
                    bulkImportLoading ||
                    bulkPreviewLoading ||
                    !bulkPreview ||
                    bulkPreview.invalid_rows > 0 ||
                    bulkPreview.ready_rows === 0
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-secondarybg rounded-md hover:bg-primarydull transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={14} />
                  {bulkImportLoading ? "Importing…" : "Import Drivers"}
                </button>
              </div>
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
